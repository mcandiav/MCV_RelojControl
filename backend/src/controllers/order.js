/* eslint-disable */

// =========================================
// IMPORTS Y CONFIGURACIÓN INICIAL
// =========================================

const sequelize = require('../config/db.js');
const cron = require('node-cron');
const { Op } = require("sequelize");
const { 
    isValid, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    isWeekend, 
    format, 
    addHours, 
    differenceInMilliseconds, 
    differenceInMinutes, 
    addDays, 
    subDays, 
    addMonths 
} = require('date-fns');

// Importación de Modelos de la Base de Datos
const Order = require('../models/order.js');
const Resource = require('../models/resource.js');
const Count = require('../models/count.js');
const Data = require('../models/data');
const User = require('../models/user');
const Role = require('../models/role');
const Workplace = require('../models/workplace');
const Finalized = require('../models/finalized');
const Record = require('../models/record');
const Discharged = require('../models/discharged');
const Registry = require('../models/registry');
const Log = require('../models/log');
const TaskIntervals = require('../models/task_interval');

// Servicios y configuración
const config = require('../config/config.js');
const { getSafeTimer, minutesToMs, getChileOffsetHours } = require('./timeService');

// =========================================
// FUNCIONES AUXILIARES INTERNAS
// =========================================

/**
 * Calcula las duraciones totales para las etapas de 'montaje', 'curso' y 'pausado'
 * de una tarea específica, basándose en sus intervalos registrados.
 * @param {number} taskId - ID de la tarea.
 * @param {number} userId - ID del usuario.
 * @param {number} parentId - ID del intervalo padre que agrupa la secuencia.
 * @returns {Promise<object>} Objeto con las duraciones en minutos para montaje, curso y pausado.
 */
async function getFinalizedTaskDurations(taskId, userId, parentId) {
    const intervals = await TaskIntervals.findAll({
      where: {
        task_id: taskId,
        user_id: userId,
        parent_interval_id: parentId
      },
      order: [['start_time', 'ASC']]
    });
  
    let montaje = 0;
    let curso = 0;
    let pausado = 0;
  
    for (let i = 0; i < intervals.length; i++) {
      const current = intervals[i];
      const next = intervals[i + 1] || null;
  
      const start = new Date(current.start_time);
      const end = current.end_time ? new Date(current.end_time) : null;
  
      if (!isValid(start) || !isValid(end)) continue;
  
      const duration = differenceInMinutes(end, start);
  
      if (current.paused) {
        const pauseEnd = next ? new Date(next.start_time) : new Date();
        pausado += differenceInMinutes(pauseEnd, end);
      }
  
      if (current.stage === 'En montaje') {
        montaje += duration;
      } else if (current.stage === 'En curso' || current.stage === 'Completado') {
        curso += duration;
      }
    }
  
    return {
      montaje: Math.round(montaje),
      curso: Math.round(curso),
      pausado: Math.round(pausado)
    };
}

/**
 * Detiene todas las órdenes de trabajo que se encuentran activas ('En montaje', 'Pausado', 'En curso').
 * Se utiliza principalmente en tareas programadas (cron jobs) para asegurar que no queden tareas corriendo
 * fuera del horario laboral.
 */
const stopAll = async function(req, res) {
    console.log('Stop all orders.');

    var data = await Record.findAll({
        where: {
            state: {
                [Op.in]: ["Pausado", "En montaje"]
            }
        },
        include: [{
            model: User,
            attributes: ['name', 'lastname']
        }],
    });

    var en_montaje_pausa = data.filter(reg => reg.state === "En montaje" || reg.state === "Pausado");
    console.log('total en montaje o pausa: ', en_montaje_pausa.length);

    for (const reg of en_montaje_pausa) {
        req.body = reg;
        req.userId = reg.id_user;
        req.quantity = 0;

        const fakeRes = {
            status: () => fakeRes,
            send: () => {},
            header: () => {},
        };

        try {
            await exports.stop(req, fakeRes);
            console.log('Registro detenido:', reg.id);
        } catch (error) {
            console.error('Error al detener el registro:', reg.id, error);
        }
    }

    var en_curso = await Record.findAll({
        where: {
            state: {
                [Op.in]: ["En curso"]
            }
        },
        include: [{
            model: User,
            attributes: ['name', 'lastname']
        }],
    });

    console.log('total en curso: ', en_curso.length);

    const stopRecords = async (records) => {
        if (records.length === 0) {
            return;
        }

        for (const reg of records) {
            req.body = reg;
            req.userId = reg.id_user;
            req.quantity = 0;

            const fakeRes2 = {
                status: () => fakeRes2,
                send: () => {},
                header: () => {},
            };

            try {
                await exports.stop(req, fakeRes2);
                console.log('Registro detenido:', reg.id);
            } catch (error) {
                console.error('Error al detener el registro:', reg.id, error);
            }
        }

        var en_curso_restante = await Record.findAll({
            where: {
                state: {
                    [Op.in]: ["En curso"]
                }
            },
            include: [{
                model: User,
                attributes: ['name', 'lastname']
            }],
        });

        console.log('total en curso restante: ', en_curso_restante.length);
        await stopRecords(en_curso_restante);
    };

    await stopRecords(en_curso);
};


// =========================================
// GESTIÓN DE ÓRDENES (CRUD)
// =========================================

