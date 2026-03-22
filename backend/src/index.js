const http = require('http');
const express = require('express');
const app = express();
var bodyParser = require('body-parser');
const path = require('path');
const server = http.createServer(app);
const db = require('./config/db');
const compression = require('compression');
const cron = require('node-cron');


const {
    load_data_workplaces,
    load_users,
    ensureDefaultRoles,
    ensureSandboxDemoUsers
} = require('./libs/initialSetup');
require('./models/role');
require('./models/work_order_operation');
require('./models/operation_timer');
require('./models/timer_event');
require('./models/operation_time_total');

const authRoutes = require('./routes/auth');
const chronometerRoutes = require('./routes/chronometer');
const chronometerController = require('./controllers/chronometer');
const config = require('./config/config');
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
app.use(
  cors({
    allowedHeaders: ['Content-Type', 'x-access-token', 'x-station-id']
  })
);
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

if (config.NS_SHIFT_BATCH_ENABLED && config.NS_AUTO_STOP_AT_SHIFT_END) {
    const [hourRaw, minuteRaw] = String(config.NS_SHIFT_BATCH_TIME || '17:00').split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        const cronExpr = `${minute} ${hour} * * *`;
        cron.schedule(cronExpr, async () => {
            try {
                const result = await chronometerController.runShiftClose('scheduler');
                console.log('Shift batch completed:', result);
            } catch (error) {
                console.error('Shift batch failed:', error);
            }
        }, { timezone: config.NS_TIMEZONE });
        console.log(`Shift batch scheduler enabled at ${config.NS_SHIFT_BATCH_TIME} (${config.NS_TIMEZONE}).`);
    } else {
        console.warn(`Invalid NS_SHIFT_BATCH_TIME value: ${config.NS_SHIFT_BATCH_TIME}`);
    }
}

// Puerto abierto de inmediato: healthcheck TCP/HTTP no mata el contenedor durante sync.
server.listen(8000, () => {
    console.log('HTTP en puerto 8000 (sync DB en curso; /health = starting hasta listo).');
});

db.sync({ alter: true })
    .then(async () => {
        console.log('Base de datos sincronizada.');
        try {
            await ensureDefaultRoles();
            await load_data_workplaces();
            await load_users();
            await ensureSandboxDemoUsers();
        } catch (e) {
            console.error('Error en carga inicial (roles/workplaces/usuarios):', e);
        }
        dbReady = true;
        console.log('Server initialized (API lista).');
    })
    .catch((error) => {
        console.error('Error al sincronizar la base de datos:', error);
        process.exit(1);
    });