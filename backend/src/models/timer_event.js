const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');
const OperationTimer = require('./operation_timer');
const WorkOrderOperation = require('./work_order_operation');

const TimerEvent = sequelize.define('TimerEvent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  operation_timer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  work_order_operation_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  event_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    validate: {
      isIn: [['START', 'PAUSE', 'RESUME', 'STOP', 'AUTO_STOP_SHIFT_END']]
    }
  },
  event_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  details_json: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  }
}, {
  tableName: 'timer_events',
  modelName: 'TimerEvent',
  indexes: [
    {
      fields: ['operation_timer_id']
    },
    {
      fields: ['work_order_operation_id']
    },
    {
      fields: ['event_type']
    },
    {
      fields: ['event_at']
    }
  ]
});

TimerEvent.belongsTo(OperationTimer, { foreignKey: 'operation_timer_id' });
OperationTimer.hasMany(TimerEvent, { foreignKey: 'operation_timer_id' });

TimerEvent.belongsTo(WorkOrderOperation, { foreignKey: 'work_order_operation_id' });
WorkOrderOperation.hasMany(TimerEvent, { foreignKey: 'work_order_operation_id' });

TimerEvent.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(TimerEvent, { foreignKey: 'user_id' });

module.exports = TimerEvent;
