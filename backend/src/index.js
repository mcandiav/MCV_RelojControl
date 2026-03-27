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
const cors = require('cors');
const corsOptions = require('./config/corsOptions');

/** Evita bucle SIGTERM: EasyPanel/Docker suelen hacer healthcheck HTTP mientras corre db.sync (alter). */
let dbReady = false;
const BUILD_VERSION = String(process.env.APP_BUILD_VERSION || process.env.GIT_SHA || process.env.BUILD_VERSION || 'V2').trim();

app.use(function setCommonHeaders(req, res, next) {
    res.set("Access-Control-Allow-Private-Network", "true");
    next();
  });
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'files')));
app.use(cors(corsOptions));
// Asegura preflight OPTIONS en proxies estrictos (Cloudflare/Traefik).
app.options('*', cors(corsOptions));
app.use(compression());

/**
 * CORS explícito solo para diagnóstico NetSuite.
 * Motivo: cuando la llamada a NetSuite falla y devolvemos 502, algunos paths/proxies terminan sin ACAO
 * y el navegador oculta el body (“blocked by CORS”), impidiendo ver el error real.
 */
app.use('/chronometer/netsuite', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, x-access-token, x-station-id, x-terminal-id, Accept'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
});

// 200 siempre: muchos healthchecks solo miran código HTTP (503 durante sync = reinicios en bucle).
app.get(['/', '/health'], (req, res) => {
    if (dbReady) return res.status(200).json({ status: 'ok', build: BUILD_VERSION });
    return res.status(200).json({ status: 'starting', build: BUILD_VERSION });
});

/** GET sin auth: probar desde el front (otro subdominio) que haya TLS + CORS. */
app.get('/cors-ping', (req, res) => {
    res.status(200).json({ ok: true, dbReady, t: new Date().toISOString() });
});

function applyCorsForEarlyResponse(req, res) {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    const reqHdr = req.headers['access-control-request-headers'];
    res.setHeader(
        'Access-Control-Allow-Headers',
        reqHdr || 'Content-Type, Authorization, x-access-token, x-station-id, x-terminal-id, Accept'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
}

app.use((req, res, next) => {
    if (dbReady) return next();
    applyCorsForEarlyResponse(req, res);
    return res.status(503).json({ message: 'Service starting' });
});

// Logging mínimo para diagnóstico (NetSuite): útil cuando el proxy devuelve 502 y no llega al handler.
app.use((req, res, next) => {
    const p = req.path || '';
    if (!p.startsWith('/chronometer/netsuite')) return next();
    const started = Date.now();
    const origin = req.headers.origin || '';
    console.log('[netsuite][in]', req.method, p, origin ? `origin=${origin}` : '');
    res.on('finish', () => {
        const ms = Date.now() - started;
        console.log('[netsuite][out]', req.method, p, `status=${res.statusCode}`, `ms=${ms}`);
    });
    return next();
});

app.use('/auth', authRoutes);
app.use('/chronometer', chronometerRoutes);

// Puerto abierto de inmediato: healthcheck TCP/HTTP no mata el contenedor durante sync.
server.listen(8000, () => {
    console.log(`HTTP en puerto 8000 (build=${BUILD_VERSION}) (sync DB en curso; /health = 503 hasta listo).`);
});

db.sync({ alter: true })
    .then(async () => {
        console.log('Base de datos sincronizada.');
        await load_data_workplaces();
        await load_users();
        await ensureShiftCloseSlots();
        await registerShiftCloseCrons();
        dbReady = true;
        console.log(`Server initialized (API lista, build=${BUILD_VERSION}).`);
    })
    .catch((error) => {
        console.error('Error al sincronizar la base de datos:', error);
        process.exit(1);
    });