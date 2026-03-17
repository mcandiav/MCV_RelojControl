const http = require('http');
const express = require('express');
const app = express();
var bodyParser = require('body-parser');
const path = require('path');
const server = http.createServer(app);
const db = require('./config/db');
const compression = require('compression');


const { load_data, load_data_workplaces, load_users } = require('./libs/initialSetup');

const index = require('./routes/index')
const order = require('./routes/order')
const authRoutes = require('./routes/auth');
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

app.use(index)
app.use('/order', order);
app.use('/auth', authRoutes);

db.sync({ alter: true }).then(() => {
    console.log('Base de datos sincronizada.');
    load_data();
    load_data_workplaces();
    load_users();
}).catch((error) => {
    console.error('Error al sincronizar la base de datos:', error);
});

server.listen(8000, ()=>{
    console.log('Server initialized.')
});