const config = require('../../config/config');
const { isNetsuiteConfigured } = require('./config');
const { buildActualsPayload } = require('./buildActualsPayload');
const { pushActualsBatch } = require('./restletClient');

async function tryPushAfterShiftClose() {
  if (!config.NETSUITE_PUSH_ON_SHIFT_CLOSE) {
    return { skipped: true, reason: 'NETSUITE_PUSH_ON_SHIFT_CLOSE not enabled' };
  }
  if (!isNetsuiteConfigured()) {
    return { skipped: true, reason: 'netsuite_env_incomplete' };
  }

  const { items } = await buildActualsPayload();
  if (items.length === 0) {
    return { skipped: true, reason: 'no_operations_with_netsuite_id' };
  }

  const netsuite = await pushActualsBatch(items);
  return { skipped: false, itemCount: items.length, netsuite };
}

module.exports = {
  tryPushAfterShiftClose
};
