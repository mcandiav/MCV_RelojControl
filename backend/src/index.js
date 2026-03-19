const http = require('http');
const express = require('express');
const app = express();
var bodyParser = require('body-parser');
const path = require('path');
const server = http.createServer(app);
const db = require('./config/db');
const compression = require('compression');
const cron = require('node-cron');


const { load_data_workplaces, load_users } = require('./libs/initialSetup');
require('./models/work_order_operation');
require('./models/operation_timer');
require('./models/timer_event');
require('./models/operation_time_total');

const authRoutes = require('./routes/auth');
const chronometerRoutes = require('./routes/chronometer');
const chronometerController = require('./controllers/chronometer');
const config = require('./config/config');
var cors = require('cors');


app.use(function setCommonHeaders(req, res, next) {
    res.set("Access-Control-Allow-Private-Network", "true");
    next();
  });
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'files')));
app.use(cors());
app.use(compression());

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

db.sync({ alter: true }).then(() => {
    console.log('Base de datos sincronizada.');
    load_data_workplaces();
    load_users();
}).catch((error) => {
    console.error('Error al sincronizar la base de datos:', error);
});

server.listen(8000, ()=>{
    console.log('Server initialized.')
});