/**
 * Crea una nueva orden de trabajo en la base de datos.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.create = async function (req, res) {
    console.log('Creando una nueva orden.')
    const { ot, resource, assembly_time, estimated_time, item } = req.body

    var new_order = {
        resource: resource,
        ot: ot,
        assembly_time: assembly_time,
        estimated_time: estimated_time,
        item: item,
        state: "No iniciado",
        max_time: new Date(),
        date: new Date()
    }
    
    const minutesInMillisAssembly = assembly_time * 60 * 1000;
    new_order.assembly_max_time = new_order.date.getTime() + minutesInMillisAssembly

    const minutesInMillis = estimated_time * 60 * 1000;
    new_order.max_time.setTime(new_order.date.getTime() + minutesInMillis);

    var newOrder = new Data(new_order);
    await newOrder.save().then(function (data) {
        if (!data) {
            console.log(err)
            res.header('Access-Control-Allow-Credentials', true);
            res.status(400).send('Unable to save a order to database.');
        } else {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(200).send(newOrder);
        }
    });
};

/**
 * Edita los detalles de una orden de trabajo existente.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.edit = async function (req, res) {
    console.log('Actualizando información.')
    const { id, ot, resource, assembly_time, estimated_time, item } = req.body

    var order = await Data.findOne({
        where: {
            id: id
        }
    })

    order.update({
        "ot": ot,
        "resource": resource,
        "assembly_time": assembly_time,
        "estimated_time": estimated_time,
        "item": item
    })

    await order.save().then(function (data) {
        if (!data) {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(400).send('Unable to update a order to database.');
        } else {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(200).send(order);
        }
    });
};

/**
 * Elimina una orden de trabajo de la base de datos, buscándola primero en la tabla `Data` y luego en `Record`.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.remove = async function (req, res) {
    console.log('Deleting a order.')
    const data_destroy = await Data.findOne({
        where: {
            id: req.body.id
        }
    })

    if (data_destroy === null) {
        const data_destroy_record = await Record.findOne({
            where: {
                id: req.body.id
            }
        })

        if (data_destroy_record === null) {
            res.status(404).send({ "message": "Order ID not found." });
        }

        await Record.destroy({
            where: {
                id: req.body.id
            }
        }).then(function (data) {
            if (!data) {
                res.status(404).send({ "message": "Order ID not found." });
            }
            res.header('Access-Control-Allow-Credentials', true);
            res.status(200).send({ "message": "Order ID removed." });
        });
    } else {
        await Data.destroy({
            where: {
                id: req.body.id
            }
        }).then(function (data) {
            if (!data) {
                res.status(404).send({ "message": "Order ID not found." });
            }
            res.header('Access-Control-Allow-Credentials', true);
            res.status(200).send({ "message": "Order ID removed." });
        });
    }
};

/**
 * Elimina todas las órdenes de trabajo de la tabla `Data` y los registros 'No iniciados' de la tabla `Record`.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.removeAll = async function (req, res) {
    console.log('Deleting all orders.')
    
    try {
        await Record.destroy({
            where: {
                state: "No iniciado"
            }
        })
    } catch (error) {
        console.log(error)
    }

    try{
        await Data.destroy({
            where: {},
            truncate: true
        }).then(function () {
                res.header('Access-Control-Allow-Credentials', true);
                res.status(200).send({ "message": "All records removed." });
        }).catch(function (error) {
            res.status(500).send({ "message": "Error occurred while deleting records." });
        });
    } catch (error) {
        console.log(error)
    }
};

// =========================================
// CICLO DE VIDA DE LA ORDEN (PLAY, PAUSE, STOP)
// =========================================

/**
 * Inicia o reanuda el trabajo en una orden, creando los registros e intervalos de tiempo correspondientes.
 * Cambia el estado a 'En montaje' o 'En curso'.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.play = async function (req, res) {
    console.log('Play order', req.body);
    
    const userId = req.userId;
    let record = await Record.findOne({
        where: { id: req.body.id, id_user: userId } 
    });

    console.log('Found record:', record);
    
    let registry = await Registry.findOne({
        where: { id_ot: req.body.id, id_user: userId },
        order: [[sequelize.literal('updatedAt'), 'DESC']],
    });
    
    let data_order = await Data.findOne({ where: { id: req.body.id } });
    
    const alreadyActive = await TaskIntervals.findOne({
        where: {
          task_id: data_order.id,
          user_id: userId,
          paused: false,
          completed: false
        }
    });

    if (alreadyActive) {
        if (alreadyActive.end_time === null) {
            return res.status(400).send({ text: "Ya tienes un intervalo activo para esta tarea." });
        }
    }
  
    if (!record) {
      const order = await Data.findOne({ where: { id: req.body.id } });
      record = await Record.create({
        id_user: userId,
        id: req.body.id,
        resource: order.resource,
        quantity: 0,
        ot: order.ot,
        assembly_time: order.assembly_time,
        estimated_time: order.estimated_time,
        max_time: order.max_time,
        assembly_max_time: order.assembly_max_time,
        missing_time: order.missing_time,
        assembly_missing_time: order.assembly_missing_time,
        finished_assembly: order.finished_assembly,
        date: order.date,
        paused: order.paused,
        n_times_paused: order.n_times_paused,
        time_out: order.time_out,
        stoped: order.stoped,
        item: order.item,
        state: order.state,
        operation_name: order.operation_name
      });
    }
  
    if (!registry || registry.id_finalized !== null) {
      await Registry.create({
        id_ot: req.body.id,
        id_user: userId,
        id_record: record.id_record,
        start_time: Date.now(),
        end_time: null
      });
    }

    let lastInteval = await TaskIntervals.findOne({
        where: {
          task_id: data_order.id,
          user_id: userId,
        },
        order: [['start_time', 'DESC']],
      });

    let newStage = "En montaje";
    let shouldCreate = false;
    let parentId = null;
    
    if (lastInteval) {
        if (lastInteval.paused || lastInteval.completed) {
            shouldCreate = true;
            if (!lastInteval.completed) {
                newStage = lastInteval.stage;
                parentId = lastInteval.parent_interval_id;
            }
        }
    } else {
        shouldCreate = true;
    }
    
    if (shouldCreate) {
        const newInterval = await TaskIntervals.create({
            task_id: data_order.id,
            user_id: userId,
            start_time: new Date(),
            stage: newStage,
            paused: false,
            completed: false,
        });
    
        newInterval.parent_interval_id = parentId ? parentId : newInterval.id;
        await newInterval.save();
    }
  
    if (record.state === "En montaje") return res.status(400).send({ text: "El recurso se encuentra en montaje." });
  
    const now = Date.now();
    const isMontaje = !record.finished_assembly;
    if(isMontaje){
        //montaje
        fullDuration = record.assembly_missing_time > 0 ? record.assembly_missing_time : record.assembly_time
    }else{
        //curso
        fullDuration = record.missing_time > 0 ? record.missing_time : record.estimated_time
    }
  
    const endTime = now + fullDuration * 60 * 1000;
  
    const updates = {
      date: now,
      state: isMontaje ? "En montaje" : "En curso",
      ...(isMontaje ? { assembly_max_time: endTime } : { max_time: endTime })
    };
  
    await record.update(updates);
    await record.save();
  
    return res.status(200).send(record);
};

/**
 * Pausa una orden de trabajo activa, calculando y guardando el tiempo restante.
 * Actualiza el estado de la orden a 'Pausado'.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.pause = async function (req, res) {
    console.log('Pause a order.', req.body.id)
    
    const user_id = req.userId === req.body.id_user ? req.userId : req.body.id_user

    var order = await Record.findOne({
        where: {
            id: req.body.id,
            id_user: user_id
        }
    })

    if (order === null) {
        return res.status(400).send("None");
    }

    if (order.state === "Pausado") return res.status(400).send({ text: "El recurso ya se está pausado." });

    const currentInterval = await TaskIntervals.findOne({
        where: {
          task_id: order.id,
          user_id: user_id,
          end_time: { [Op.is]: null },
          completed: false,
          paused: false,
        },
        order: [['start_time', 'DESC']],
      });
    
      if (!currentInterval) {
        console.log(`No hay intervalo activo para usuario ${user_id} en la tarea ${taskId}`);
        return;
      }
    
      currentInterval.end_time = new Date();
      currentInterval.paused = true;
      await currentInterval.save();

    let options;
    if (!order.finished_assembly) {
        let timer = parseInt((new Date(order.assembly_max_time).getTime() - new Date(Date.now()).getTime()) / (1000 * 60))
        if(timer < -1000000 || timer > 1000000){
            timer = 3
        }
        options = {
            "paused": true,
            "state": "Pausado",
            "assembly_missing_time": timer
        };
    } else {
        let timer = parseInt((new Date(order.max_time).getTime() - new Date().getTime()) / (1000 * 60))
        if(timer < -1000000 || timer > 1000000){
            timer = 3
        }
        options = {
            "paused": true,
            "state": "Pausado",
            "missing_time": timer
        };
    }

    order.update(options, {
        where: {
            id: req.body.id
        }
    }).then((data) => {
        if (!data) {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(400).send(data);
        } else {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(200).send({ text: "Pausado exitosamente!" })
        }
    })
};

/**
 * Detiene una fase de la orden. Si está 'En montaje', pasa a 'En curso'.
 * Si está 'En curso', la finaliza y la mueve a la tabla `Finalized`.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.stop = async function (req, res) {
    console.log('Stop order', req.body.id);
    const userId = req.userId === req.body.id_user ? req.userId : req.body.id_user;
    const record = await Record.findOne({ where: { id: req.body.id, id_user: userId }, order: [[sequelize.literal('updatedAt'), 'DESC']] });
  
    if (!record) return res.status(400).send("None");
  
    const register = await Registry.findOne({
      where: { id_ot: req.body.id, id_user: userId },
      order: [[sequelize.literal('updatedAt'), 'DESC']],
    });
  
    const now = Date.now();
    const data = await Data.findOne({ where: { id: req.body.id } });
    const currentInterval = await TaskIntervals.findOne({
        where: {
            task_id: data.id,
            user_id: userId,
            completed: false
        },
        order: [['start_time', 'DESC']],
    });

    if (currentInterval){
        if (currentInterval.paused) {
            if (currentInterval.stage === 'En montaje') {
                let interval = await TaskIntervals.create({
                    task_id: data.id,
                    user_id: userId,
                    start_time: new Date(),
                    stage: "En curso",
                    paused: false,
                    completed: false
                })
                interval.parent_interval_id = currentInterval.parent_interval_id
                await interval.save()
            } else if (currentInterval.stage === 'En curso') {
                let interval = await TaskIntervals.create({
                    task_id: data.id,
                    user_id: userId,
                    start_time: new Date(),
                    end_time: new Date(),
                    stage: "Completado",
                    paused: false,
                    completed: true
                })
                interval.parent_interval_id = currentInterval.parent_interval_id
                await interval.save()
            }
        } else {
            if (currentInterval.stage === 'En montaje') {
                currentInterval.end_time = new Date();
                await currentInterval.save();

                let newInter = await TaskIntervals.create({
                    task_id: data.id,
                    user_id: userId,
                    start_time: new Date(),
                    stage: "En curso",
                    paused: false,
                    completed: false
                })
                newInter.parent_interval_id = currentInterval.parent_interval_id
                await newInter.save()
            } else if (currentInterval.stage === 'En curso') {
                currentInterval.end_time = new Date();
                currentInterval.stage = "Completado";
                currentInterval.completed = true;
                await currentInterval.save()
            }
        }
    }

      if (!record.finished_assembly) {
          const timer = getSafeTimer(record.assembly_max_time);
          await record.update({
              finished_assembly: true,
              assembly_missing_time: timer,
              state: "En curso",
              max_time: now + minutesToMs(record.estimated_time)
          });
          return res.status(200).send({ text: "Montaje detenido, comienza fabricación." });
      }
  
    const timer = getSafeTimer(record.max_time);
    const user = await User.findOne({
      where: { id: req.userId },
      include: [Role, Workplace],
    });
  
    record.stoped = true;
    record.missing_time = timer;
    record.quantity = req.body.quantity;
    record.state = "Completado";
    record.name = `${user.name} ${user.lastname}`;

    const result = await getFinalizedTaskDurations(data.id, userId, currentInterval.parent_interval_id);
    record.assembly_missing_time = record.assembly_time - result.montaje;
    record.missing_time = record.estimated_time - result.curso;
    record.time_out = result.pausado;
  
    const finalized = await Finalized.create({ ...record.dataValues, createdAt: now });
    if (register) {
      register.id_finalized = finalized.id_finalized;
      register.end_time = now;
      await register.save();
    }
  
    await Record.update({
      max_time: null,
      assembly_max_time: null,
      missing_time: null,
      assembly_missing_time: null,
      finished_assembly: false,
      stoped: false,
      paused: false,
      quantity: record.quantity,
      state: "No iniciado",
      estimated_time: timer
    }, {
      where: { id: req.body.id, id_user: userId }
    });
  
    return res.status(200).send({ text: "Orden detenida exitosamente." });
};

// =========================================
// LISTADO Y OBTENCIÓN DE DATOS
// =========================================

/**
 * Obtiene una lista paginada de órdenes de trabajo, con filtros de búsqueda y estado.
 * La lógica varía si el usuario es administrador (ve todo) o un usuario regular (ve lo asignado a su puesto).
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.list = async function (req, res) {
    console.log('Get list of orders')
    const { search, pag, items, status } = req.query

    filtersOptions = ["No iniciado", "En montaje", "En curso", "Completado", "Pausado"]
    if (search === undefined) return res.status(400).json({ message: "Invalid search." })
    searchFilter = status === undefined ? filtersOptions : filtersOptions.indexOf(status) === -1 ? filtersOptions : [status]

    const offset = (pag - 1) * items;

    const userFound = await User.findOne({
        where: {
            id: req.userId
        },
        include: [Role, Workplace],
    })
    if (!userFound) return res.status(401).json({ message: "Invalid user." })
    
    if(userFound.Role.name === "admin"){
        var records = await Record.findAll({
            where: {
                [Op.or]: [
                    { resource: { [Op.like]: '%' + search + '%' } },
                    { ot: { [Op.like]: '%' + search + '%' } },
                ],
                state: {
                    [Op.in]: searchFilter
                }
            },
            include: [{
                model: User,
                attributes: ['name', 'lastname']
            }],
            offset: offset,
            limit: parseInt(items)
        })

        let orders = [];
        if(searchFilter.length > 1){
            var id_records = records.map(object => object.id)
            orders = await Data.findAll({
                where: {
                    id: {
                        [Op.not]: id_records
                    },
                    [Op.or]: [
                        { resource: { [Op.like]: '%' + search + '%' } },
                        { ot: { [Op.like]: '%' + search + '%' } },
                    ],
                },
                offset: offset,
                limit: parseInt(items)
            })
        }

        var final_query = [...records, ...orders].sort((a, b) => {
            if (a.item < b.item) return -1;
            if (a.item > b.item) return 1;
            return 0;
        });
        return res.status(200).json({ orders: final_query, group: [] })
    }

    if (search === '') return res.status(400).json({ message: "Invalid search." })

    var records = await Record.findAll({
        where: {
            id_user: req.userId,
            [Op.or]: [
                { resource: { [Op.like]: '%' + search + '%' } },
                { ot: { [Op.like]: '%' + search + '%' } },
            ],
            resource: {
                [Op.like]: userFound.Workplace.name + '%'
            }
        },
        offset: offset,
        limit: parseInt(items),
    })

    var id_records = records.map(object => object.id)

    var records_without_user = await Record.findAll({
        where: {
            id: {
                [Op.in]: id_records
            },
            [Op.or]: [
                { resource: { [Op.like]: '%' + search + '%' } },
                { ot: { [Op.like]: '%' + search + '%' } },
            ],
            resource: {
                [Op.like]: userFound.Workplace.name + '%'
            }
        },
        attributes: [
            'id',
            [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
        ],
        group: ['id'],
    })

    records_without_user = records_without_user.map(result => result.toJSON())

    records.map(result => {
        for (let i = 0; i < records_without_user.length; i++) {
            if (result.id === records_without_user[i].id) {
                result.quantity = records_without_user[i].total_quantity
                break
            }
        }
        return result
    })

    var orders = await Data.findAll({
        where: {
            id: {
                [Op.not]: id_records
            },
            [Op.or]: [
                { resource: { [Op.like]: '%' + search + '%' } },
                { ot: { [Op.like]: '%' + search + '%' } },
            ],
            resource: {
                [Op.like]: userFound.Workplace.name + '%'
            }
        },
        offset: offset,
        limit: parseInt(items),
    })

    var final_query = [...records, ...orders].sort((a, b) => {
        if (a.item < b.item) return -1;
        if (a.item > b.item) return 1;
        return 0;
    });

    var information = {
        orders: final_query,
        group: []
    }
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(information)
};

/**
 * Obtiene todos los recursos (órdenes) que coinciden con un término de búsqueda.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getallresource = async function (req, res) {
    console.log('get all resource')
    const { search } = req.query
    var resource = await Data.findAll({
        where: {
            [Op.or]: [
                { resource: { [Op.like]: '%' + search + '%' } },
                { ot: { [Op.like]: '%' + search + '%' } },
            ]
        }
    })
    res.status(200).send(resource)
};

/**
 * Obtiene el último ID registrado en la tabla `Count` y le suma 1 para proponer un nuevo ID.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.lastId = async function (req, res) {
    console.log('Get list of orders')
    var orders = await Count.findAll()
    if (orders.length == 0) {
        var count = {
            lastId: 40,
            date: new Date()
        }
        var newCount = new Count(count)
        await newCount.save()
        orders = await Count.findAll()
    }
    var lastIDObject = orders[orders.length - 1]
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send({ "lastId": lastIDObject.lastId + 1 })
};

/**
 * Actualiza el último ID guardado en la tabla `Count`.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.updateLastId = async function (req, res) {
    console.log('Update last id')
    const { lastid } = req.body

    Count.update({ "lastId": lastid }, {
        where: {
            id: 1
        }
    }).then((data) => {
        if (!data) {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(400).send(data);
        } else {
            res.header('Access-Control-Allow-Credentials', true);
            res.status(200).send({ text: "Actualizado exitosamente!" })
        }
    })
};

/**
 * Obtiene la lista completa de roles del sistema.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.listRoles = async function (req, res) {
    console.log('Get list of roles')
    var roles = await Role.findAll()
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(roles)
}

/**
 * Obtiene la lista completa de puestos de trabajo (workplaces).
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.listWorkplaces = async function (req, res) {
    console.log('Get list of workplaces')
    var workplaces = await Workplace.findAll()
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(workplaces)
}

/**
 * Verifica si un nombre de usuario ya existe en la base de datos.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getUsername = async function (req, res) {
    console.log('Get username')
    const { username } = req.query
    var user = await User.findOne({
        where: {
            username: username
        }
    })
    res.header('Access-Control-Allow-Credentials', true);
    if(user !== null){
        res.status(200).send({username: true})
    }else{
        res.status(200).send({username: false})
    }
}

/**
 * Devuelve la hora actual del servidor en formato ISO.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getServerTime = function (req, res) {
    const serverTime = new Date().toISOString();
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send({ "serverTime": serverTime });
};


// =========================================
// REPORTES Y ANÁLISIS
// =========================================

/**
 * Función central para obtener datos de trabajo de los usuarios en un rango de fechas.
 * Es utilizada por otras funciones de reportes.
 * @param {object} req - Objeto de solicitud de Express (utiliza req.query.start y req.query.end).
 * @returns {Promise<object>} Un objeto con los datos de trabajo procesados.
 */
