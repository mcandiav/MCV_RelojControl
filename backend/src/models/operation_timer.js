const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');
const WorkOrderOperation = require('./work_order_operation');

const OperationTimer = sequelize.define('OperationTimer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  work_order_operation_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  resource_code: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  current_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'STOPPED',
    validate: {
      isIn: [['ACTIVE', 'PAUSED', 'STOPPED']]
    }
  },
  active_since: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_event_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  total_elapsed_seconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  shift_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  station_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Pantalla/PC donde se opera el cronometro (multi-estacion)'
  }
}, {
  tableName: 'operation_timers',
  modelName: 'OperationTimer',
  indexes: [
    {
      fields: ['resource_code']
    },
    {
      fields: ['status']
    },
    {
      unique: true,
      fields: ['work_order_operation_id']
    },
    {
      fields: ['station_id']
    }
  ]
});

OperationTimer.belongsTo(WorkOrderOperation, { foreignKey: 'work_order_operation_id' });
WorkOrderOperation.hasOne(OperationTimer, { foreignKey: 'work_order_operation_id' });

OperationTimer.belongsTo(User, { foreignKey: 'current_user_id' });
User.hasMany(OperationTimer, { foreignKey: 'current_user_id' });

module.exports = OperationTimer;
