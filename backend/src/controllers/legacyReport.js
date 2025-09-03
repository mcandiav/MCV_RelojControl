/* eslint-disable */
const sequelize = require('../config/db.js');
const User = require('../models/user');
const Role = require('../models/role');
const Workplace = require('../models/workplace');
const Finalized = require('../models/finalized');
const Registry = require('../models/registry');
const { Op } = require("sequelize");
const { startOfDay, endOfDay, parseISO } = require('date-fns');

async function listWorkers_return_legacy(req) {
    console.log('Legacy listWorkers_return');
    const { start, end, workplace, role } = req.query;

    let whereClause = {
        '$User.Workplace.name$': {
            [Op.like]: workplace === 'all' ? '%' : workplace
        },
        '$User.Role.name$': {
            [Op.like]: role === 'all' ? '%' : role
        },
    };

    if (start && end) {
        const startDate = startOfDay(parseISO(start));
        const endDate = endOfDay(parseISO(end));
        whereClause.createdAt = {
            [Op.between]: [startDate, endDate]
        };
    }

    const finalized = await Finalized.findAll({
        where: whereClause,
        include: [{
            model: User,
            include: [Role, Workplace]
        }],
        order: [
            ['createdAt', 'DESC']
        ],
    });

    const records = {};
    for (const reg of finalized) {
        const registries = await Registry.findAll({
            where: {
                id_finalized: reg.id_finalized
            }
        });

        for (const registry of registries) {
            const user = await User.findOne({ where: { id: registry.id_user } });
            if (user) {
                const key = `${user.name} ${user.lastname}`;
                if (!records[key]) {
                    records[key] = {
                        name: user.name,
                        lastname: user.lastname,
                        total_time_assembly: 0,
                        total_time_ejecution: 0,
                        registries: []
                    };
                }
                records[key].total_time_assembly += registry.total_time_assembly;
                records[key].total_time_ejecution += registry.total_time_ejecution;
                records[key].registries.push(reg);
            }
        }
    }
    return records;
}

exports.complianceReportLegacy = async function (req, res) {
    const listWorkers = await listWorkers_return_legacy(req);
    const hrsMonth = 160;
    const agroupByName = {};

    for (const key in listWorkers) {
        if (!agroupByName[key]) {
            agroupByName[key] = {
                total_time_assembly: 0,
                total_time_ejecution: 0,
                compliance: 0
            };
        }
        agroupByName[key].total_time_assembly += listWorkers[key].total_time_assembly;
        agroupByName[key].total_time_ejecution += listWorkers[key].total_time_ejecution;
    }

    for (const key in agroupByName) {
        const totalMinutes = agroupByName[key].total_time_ejecution + agroupByName[key].total_time_assembly;
        agroupByName[key].compliance = ((totalMinutes / 60 / hrsMonth) * 100).toFixed(2);
    }

    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(agroupByName);
};

exports.complianceReportbyDayLegacy = async function (req, res) {
    const hrsDay = 8;
    req.query.end = req.query.start;

    const listWorkers = await listWorkers_return_legacy(req);
    const agroupByName = {};

    for (const key in listWorkers) {
        if (!agroupByName[key]) {
            agroupByName[key] = {
                total_time_assembly: 0,
                total_time_ejecution: 0,
                compliance: 0
            };
        }
        agroupByName[key].total_time_assembly += listWorkers[key].total_time_assembly;
        agroupByName[key].total_time_ejecution += listWorkers[key].total_time_ejecution;
    }

    for (const key in agroupByName) {
        const totalMinutes = agroupByName[key].total_time_ejecution + agroupByName[key].total_time_assembly;
        agroupByName[key].compliance = ((totalMinutes / 60 / hrsDay) * 100).toFixed(2);
    }

    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(agroupByName);
};

exports.timerReportLegacy = async function (req, res) {
    const { yearMonthdays } = req.body;
    const agroupByName = {};

    for (const day of yearMonthdays) {
        req.query.start = day;
        req.query.end = day;
        const listWorkers = await listWorkers_return_legacy(req);

        for (const key in listWorkers) {
            if (!agroupByName[key]) {
                agroupByName[key] = {};
            }
            if (!agroupByName[key][day]) {
                agroupByName[key][day] = {
                    total_time_assembly: 0,
                    total_time_ejecution: 0,
                };
            }
            agroupByName[key][day].total_time_assembly += listWorkers[key].total_time_assembly;
            agroupByName[key][day].total_time_ejecution += listWorkers[key].total_time_ejecution;
        }
    }

    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(agroupByName);
};
