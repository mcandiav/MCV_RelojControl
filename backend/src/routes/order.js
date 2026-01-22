const express = require('express');
const router = express.Router();
const order = require('../controllers/order.js');

const security = require('../middlewares/authJwt');

// =============================
// RUTAS DE ORDENES
// =============================

// Obtener lista de órdenes
router.get('/', security.verifyToken, function(req, res){
    order.list(req,res);
});

// Descargar lista de órdenes
router.get('/download', security.isAdmin, function(req, res){
    order.listDownload(req,res);
});

// Crear nueva orden (deprecated)
router.post('/', security.isAdmin, function(req, res) {
    order.create(req, res);
});

// Iniciar orden de trabajo
router.post('/play', [security.verifyToken, security.preventDuplicatePlay], function(req, res) {
    order.play(req, res);
});

// Pausar orden de trabajo
router.post('/pause', security.verifyToken, function(req, res) {
    order.pause(req, res);
});

// Editar orden de trabajo (deprecated)
router.post('/edit', security.isAdmin, function(req, res) {
    order.edit(req, res);
});

// Detener orden de trabajo
router.post('/stop', security.verifyToken, function(req, res) {
    order.stop(req, res);
});

// Eliminar orden de trabajo (deprecated)
router.post('/delete', security.isAdmin, function(req, res) {
    order.remove(req, res);
});

// Eliminar todas las órdenes (deprecated)
router.post('/deleteAll', security.isAdmin, function(req, res) {
    order.removeAll(req, res);
});

// Obtener el último ID de orden
router.get('/lastid', function(req, res){
    order.lastId(req,res);
});

// Actualizar el último ID de orden
router.post('/updateid', security.verifyToken, function(req, res){
    order.updateLastId(req,res);
});

// Obtener todos los recursos (deprecated)
router.get('/resource', function(req, res){
    order.getallresource(req,res);
});

// Listar trabajadores para mostrar el detalle de horas trabajadas 
router.get('/workers', security.verifyToken, function(req, res){
    order.listWorkers(req, res)
});

// Listar roles
router.get('/roles', security.verifyToken, function(req, res){
    order.listRoles(req, res)
});

// Listar lugares de trabajo
router.get('/workplaces', security.verifyToken, function(req, res){
    order.listWorkplaces(req, res)
});

// Obtener nombre de usuario por ID
router.get('/getUsername', security.verifyToken, function(req, res){
    order.getUsername(req, res)
});

// Obtener hora del servidor
router.get('/serverTime', function(req, res){
    order.getServerTime(req, res)
});

// Detener todas las órdenes en curso (deprecated)
router.post('/stopAll', function(req, res){
    order.stopAll(req, res)
});

// Generar reporte de cumplimiento
router.post('/report', security.verifyToken, function(req, res){
    order.complianceReport(req, res)
});

// Generar reporte de cumplimiento por día
router.post('/reportbyDay', security.verifyToken, function(req, res){
    order.complianceReportbyDay(req, res)
});

// Generar reporte detallado de los trabajadores en rango de meses
router.post('/timerReport', security.verifyToken, function(req, res){
    order.timerReport(req, res)
});

// Verificar inconsistencias en las órdenes (deprecated)
router.get('/inconsistency', function(req, res){
    order.listInconsistentOrders(req, res)
});

// Arreglar inconsistencias en las órdenes (deprecated)
router.post('/fixInconsistency', function(req, res){
    order.fixOrderTime(req, res)
});


module.exports = router;


