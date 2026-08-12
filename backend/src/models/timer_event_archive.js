const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const TimerEventArchive = sequelize.define('TimerEventArchive', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  source_timer_event_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  operation_timer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  work_order_operation_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  event_type: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  event_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  details_json: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  archived_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  ot_number: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  operation_sequence: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  operation_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  resource_code: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  user_name_snapshot: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  station_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  planned_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  completed_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'timer_events_archive',
  modelName: 'TimerEventArchive',
  indexes: [
    { fields: ['event_at'] },
    { fields: ['user_id'] },
    { fields: ['event_type'] },
    { fields: ['ot_number'] },
    { fields: ['operation_timer_id'] },
    {
      unique: true,
      fields: ['source_timer_event_id'],
      name: 'uk_timer_events_archive_source_id'
    }
  ]
});

TimerEventArchive.belongsTo(User, { foreignKey: 'user_id', constraints: false });
User.hasMany(TimerEventArchive, { foreignKey: 'user_id', constraints: false });

module.exports = TimerEventArchive;
