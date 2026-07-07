const { Op } = require('sequelize');
const TimerEvent = require('../models/timer_event');
const OperationTimer = require('../models/operation_timer');
const User = require('../models/user');
const WorkOrderOperation = require('../models/work_order_operation');
const { normalizeTimerMode } = require('./timerEventTotals');

const SESSION_EVENT_TYPES = ['START', 'RESUME', 'PAUSE', 'STOP', 'AUTO_STOP_SHIFT_END', 'MODE_CHANGE'];

function formatUserDisplayName(user) {
  if (!user) return '—';
  const full = [user.name, user.lastname].filter(Boolean).join(' ').trim();
  if (full) return full;
  const username = user.username ? String(user.username).trim() : '';
  return username || '—';
}

function toNonNegIntOrNull(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Del evento STOP: delta que cargó el usuario y snapshot del total de la OT al cerrar.
 */
function parseStopDetails(detailsJson) {
  if (detailsJson == null || detailsJson === '') return { user_finished: null, operation_total: null };
  try {
    const d = typeof detailsJson === 'string' ? JSON.parse(detailsJson) : detailsJson;
    return {
      user_finished: toNonNegIntOrNull(d && d.completed_quantity),
      operation_total: toNonNegIntOrNull(d && d.operation_completed_total)
    };
  } catch (_) {
    return { user_finished: null, operation_total: null };
  }
}

function readTimerModeFromEvent(event, fallback = 'RUN') {
  try {
    const raw = event && event.details_json;
    if (!raw) return fallback;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeTimerMode(parsed && parsed.timer_mode, fallback);
  } catch (_) {
    return fallback;
  }
}

/**
 * Construye tramos de estado (un renglón por estado) recorriendo la línea de
 * tiempo continua del cronómetro. Estados: SETUP (play montaje), RUN (play
 * ejecución), PAUSED (pausa), STOPPED (detenido). Cada cambio de estado cierra
 * el tramo anterior (le pone término) y abre uno nuevo. El último tramo queda
 * abierto (sin término) porque representa el estado actual.
 *
 * La cantidad cargada en un STOP se atribuye al tramo que se está cerrando
 * (el play/pausa previo), tal como lo pidió el usuario.
 */
function buildSegmentsFromEvents(events) {
  const segments = [];
  let current = null;
  let currentMode = 'RUN';

  const openSegment = (state, atIso) => {
    current = { state, start_at: atIso, end_at: null, stop_details: null };
  };
  const closeSegment = (atIso, stopDetails) => {
    if (!current) return;
    current.end_at = atIso;
    if (stopDetails) current.stop_details = stopDetails;
    segments.push(current);
    current = null;
  };

  for (const ev of events || []) {
    const type = String(ev.event_type || '').toUpperCase();
    const atIso = ev.event_at;

    if (type === 'START' || type === 'RESUME') {
      currentMode = readTimerModeFromEvent(ev, currentMode);
      closeSegment(atIso);
      openSegment(currentMode === 'SETUP' ? 'SETUP' : 'RUN', atIso);
      continue;
    }
    if (type === 'MODE_CHANGE') {
      currentMode = readTimerModeFromEvent(ev, currentMode);
      closeSegment(atIso);
      openSegment(currentMode === 'SETUP' ? 'SETUP' : 'RUN', atIso);
      continue;
    }
    if (type === 'PAUSE') {
      closeSegment(atIso);
      openSegment('PAUSED', atIso);
      continue;
    }
    if (type === 'STOP' || type === 'AUTO_STOP_SHIFT_END') {
      const stopDetails = parseStopDetails(ev.details_json);
      if (current) {
        closeSegment(atIso, stopDetails);
      } else {
        // Stop sin tramo activo previo: registra el propio stop con su detalle.
        openSegment('STOPPED', atIso);
        current.stop_details = stopDetails;
        closeSegment(atIso);
        continue;
      }
      openSegment('STOPPED', atIso);
      continue;
    }
  }

  if (current) segments.push(current);
  return segments;
}

const SEGMENT_STATUS = {
  SETUP: { code: 'SETUP', label: 'Play montaje' },
  RUN: { code: 'RUN', label: 'Play ejecución' },
  PAUSED: { code: 'PAUSED', label: 'Pausa' },
  STOPPED: { code: 'STOPPED', label: 'Stop' }
};

function resolveSegmentStatus(segment) {
  return SEGMENT_STATUS[segment.state] || SEGMENT_STATUS.STOPPED;
}

function resolveResourceCode(op, timer) {
  const rc = (op && op.resource_code) || (timer && timer.resource_code) || '';
  return String(rc).trim().toUpperCase() || '—';
}

function secondsToMinutes(sec) {
  return Math.max(0, Math.round(Number(sec || 0) / 60));
}

function sessionOverlapsRange(startedAt, endedAt, fromYmd, toYmd) {
  const fromMs = new Date(`${fromYmd}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${toYmd}T23:59:59.999Z`).getTime();
  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) return false;
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(endMs)) return false;
  return startMs <= toMs && endMs >= fromMs;
}

