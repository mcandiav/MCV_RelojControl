const { Sequelize } = require('sequelize');
const config = require("./config");

const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
    dialect: config.dialect,
    host: config.HOST,
    port: config.PORT,
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
 }).catch((error) => {
    console.error('Unable to connect to the database: ', error);
 });

module.exports = sequelize