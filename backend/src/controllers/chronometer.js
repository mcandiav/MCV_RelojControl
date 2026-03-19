const { Op } = require('sequelize');

const User = require('../models/user');
const Role = require('../models/role');
const Workplace = require('../models/workplace');
const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
const TimerEvent = require('../models/timer_event');
const OperationTimeTotal = require('../models/operation_time_total');
const config = require('../config/config');

function normalizeWorkplaceArea(workplaceName) {
  const area = String(workplaceName || '').trim().toUpperCase();
  if (area === 'ME' || area === 'ES') return area;
  if (area === 'ALL' || area === 'BOTH') return 'BOTH';
  return 'UNKNOWN';
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

exports.getOperationsByOt = async function getOperationsByOt(req, res) {
  const { otNumber } = req.params;
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const userArea = normalizeWorkplaceArea(currentUser.Workplace && currentUser.Workplace.name);
  if (userArea === 'UNKNOWN') return res.status(400).json({ message: 'User area is not configured.' });

  const areaFilter = userArea === 'BOTH' ? ['ME', 'ES'] : [userArea];

  const operations = await WorkOrderOperation.findAll({
    where: {
      ot_number: otNumber,
      area: { [Op.in]: areaFilter }
    },
    order: [['operation_sequence', 'ASC']]
  });

  return res.status(200).json({
    otNumber,
    userArea,
    operations
  });
};

exports.getActiveBoard = async function getActiveBoard(req, res) {
  const timers = await OperationTimer.findAll({
    where: {
      status: { [Op.in]: ['ACTIVE', 'PAUSED'] }
    },
    include: [WorkOrderOperation, User],
    order: [['updatedAt', 'DESC']]
  });

  return res.status(200).json(timers);
};

exports.startTimer = async function startTimer(req, res) {
  const { work_order_operation_id } = req.body;
  if (!work_order_operation_id) return res.status(400).json({ message: 'work_order_operation_id is required.' });

  const operation = await WorkOrderOperation.findByPk(work_order_operation_id);
  if (!operation) return res.status(404).json({ message: 'Operation not found.' });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: 'Invalid user.' });

  const userArea = normalizeWorkplaceArea(currentUser.Workplace && currentUser.Workplace.name);
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
      shift_date: new Date()
    });
  } else {
    if (timer.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Timer is already active.' });
    }
    timer.current_user_id = currentUser.id;
    timer.status = 'ACTIVE';
    timer.active_since = new Date();
    timer.last_event_at = new Date();
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

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (timer.status !== 'ACTIVE') return res.status(400).json({ message: 'Only active timers can be paused.' });

  timer.status = 'PAUSED';
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

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
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

  const timer = await OperationTimer.findOne({ where: { work_order_operation_id } });
  if (!timer) return res.status(404).json({ message: 'Timer not found.' });
  if (timer.status === 'STOPPED') return res.status(400).json({ message: 'Timer is already stopped.' });

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
      ot_number: 'OT-1001',
      operation_sequence: 10,
      operation_code: 'ME-10',
      operation_name: 'Mecanizado base',
      resource_code: 'ME-CNC-01',
      area: 'ME',
      planned_setup_minutes: 30,
      planned_operation_minutes: 120,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT-1001',
      operation_sequence: 20,
      operation_code: 'ES-20',
      operation_name: 'Estructura ensamble',
      resource_code: 'ES-ARM-01',
      area: 'ES',
      planned_setup_minutes: 20,
      planned_operation_minutes: 90,
      source_status: 'WIP',
      last_synced_at: new Date()
    },
    {
      ot_number: 'OT-1002',
      operation_sequence: 10,
      operation_code: 'ME-10',
      operation_name: 'Mecanizado eje',
      resource_code: 'ME-CNC-02',
      area: 'ME',
      planned_setup_minutes: 25,
      planned_operation_minutes: 110,
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
      'source_status',
      'last_synced_at',
      'updatedAt'
    ]
  });

  return res.status(200).json({
    message: 'Sample WIP seeded.',
    total: sample.length
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
