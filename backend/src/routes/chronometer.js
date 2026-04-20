const express = require('express');
const router = express.Router();

const chronometer = require('../controllers/chronometer');
const netsuiteSync = require('../controllers/netsuiteSync');
const shiftSchedule = require('../controllers/shiftSchedule');
const security = require('../middlewares/authJwt');

router.get('/operations', security.verifyToken, chronometer.listOperations);
router.get('/operations/:otNumber', security.verifyToken, chronometer.getOperationsByOt);
router.get('/board/active', security.verifyToken, chronometer.getActiveBoard);
router.get('/board/report', security.verifyToken, chronometer.getReportBoard);
router.delete('/operations/:id', [security.verifyToken, security.isAdmin], chronometer.deleteOperation);

router.post('/wip/upsert', [security.verifyToken, security.isAdmin], chronometer.upsertWipOperations);
router.post('/wip/seed-sample', [security.verifyToken, security.isAdmin], chronometer.seedWipSample);
router.post('/wip/import-upload', [security.verifyToken, security.isAdmin], chronometer.importWipFromUpload);
router.post('/shift/close', [security.verifyToken, security.isAdmin], chronometer.closeShiftBatch);
router.post('/timers/stop-batch', [security.verifyToken, security.isAdmin], chronometer.stopTimersBatch);

router.get('/admin/shift-schedule', [security.verifyToken, security.isAdmin], shiftSchedule.getShiftSchedule);
router.put('/admin/shift-schedule', [security.verifyToken, security.isAdmin], shiftSchedule.putShiftSchedule);

router.post('/admin/netsuite-ingest-wip', [security.verifyToken, security.isAdmin], netsuiteSync.ingestWipFromStandalonePull);

router.get('/netsuite/status', [security.verifyToken, security.isAdmin], netsuiteSync.getConfigStatus);
router.get('/netsuite/list-datasets', [security.verifyToken, security.isAdmin], netsuiteSync.listDatasets);
router.get('/netsuite/peek-dataset', [security.verifyToken, security.isAdmin], netsuiteSync.peekDataset);
router.post('/netsuite/pull-dataset', [security.verifyToken, security.isAdmin], netsuiteSync.pullDataset);
router.post('/netsuite/push-actuals', [security.verifyToken, security.isAdmin], netsuiteSync.pushActuals);
router.post('/netsuite/sync-official', [security.verifyToken, security.isAdmin], netsuiteSync.officialSync);
router.post('/netsuite/sync-operational', [security.verifyToken, security.isAdmin], netsuiteSync.operationalSync);
router.get('/netsuite/sync-runs', [security.verifyToken, security.isAdmin], netsuiteSync.listSyncRuns);
router.get('/netsuite/sync-runs/:id', [security.verifyToken, security.isAdmin], netsuiteSync.getSyncRun);
router.get('/netsuite/push-log', [security.verifyToken, security.isAdmin], netsuiteSync.listPushLogRows);
router.post('/netsuite/oauth/clear-cache', [security.verifyToken, security.isAdmin], netsuiteSync.clearOAuthCache);

router.post('/timers/start', security.verifyToken, chronometer.startTimer);
router.post('/timers/pause', security.verifyToken, chronometer.pauseTimer);
router.post('/timers/resume', security.verifyToken, chronometer.resumeTimer);
router.post('/timers/mode', security.verifyToken, chronometer.switchTimerMode);
router.post('/timers/stop', security.verifyToken, chronometer.stopTimer);

module.exports = router;
