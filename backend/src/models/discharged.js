const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')

const dischargedSchema = sequelize.define('Discharged', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING(256),
    allowNull: false,
    unique: true
  },
  // Compatibilidad opcional con la versión anterior basada en INTEGER
  // (puede quedar null y no se usa si deduplicas por `key`)
  id_finalized: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'Discharged',
  modelName: 'Discharged',
  timestamps: true,
})

module.exports = dischargedSchema