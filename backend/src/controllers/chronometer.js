const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const User = require('../models/user');
const Role = require('../models/role');
const Workplace = require('../models/workplace');
const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
const TimerEvent = require('../models/timer_event');
const OperationTimeTotal = require('../models/operation_time_total');
const config = require('../config/config');
const { getShiftDateString, computeTotalsFromEvents } = require('../lib/timerEventTotals');

function normalizeWorkplaceArea(workplaceName) {
  const area = String(workplaceName || '').trim().toUpperCase();
  if (area === 'ME' || area === 'ES') return area;
  // Sandbox legacy: IN / ALL = full plant visibility (ME + ES)
  if (area === 'ALL' || area === 'BOTH' || area === 'IN') return 'BOTH';
  return 'UNKNOWN';
}

/** Area used for OT search and start permission: admins always see both areas. */
function resolveEffectiveUserArea(currentUser) {
  const roleName =
    currentUser && currentUser.Role && currentUser.Role.name
      ? String(currentUser.Role.name).trim().toLowerCase()
      : '';
  if (roleName === 'admin') return 'BOTH';
  return normalizeWorkplaceArea(currentUser.Workplace && currentUser.Workplace.name);
}

async function getCurrentUser(req) {
  return User.findOne({
    where: { id: req.userId },
    include: [Role, Workplace]
  });
}

/**
 * Operario: pause/stop/resume solo en la misma terminal (cabecera x-station-id ↔ timer.station_id).
 * Timer sin station_id (datos viejos): solo quien tiene current_user_id.
 * Sin cabecera de terminal: mismo criterio que antes (solo current_user_id).
 */
function operarioMayControlTimer(req, timer) {
  if (!timer) return false;
  if (req.stationId) {
    if (timer.station_id && timer.station_id === req.stationId) return true;
    if (!timer.station_id && Number(timer.current_user_id) === Number(req.userId)) return true;
    return false;
  }
  return Number(timer.current_user_id) === Number(req.userId);
}

function normalizeTimerMode(input, fallback = 'RUN') {
  const mode = String(input || '').trim().toUpperCase();
  if (mode === 'SETUP') return 'SETUP';
  if (mode === 'RUN') return 'RUN';
  return fallback;
}

async function assertTimerControlOrRespond(req, timer, res) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    res.status(401).json({ message: 'Invalid user.' });
    return false;
  }
  const roleName =
    currentUser.Role && currentUser.Role.name
      ? String(currentUser.Role.name).trim().toLowerCase()
      : '';
  if (roleName === 'admin') return true;
  if (operarioMayControlTimer(req, timer)) return true;
  res.status(403).json({ message: 'Este cronómetro pertenece a otra terminal.' });
  return false;
}

async function appendEvent({ timerId, operationId, userId, eventType, details }) {
  return TimerEvent.create({
    operation_timer_id: timerId,
    work_order_operation_id: operationId,
    user_id: userId,
    event_type: eventType,
    event_at: new Date(),
    details_json: details ? JSON.stringify(details) : null
  });
}

function accumulateElapsedSeconds(timer) {
  if (!timer || !timer.active_since) return timer ? (timer.total_elapsed_seconds || 0) : 0;
  const startMs = new Date(timer.active_since).getTime();
  const nowMs = Date.now();
  const deltaSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  return Math.max(0, (timer.total_elapsed_seconds || 0) + deltaSeconds);
}

async function consolidateShiftForOperation(operationId, shiftDate) {
  const allEvents = await TimerEvent.findAll({
    where: { work_order_operation_id: operationId },
    order: [['event_at', 'ASC']]
  });

  const shiftEvents = allEvents.filter((event) => getShiftDateString(event.event_at) === shiftDate);
  const totals = computeTotalsFromEvents(shiftEvents);

  await OperationTimeTotal.upsert({
    work_order_operation_id: operationId,
    shift_date: shiftDate,
    total_active_seconds: totals.total_active_seconds,
    total_pause_seconds: totals.total_pause_seconds,
    sync_status: 'PENDING',
    retry_count: 0,
    last_error: null,
    last_consolidated_at: new Date()
  });
}

