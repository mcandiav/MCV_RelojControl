const { DataTypes } = require('sequelize');
const sequelize = require('../config/db')
const User = require('./user')

const recordSchema = sequelize.define('Record', {
      id_record: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      id_user: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      name: { //nombre del trabajador
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
      },
      resource: { // Centro de trabajo
        type: DataTypes.STRING,
        allowNull: false
      },
      quantity: { // Cantidad
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: -1
      },
      ot: { // OT
        type: DataTypes.STRING,
        allowNull: false
      },
      assembly_time:{
        type: DataTypes.INTEGER, // Configuracion montaje
        allowNull: false
      },
      estimated_time: { // Configuracion fabricacion
        type: DataTypes.INTEGER,
        allowNull: false
      },
      max_time: { // Configuracion real de frabricacion
        type: DataTypes.DATE,
        allowNull: true
      },
      assembly_max_time: { // Configuracion real de montaje
        type: DataTypes.DATE,
        allowNull: true
      },
      missing_time: { // diferencia o tiempo real final de fabricacion
        type: DataTypes.INTEGER,
        allowNull: true
      },
      assembly_missing_time: { // diferencia en montaje
        type: DataTypes.INTEGER,
        allowNull: true
      },
      finished_assembly:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      date: { // fecha
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      paused: { // Pausado?
        type: DataTypes.BOOLEAN ,
        defaultValue: false,
      },
      n_times_paused: { // Cantidad de veces pausado
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      time_out: { // Tiempo total en pausa
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      stoped: { // Detenido
        type: DataTypes.BOOLEAN ,
        defaultValue: false,
      },
      item: { // Secuencia.
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      operation_name: { // Nombre de la operacion
        type: DataTypes.STRING,
        allowNull: false
      }
},
{
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'Record', // We need to choose the model name
});

recordSchema.belongsTo(User, { foreignKey: 'id_user' }); // Relación de Registry a User, usando id_user como clave foránea

sequelize.sync().then(() => {
  console.log('Tabla Data creada exitosamente!');
}).catch((error) => {
  console.error('No se puede crear la tabla: ', error);
});

module.exports = recordSchema
