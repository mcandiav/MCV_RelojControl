const express = require('express');
const router = express.Router();
const order = require('../controllers/order.js');

const security = require('../middlewares/authJwt');

router.get('/', security.verifyToken, function(req, res){
    order.list(req,res);
});

router.get('/download', security.isAdmin, function(req, res){
    order.listDownload(req,res);
});

router.post('/', security.isAdmin, function(req, res) {
    order.create(req, res);
});

router.post('/play', [security.verifyToken, security.preventDuplicatePlay], function(req, res) {
    order.play(req, res);
});

router.post('/pause', security.verifyToken, function(req, res) {
    order.pause(req, res);
});

router.post('/edit', security.isAdmin, function(req, res) {
    order.edit(req, res);
});

router.post('/stop', security.verifyToken, function(req, res) {
    order.stop(req, res);
});

router.post('/delete', security.isAdmin, function(req, res) {
    order.remove(req, res);
});

router.post('/deleteAll', security.isAdmin, function(req, res) {
    order.removeAll(req, res);
});

router.get('/lastid', function(req, res){
    order.lastId(req,res);
});

router.post('/updateid', security.verifyToken, function(req, res){
    order.updateLastId(req,res);
});

router.get('/resource', function(req, res){
    order.getallresource(req,res);
});

router.get('/workers', security.verifyToken, function(req, res){
    order.listWorkers(req, res)
});

router.get('/roles', security.verifyToken, function(req, res){
    order.listRoles(req, res)
});

router.get('/workplaces', security.verifyToken, function(req, res){
    order.listWorkplaces(req, res)
});

router.get('/getUsername', security.verifyToken, function(req, res){
    order.getUsername(req, res)
});

router.get('/serverTime', function(req, res){
    order.getServerTime(req, res)
});

router.post('/stopAll', function(req, res){
    order.stopAll(req, res)
});

router.post('/report', security.verifyToken, function(req, res){
    order.complianceReport(req, res)
});

router.post('/reportbyDay', security.verifyToken, function(req, res){
    order.complianceReportbyDay(req, res)
});

// reportTimer 
router.post('/timerReport', security.verifyToken, function(req, res){
    order.timerReport(req, res)
});

// inconsistency
router.get('/inconsistency', function(req, res){
    order.listInconsistentOrders(req, res)
});

// fix inconsistency
router.post('/fixInconsistency', function(req, res){
    order.fixOrderTime(req, res)
});


module.exports = router;


