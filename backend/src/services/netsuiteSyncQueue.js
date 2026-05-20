const { Op } = require('sequelize');
const NetsuiteSyncQueue = require('../models/netsuite_sync_queue');
const config = require('../config/config');

function safeJson(value) {
  try {
    return JSON.stringify(value == null ? null : value);
  } catch (_) {
    return JSON.stringify({ non_serializable: true });
  }
}

function buildIdempotencyKey({ operationId, eventId }) {
  return `stop:${operationId}:${eventId || 'na'}`;
}

async function enqueueFromStop({ operationId, eventId, userId }) {
  const idempotencyKey = buildIdempotencyKey({ operationId, eventId });
  const defaults = {
    idempotency_key: idempotencyKey,
    work_order_operation_id: operationId,
    trigger_event_id: eventId || null,
    status: 'PENDING',
    attempt_count: 0,
    next_retry_at: null,
    created_by_user_id: userId || null
  };
  const [row, created] = await NetsuiteSyncQueue.findOrCreate({
    where: { idempotency_key: idempotencyKey },
    defaults
  });
  return { row, created };
}

async function claimNextPending() {
  const now = new Date();
  const candidate = await NetsuiteSyncQueue.findOne({
    where: {
      status: { [Op.in]: ['PENDING', 'RETRY'] },
      [Op.or]: [{ next_retry_at: null }, { next_retry_at: { [Op.lte]: now } }]
    },
    order: [['createdAt', 'ASC']]
  });
  if (!candidate) return null;

  const [affected] = await NetsuiteSyncQueue.update(
    {
      status: 'PROCESSING',
      locked_at: now
    },
    {
      where: {
        id: candidate.id,
        status: { [Op.in]: ['PENDING', 'RETRY'] }
      }
    }
  );
  if (affected !== 1) return null;
  return NetsuiteSyncQueue.findByPk(candidate.id);
}

async function markSent(row, result) {
  row.status = 'SENT';
  row.processed_at = new Date();
  row.last_error = null;
  row.result_json = safeJson(result);
  row.locked_at = null;
  await row.save();
}

async function markRetry(row, err) {
  const attempts = Number(row.attempt_count || 0) + 1;
  const retryable = attempts < Number(config.V4_MAX_ATTEMPTS || 5);
  row.attempt_count = attempts;
  row.status = retryable ? 'RETRY' : 'ERROR';
  row.last_error = String(err && err.message ? err.message : err);
  row.locked_at = null;
  row.next_retry_at = retryable ? new Date(Date.now() + Number(config.V4_RETRY_BACKOFF_MS || 30000)) : null;
  await row.save();
}

async function requeueStuckProcessing() {
  if (!config.V4_WATCHDOG_ENABLED) return { requeued: 0 };
  const threshold = new Date(Date.now() - Number(config.V4_PROCESSING_TIMEOUT_MS || 300000));
  const [requeued] = await NetsuiteSyncQueue.update(
    {
      status: 'RETRY',
      locked_at: null,
      next_retry_at: new Date(),
      last_error: 'Processing timeout watchdog requeue'
    },
    {
      where: {
        status: 'PROCESSING',
        locked_at: { [Op.lte]: threshold }
      }
    }
  );
  return { requeued };
}

module.exports = {
  enqueueFromStop,
  claimNextPending,
  markSent,
  markRetry,
  requeueStuckProcessing
};
