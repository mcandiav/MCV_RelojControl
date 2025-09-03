const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')
const bcrypt = require("bcrypt-nodejs");
const User = require('./user')

const logSchema = sequelize.define('Log', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sign_in: {
        type: DataTypes.DATE,
        allowNull: false
    },
    sign_out: {
        type: DataTypes.DATE,
        allowNull: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
},
{
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'Log', // We need to choose the model name
});

// Definir relacion de uno a muchos con la tabla User
logSchema.belongsTo(User, { foreignKey: 'user_id' });

sequelize.sync().then(() => {
    console.log('Tabla User creada exitosamente!');
  }).catch((error) => {
    console.error('No se puede crear la tabla: ', error);
  });
  
  module.exports = logSchema