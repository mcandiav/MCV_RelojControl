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
const {
  resolveStationId,
  timerBelongsToViewerStation,
  assertTimerStationMatch,
  getBoardTimerWhere
} = require('../libs/stationContext');
const { assertOperatorPinForTimer } = require('../libs/timerPinAuth');

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

function getShiftDateString(date = new Date(), timeZone = config.NS_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function computeTotalsFromEvents(events) {
  let totalActiveMs = 0;
  let totalPauseMs = 0;
  let activeStart = null;
  let pauseStart = null;

  for (const event of events) {
    const at = new Date(event.event_at).getTime();
    if (!Number.isFinite(at)) continue;

    if (event.event_type === 'START' || event.event_type === 'RESUME') {
      if (pauseStart) {
        totalPauseMs += at - pauseStart;
        pauseStart = null;
      }
      if (!activeStart) activeStart = at;
      continue;
    }

    if (event.event_type === 'PAUSE') {
      if (activeStart) {
        totalActiveMs += at - activeStart;
        activeStart = null;
      }
      if (!pauseStart) pauseStart = at;
      continue;
    }

    if (event.event_type === 'STOP' || event.event_type === 'AUTO_STOP_SHIFT_END') {
      if (activeStart) {
        totalActiveMs += at - activeStart;
        activeStart = null;
      }
      if (pauseStart) {
        totalPauseMs += at - pauseStart;
        pauseStart = null;
      }
    }
  }

  return {
    total_active_seconds: Math.max(0, Math.floor(totalActiveMs / 1000)),
    total_pause_seconds: Math.max(0, Math.floor(totalPauseMs / 1000))
  };
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

async function runShiftClose(trigger = 'manual') {
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

  return {
    shiftDate,
    stoppedTimers: activeOrPausedTimers.length,
    consolidatedOperations: affectedOperationIds.size
  };
}

function resolveAreaFromResource(resourceCode) {
  const code = String(resourceCode || '').trim().toUpperCase();
  if (code.startsWith('ME')) return 'ME';
  if (code.startsWith('ES')) return 'ES';
  return null;
}

async function enrichOperationsWithTimerState(operations, viewerStationId) {
  if (!operations.length) return [];
  const ids = operations.map((op) => op.id);
  const timers = await OperationTimer.findAll({
    where: { work_order_operation_id: { [Op.in]: ids } }
  });
  const timerByOperationId = new Map(timers.map((timer) => [timer.work_order_operation_id, timer]));
  const sid = String(viewerStationId || '').trim();
  return operations.map((operation) => {
    const op = operation.toJSON ? operation.toJSON() : operation;
    const timer = timerByOperationId.get(operation.id);
    if (timer && !timerBelongsToViewerStation(timer, sid)) {
      return {
        ...op,
        status: 'STOPPED',
        elapsed_seconds: 0,
        foreign_station_timer: true
      };
    }
    const elapsed = timer ? accumulateElapsedSeconds(timer) : 0;
    return {
      ...op,
      status: timer ? timer.status : 'STOPPED',
      elapsed_seconds: elapsed,
      timer_station_id: timer ? timer.station_id : null
    };
  });
}

/** Lista operaciones del área del usuario con estado de cronómetro (filtro opcional). */
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

  const stationId = resolveStationId(req);
  let rows = await enrichOperationsWithTimerState(operations, stationId);
  if (statusFilter !== 'ALL') {
    rows = rows.filter((r) => r.status === statusFilter);
  }

  return res.status(200).json({
    userArea,
    station_id: stationId,
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

  const stationId = resolveStationId(req);
  const operationsWithState = await enrichOperationsWithTimerState(operations, stationId);

  return res.status(200).json({
    otNumber,
    userArea,
    station_id: stationId,
    operations: operationsWithState
  });
};

exports.getActiveBoard = async function getActiveBoard(req, res) {
  const stationId = resolveStationId(req);
  const timers = await OperationTimer.findAll({
    where: getBoardTimerWhere(stationId),
    include: [WorkOrderOperation, User],
    order: [['updatedAt', 'DESC']]
  });

  return res.status(200).json({
    station_id: stationId,
    timers
  });
};

exports.startTimer = async function startTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });

  if (!(await assertOperatorPinForTimer(req, res))) return;

  const stationId = resolveStationId(req);
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
      current_user_id: currentUser.id,
      status: 'ACTIVE',
      active_since: new Date(),
      last_event_at: new Date(),
      total_elapsed_seconds: 0,
      shift_date: new Date(),
      station_id: stationId
    });
  } else {
    if (timer.station_id && timer.station_id !== stationId) {
      return res.status(403).json({ message: 'Operacion cronometrada en otra estacion.' });
    }
    if (timer.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Timer is already active.' });
    }
    timer.current_user_id = currentUser.id;
    timer.status = 'ACTIVE';
    timer.active_since = new Date();
    timer.last_event_at = new Date();
    timer.station_id = stationId;
    await timer.save();
  }

  await appendEvent({
    timerId: timer.id,
    operationId: operation.id,
    userId: currentUser.id,
    eventType: 'START',
    details: { resource_code: operation.resource_code }
  });

  return res.status(200).json(timer);
};

