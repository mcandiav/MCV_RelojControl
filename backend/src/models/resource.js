const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')

const orderSchema = sequelize.define('Resource', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  ot: {
    type: DataTypes.STRING,
    allowNull: false
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Resource' // We need to choose the model name
});

sequelize.sync().then(() => {
  console.log('Tabla creada exitosamente!');
}).catch((error) => {
  console.error('No se puede crear la tabla: ', error);
});

module.exports = orderSchema
//module.exports = mongoose.model("Order", orderSchema);