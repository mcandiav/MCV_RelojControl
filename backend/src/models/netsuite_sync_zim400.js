const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const NetsuiteSyncZim400 = sequelize.define(
  'NetsuiteSyncZim400',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // Unique vía índice nombrado (evita acumulación por sync(alter)).
    stop_event_id: { type: DataTypes.INTEGER, allowNull: false },
    queue_item_id: { type: DataTypes.INTEGER, allowNull: true },
    work_order_operation_id: { type: DataTypes.INTEGER, allowNull: false },
    ot_number: { type: DataTypes.STRING(64), allowNull: true },
    operation_sequence: { type: DataTypes.INTEGER, allowNull: true },
    netsuite_work_order_id: { type: DataTypes.STRING(64), allowNull: true },
    netsuite_operation_id: { type: DataTypes.STRING(64), allowNull: true },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'PENDING',
      validate: { isIn: [['PENDING', 'PROCESSING', 'SENT', 'ERROR', 'RETRY', 'CANCELLED']] }
    },
    attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    payload_json: { type: DataTypes.TEXT('long'), allowNull: true },
    diagnostic_json: { type: DataTypes.TEXT('long'), allowNull: true },
    netsuite_record_id: { type: DataTypes.STRING(64), allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'netsuite_sync_zim400',
    modelName: 'NetsuiteSyncZim400',
    indexes: [
      { unique: true, name: 'uk_netsuite_sync_zim400_stop_event', fields: ['stop_event_id'] },
      { name: 'idx_netsuite_sync_zim400_status', fields: ['status'] },
      { name: 'idx_netsuite_sync_zim400_queue_item', fields: ['queue_item_id'] },
      { name: 'idx_netsuite_sync_zim400_operation', fields: ['work_order_operation_id'] },
      { name: 'idx_netsuite_sync_zim400_sent_at', fields: ['sent_at'] }
    ]
  }
);

module.exports = NetsuiteSyncZim400;
