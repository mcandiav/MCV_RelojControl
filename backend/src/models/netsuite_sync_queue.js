const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const NetsuiteSyncQueue = sequelize.define(
  'NetsuiteSyncQueue',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    idempotency_key: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true
    },
    work_order_operation_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    trigger_event_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'PENDING',
      validate: {
        isIn: [['PENDING', 'PROCESSING', 'SENT', 'RETRY', 'ERROR', 'CANCELLED']]
      }
    },
    attempt_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    next_retry_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    payload_json: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    result_json: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    tableName: 'netsuite_sync_queue',
    modelName: 'NetsuiteSyncQueue',
    indexes: [
      { fields: ['status'] },
      { fields: ['work_order_operation_id'] },
      { fields: ['trigger_event_id'] },
      { fields: ['next_retry_at'] },
      { fields: ['locked_at'] }
    ]
  }
);

module.exports = NetsuiteSyncQueue;
