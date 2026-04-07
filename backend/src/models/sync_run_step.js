const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const SyncRun = require('./sync_run');

const SyncRunStep = sequelize.define('SyncRunStep', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sync_run_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  step_name: {
    type: DataTypes.STRING(24),
    allowNull: false
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
  result_json: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'sync_run_steps',
  modelName: 'SyncRunStep',
  indexes: [
    { fields: ['sync_run_id'] },
    { fields: ['step_name'] },
    { fields: ['status'] },
    { fields: ['started_at'] }
  ]
});

SyncRun.hasMany(SyncRunStep, { foreignKey: 'sync_run_id', onDelete: 'CASCADE' });
SyncRunStep.belongsTo(SyncRun, { foreignKey: 'sync_run_id' });

module.exports = SyncRunStep;

