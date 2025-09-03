const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')
const User = require('./user')
const Finalized = require('./finalized')
const Record = require('./record')
const Data = require('./data')

const regestrySchema = sequelize.define('Registry', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    id_ot: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_finalized: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    id_record: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: true
    },
},
{
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'Registry', // We need to choose the model name
});

regestrySchema.belongsTo(User, { foreignKey: 'id_user' }); // Relación de Registry a User, usando id_user como clave foránea
regestrySchema.belongsTo(Finalized, { foreignKey: 'id_finalized' }); // Relación de Registry a Finalized, usando id_registry como clave foránea
regestrySchema.belongsTo(Record, { foreignKey: 'id_record' }); // Relación de Registry a Record, usando id_registry como clave foránea
regestrySchema.belongsTo(Data, { foreignKey: 'id_ot' }); // Relación de Registry a Data, usando id_registry como clave foránea

sequelize.sync().then(() => {
    console.log('Tabla User creada exitosamente!');
  }).catch((error) => {
    console.error('No se puede crear la tabla: ', error);
  });
  
  module.exports = regestrySchema