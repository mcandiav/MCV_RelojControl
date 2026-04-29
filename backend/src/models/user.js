const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db')
const bcrypt = require("bcryptjs");

const userSchema = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    username:{
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lastname: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
},
{
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'User', // We need to choose the model name
});

userSchema.addHook('beforeCreate', (user, options) => {
    const salt = bcrypt.genSaltSync();
    user.password = bcrypt.hashSync(user.password, salt);
})

userSchema.prototype.validPassword = function(password, hash){
    return bcrypt.compareSync(password, this.password);
}

module.exports = userSchema