exports.pauseTimer = async function pauseTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });

  if (!(await assertOperatorPinForTimer(req, res))) return;

  const stationId = resolveStationId(req);
  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (!assertTimerStationMatch(timer, stationId, res)) return;
  if (timer.status !== 'ACTIVE') return res.status(400).json({ message: 'Only active timers can be paused.' });

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

  if (!(await assertOperatorPinForTimer(req, res))) return;

  const stationId = resolveStationId(req);
  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (!assertTimerStationMatch(timer, stationId, res)) return;
  if (timer.status !== 'PAUSED') return res.status(400).json({ message: 'Only paused timers can be resumed.' });

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
  timer.active_since = new Date();
  timer.last_event_at = new Date();
  timer.current_user_id = req.userId;
  if (!Number.isFinite(timer.total_elapsed_seconds)) timer.total_elapsed_seconds = 0;
  await timer.save();

  await appendEvent({
    timerId: timer.id,
    operationId: timer.work_order_operation_id,
    userId: req.userId,
    eventType: 'RESUME'
  });

  return res.status(200).json(timer);
};

exports.stopTimer = async function stopTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });

  if (!(await assertOperatorPinForTimer(req, res))) return;

  const stationId = resolveStationId(req);
  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (!assertTimerStationMatch(timer, stationId, res)) return;
  if (timer.status === 'STOPPED') return res.status(400).json({ message: 'Timer is already stopped.' });

  if (timer.status === 'ACTIVE') {
    timer.total_elapsed_seconds = accumulateElapsedSeconds(timer);
  }
  timer.status = 'STOPPED';
  timer.active_since = null;
  timer.last_event_at = new Date();
  await timer.save();

  await appendEvent({
    timerId: timer.id,
    operationId: timer.work_order_operation_id,
    userId: req.userId,
    eventType: 'STOP'
  });

  return res.status(200).json(timer);
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
      completed_quantity: op.completed_quantity ?? null,
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
      'completed_quantity',
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

exports.seedWipSample = async function seedWipSample(req, res) {
  const sample = [
    {
      ot_number: 'OT3289',
      operation_sequence: 10,
      operation_code: 'ES-10',
      operation_name: 'ARMADO',
      resource_code: 'ES414 ARMADO',
      area: 'ES',
      planned_setup_minutes: null,
      planned_operation_minutes: 25,
      planned_quantity: 7,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT3289',
      operation_sequence: 20,
      operation_code: 'ES-20',
      operation_name: 'SOLDAR',
      resource_code: 'ES512 SOLDADURA',
      area: 'ES',
      planned_setup_minutes: null,
      planned_operation_minutes: 25,
      planned_quantity: 7,
      completed_quantity: 7,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT3491',
      operation_sequence: 10,
      operation_code: 'ME-10',
      operation_name: 'PERFORAR A DIA 56',
      resource_code: 'ME230 TORNO REVOLVER MINGANTI',
      area: 'ME',
      planned_setup_minutes: null,
      planned_operation_minutes: 60,
      planned_quantity: 5,
      completed_quantity: 5,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT3491',
      operation_sequence: 20,
      operation_code: 'ME-20',
      operation_name: 'TORNEADO',
      resource_code: 'ME210 TORNO V.D.F. 2000',
      area: 'ME',
      planned_setup_minutes: null,
      planned_operation_minutes: 105,
      planned_quantity: 5,
      completed_quantity: 5,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT2316',
      operation_sequence: 10,
      operation_code: 'ME-10',
      operation_name: 'BANCO',
      resource_code: 'ME121 BANCO MECANICO',
      area: 'ME',
      planned_setup_minutes: null,
      planned_operation_minutes: 270,
      planned_quantity: 1,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT2316',
      operation_sequence: 20,
      operation_code: 'ME-20',
      operation_name: 'ARMADO',
      resource_code: 'ME123 BANCO MECANICO',
      area: 'ME',
      planned_setup_minutes: null,
      planned_operation_minutes: 540,
      planned_quantity: 1,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    // Demo rejilla 4 cuadrantes: una OT con 4 recursos distintos (4 timers a la vez).
    {
      ot_number: 'OT4444',
      operation_sequence: 10,
      operation_code: 'DEMO-10',
      operation_name: 'CUADRANTE A',
      resource_code: 'ES901 LINEA A',
      area: 'ES',
      planned_setup_minutes: null,
      planned_operation_minutes: 120,
      planned_quantity: 10,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT4444',
      operation_sequence: 20,
      operation_code: 'DEMO-20',
      operation_name: 'CUADRANTE B',
      resource_code: 'ES902 LINEA B',
      area: 'ES',
      planned_setup_minutes: null,
      planned_operation_minutes: 120,
      planned_quantity: 10,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT4444',
      operation_sequence: 30,
      operation_code: 'DEMO-30',
      operation_name: 'CUADRANTE C',
      resource_code: 'ME903 CELDA C',
      area: 'ME',
      planned_setup_minutes: null,
      planned_operation_minutes: 120,
      planned_quantity: 10,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT4444',
      operation_sequence: 40,
      operation_code: 'DEMO-40',
      operation_name: 'CUADRANTE D',
      resource_code: 'ME904 CELDA D',
      area: 'ME',
      planned_setup_minutes: null,
      planned_operation_minutes: 120,
      planned_quantity: 10,
      completed_quantity: 0,
      source_status: 'WIP',
      last_synced_at: new Date()
    }
  ];

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