async function runShiftClose(trigger = 'manual', options = {}) {
  const shiftDate = getShiftDateString(new Date());
  const activeOrPausedTimers = await OperationTimer.findAll({
    where: {
      status: { [Op.in]: ['ACTIVE', 'PAUSED'] }
    }
  });

  const affectedOperationIds = new Set();
  for (const timer of activeOrPausedTimers) {
    affectedOperationIds.add(timer.work_order_operation_id);
    if (timer.status === 'ACTIVE') {
      timer.total_elapsed_seconds = accumulateElapsedSeconds(timer);
    }
    await appendEvent({
      timerId: timer.id,
      operationId: timer.work_order_operation_id,
      userId: timer.current_user_id || null,
      eventType: 'AUTO_STOP_SHIFT_END',
      details: {
        trigger,
        timezone: config.NS_TIMEZONE,
        shift_date: shiftDate
      }
    });

    timer.status = 'STOPPED';
    timer.active_since = null;
    timer.last_event_at = new Date();
    await timer.save();
  }

  for (const operationId of affectedOperationIds) {
    await consolidateShiftForOperation(operationId, shiftDate);
  }

  const result = {
    shiftDate,
    stoppedTimers: activeOrPausedTimers.length,
    consolidatedOperations: affectedOperationIds.size
  };

  const shouldRunNetsuiteSync = options && options.skipNetsuiteSync === true
    ? false
    : config.NETSUITE_PUSH_ON_SHIFT_CLOSE;

  if (trigger === 'scheduler') {
    const { logSchedulerShiftCloseOperational } = require('./netsuiteSync');
    const logOutcome = await logSchedulerShiftCloseOperational(result, {
      // Contrato: la sincronización automática es el MISMO flujo que la manual (STOP->PUSH->WAIT->PULL).
      // El scheduler se registra solo si NS_SHIFT_BATCH_ENABLED + NS_AUTO_STOP_AT_SHIFT_END, por lo que aquí
      // siempre intentamos ejecutar fases NetSuite (si está configurado). Si no, queda trazado como ERROR en el log.
      runNetSuitePhases: true
    });
    result.operationalSyncLog = logOutcome;
    if (logOutcome.netsuiteSync) {
      result.netsuiteSyncEnabled = true;
      result.netsuiteSync = logOutcome.netsuiteSync;
    } else if (logOutcome.netsuiteSyncError) {
      result.netsuiteSyncEnabled = logOutcome.netsuiteSyncEnabled === true;
      result.netsuiteSyncError = logOutcome.netsuiteSyncError;
    } else {
      result.netsuiteSyncEnabled = false;
    }
  } else if (shouldRunNetsuiteSync) {
    try {
      const { runOfficialSyncFlow } = require('./netsuiteSync');
      result.netsuiteSync = await runOfficialSyncFlow();
      result.netsuiteSyncEnabled = true;
    } catch (error) {
      result.netsuiteSyncEnabled = true;
      result.netsuiteSyncError = error.message || String(error);
      console.error('NetSuite official sync after shift close failed:', error.message || error);
    }
  } else {
    result.netsuiteSyncEnabled = false;
  }

  return result;
}

function resolveAreaFromResource(resourceCode) {
  const code = String(resourceCode || '').trim().toUpperCase();
  if (code.startsWith('ME')) return 'ME';
  if (code.startsWith('ES')) return 'ES';
  return null;
}

