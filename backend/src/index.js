const http = require('http');
const express = require('express');
const app = express();
var bodyParser = require('body-parser');
const path = require('path');
const server = http.createServer(app);
const db = require('./config/db');
const compression = require('compression');
const { load_data_workplaces, load_users, ensureShiftCloseSlots } = require('./libs/initialSetup');
require('./models/work_order_operation');
require('./models/operation_timer');
require('./models/timer_event');
require('./models/operation_time_total');
require('./models/shift_close_slot');

const authRoutes = require('./routes/auth');
const chronometerRoutes = require('./routes/chronometer');
const config = require('./config/config');
const { registerShiftCloseCrons } = require('./jobs/shiftCloseScheduler');
var cors = require('cors');

/** Evita bucle SIGTERM: EasyPanel/Docker suelen hacer healthcheck HTTP mientras corre db.sync (alter). */
let dbReady = false;

app.use(function setCommonHeaders(req, res, next) {
    res.set("Access-Control-Allow-Private-Network", "true");
    next();
  });
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'files')));
// Sin lista fija de allowedHeaders: el paquete cors refleja las cabeceras del preflight
// (si acotamos a mano, axios/navegador pueden mandar Accept u otras y el GET /auth/operarios falla
// en silencio en el front → lista vacía "No hay operarios").
app.use(cors());
app.use(compression());

// 200 siempre: muchos healthchecks solo miran código HTTP (503 durante sync = reinicios en bucle).
app.get(['/', '/health'], (req, res) => {
    if (dbReady) return res.status(200).json({ status: 'ok' });
    return res.status(200).json({ status: 'starting' });
});

app.use((req, res, next) => {
    if (!dbReady) return res.status(503).json({ message: 'Service starting' });
    next();
});

app.use('/auth', authRoutes);
app.use('/chronometer', chronometerRoutes);

// Puerto abierto de inmediato: healthcheck TCP/HTTP no mata el contenedor durante sync.
server.listen(8000, () => {
    console.log('HTTP en puerto 8000 (sync DB en curso; /health = 503 hasta listo).');
});

db.sync({ alter: true })
    .then(async () => {
        console.log('Base de datos sincronizada.');
        await load_data_workplaces();
        await load_users();
        await ensureShiftCloseSlots();
        await registerShiftCloseCrons();
        dbReady = true;
        console.log('Server initialized (API lista).');
    })
    .catch((error) => {
        console.error('Error al sincronizar la base de datos:', error);
        process.exit(1);
    });