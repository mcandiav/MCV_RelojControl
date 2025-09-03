const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');
const Data = require('./data');

const TaskIntervals = sequelize.define('TaskIntervals', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Data',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  parent_interval_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'TaskIntervals',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  stage: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'En montaje',
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  paused: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  sequelize,
  modelName: 'TaskIntervals',
  timestamps: false,
});

TaskIntervals.belongsTo(User, { foreignKey: 'user_id' });
TaskIntervals.belongsTo(Data, { foreignKey: 'task_id' });
TaskIntervals.belongsTo(TaskIntervals, { as: 'ParentInterval', foreignKey: 'parent_interval_id' });

sequelize.sync().then(() => {
  console.log('Tabla TaskIntervals creada exitosamente!');
}).catch((error) => {
  console.error('No se puede crear la tabla TaskIntervals:', error);
});

module.exports = TaskIntervals;