function toSafeMinutes(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function computeLiveModeSeconds(timer) {
  if (!timer) return { setupSeconds: 0, runSeconds: 0 };
  if (String(timer.status || '').toUpperCase() !== 'ACTIVE') {
    return { setupSeconds: 0, runSeconds: 0 };
  }
  if (!timer.active_since) return { setupSeconds: 0, runSeconds: 0 };

  const startMs = new Date(timer.active_since).getTime();
  if (!Number.isFinite(startMs)) return { setupSeconds: 0, runSeconds: 0 };

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const mode = normalizeTimerMode(timer.timer_mode, 'RUN');
  if (mode === 'SETUP') {
    return { setupSeconds: elapsedSeconds, runSeconds: 0 };
  }
  return { setupSeconds: 0, runSeconds: elapsedSeconds };
}

async function buildEventTotalsByOperationIds(operationIds) {
  const ids = Array.from(
    new Set(
      (operationIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  const totalsByOpId = new Map();
  if (ids.length === 0) return totalsByOpId;

  const allEvents = await TimerEvent.findAll({
    where: { work_order_operation_id: { [Op.in]: ids } },
    order: [['work_order_operation_id', 'ASC'], ['event_at', 'ASC']]
  });

  const grouped = new Map();
  for (const ev of allEvents) {
    const opId = Number(ev.work_order_operation_id);
    if (!Number.isInteger(opId)) continue;
    if (!grouped.has(opId)) grouped.set(opId, []);
    grouped.get(opId).push(ev);
  }

  for (const opId of ids) {
    const totals = computeTotalsFromEvents(grouped.get(opId) || []);
    totalsByOpId.set(opId, {
      setupSeconds: Math.max(0, Number(totals.total_setup_seconds || 0)),
      runSeconds: Math.max(0, Number(totals.total_run_seconds || 0))
    });
  }

  return totalsByOpId;
}

function mergeOperationActualsForView(operationPlain, timer, eventTotalsByOpId) {
  const op = operationPlain ? { ...operationPlain } : {};
  const opId = Number(op.id);
  const eventTotals = Number.isInteger(opId) ? eventTotalsByOpId.get(opId) : null;
  const liveTotals = computeLiveModeSeconds(timer);

  const setupDeltaSeconds =
    Math.max(0, Number((eventTotals && eventTotals.setupSeconds) || 0)) + liveTotals.setupSeconds;
  const runDeltaSeconds =
    Math.max(0, Number((eventTotals && eventTotals.runSeconds) || 0)) + liveTotals.runSeconds;

  const baseSetupMinutes = toSafeMinutes(op.actual_setup_time);
  const baseRunMinutes = toSafeMinutes(op.actual_run_time);
  const setupDeltaMinutes = Math.max(0, Math.floor(setupDeltaSeconds / 60));
  const runDeltaMinutes = Math.max(0, Math.floor(runDeltaSeconds / 60));

  op.actual_setup_time = baseSetupMinutes + setupDeltaMinutes;
  op.actual_run_time = baseRunMinutes + runDeltaMinutes;
  return op;
}

/**
 * Lista operaciones del área del usuario con estado de cronómetro (misma pantalla que en main: "Listado de procesos").
 * Debe existir la ruta GET /chronometer/operations ANTES de /chronometer/operations/:otNumber.
 */
exports.listOperations = async function listOperations(req, res) {
  const statusFilter = String(req.query.status || 'ALL').toUpperCase();
  const allowed = ['ALL', 'ACTIVE', 'PAUSED', 'STOPPED'];
  if (!allowed.includes(statusFilter)) {
    return res.status(400).json({ message: 'status debe ser ALL, ACTIVE, PAUSED o STOPPED.' });
  }

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const userArea = resolveEffectiveUserArea(currentUser);
  if (userArea === 'UNKNOWN') return res.status(400).json({ message: 'User area is not configured.' });

  const areaFilter = userArea === 'BOTH' ? ['ME', 'ES'] : [userArea];
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));

  const operations = await WorkOrderOperation.findAll({
    where: { area: { [Op.in]: areaFilter } },
    order: [
      ['ot_number', 'ASC'],
      ['operation_sequence', 'ASC']
    ],
    limit
  });

  let timers = [];
  if (operations.length > 0) {
    timers = await OperationTimer.findAll({
      where: {
        work_order_operation_id: { [Op.in]: operations.map((op) => op.id) }
      }
    });
  }
  const timerByOperationId = new Map(timers.map((timer) => [timer.work_order_operation_id, timer]));
  const eventTotalsByOpId = await buildEventTotalsByOperationIds(operations.map((op) => op.id));
  let rows = operations.map((operation) => {
    const op = operation.toJSON();
    const timer = timerByOperationId.get(operation.id);
    const elapsed = timer ? accumulateElapsedSeconds(timer) : 0;
    const opWithComputedActuals = mergeOperationActualsForView(op, timer, eventTotalsByOpId);
    return {
      ...opWithComputedActuals,
      status: timer ? timer.status : 'STOPPED',
      elapsed_seconds: elapsed
    };
  });

  if (statusFilter !== 'ALL') {
    rows = rows.filter((r) => r.status === statusFilter);
  }

  return res.status(200).json({
    userArea,
    status: statusFilter,
    count: rows.length,
    operations: rows
  });
};

exports.getOperationsByOt = async function getOperationsByOt(req, res) {
  const rawOt = String(req.params.otNumber || '').trim();
  const normalizedDigits = rawOt.replace(/[^0-9]/g, '');
  const otNumber = normalizedDigits ? `OT${normalizedDigits}` : rawOt.toUpperCase();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const userArea = resolveEffectiveUserArea(currentUser);
  if (userArea === 'UNKNOWN') return res.status(400).json({ message: 'User area is not configured.' });

  const areaFilter = userArea === 'BOTH' ? ['ME', 'ES'] : [userArea];

  const operations = await WorkOrderOperation.findAll({
    where: {
      ot_number: otNumber,
      area: { [Op.in]: areaFilter }
    },
    order: [['operation_sequence', 'ASC']]
  });

  // Evitar WHERE id IN () en SQL (MariaDB/MySQL falla) cuando no hay operaciones en el área del usuario.
  let timers = [];
  if (operations.length > 0) {
    timers = await OperationTimer.findAll({
      where: {
        work_order_operation_id: { [Op.in]: operations.map((op) => op.id) }
      }
    });
  }
  const timerByOperationId = new Map(timers.map((timer) => [timer.work_order_operation_id, timer]));
  const eventTotalsByOpId = await buildEventTotalsByOperationIds(operations.map((op) => op.id));
  const operationsWithState = operations.map((operation) => {
    const op = operation.toJSON();
    const timer = timerByOperationId.get(operation.id);
    const elapsed = timer ? accumulateElapsedSeconds(timer) : 0;
    const opWithComputedActuals = mergeOperationActualsForView(op, timer, eventTotalsByOpId);
    return {
      ...opWithComputedActuals,
      status: timer ? timer.status : 'STOPPED',
      elapsed_seconds: elapsed
    };
  });

  return res.status(200).json({
    otNumber,
    userArea,
    operations: operationsWithState
  });
};

exports.getActiveBoard = async function getActiveBoard(req, res) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const roleName =
    currentUser.Role && currentUser.Role.name
      ? String(currentUser.Role.name).trim().toLowerCase()
      : '';
  const isAdmin = roleName === 'admin';

  const where = {
    status: { [Op.in]: ['ACTIVE', 'PAUSED'] }
  };
  // Operario: cronómetros de ESTA terminal (cabecera x-station-id), no solo del usuario actual.
  // Compatibilidad: sin station_id en BD (null) se muestran solo los que inició este usuario.
  if (!isAdmin) {
    if (req.stationId) {
      where[Op.or] = [
        { station_id: req.stationId },
        {
          [Op.and]: [{ station_id: { [Op.is]: null } }, { current_user_id: req.userId }]
        }
      ];
    } else {
      where.current_user_id = req.userId;
    }
  }

  const timers = await OperationTimer.findAll({
    where,
    include: [WorkOrderOperation, User],
    order: [['updatedAt', 'DESC']]
  });
  const opIds = timers
    .map((timer) => Number(timer.work_order_operation_id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const eventTotalsByOpId = await buildEventTotalsByOperationIds(opIds);
  const rows = timers.map((timer) => {
    const plain = timer.toJSON();
    if (plain && plain.WorkOrderOperation) {
      plain.WorkOrderOperation = mergeOperationActualsForView(
        plain.WorkOrderOperation,
        timer,
        eventTotalsByOpId
      );
    }
    return plain;
  });

  return res.status(200).json(rows);
};

/**
 * Estado operativo para reporte admin (todas las operaciones WIP en ME/ES).
 * Orden de precedencia: Iniciado / Pausado / Terminado pend. sync / Detenido / No iniciado.
 */
function computeReportRowStatus(timer, hasPendingSync) {
  if (!timer) {
    if (hasPendingSync) {
      return { code: 'TERMINADO_PEND_SYNC', sort: 60, label: 'Terminado (pend. sinc.)' };
    }
    return { code: 'NO_INICIADO', sort: 10, label: 'No iniciado' };
  }
  const s = String(timer.status || '').toUpperCase();
  if (s === 'ACTIVE') return { code: 'INICIADO', sort: 30, label: 'Iniciado' };
  if (s === 'PAUSED') return { code: 'PAUSADO', sort: 40, label: 'Pausado' };
  if (s === 'STOPPED') {
    if (hasPendingSync) {
      return { code: 'TERMINADO_PEND_SYNC', sort: 60, label: 'Terminado (pend. sinc.)' };
    }
    return { code: 'DETENIDO', sort: 50, label: 'Detenido' };
  }
  return { code: 'DESCONOCIDO', sort: 99, label: s || '—' };
}

/**
 * Reporte admin: mismo universo que el WIP en MariaDB (operaciones por á ME/ES),
 * más estado de cronómetro y si hay totales pendientes de sincronizar.
 */
exports.getReportBoard = async function getReportBoard(req, res) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const roleName =
    currentUser.Role && currentUser.Role.name
      ? String(currentUser.Role.name).trim().toLowerCase()
      : '';
  if (roleName !== 'admin') {
    return res.status(403).json({ message: 'Solo administradores pueden ver el reporte.' });
  }

  const limit = Math.min(2000, Math.max(1, parseInt(String(req.query.limit || '500'), 10) || 500));

  const operations = await WorkOrderOperation.findAll({
    where: { area: { [Op.in]: ['ME', 'ES'] } },
    order: [
      ['ot_number', 'ASC'],
      ['operation_sequence', 'ASC']
    ],
    limit
  });

  const opIds = operations.map((o) => o.id);

  let timers = [];
  if (opIds.length > 0) {
    timers = await OperationTimer.findAll({
      where: { work_order_operation_id: { [Op.in]: opIds } },
      include: [{ model: User, required: false }]
    });
  }
  const timerByOpId = new Map(timers.map((t) => [t.work_order_operation_id, t]));

  const pendingSyncIds = new Set();
  if (opIds.length > 0) {
    const pendingTotals = await OperationTimeTotal.findAll({
      where: {
        work_order_operation_id: { [Op.in]: opIds },
        sync_status: 'PENDING'
      },
      attributes: ['work_order_operation_id']
    });
    pendingTotals.forEach((row) => pendingSyncIds.add(row.work_order_operation_id));
  }
  const eventTotalsByOpId = await buildEventTotalsByOperationIds(opIds);

  const rows = operations.map((operation) => {
    const op = operation.get({ plain: true });
    const timer = timerByOpId.get(operation.id);
    const opWithComputedActuals = mergeOperationActualsForView(op, timer, eventTotalsByOpId);
    const hasPendingSync = pendingSyncIds.has(operation.id);
    const st = computeReportRowStatus(timer, hasPendingSync);
    const mode = timer ? normalizeTimerMode(timer.timer_mode, 'RUN') : null;
    const u = timer && timer.User ? timer.User : null;
    const operator = u ? [u.name, u.lastname].filter(Boolean).join(' ').trim() : '';

    return {
      row_key: `${opWithComputedActuals.ot_number}|${opWithComputedActuals.operation_sequence}|${opWithComputedActuals.resource_code}`,
      ot_number: opWithComputedActuals.ot_number,
      operation_sequence: opWithComputedActuals.operation_sequence,
      operation_name: opWithComputedActuals.operation_name,
      resource_code: opWithComputedActuals.resource_code,
      area: opWithComputedActuals.area,
      planned_setup_minutes: opWithComputedActuals.planned_setup_minutes,
      planned_operation_minutes: opWithComputedActuals.planned_operation_minutes,
      planned_quantity: opWithComputedActuals.planned_quantity,
      actual_setup_time: opWithComputedActuals.actual_setup_time,
      actual_run_time: opWithComputedActuals.actual_run_time,
      completed_quantity: opWithComputedActuals.completed_quantity,
      netsuite_operation_id: opWithComputedActuals.netsuite_operation_id,
      source_status: opWithComputedActuals.source_status,
      last_synced_at: opWithComputedActuals.last_synced_at,
      report_status_code: st.code,
      report_status_label: st.label,
      report_status_sort: st.sort,
      timer_mode: mode,
      timer_mode_sort: mode === 'SETUP' ? 2 : mode === 'RUN' ? 1 : 0,
      station_id: timer ? timer.station_id : null,
      last_event_at: timer ? timer.last_event_at : null,
      total_elapsed_seconds: timer ? accumulateElapsedSeconds(timer) : null,
      operator: operator || null,
      sync_pending: hasPendingSync,
      sync_pending_sort: hasPendingSync ? 1 : 0
    };
  });

  return res.status(200).json({
    count: rows.length,
    rows
  });
};

exports.startTimer = async function startTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });
  const requestedMode = normalizeTimerMode(req.body && req.body.timer_mode, 'SETUP');

  const operation = await WorkOrderOperation.findByPk(work_order_operation_id);
  if (!operation) return res.status(404).json({ message: 'Operation not found.' });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const userArea = resolveEffectiveUserArea(currentUser);
  if (userArea === 'UNKNOWN') return res.status(400).json({ message: 'User area is not configured.' });
  if (userArea !== 'BOTH' && userArea !== operation.area) {
    return res.status(403).json({ message: 'Operation is outside your area.' });
  }

  const lockTimer = await OperationTimer.findOne({
    where: {
      resource_code: operation.resource_code,
      status: 'ACTIVE',
      work_order_operation_id: { [Op.ne]: operation.id }
    }
  });
  if (lockTimer) {
    return res.status(409).json({ message: 'Machine/resource already has an active operation.' });
  }

  let timer = await OperationTimer.findOne({
    where: { work_order_operation_id: operation.id }
  });

  if (!timer) {
    timer = await OperationTimer.create({
      work_order_operation_id: operation.id,
      resource_code: operation.resource_code,
      station_id: req.stationId || null,
      current_user_id: currentUser.id,
      status: 'ACTIVE',
      timer_mode: requestedMode,
      active_since: new Date(),
      last_event_at: new Date(),
      total_elapsed_seconds: 0,
      shift_date: new Date()
    });
  } else {
    if (timer.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Timer is already active.' });
    }
    // En PAUSA solo la misma terminal (o dueño legacy) puede reanudar con Play; evita secuestrar desde otro PC.
    if (timer.status === 'PAUSED') {
      if (!(await assertTimerControlOrRespond(req, timer, res))) return;
    }
    timer.current_user_id = currentUser.id;
    if (req.stationId) timer.station_id = req.stationId;
    timer.status = 'ACTIVE';
    timer.timer_mode = requestedMode;
    timer.active_since = new Date();
    timer.last_event_at = new Date();
    await timer.save();
  }

  await appendEvent({
    timerId: timer.id,
    operationId: operation.id,
    userId: currentUser.id,
    eventType: 'START',
    details: { resource_code: operation.resource_code, timer_mode: timer.timer_mode }
  });

  return res.status(200).json(timer);
};

