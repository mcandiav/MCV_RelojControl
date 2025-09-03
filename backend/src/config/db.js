const { Sequelize } = require('sequelize');
const config = require("./config");

const path = `${config.dialect}://${config.USER}:${config.PASSWORD}@${config.HOST}:${config.PORT}/${config.DB}`;
const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
    dialect: 'mssql',//'mssql',
    host: config.HOST,
    port: config.PORT,
    idle_in_transaction_session_timeout: 60000
  });

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
 }).catch((error) => {
    console.error('Unable to connect to the database: ', error);
 });

module.exports = sequelize