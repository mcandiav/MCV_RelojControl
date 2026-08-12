const { Op } = require('sequelize');
const TimerEvent = require('../models/timer_event');
const TimerEventArchive = require('../models/timer_event_archive');
const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
const User = require('../models/user');

const RETENTION_DAYS = 30;

function formatUserDisplayName(user) {
  if (!user) return null;
  const full = [user.name, user.lastname].filter(Boolean).join(' ').trim();
  if (full) return full;
  const username = user.username ? String(user.username).trim() : '';
  return username || null;
}

function retentionCutoffDate(now = new Date()) {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Copia eventos vivos a timer_events_archive con snapshots denormalizados.
 * Idempotente por source_timer_event_id (unique).
 */
async function archiveTimerEvents({ where = {}, transaction = null } = {}) {
  const events = await TimerEvent.findAll({
    where,
    include: [
      {
        model: WorkOrderOperation,
        required: false,
        attributes: [
          'id',
          'ot_number',
          'operation_sequence',
          'operation_name',
          'resource_code',
          'planned_quantity',
          'completed_quantity'
        ]
      },
      {
        model: User,
        required: false,
        attributes: ['id', 'name', 'lastname', 'username']
      },
      {
        model: OperationTimer,
        required: false,
        attributes: ['id', 'station_id', 'resource_code']
      }
    ],
    transaction
  });

  if (!events.length) {
    return { archived: 0, purged: 0 };
  }

  const archivedAt = new Date();
  const rows = events.map((ev) => {
    const op = ev.WorkOrderOperation;
    const user = ev.User;
    const timer = ev.OperationTimer;
    return {
      source_timer_event_id: ev.id,
      operation_timer_id: ev.operation_timer_id,
      work_order_operation_id: ev.work_order_operation_id,
      user_id: ev.user_id,
      event_type: ev.event_type,
      event_at: ev.event_at,
      details_json: ev.details_json,
      archived_at: archivedAt,
      ot_number: op && op.ot_number ? op.ot_number : null,
      operation_sequence: op && op.operation_sequence != null ? op.operation_sequence : null,
      operation_name: op && op.operation_name ? op.operation_name : null,
      resource_code:
        (op && op.resource_code) ||
        (timer && timer.resource_code) ||
        null,
      user_name_snapshot: formatUserDisplayName(user),
      station_id: timer && timer.station_id != null ? String(timer.station_id) : null,
      planned_quantity: op && op.planned_quantity != null ? op.planned_quantity : null,
      completed_quantity: op && op.completed_quantity != null ? op.completed_quantity : null
    };
  });

  await TimerEventArchive.bulkCreate(rows, {
    ignoreDuplicates: true,
    transaction
  });

  const purged = await purgeTimerEventArchiveOlderThanRetention({ transaction });
  return { archived: rows.length, purged };
}

async function purgeTimerEventArchiveOlderThanRetention({ transaction = null, now = new Date() } = {}) {
  const cutoff = retentionCutoffDate(now);
  return TimerEventArchive.destroy({
    where: {
      event_at: { [Op.lt]: cutoff }
    },
    transaction
  });
}

module.exports = {
  RETENTION_DAYS,
  retentionCutoffDate,
  archiveTimerEvents,
  purgeTimerEventArchiveOlderThanRetention
};
