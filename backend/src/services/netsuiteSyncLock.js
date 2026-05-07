let lockCount = 0;

function beginNetsuiteSyncWindow() {
  lockCount += 1;
}

function endNetsuiteSyncWindow() {
  lockCount = Math.max(0, lockCount - 1);
}

function isNetsuiteSyncWindowActive() {
  return lockCount > 0;
}

module.exports = {
  beginNetsuiteSyncWindow,
  endNetsuiteSyncWindow,
  isNetsuiteSyncWindowActive
};

