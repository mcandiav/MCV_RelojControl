const { DataTypes } = require('sequelize');
const sequelize = require('../config/db')
const User = require('./user')

const workplaceSchema = sequelize.define('Workplace', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'Workplace' // We need to choose the model name
  });

workplaceSchema.hasMany(User);
User.belongsTo(workplaceSchema);

module.exports = workplaceSchema
