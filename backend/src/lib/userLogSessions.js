const { Op } = require('sequelize');
const TimerEvent = require('../models/timer_event');
const OperationTimer = require('../models/operation_timer');
const User = require('../models/user');
const WorkOrderOperation = require('../models/work_order_operation');
const { computeTotalsFromEvents, normalizeTimerMode } = require('./timerEventTotals');

const SESSION_EVENT_TYPES = ['START', 'RESUME', 'PAUSE', 'STOP', 'AUTO_STOP_SHIFT_END', 'MODE_CHANGE'];

function formatUserDisplayName(user) {
  if (!user) return '—';
  const full = [user.name, user.lastname].filter(Boolean).join(' ').trim();
  if (full) return full;
  const username = user.username ? String(user.username).trim() : '';
  return username || '—';
}

function parseStopQuantity(detailsJson) {
  if (detailsJson == null || detailsJson === '') return 0;
  try {
    const d = typeof detailsJson === 'string' ? JSON.parse(detailsJson) : detailsJson;
    const n = Number(d && d.completed_quantity);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch (_) {
    return 0;
  }
}

function splitSessionsFromEvents(events) {
  const sessions = [];
  let current = null;

  for (const ev of events || []) {
    const type = String(ev.event_type || '').toUpperCase();
    if (type === 'START') {
      if (current) sessions.push(current);
      current = { events: [ev], started_at: ev.event_at, ended_at: null, stop_event: null };
      continue;
    }
    if (!current) {
      if (type === 'RESUME') {
        current = { events: [ev], started_at: ev.event_at, ended_at: null, stop_event: null };
      }
      continue;
    }
    current.events.push(ev);
    if (type === 'STOP' || type === 'AUTO_STOP_SHIFT_END') {
      current.ended_at = ev.event_at;
      current.stop_event = ev;
      sessions.push(current);
      current = null;
    }
  }

  if (current) sessions.push(current);
  return sessions;
}

function resolveClockStatus(session, timer) {
  if (session.ended_at) {
    return { code: 'STOPPED', label: 'Detenido' };
  }
  const status = timer && timer.status ? String(timer.status).toUpperCase() : 'STOPPED';
  const mode = normalizeTimerMode(timer && timer.timer_mode, 'RUN');
  if (status === 'ACTIVE' || status === 'PAUSED') {
    return mode === 'SETUP'
      ? { code: 'SETUP', label: 'En montaje' }
      : { code: 'RUN', label: 'En curso' };
  }
  return { code: 'STOPPED', label: 'Detenido' };
}

function formatOperationLabel(op, timer) {
  const rc = (op && op.resource_code) || (timer && timer.resource_code) || '';
  const name = (op && op.operation_name) || '';
  return `${String(rc).trim()} ${String(name).trim()}`.trim().toUpperCase() || '—';
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

function mapSessionToRow(session, timer, user, op, sessionIndex) {
  const isOpen = !session.ended_at;
  const asOf = isOpen ? new Date() : session.ended_at;
  const totals = computeTotalsFromEvents(session.events, { asOf });
  const status = resolveClockStatus(session, timer);
  const qty = session.stop_event ? parseStopQuantity(session.stop_event.details_json) : 0;
  const startedMs = new Date(session.started_at).getTime();

  return {
    id: `${timer.id}-${sessionIndex}-${startedMs}`,
    operation_timer_id: timer.id,
    user_id: user ? user.id : null,
    user_name: formatUserDisplayName(user),
    ot_number: op && op.ot_number ? op.ot_number : '—',
    operation_label: formatOperationLabel(op, timer),
    quantity: qty,
    setup_minutes: secondsToMinutes(totals.total_setup_seconds),
    run_minutes: secondsToMinutes(totals.total_run_seconds),
    pause_minutes: secondsToMinutes(totals.total_pause_seconds),
    started_at: session.started_at,
    ended_at: session.ended_at,
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
    case 'operation_label':
      cmp = text(a.operation_label).localeCompare(text(b.operation_label));
      break;
    case 'quantity':
      cmp = num(a.quantity) - num(b.quantity);
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
        attributes: ['id', 'ot_number', 'operation_sequence', 'operation_name', 'resource_code']
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
    const sessions = splitSessionsFromEvents(events);
    sessions.forEach((session, idx) => {
      if (!sessionOverlapsRange(session.started_at, session.ended_at, fromYmd, toYmd)) return;
      rows.push(mapSessionToRow(session, timer, timer.User, timer.WorkOrderOperation, idx));
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
  splitSessionsFromEvents,
  formatOperationLabel,
  resolveClockStatus
};