exports.pauseTimer = async function pauseTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (timer.status !== 'ACTIVE') return res.status(400).json({ message: 'Only active timers can be paused.' });

  if (!(await assertTimerControlOrRespond(req, timer, res))) return;

  timer.status = 'PAUSED';
  timer.total_elapsed_seconds = accumulateElapsedSeconds(timer);
  timer.active_since = null;
  timer.last_event_at = new Date();
  await timer.save();

  await appendEvent({
    timerId: timer.id,
    operationId: timer.work_order_operation_id,
    userId: req.userId,
    eventType: 'PAUSE'
  });

  return res.status(200).json(timer);
};

exports.resumeTimer = async function resumeTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });
  const requestedMode = normalizeTimerMode(req.body && req.body.timer_mode, 'RUN');

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (timer.status !== 'PAUSED') return res.status(400).json({ message: 'Only paused timers can be resumed.' });

  if (!(await assertTimerControlOrRespond(req, timer, res))) return;

  const operation = await WorkOrderOperation.findByPk(work_order_operation_id);
  if (!operation) return res.status(404).json({ message: 'Operation not found.' });

  const lockTimer = await OperationTimer.findOne({
    where: {
      resource_code: operation.resource_code,
      status: 'ACTIVE',
      work_order_operation_id: { [Op.ne]: operation.id }
    }
  });
  if (lockTimer) {
    return res.status(409).json({ message: 'Machine/resource already has an active operation.' });
  }

  timer.status = 'ACTIVE';
  timer.timer_mode = requestedMode;
  timer.active_since = new Date();
  timer.last_event_at = new Date();
  timer.current_user_id = req.userId;
  if (req.stationId) timer.station_id = req.stationId;
  if (!Number.isFinite(timer.total_elapsed_seconds)) timer.total_elapsed_seconds = 0;
  await timer.save();

  await appendEvent({
    timerId: timer.id,
    operationId: timer.work_order_operation_id,
    userId: req.userId,
    eventType: 'RESUME',
    details: { timer_mode: timer.timer_mode }
  });

  return res.status(200).json(timer);
};

