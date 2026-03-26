const express = require('express');
const router = express.Router();

const chronometer = require('../controllers/chronometer');
const netsuiteSync = require('../controllers/netsuiteSync');
const shiftSchedule = require('../controllers/shiftSchedule');
const security = require('../middlewares/authJwt');

router.get('/operations', security.verifyToken, chronometer.listOperations);
router.get('/operations/:otNumber', security.verifyToken, chronometer.getOperationsByOt);
router.get('/board/active', security.verifyToken, chronometer.getActiveBoard);
router.delete('/operations/:id', [security.verifyToken, security.isAdmin], chronometer.deleteOperation);

router.post('/wip/upsert', [security.verifyToken, security.isAdmin], chronometer.upsertWipOperations);
router.post('/wip/seed-sample', [security.verifyToken, security.isAdmin], chronometer.seedWipSample);
router.post('/wip/import-upload', [security.verifyToken, security.isAdmin], chronometer.importWipFromUpload);
router.post('/shift/close', [security.verifyToken, security.isAdmin], chronometer.closeShiftBatch);

router.get('/admin/shift-schedule', [security.verifyToken, security.isAdmin], shiftSchedule.getShiftSchedule);
router.put('/admin/shift-schedule', [security.verifyToken, security.isAdmin], shiftSchedule.putShiftSchedule);

router.post('/admin/netsuite-ingest-wip', [security.verifyToken, security.isAdmin], netsuiteSync.ingestWipFromStandalonePull);

router.get('/netsuite/status', [security.verifyToken, security.isAdmin], netsuiteSync.getConfigStatus);
router.get('/netsuite/peek-dataset', [security.verifyToken, security.isAdmin], netsuiteSync.peekDataset);
router.get('/netsuite/pull-dataset-dry-run', netsuiteSync.pullDatasetDryRun);
router.post('/netsuite/pull-dataset', [security.verifyToken, security.isAdmin], netsuiteSync.pullDataset);
router.post('/netsuite/push-actuals', [security.verifyToken, security.isAdmin], netsuiteSync.pushActuals);
router.post('/netsuite/oauth/clear-cache', [security.verifyToken, security.isAdmin], netsuiteSync.clearOAuthCache);

router.post('/timers/start', security.verifyToken, chronometer.startTimer);
router.post('/timers/pause', security.verifyToken, chronometer.pauseTimer);
router.post('/timers/resume', security.verifyToken, chronometer.resumeTimer);
router.post('/timers/stop', security.verifyToken, chronometer.stopTimer);

module.exports = router;