exports.listWorkers_return = async function (req, res) {
    console.log('Get list of who interacted with the plataform by day return: ')
    var selectedDates = Object.assign({ end: req.query.start }, req.query)
    
    let selectedDateStart =  new Date(selectedDates.start)
    let selectedDateEnd = new Date(selectedDates.end + 'T23:59:59.999Z')

    const offset = Math.abs(getChileOffsetHours());
    let startOfDayInSantiago = addHours(selectedDateStart, +offset);
    let endOfDayInSantiago = addHours(selectedDateEnd, +offset);

    var queryDates = {
        start: startOfDayInSantiago,
        end: endOfDayInSantiago
    };

    if (differenceInMilliseconds(queryDates.end, queryDates.start)/1000/60/60 > 24){
        function generateIntermediateDays(startDate, endDate) {
            const start = new Date(startDate.getTime() + startDate.getTimezoneOffset() * 60000);
            const end = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000);
            const intermediateDates = eachDayOfInterval({ start, end });
            const formattedDates = intermediateDates.slice(0, -1).map(date => {
                return {
                    start: format(date, `yyyy-MM-dd'T'0${offset}:mm:ss.SSS'Z'`),
                    end: format(addDays(date, 1), `yyyy-MM-dd'T'0${offset}:mm:ss.SSS'Z'`)
                };
            })
            return formattedDates;
        }
        selectedDates = generateIntermediateDays(queryDates.start, queryDates.end);
    } else {
        selectedDates = [queryDates];
    }
    
    async function getDate(date) {
        const regestry = await Registry.findAll({
            where: {
                createdAt: {
                    [Op.between]: [date.start, date.end]
                }
            },
            include: [
                { model: User, attributes: ['name', 'lastname', 'id'] },
                { model: Data, attributes: ['id', 'ot', 'item', 'quantity', 'state', 'resource', 'estimated_time', 'missing_time', 'assembly_time', 'assembly_missing_time', 'n_times_paused'] },
                { model: Finalized, attributes: ['id', 'id_finalized', 'ot', 'item', 'quantity', 'state', 'resource', 'estimated_time', 'missing_time', 'assembly_time', 'assembly_missing_time', 'time_out'] },
                { model: Record, attributes: ['id', 'ot', 'item', 'quantity', 'state', 'resource', 'estimated_time', 'missing_time', 'assembly_time', 'assembly_missing_time', 'time_out'] }
            ]
        });
  
        const ots = regestry.map(reg => reg.Datum?.ot);
        const data = await Data.findAll({ where: { ot: { [Op.in]: ots } } });
        const data_dict = {};
        data.forEach(element => { data_dict[element.ot] = element; });
    
        if (Object.keys(data_dict).length === 0) return {};
    
        const sums = {};
        regestry.forEach(reg => {
            const start_time = reg.start_time ? new Date(reg.start_time).getTime() : null;
            const end_time = reg.end_time ? new Date(reg.end_time).getTime() : null;
            const estimated_time = reg.Datum?.estimated_time ? reg.Datum.estimated_time : 0;
            const assembly_time = reg.Datum?.assembly_time ? reg.Datum.estimated_time : 0;
    
            if (reg.Finalized !== null) {
                const key = `${reg.User.name}_${reg.User.lastname}_${reg.Finalized.id}${reg.Finalized.id_finalized}`;
                if (!sums[key]) {
                    const raw_assembly = reg.Finalized.assembly_time - reg.Finalized.assembly_missing_time;
                    const raw_exec = reg.Finalized.estimated_time - reg.Finalized.missing_time;
                    sums[key] = {
                        ot: reg.Finalized.ot, name: `${reg.User.name} ${reg.User.lastname}`, resource: reg.Finalized.resource,
                        item: reg.Finalized.item, quantity: reg.Finalized.quantity, state: reg.Finalized.state, start_time, end_time,
                        total_time_assembly: Math.max(raw_assembly, 0), total_time_ejecution: Math.max(raw_exec, 0),
                        assembly_time: assembly_time, estimated_time: estimated_time, missing_time: reg.Finalized.missing_time,
                        time_out: reg.Finalized.time_out ? reg.Finalized.time_out : 0,
                        quantity_expected: reg.Datum?.n_times_paused ? reg.Datum.n_times_paused : 0
                    };
                }
            } else if (reg.Record !== null) {
                const key = `${reg.User.name}_${reg.User.lastname}_${reg.Record.id}`;
                if (!sums[key]) {   
                    sums[key] = {
                        ot: reg.Record.ot, name: `${reg.User.name} ${reg.User.lastname}`, resource: reg.Record.resource,
                        item: reg.Record.item, quantity: reg.Record.quantity, state: reg.Record.state, start_time, end_time,
                        total_time_assembly: 0, total_time_ejecution: 0,
                        assembly_time: assembly_time, estimated_time: estimated_time, missing_time: reg.Record.missing_time,
                        time_out: 0,
                        quantity_expected: reg.Datum?.n_times_paused ?  reg.Datum.n_times_paused : 0
                    };
                }
            }
        });
        return sums;
    }

    var final_sums = await Promise.all(selectedDates.map(getDate))
    
    let sums = {};
    final_sums.forEach(sum => {
        if (!sum || typeof sum !== 'object') {
            console.warn("Saltando resultado inválido en listWorkers_return:", sum);
            return;
        }
        for (const [key, value] of Object.entries(sum)) {
            if (key in sums) {
                const randomValue = Math.floor(Math.random() * 1000);
                const randomKey = key + randomValue;
                sums[randomKey] = value;
            } else {
                sums[key] = value;
            }
        }
    });

    var keys = Object.keys(sums).sort();
    var new_sums = {}
    keys.forEach(key => { new_sums[key] = sums[key] })

    return new_sums
};