exports.stopTimer = async function stopTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (timer.status === 'STOPPED') return res.status(400).json({ message: 'Timer is already stopped.' });

  if (!(await assertTimerControlOrRespond(req, timer, res))) return;

  const rawQty = req.body && req.body.completed_quantity;
  let completedQtyToStore = null;
  if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
    const n = Number(rawQty);
    if (!Number.isInteger(n) || n < 0) {
      return res.status(400).json({ message: 'completed_quantity debe ser un entero mayor o igual a 0.' });
    }
    completedQtyToStore = n;
  }

  if (timer.status === 'ACTIVE') {
    timer.total_elapsed_seconds = accumulateElapsedSeconds(timer);
  }
  timer.status = 'STOPPED';
  timer.active_since = null;
  timer.last_event_at = new Date();
  await timer.save();

  if (completedQtyToStore !== null) {
    const operation = await WorkOrderOperation.findByPk(timer.work_order_operation_id);
    if (operation) {
      const previous = Number.isFinite(Number(operation.completed_quantity))
        ? Math.max(0, Math.floor(Number(operation.completed_quantity)))
        : 0;
      operation.completed_quantity = previous + completedQtyToStore;
      await operation.save();
    }
  }

  await appendEvent({
    timerId: timer.id,
    operationId: timer.work_order_operation_id,
    userId: req.userId,
    eventType: 'STOP',
    details:
      completedQtyToStore !== null
        ? { completed_quantity: completedQtyToStore }
        : undefined
  });

  return res.status(200).json(timer);
};

