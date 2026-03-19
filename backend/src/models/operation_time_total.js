const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const WorkOrderOperation = require('./work_order_operation');

const OperationTimeTotal = sequelize.define('OperationTimeTotal', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  work_order_operation_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  shift_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  total_active_seconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  total_pause_seconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  sync_status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'PENDING',
    validate: {
      isIn: [['PENDING', 'SENT', 'ERROR']]
    }
  },
  retry_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  last_error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  last_consolidated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'operation_time_totals',
  modelName: 'OperationTimeTotal',
  indexes: [
    {
      unique: true,
      fields: ['work_order_operation_id', 'shift_date']
    },
    {
      fields: ['sync_status']
    }
  ]
});

OperationTimeTotal.belongsTo(WorkOrderOperation, { foreignKey: 'work_order_operation_id' });
WorkOrderOperation.hasMany(OperationTimeTotal, { foreignKey: 'work_order_operation_id' });

module.exports = OperationTimeTotal;
