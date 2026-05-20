const config = require('../config/config');
const {
  claimNextPending,
  markSent,
  markRetry,
  requeueStuckProcessing
} = require('../services/netsuiteSyncQueue');
const { runV4QueueSync } = require('../controllers/netsuiteSync');

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await requeueStuckProcessing();
    const item = await claimNextPending();
    if (!item) return;
    try {
      const result = await runV4QueueSync(item);
      await markSent(item, result);
    } catch (error) {
      await markRetry(item, error);
    }
  } catch (error) {
    console.error('V4 queue worker tick failed:', error && error.message ? error.message : error);
  } finally {
    running = false;
  }
}

function startNetsuiteSyncQueueWorker() {
  if (!config.V4_WORKER_ENABLED) {
    console.log('V4 queue worker: disabled by V4_WORKER_ENABLED=false');
    return;
  }
  if (timer) return;
  const interval = Number(config.V4_WORKER_INTERVAL_MS || 5000);
  timer = setInterval(() => {
    tick().catch(() => {});
  }, interval);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`V4 queue worker started (interval=${interval}ms).`);
}

module.exports = {
  startNetsuiteSyncQueueWorker
};
