const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')

const dischargedSchema = sequelize.define('Discharged', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_finalized: {
      type: DataTypes.INTEGER,
    },
  }, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'Discharged' // We need to choose the model name
  });

sequelize.sync().then(() => {
    console.log('Tabla discharged creada exitosamente!');
}).catch((error) => {
    console.error('No se puede crear la tabla: ', error);
});
  
module.exports = dischargedSchema