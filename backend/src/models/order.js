const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')

const orderSchema = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: -1
  },
  ot: {
    type: DataTypes.STRING,
    allowNull: false
  },
  estimated_time: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  max_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  missing_time: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  paused: {
    type: DataTypes.BOOLEAN ,
    defaultValue: false,
  },
  n_times_paused: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  time_out: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  stoped: {
    type: DataTypes.BOOLEAN ,
    defaultValue: false,
  },
  item: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Order' // We need to choose the model name
});

sequelize.sync().then(() => {
  console.log('Tabla creada exitosamente!');
}).catch((error) => {
  console.error('No se puede crear la tabla: ', error);
});

module.exports = orderSchema
//module.exports = mongoose.model("Order", orderSchema);