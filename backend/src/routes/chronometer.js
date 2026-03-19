const express = require('express');
const router = express.Router();

const chronometer = require('../controllers/chronometer');
const security = require('../middlewares/authJwt');

router.get('/operations/:otNumber', security.verifyToken, chronometer.getOperationsByOt);
router.get('/board/active', security.verifyToken, chronometer.getActiveBoard);
router.delete('/operations/:id', [security.verifyToken, security.isAdmin], chronometer.deleteOperation);

router.post('/wip/upsert', [security.verifyToken, security.isAdmin], chronometer.upsertWipOperations);
router.post('/wip/seed-sample', [security.verifyToken, security.isAdmin], chronometer.seedWipSample);
router.post('/wip/import-upload', [security.verifyToken, security.isAdmin], chronometer.importWipFromUpload);
router.post('/shift/close', [security.verifyToken, security.isAdmin], chronometer.closeShiftBatch);

router.post('/timers/start', security.verifyToken, chronometer.startTimer);
router.post('/timers/pause', security.verifyToken, chronometer.pauseTimer);
router.post('/timers/resume', security.verifyToken, chronometer.resumeTimer);
router.post('/timers/stop', security.verifyToken, chronometer.stopTimer);

module.exports = router;
