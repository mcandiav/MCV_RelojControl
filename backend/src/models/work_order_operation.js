const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WorkOrderOperation = sequelize.define('WorkOrderOperation', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  ot_number: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  operation_sequence: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  operation_code: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  operation_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  resource_code: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  area: {
    type: DataTypes.STRING(8),
    allowNull: false,
    validate: {
      isIn: [['ME', 'ES']]
    }
  },
  planned_setup_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  planned_operation_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  netsuite_work_order_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  netsuite_operation_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  source_status: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'WIP'
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'work_order_operations',
  modelName: 'WorkOrderOperation',
  indexes: [
    {
      unique: true,
      fields: ['ot_number', 'operation_sequence', 'resource_code']
    },
    {
      fields: ['ot_number']
    },
    {
      fields: ['area']
    }
  ]
});

module.exports = WorkOrderOperation;