function buildOpWhere({ workOrderFilter, resourceFilter, operationFilter }) {
  const opWhere = {};
  if (workOrderFilter) {
    opWhere.ot_number = { [Op.like]: `%${workOrderFilter}%` };
  }
  if (resourceFilter) {
    opWhere.resource_code = { [Op.like]: `%${resourceFilter}%` };
  }
  if (operationFilter) {
    const seq = parseInt(operationFilter, 10);
    if (Number.isInteger(seq) && String(seq) === operationFilter.trim()) {
      opWhere.operation_sequence = seq;
    } else {
      opWhere.operation_name = { [Op.like]: `%${operationFilter}%` };
    }
  }
  return opWhere;
}

function mapSegmentToRow(segment, timer, user, op, segmentIndex) {
  const isOpen = !segment.end_at;
  const status = resolveSegmentStatus(segment);
  const stopInfo = segment.stop_details || { user_finished: null, operation_total: null };
  const startedMs = new Date(segment.start_at).getTime();
  const endMs = segment.end_at ? new Date(segment.end_at).getTime() : Date.now();
  const durationMinutes = secondsToMinutes(Math.max(0, (endMs - startedMs) / 1000));

  const plannedQty = op ? toNonNegIntOrNull(op.planned_quantity) : null;
  // Cantidad completada (total OT): snapshot del STOP si existe; si no, total actual de la OT.
  let completedTotal = stopInfo.operation_total;
  if (completedTotal == null && op) {
    completedTotal = toNonNegIntOrNull(op.completed_quantity);
  }

  // Con un renglón por estado, cada tramo llena solo la columna de tiempo que
  // corresponde a su estado. STOP no llena ninguna (su duración es tiempo detenido).
  const setupMinutes = segment.state === 'SETUP' ? durationMinutes : null;
  const runMinutes = segment.state === 'RUN' ? durationMinutes : null;
  const pauseMinutes = segment.state === 'PAUSED' ? durationMinutes : null;

  return {
    id: `${timer.id}-${segmentIndex}-${startedMs}`,
    operation_timer_id: timer.id,
    user_id: user ? user.id : null,
    user_name: formatUserDisplayName(user),
    ot_number: op && op.ot_number ? op.ot_number : '—',
    operation_sequence: op && op.operation_sequence != null ? op.operation_sequence : null,
    resource_code: resolveResourceCode(op, timer),
    planned_quantity: plannedQty,
    completed_quantity: completedTotal,
    user_finished_quantity: stopInfo.user_finished,
    setup_minutes: setupMinutes,
    run_minutes: runMinutes,
    pause_minutes: pauseMinutes,
    started_at: segment.start_at,
    ended_at: segment.end_at,
    clock_status: status.label,
    clock_status_code: status.code,
    is_open: isOpen
  };
}

