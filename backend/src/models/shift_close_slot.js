const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ShiftCloseSlot = sequelize.define('ShiftCloseSlot', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 3 }
  },
  hhmm: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'shift_close_slots',
  modelName: 'ShiftCloseSlot'
});

module.exports = ShiftCloseSlot;