exports.switchTimerMode = async function switchTimerMode(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });
  const targetMode = normalizeTimerMode(req.body && req.body.timer_mode, null);
  if (!targetMode) {
    return res.status(400).json({ message: 'timer_mode debe ser RUN o SETUP.' });
  }

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (timer.status !== 'ACTIVE') {
    return res.status(400).json({ message: 'Only active timers can change mode.' });
  }
  if (!(await assertTimerControlOrRespond(req, timer, res))) return;

  const previousMode = normalizeTimerMode(timer.timer_mode, 'RUN');
  if (previousMode === targetMode) {
    return res.status(200).json({
      work_order_operation_id: timer.work_order_operation_id,
      timer_mode: previousMode,
      changed: false
    });
  }

  timer.timer_mode = targetMode;
  timer.last_event_at = new Date();
  await timer.save();

  await appendEvent({
    timerId: timer.id,
    operationId: timer.work_order_operation_id,
    userId: req.userId,
    eventType: 'MODE_CHANGE',
    details: {
      from_mode: previousMode,
      timer_mode: targetMode
    }
  });

  return res.status(200).json({
    work_order_operation_id: timer.work_order_operation_id,
    timer_mode: targetMode,
    changed: true
  });
};

exports.upsertWipOperations = async function upsertWipOperations(req, res) {
  const { operations } = req.body || {};
  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ message: 'operations array is required.' });
  }

  const sanitized = [];
  for (const op of operations) {
    const ot_number = String(op.ot_number || '').trim();
    const resource_code = String(op.resource_code || '').trim().toUpperCase();
    const operation_name = String(op.operation_name || '').trim();
    const operation_sequence = Number(op.operation_sequence);
    const inferredArea = resolveAreaFromResource(resource_code);
    const area = String(op.area || inferredArea || '').trim().toUpperCase();

    if (!ot_number || !resource_code || !operation_name || !Number.isFinite(operation_sequence)) {
      return res.status(400).json({ message: 'Each operation requires ot_number, operation_sequence, operation_name, resource_code.' });
    }
    if (!['ME', 'ES'].includes(area)) {
      return res.status(400).json({ message: `Invalid area for resource ${resource_code}. Use ME/ES.` });
    }

    sanitized.push({
      ot_number,
      operation_sequence,
      operation_code: op.operation_code || null,
      operation_name,
      resource_code,
      area,
      planned_setup_minutes: op.planned_setup_minutes ?? null,
      planned_operation_minutes: op.planned_operation_minutes ?? null,
      planned_quantity: op.planned_quantity ?? null,
      actual_setup_time: op.actual_setup_time ?? 0,
      actual_run_time: op.actual_run_time ?? 0,
      completed_quantity: op.completed_quantity ?? null,
      last_pushed_actual_run_time: op.last_pushed_actual_run_time ?? (op.actual_run_time ?? 0),
      last_pushed_completed_quantity: op.last_pushed_completed_quantity ?? (op.completed_quantity ?? 0),
      netsuite_work_order_id: op.netsuite_work_order_id || null,
      netsuite_operation_id: op.netsuite_operation_id || null,
      source_status: op.source_status || 'WIP',
      last_synced_at: new Date()
    });
  }

  await WorkOrderOperation.bulkCreate(sanitized, {
    updateOnDuplicate: [
      'operation_code',
      'operation_name',
      'area',
      'planned_setup_minutes',
      'planned_operation_minutes',
      'planned_quantity',
      'actual_setup_time',
      'actual_run_time',
      'completed_quantity',
      'last_pushed_actual_run_time',
      'last_pushed_completed_quantity',
      'netsuite_work_order_id',
      'netsuite_operation_id',
      'source_status',
      'last_synced_at',
      'updatedAt'
    ]
  });

  return res.status(200).json({
    message: 'WIP operations upserted.',
    total: sanitized.length
  });
};