function compareRows(a, b, sortBy, sortDir) {
  const dir = sortDir === 'ASC' ? 1 : -1;
  const text = (v) => String(v == null ? '' : v).toLowerCase();
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const date = (v) => {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  let cmp = 0;
  switch (sortBy) {
    case 'user_name':
      cmp = text(a.user_name).localeCompare(text(b.user_name));
      break;
    case 'ot_number':
      cmp = text(a.ot_number).localeCompare(text(b.ot_number));
      break;
    case 'operation_sequence':
      cmp = num(a.operation_sequence) - num(b.operation_sequence);
      break;
    case 'resource_code':
      cmp = text(a.resource_code).localeCompare(text(b.resource_code));
      break;
    case 'planned_quantity':
      cmp = num(a.planned_quantity) - num(b.planned_quantity);
      break;
    case 'completed_quantity':
      cmp = num(a.completed_quantity) - num(b.completed_quantity);
      break;
    case 'user_finished_quantity':
      cmp = num(a.user_finished_quantity) - num(b.user_finished_quantity);
      break;
    case 'setup_minutes':
      cmp = num(a.setup_minutes) - num(b.setup_minutes);
      break;
    case 'run_minutes':
      cmp = num(a.run_minutes) - num(b.run_minutes);
      break;
    case 'pause_minutes':
      cmp = num(a.pause_minutes) - num(b.pause_minutes);
      break;
    case 'ended_at':
      cmp = date(a.ended_at) - date(b.ended_at);
      break;
    case 'clock_status':
      cmp = text(a.clock_status).localeCompare(text(b.clock_status));
      break;
    case 'started_at':
    default:
      cmp = date(a.started_at) - date(b.started_at);
      break;
  }
  if (cmp === 0) cmp = text(a.id).localeCompare(text(b.id));
  return cmp * dir;
}

async function fetchUserLogSessions({
  fromYmd,
  toYmd,
  userId,
  workOrderFilter,
  resourceFilter,
  operationFilter,
  sortBy,
  sortDir,
  page,
  pageSize
}) {
  const opWhere = buildOpWhere({ workOrderFilter, resourceFilter, operationFilter });
  const opFilterActive = Object.keys(opWhere).length > 0;
  const eventAtRange = {};
  if (fromYmd) eventAtRange[Op.gte] = new Date(`${fromYmd}T00:00:00.000Z`);
  if (toYmd) eventAtRange[Op.lte] = new Date(`${toYmd}T23:59:59.999Z`);

  const timerIdSet = new Set();

  const openTimerWhere = { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } };
  if (Number.isInteger(userId) && userId > 0) openTimerWhere.current_user_id = userId;

  const openTimers = await OperationTimer.findAll({
    where: openTimerWhere,
    attributes: ['id'],
    include: [
      {
        model: WorkOrderOperation,
        required: opFilterActive,
        where: opFilterActive ? opWhere : undefined,
        attributes: ['id']
      }
    ]
  });
  openTimers.forEach((t) => timerIdSet.add(t.id));

  const eventWhere = {
    event_type: { [Op.in]: SESSION_EVENT_TYPES }
  };
  if (Object.keys(eventAtRange).length) eventWhere.event_at = eventAtRange;
  if (Number.isInteger(userId) && userId > 0) eventWhere.user_id = userId;

  const eventsInRange = await TimerEvent.findAll({
    where: eventWhere,
    attributes: ['operation_timer_id'],
    include: [
      {
        model: WorkOrderOperation,
        required: opFilterActive,
        where: opFilterActive ? opWhere : undefined,
        attributes: ['id']
      }
    ]
  });
  eventsInRange.forEach((ev) => timerIdSet.add(ev.operation_timer_id));

  if (timerIdSet.size === 0) {
    return { rows: [], total: 0 };
  }

  const timerWhere = { id: { [Op.in]: Array.from(timerIdSet) } };
  if (Number.isInteger(userId) && userId > 0) timerWhere.current_user_id = userId;

  const timers = await OperationTimer.findAll({
    where: timerWhere,
    include: [
      {
        model: User,
        required: false,
        attributes: ['id', 'name', 'lastname', 'username']
      },
      {
        model: WorkOrderOperation,
        required: opFilterActive,
        where: opFilterActive ? opWhere : undefined,
        attributes: [
          'id',
          'ot_number',
          'operation_sequence',
          'operation_name',
          'resource_code',
          'planned_quantity',
          'completed_quantity'
        ]
      }
    ]
  });

  const timerIds = timers.map((t) => t.id);
  if (!timerIds.length) {
    return { rows: [], total: 0 };
  }

  const allEvents = await TimerEvent.findAll({
    where: {
      operation_timer_id: { [Op.in]: timerIds },
      event_type: { [Op.in]: SESSION_EVENT_TYPES }
    },
    order: [
      ['operation_timer_id', 'ASC'],
      ['event_at', 'ASC']
    ]
  });

  const eventsByTimer = new Map();
  for (const ev of allEvents) {
    const list = eventsByTimer.get(ev.operation_timer_id) || [];
    list.push(ev);
    eventsByTimer.set(ev.operation_timer_id, list);
  }

  const rows = [];
  for (const timer of timers) {
    if (opFilterActive && !timer.WorkOrderOperation) continue;
    const events = eventsByTimer.get(timer.id) || [];
    if (!events.length) continue;
    const segments = buildSegmentsFromEvents(events);
    segments.forEach((segment, idx) => {
      if (!sessionOverlapsRange(segment.start_at, segment.end_at, fromYmd, toYmd)) return;
      rows.push(mapSegmentToRow(segment, timer, timer.User, timer.WorkOrderOperation, idx));
    });
  }

  const sortKey = sortBy || 'started_at';
  const direction = sortDir === 'ASC' ? 'ASC' : 'DESC';
  rows.sort((a, b) => compareRows(a, b, sortKey, direction));

  const total = rows.length;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const paged = rows.slice(offset, offset + pageSize);

  return { rows: paged, total };
}

module.exports = {
  SESSION_EVENT_TYPES,
  fetchUserLogSessions,
  buildSegmentsFromEvents,
  resolveSegmentStatus
};