/**
 * Procesa y devuelve los datos de trabajo de los usuarios en un rango de fechas para ser consumidos por una API.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.listWorkers = async function (req, res) {
    console.log('Get list of who interacted with the plataform by day: ')
    const workersData = await exports.listWorkers_return(req, res);
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(workersData);
};

/**
 * Genera un listado de órdenes finalizadas y agrupadas para su descarga, basado en un rango de fechas.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.listDownload = async function (req, res) {
    console.log('Get list of orders for download: ')
    var lista_usuarios = await exports.listWorkers_return(req, res);

    function sumTaskDetails(taskData) {
        const result = {};
        for (const key in taskData) {
            const task = taskData[key];
            var { name, resource, ot, item, assembly_time, estimated_time, total_time_assembly, total_time_ejecution, quantity, start_time, end_time, state, missing_time } = task;
            
            if(state !== "Completado") continue;
            
            const taskKey = `${ot}_${item}`;
            var millisecondsDifference = end_time - start_time;
            var minutesDifference = parseInt(millisecondsDifference / (1000 * 60));

            if (!result[taskKey]) {
                result[taskKey] = {
                    resource, ot, item, assembly_time, estimated_time, missing_time,
                    total_time_assembly: 0, total_time_ejecution: 0, quantity: 0, minutesDifference: 0
                };
            }
            result[taskKey].total_time_assembly += total_time_assembly;
            result[taskKey].total_time_ejecution += total_time_ejecution;
            result[taskKey].minutesDifference += minutesDifference;
            result[taskKey].quantity += quantity;
        }
        const sortedResult = Object.values(result).sort((a, b) => a.item.toString().localeCompare(b.item.toString()));
        return Object.values(sortedResult);
    }

    const taskDate = sumTaskDetails(lista_usuarios);
    
    var information = {
        orders: [],
        group: taskDate
    }
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(information)
};

/**
 * Genera un reporte de cumplimiento mensual para los trabajadores.
 * Calcula las horas trabajadas vs. las horas laborales esperadas en el mes.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.complianceReport = async function (req, res) {
    console.log('Get compliance report by month')
    const { month, year } = req.body;
    const date = new Date(year, month - 1, 1, 0, 0, 0, 0);

    const holidays = [
        new Date(year, 0, 1), new Date(year, 5, 1), new Date(year, 8, 18),
        new Date(year, 8, 19), new Date(year, 11, 25)
    ];

    function isHoliday(date) {
        return holidays.some(holiday => holiday.getTime() === date.getTime());
    }

    const start = date
    let end = addMonths(start, 1);
    const hourDifference = start.getTimezoneOffset() - end.getTimezoneOffset();
    end = new Date(subDays(end.getTime() + hourDifference * 60 * 1000, 1));

    let daysOfMonth = eachDayOfInterval({ start, end });
    daysOfMonth = daysOfMonth
        .map(day => {
            day.setUTCHours(Math.abs(getChileOffsetHours()), 0, 0, 0);
            return day;
        })
        .filter(day => day >= start);

    let workDays = 0
    daysOfMonth.forEach(day => {
        if (!isWeekend(day) && !isHoliday(day)) {
            workDays++;
        }
    });

    const hrsMonth = workDays * 6;

    req.query.start = new Date(start).toISOString().split('T')[0];
    req.query.end = new Date(end).toISOString().split('T')[0];

    const listWorkers = await exports.listWorkers_return(req);

    const agroupByName = {}
    for (const key in listWorkers){
        let split_name = key.split("_")
        let name = split_name[0] + "_" + split_name[1]
        if(name in agroupByName){
            agroupByName[name].total_time_assembly += listWorkers[key].total_time_assembly;
            agroupByName[name].total_time_ejecution += listWorkers[key].total_time_ejecution;
            agroupByName[name].quantity += listWorkers[key].quantity;
        }else{
            agroupByName[name] = {
                total_time_assembly: listWorkers[key].total_time_assembly,
                total_time_ejecution: listWorkers[key].total_time_ejecution,
                quantity: listWorkers[key].quantity,
                name: split_name[0] + " " + split_name[1],
                compliance: 0
            }
        }
    }

    for (const key in agroupByName){
        agroupByName[key].monthlyHours = ((agroupByName[key].total_time_ejecution + agroupByName[key].total_time_assembly) / 60).toFixed(2);
        agroupByName[key].compliance = ((((agroupByName[key].total_time_ejecution + agroupByName[key].total_time_assembly) / 60)/ hrsMonth) * 100).toFixed(2);
    }

    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(agroupByName)
};

/**
 * Genera un reporte de cumplimiento diario para los trabajadores.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.complianceReportbyDay = async function (req, res) {
    console.log('Get compliance report by Day')
    const { month, year, day } = req.body;
    const initDate = new Date(year, month - 1, day);

    const start = format(initDate, "yyyy-MM-dd'T'03:00:00.000'Z'");
    const end = format(addDays(initDate, 1), "yyyy-MM-dd'T'02:59:59.000'Z'");

    const hrsMonth = 6;

    req.query.start = start.split('T')[0];
    req.query.end = req.query.start;

    const listWorkers = await exports.listWorkers_return(req);

    const agroupByName = {}
    for (const key in listWorkers){
        let split_name = key.split("_")
        let name = split_name[0] + "_" + split_name[1]
        if(name in agroupByName){
            agroupByName[name].total_time_assembly += listWorkers[key].total_time_assembly;
            agroupByName[name].total_time_ejecution += listWorkers[key].total_time_ejecution;
            agroupByName[name].quantity += listWorkers[key].quantity;
        }else{
            agroupByName[name] = {
                total_time_assembly: listWorkers[key].total_time_assembly,
                total_time_ejecution: listWorkers[key].total_time_ejecution,
                quantity: listWorkers[key].quantity,
                name: split_name[0] + " " + split_name[1],
                compliance: 0
            }
        }
    }

    for (const key in agroupByName){
        agroupByName[key].monthlyHours = ((agroupByName[key].total_time_ejecution + agroupByName[key].total_time_assembly) / 60).toFixed(2);
        agroupByName[key].compliance = ((((agroupByName[key].total_time_ejecution + agroupByName[key].total_time_assembly) / 60)/ hrsMonth) * 100).toFixed(2);
    }

    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(agroupByName)
};

/**
 * Genera un reporte detallado (reloj control) para un rango de meses, agrupando datos por trabajador y tarea.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.timerReport = async function (req, res) {
    console.log('Get report timer')
    const { yearMonthdays } = req.body;
    var agroupByName = {}

    for (let i = 0; i < yearMonthdays.length; i++) {
        const date = new Date(yearMonthdays[i]);
        var year = date.getFullYear();
        
        const start = addHours(date, Math.abs(getChileOffsetHours()));
        let end = addMonths(start, 1);
        const hourDifference = start.getTimezoneOffset() - end.getTimezoneOffset();
        end = new Date(subDays(end.getTime() + hourDifference * 60 * 1000, 1));
        
        req.query.start = new Date(start).toISOString().split('T')[0];
        req.query.end = new Date(end).toISOString().split('T')[0];

        const listWorkers = await exports.listWorkers_return(req);
    
        for (const key in listWorkers){
            let split_name = key.split("_")
            let name = split_name[0] + "_" + split_name[1] + "_" + split_name[2]
            if(name in agroupByName){
                agroupByName[name] = {
                    ot: listWorkers[key].ot,
                    resource: listWorkers[key].resource,
                    item: listWorkers[key].item,
                    assembly_time: listWorkers[key].assembly_time,
                    ejecution_time: listWorkers[key].estimated_time,
                    total_time_assembly: agroupByName[name].total_time_assembly + listWorkers[key].total_time_assembly,
                    total_time_ejecution: agroupByName[name].total_time_ejecution + listWorkers[key].total_time_ejecution,
                    time_out: agroupByName[name].time_out + listWorkers[key].time_out,
                    quantity: agroupByName[name].quantity + listWorkers[key].quantity,
                    quantity_expected: listWorkers[key].quantity_expected,
                    name: split_name[0] + " " + split_name[1]
                }
            }else{
                agroupByName[name] = {
                    ot: listWorkers[key].ot,
                    resource: listWorkers[key].resource,
                    item: listWorkers[key].item,
                    assembly_time: listWorkers[key].assembly_time,
                    ejecution_time: listWorkers[key].estimated_time,
                    total_time_assembly: listWorkers[key].total_time_assembly,
                    total_time_ejecution: listWorkers[key].total_time_ejecution,
                    time_out: listWorkers[key].time_out,
                    quantity: listWorkers[key].quantity,
                    name: split_name[0] + " " + split_name[1],
                    quantity_expected: listWorkers[key].quantity_expected,
                    start_time: listWorkers[key].start_time,
                    end_time: listWorkers[key].end_time
                }
            }
        }
    }
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send(agroupByName)
};

// =========================================
// INTEGRIDAD Y CORRECCIÓN DE DATOS
// =========================================

/**
 * Busca y lista órdenes de trabajo que presentan inconsistencias entre el tiempo total registrado y la suma
 * de los tiempos de montaje y fabricación.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.listInconsistentOrders = async function (req, res) {
    console.log('Buscando órdenes con tiempos inconsistentes');
    try {
      if (!req.query.start) {
        req.query.start = new Date().toISOString().split('T')[0];
      }
      if (!req.query.end) {
        req.query.end = req.query.start;
      }
  
      const listaUsuarios = await exports.listWorkers_return(req, res);
  
      function detectarInconsistencias(data) {
        const inconsistencias = [];
        for (const key in data) {
          const task = data[key];
          const { ot, item, assembly_time, estimated_time, assembly_missing_time, missing_time, start_time, end_time, state } = task;
  
          if (state !== "Completado") continue;
  
          const realDuration = Math.ceil((end_time - start_time) / (1000 * 60));
          const tiempoMontaje = assembly_time - assembly_missing_time;
          const tiempoFabricacion = estimated_time - missing_time;
          const totalTiempos = tiempoMontaje + tiempoFabricacion;
          const diferencia = Math.abs(realDuration - totalTiempos);
  
          if (diferencia > 3 || totalTiempos > realDuration + 3) {
            const totalAssembly = Math.max(assembly_time, 0);
            const totalFabrication = Math.max(estimated_time, 0);
            const realForAssembly = Math.min(1, realDuration);
            const realForFabrication = Math.max(0, realDuration - realForAssembly);
            const sug_assembly_missing = Math.max(0, totalAssembly - realForAssembly);
            const sug_missing = Math.max(0, totalFabrication - realForFabrication);
  
            inconsistencias.push({
              ot, item, start_time: new Date(start_time).toLocaleString(), end_time: new Date(end_time).toLocaleString(),
              real_minutes: realDuration, total_tiempos: totalTiempos, tiempoMontaje, tiempoFabricacion,
              diff: diferencia, missing_time, assembly_missing_time, estimated_time, assembly_time,
              sugerido: {
                assembly_time: totalAssembly, estimated_time: totalFabrication,
                assembly_missing_time: sug_assembly_missing, missing_time: sug_missing
              }
            });
          }
        }
        return inconsistencias;
      }
  
      const inconsistentes = detectarInconsistencias(listaUsuarios);
      res.status(200).send({ inconsistentes });
    } catch (error) {
      console.error('Error en listInconsistentOrders:', error);
      res.status(500).send('Error al buscar inconsistencias');
    }
};

/**
 * Corrige automáticamente los tiempos de una orden finalizada para un usuario específico,
 * basándose en el tiempo total real trabajado.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.fixOrderTime = async function (req, res) {
    const { ot, item, name } = req.body;
    try {
      const finalized = await Finalized.findOne({ where: { ot, item } });
      if (!finalized) {
        return res.status(404).send("Orden no encontrada");
      }
  
      const user = await User.findOne({
        where: {
          [Op.and]: [
            sequelize.where(sequelize.fn("concat", sequelize.col("name"), " ", sequelize.col("lastname")), name)
          ]
        }
      });
      if (!user) {
        return res.status(404).send("Usuario no encontrado por nombre completo");
      }
  
      const id_user = user.id;
      const registros = await Registry.findAll({ where: { id_finalized: finalized.id_finalized, id_user } });
      if (!registros || registros.length === 0) {
        return res.status(404).send("No se encontraron registros de tiempo para este usuario en esta orden");
      }
  
      let totalRealWorked = 0;
      registros.forEach(reg => {
        if (reg.start_time && reg.end_time) {
          totalRealWorked += Math.ceil((reg.end_time - reg.start_time) / (1000 * 60));
        }
      });
  
      const totalAssembly = Math.max(finalized.assembly_time, 0);
      const totalFabrication = Math.max(finalized.estimated_time, 0);
      const realForAssembly = Math.min(1, totalRealWorked);
      const realForFabrication = Math.max(0, totalRealWorked - realForAssembly);
      const assembly_missing_time = Math.max(0, totalAssembly - realForAssembly);
      const missing_time = Math.max(0, totalFabrication - realForFabrication);
  
      finalized.assembly_missing_time = assembly_missing_time;
      finalized.missing_time = missing_time;
      await finalized.save();
  
      res.status(200).send({
        message: 'Orden corregida automáticamente para el usuario (1 min montaje, resto fabricación)',
        ot, item, id_user, name, totalRealWorked, assembly_missing_time, missing_time
      });
    } catch (error) {
      console.error('Error en fixOrderTime:', error);
      res.status(500).send('Error al actualizar los tiempos');
    }
};

// =========================================
// ENDPOINT DE PRUEBA
// =========================================

/**
 * Endpoint simple para verificar que el servicio está funcionando.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.test = async function (req, res) {
    console.log('Test')
    res.header('Access-Control-Allow-Credentials', true);
    res.status(200).send({ "message": "Test." });
}

// =========================================
// TAREAS PROGRAMADAS (CRON JOBS)
// =========================================

const commonCronOptions = {
    scheduled: true,
    timezone: 'America/Santiago'
};

// Tareas para detener todas las órdenes al final de la jornada laboral
cron.schedule('10 17 * * *', () => {
    try {
        console.log('Ejecutando stopAll a las 17:10 PM');
        stopAll({}, {});
    } catch (error) {
        console.log('Error en stopAll: ', error);
    }
}, commonCronOptions);

cron.schedule('12 17 * * *', () => {
    try {
        console.log('Ejecutando stopAll a las 17:12 PM');
        stopAll({}, {});
    } catch (error) {
        console.log('Error en stopAll: ', error);
    }
}, commonCronOptions);

cron.schedule('15 17 * * *', () => {
    try {
        console.log('Ejecutando stopAll a las 17:15 PM');
        stopAll({}, {});
    } catch (error) {
        console.log('Error en stopAll: ', error);
    }
}, commonCronOptions);


// Tareas para detener todas las órdenes antes del inicio de la jornada laboral (limpieza)
cron.schedule('05 4 * * *', () => {
  console.log('Ejecutando stopAll a las 4:05 AM');
  stopAll({}, {});
}, commonCronOptions);

cron.schedule('10 4 * * *', () => {
  console.log('Ejecutando stopAll a las 4:10 AM');
  stopAll({}, {});
}, commonCronOptions);