/**
 * OT1…OT9: 4–8 ops cada una, ME/ES mezclado, nombres con CUAD A/B/… para validar cuadrantes.
 * Misma lógica que `backend/scripts/wip-upsert-ot1-9.json` (POST /chronometer/wip/upsert).
 */
function buildWipOperationsOt1To9QuadrantDemo() {
  const rows = [];
  const now = new Date();
  for (let i = 1; i <= 9; i += 1) {
    const numOps = 4 + ((i - 1) % 5);
    for (let j = 0; j < numOps; j += 1) {
      const area = (i - 1 + j) % 2 === 0 ? 'ES' : 'ME';
      const seq = (j + 1) * 10;
      const letter = String.fromCharCode(65 + j);
      rows.push({
        ot_number: `OT${i}`,
        operation_sequence: seq,
        operation_code: `${area}-${seq}`,
        operation_name: `OT${i} OP${j + 1} ${area} — CUAD ${letter}`,
        resource_code: `${area} OT${i} S${seq} ${letter}`.slice(0, 64),
        area,
        planned_setup_minutes: null,
        planned_operation_minutes: 30 + ((i * 3 + j * 7) % 90),
        planned_quantity: 1 + ((i + j) % 5),
        completed_quantity: 0,
        source_status: 'WIP',
        last_synced_at: now
      });
    }
  }
  return rows;
}

exports.seedWipSample = async function seedWipSample(req, res) {
  const sample = buildWipOperationsOt1To9QuadrantDemo();

  await WorkOrderOperation.bulkCreate(sample, {
    updateOnDuplicate: [
      'operation_code',
      'operation_name',
      'area',
      'planned_setup_minutes',
      'planned_operation_minutes',
      'planned_quantity',
      'completed_quantity',
      'source_status',
      'last_synced_at',
      'updatedAt'
    ]
  });

  const otNumbers = [...new Set(sample.map((s) => s.ot_number))].sort();

  return res.status(200).json({
    message: 'Sample WIP seeded.',
    total: sample.length,
    ot_numbers: otNumbers
  });
};

