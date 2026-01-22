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
  indexes: [
    { unique: true, fields: ['key'], name: 'uniq_discharged_key' }
  ]
})


// Mantengo el sync como en tu archivo original. Si vas a recrear la tabla,
// primero haz DROP TABLE y luego deja que esto la cree con el nuevo esquema.
sequelize.sync().then(() => {
  console.log('Tabla Discharged (STRING key) lista!')
}).catch((error) => {
  console.error('No se puede crear/validar la tabla Discharged: ', error)
})

module.exports = dischargedSchema