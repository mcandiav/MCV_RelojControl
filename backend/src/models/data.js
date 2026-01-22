const { DataTypes } = require('sequelize');
const sequelize = require('../config/db')

/**
 * Modelo de datos, donde se guardan las OT's que se cargan desde el archivo Excel.
 */

const dataSchema = sequelize.define('Data', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
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
      n_times_paused: { // Este valor se utilizara para guardar la cantidad esperada a realizar (por temas de tiempo y no poder pausar el reloj control).
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
      },
      // planned_quantity: { // Cantidad planificada
      //   type: DataTypes.INTEGER,
      //   allowNull: true,
      // }
},
{
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'Data', // We need to choose the model name
});

sequelize.sync().then(() => {
  console.log('Tabla Data creada exitosamente!');
}).catch((error) => {
  console.error('No se puede crear la tabla: ', error);
});

module.exports = dataSchema
