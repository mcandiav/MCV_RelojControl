const sequelize = require('../config/db.js');
const Record = require('../models/record');
const User = require('../models/user');
const { Op, or } = require("sequelize");

// Sincronizar los modelos antes de ejecutar la consulta
sequelize.sync().then(() => {
    console.log('Base de datos sincronizada.');

    async function getRecords() {
        data = await Record.findAll({
            where: {
                state: {
                    [Op.in]: ["En curso", "Pausado", "En montaje"]
                }
            },
            include: [{
                model: User,
                attributes: ['name', 'lastname']
            }],
        });
        console.log('Registros:', data);
    }

    getRecords();
}).catch((error) => {
    console.error('Error al sincronizar la base de datos:', error);
});