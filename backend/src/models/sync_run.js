const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SyncRun = sequelize.define('SyncRun', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  flow_type: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'operational'
  },
  trigger: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'manual'
  },
  status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'RUNNING',
    validate: {
      isIn: [['RUNNING', 'SUCCESS', 'ERROR']]
    }
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  finished_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  requested_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  station_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  warning: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  summary_json: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'sync_runs',
  modelName: 'SyncRun',
  indexes: [
    { fields: ['started_at'] },
    { fields: ['status'] },
    { fields: ['flow_type'] }
  ]
});

module.exports = SyncRun;

