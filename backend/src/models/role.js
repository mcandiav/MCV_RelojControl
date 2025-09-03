const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')
const User = require('./user')
const Workplace = require('./workplace')

const roleSchema = sequelize.define('Role', {
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
    modelName: 'Role' // We need to choose the model name
  });

  roleSchema.hasMany(User);
  User.belongsTo(roleSchema);

sequelize.sync().then(() => {
    console.log('Tabla Role creada exitosamente!');
}).catch((error) => {
    console.error('No se puede crear la tabla: ', error);
});
  
module.exports = roleSchema