exports.importWipFromUpload = async function importWipFromUpload(req, res) {
  const filename = String((req.body && req.body.filename) || '').trim();
  if (!filename) return res.status(400).json({ message: 'filename is required.' });

  const candidatePaths = [
    path.resolve(__dirname, '../uploads', filename),
    path.resolve(__dirname, '../../src/uploads', filename)
  ];
  const uploadPath = candidatePaths.find((filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  });
  if (!uploadPath) {
    return res.status(400).json({
      message: 'Upload file not found in container.',
      file: filename
    });
  }
  let workbook;
  try {
    workbook = XLSX.readFile(uploadPath, { cellDates: true });
  } catch (error) {
    return res.status(400).json({ message: 'Unable to read upload file.' });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'Upload has no rows.' });
  }

  const byKey = new Map();
  for (const row of rows) {
    const otRaw = String(row['ZIM - Reloj OT'] || row['ZIM - Reloj OT Texto'] || '').trim();
    const otMatch = otRaw.match(/#?(OT\d+)/i);
    const ot_number = otMatch ? otMatch[1].toUpperCase() : null;

    const resource_code = String(row['ZIM - Reloj Tarea'] || '').trim().toUpperCase();
    const operation_sequence = Number(row['ZIM - Reloj Numero Secuencia']);
    const operation_name = String(row['ZIM - Reloj Operación'] || row['ZIM - Reloj Tarea Texto'] || resource_code || '').trim();
    const area = resolveAreaFromResource(resource_code);

    if (!ot_number || !resource_code || !Number.isFinite(operation_sequence) || !area) continue;

    const key = `${ot_number}__${operation_sequence}__${resource_code}`;
    const candidate = {
      ot_number,
      operation_sequence,
      operation_code: row['ZIM - Reloj Tarea Texto'] || null,
      operation_name,
      resource_code,
      area,
      planned_setup_minutes: null,
      planned_operation_minutes: row['ZIM - Reloj Tiempo Planificado'] != null ? Number(row['ZIM - Reloj Tiempo Planificado']) : null,
      planned_quantity: row['ZIM - Reloj Cantidad Producir'] != null ? Number(row['ZIM - Reloj Cantidad Producir']) : null,
      completed_quantity: row['ZIM - Reloj Cantidad Terminada'] != null ? Number(row['ZIM - Reloj Cantidad Terminada']) : null,
      netsuite_work_order_id: row['ZIM - Reloj OT ID'] != null ? String(row['ZIM - Reloj OT ID']) : null,
      netsuite_operation_id: row['ID'] != null ? String(row['ID']) : null,
      source_status: 'WIP',
      last_synced_at: new Date()
    };

    // Keep last row for the same business key.
    byKey.set(key, candidate);
  }

  const operations = Array.from(byKey.values());
  if (operations.length === 0) {
    return res.status(400).json({ message: 'No valid ME/ES operations found in upload.' });
  }

  await WorkOrderOperation.bulkCreate(operations, {
    updateOnDuplicate: [
      'operation_code',
      'operation_name',
      'area',
      'planned_setup_minutes',
      'planned_operation_minutes',
      'planned_quantity',
      'completed_quantity',
      'netsuite_work_order_id',
      'netsuite_operation_id',
      'source_status',
      'last_synced_at',
      'updatedAt'
    ]
  });

  return res.status(200).json({
    message: 'WIP operations imported from upload.',
    file: filename,
    total_rows: rows.length,
    imported_operations: operations.length
  });
};

exports.closeShiftBatch = async function closeShiftBatch(req, res) {
  const result = await runShiftClose('manual_api');
  return res.status(200).json({
    message: 'Shift close completed.',
    ...result
  });
};

exports.stopTimersBatch = async function stopTimersBatch(req, res) {
  const area = String((req.body && req.body.area) || 'ALL').trim().toUpperCase();
  if (!['ALL', 'ME', 'ES'].includes(area)) {
    return res.status(400).json({ message: 'area debe ser ALL, ME o ES.' });
  }

  const query = {
    where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } }
  };
  if (area !== 'ALL') {
    query.include = [{
      model: WorkOrderOperation,
      required: true,
      attributes: ['id', 'area'],
      where: { area }
    }];
  }

  const timers = await OperationTimer.findAll(query);
  let stoppedActive = 0;
  let stoppedPaused = 0;

  for (const timer of timers) {
    if (timer.status === 'ACTIVE') {
      timer.total_elapsed_seconds = accumulateElapsedSeconds(timer);
      stoppedActive += 1;
    } else if (timer.status === 'PAUSED') {
      stoppedPaused += 1;
    }

    await appendEvent({
      timerId: timer.id,
      operationId: timer.work_order_operation_id,
      userId: req.userId || null,
      eventType: 'AUTO_STOP_SHIFT_END',
      details: {
        trigger: 'admin_stop_batch',
        area
      }
    });

    timer.status = 'STOPPED';
    timer.active_since = null;
    timer.last_event_at = new Date();
    await timer.save();
  }

  return res.status(200).json({
    area,
    stoppedTimers: timers.length,
    stoppedActive,
    stoppedPaused
  });
};

exports.runShiftClose = runShiftClose;

exports.deleteOperation = async function deleteOperation(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid operation id.' });

  await OperationTimer.destroy({ where: { work_order_operation_id: id } });
  await TimerEvent.destroy({ where: { work_order_operation_id: id } });
  await OperationTimeTotal.destroy({ where: { work_order_operation_id: id } });

  const deleted = await WorkOrderOperation.destroy({ where: { id } });
  if (!deleted) return res.status(404).json({ message: 'Operation not found.' });

  return res.status(200).json({ message: 'Operation deleted.' });
};
