// =========================================
// IMPORTS Y CONFIGURACIÓN
// =========================================

/**
 * 
 * Se utiliza la logica JTW para la autenticación de usuarios. Es decir, cada vez que un usuario se logea (con cualquier rol)
 * el programa le genera un token JWT que debe ser enviado en cada solicitud subsecuente para verificar su identidad y permisos.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt-nodejs');
const config = require('../config/config');
const sequelize = require('../config/db');

// Modelos de la Base de Datos
const User = require('../models/user');
const Role = require('../models/role');
const Workplace = require('../models/workplace');
const Log = require('../models/log');

// =========================================
// FLUJO DE AUTENTICACIÓN
// =========================================

/** PIN numérico de exactamente 4 dígitos (operarios). */
function passwordPinErrorMessage(password) {
  if (password == null || password === undefined) return 'La contraseña es obligatoria.';
  const s = String(password).trim();
  if (!/^\d{4}$/.test(s)) {
    return 'La contraseña debe ser exactamente 4 dígitos numéricos.';
  }
  return null;
}

/** Si viene vacío (no cambiar), no valida; si viene con valor, debe ser 4 dígitos. */
function passwordPinErrorMessageIfProvided(password) {
  if (password == null || password === undefined || String(password).trim() === '') return null;
  return passwordPinErrorMessage(password);
}

/**
 * Registra un nuevo usuario en el sistema.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.signUp = async function (req, res) {
  try {
    const { username, name, lastname, password, RoleId, WorkplaceId } = req.body;

    const pinErr = passwordPinErrorMessage(password);
    if (pinErr) return res.status(400).json({ message: pinErr });

    const existing = await User.findOne({ where: { username: String(username || '').trim() } });
    if (existing) return res.status(400).json({ message: 'El usuario ya existe.' });

    const newUser = new User({
      username: String(username || '').trim(),
      name: name,
      lastname: lastname,
      password: password,
      RoleId: RoleId,
      WorkplaceId: WorkplaceId
    });

    const savedUser = await newUser.save();

    const token = jwt.sign({ id: savedUser.id }, config.SECRET, {
      expiresIn: 86400 * 365 // 1 año
    });

    res.status(200).json({ token });
  } catch (error) {
    console.log('signUp error:', error);
    res.status(400).json({ message: error.message || 'No se pudo crear el usuario.' });
  }
};

/**
 * Autentica a un usuario y le devuelve un token JWT.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.signIn = async function (req, res) {
    try {
        const username = String(req.body.username || '').trim();
        const password = req.body.password != null ? String(req.body.password) : '';

        if (!username) {
            return res.status(400).json({ message: 'Usuario requerido.' });
        }

        const userFound = await User.findOne({
            where: { username },
            include: [
                { model: Role, required: false },
                { model: Workplace, required: false }
            ]
        });

        if (!userFound) {
            return res.status(400).json({ message: 'Usuario no encontrado.' });
        }

        const matchPassword = userFound.validPassword(password, userFound.password);

        if (!matchPassword) {
            return res.status(401).json({ token: null, message: 'Contrasena incorrecta.' });
        }
    
        const token = jwt.sign({
            id: userFound.id,
            name: userFound.name + ' ' + userFound.lastname
        }, config.SECRET, {
            expiresIn: 86400 * 365 // 1 año
        });

        // Crea un nuevo registro de inicio de sesión
        await new Log({
            "user_id": userFound.id,
            "sign_in": new Date()
        }).save();
    
        res.status(200).json({ token });   
    } catch (error) {
        console.log('signIn error:', error);
        res.status(500).json({ message: 'Error al iniciar sesion. Intenta de nuevo.' });
    }
};

/**
 * Registra el cierre de sesión de un usuario actualizando su último registro en `Log`.
 * @param {object} req - Objeto de solicitud de Express (utiliza req.userId del token).
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.logOut = async function (req, res) {
    console.log('logout');

    const lastLog = await Log.findOne({
        where: {
            user_id: req.userId
        },
        order: [
            ['sign_in', 'DESC']
        ]
    });

    if (lastLog) {
        lastLog.sign_out = new Date();
        await lastLog.save();
    }

    res.status(200).json({ message: "successfully logout." });
};

/**
 * Obtiene la información del usuario actualmente autenticado.
 * @param {object} req - Objeto de solicitud de Express (utiliza req.userId del token).
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getOperarios = async function (req, res) {
    try {
        const operarioRole = await Role.findOne({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('name')),
                'operario'
            )
        });
        if (!operarioRole) {
            return res.status(200).json([]);
        }
        const operarios = await User.findAll({
            where: { RoleId: operarioRole.id },
            attributes: ['id', 'username', 'name', 'lastname'],
            order: [['name', 'ASC']]
        });
        return res.status(200).json(operarios);
    } catch (err) {
        console.error('getOperarios:', err);
        return res.status(500).json({ message: 'Error al listar operarios.' });
    }
};

exports.me = async function (req, res) {
    const userFound = await User.findOne({
        where: { id: req.userId },
        include: [
            { model: Role, required: false },
            { model: Workplace, required: false }
        ]
    });

    if (!userFound) return res.status(401).json({ message: 'Sesion invalida.' });

    return res.status(200).json(userFound);
};


// =========================================
// GESTIÓN DE USUARIOS (CRUD)
// =========================================

/**
 * Obtiene una lista de todos los usuarios del sistema sin su contraseña.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getUsers = async function (req, res) {
    try {
        const users = await User.findAll({
            include: [
                { model: Role, required: false },
                { model: Workplace, required: false }
            ],
            attributes: { exclude: ['password'] }
        });
        res.status(200).json(users);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error retrieving users.');
    }
};

/**
 * Actualiza la información de un usuario por su ID.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.updateUser = async function (req, res) {
  try {
    const userFound = await User.findOne({ where: { id: req.params.id } });

    if (!userFound) return res.status(404).json({ message: 'No user found.' });

    const { password, id, ...fields } = req.body;

    const pinErr = passwordPinErrorMessageIfProvided(password);
    if (pinErr) return res.status(400).json({ message: pinErr });

    if (fields.username != null && String(fields.username).trim() !== '') {
      const nextName = String(fields.username).trim();
      if (nextName !== userFound.username) {
        const taken = await User.findOne({ where: { username: nextName } });
        if (taken) return res.status(400).json({ message: 'El usuario ya existe.' });
        userFound.username = nextName;
      }
    }

    if (fields.name != null) userFound.name = fields.name;
    if (fields.lastname != null) userFound.lastname = fields.lastname;
    if (fields.RoleId != null) userFound.RoleId = fields.RoleId;
    if (fields.WorkplaceId != null) userFound.WorkplaceId = fields.WorkplaceId;

    if (password != null && String(password).trim() !== '') {
      const salt = bcrypt.genSaltSync();
      userFound.password = bcrypt.hashSync(String(password).trim(), salt);
    }

    await userFound.save();

    res.status(200).json({ message: 'User updated.' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating user.' });
  }
};

/**
 * Elimina un usuario y sus logs de autenticación.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.deleteUser = async function (req, res) {
    try {
        const userId = req.params.id;

        // Eliminar registros dependientes vigentes
        await Log.destroy({ where: { user_id: userId } });

        // Encontrar y eliminar el usuario
        const userFound = await User.findOne({ where: { id: userId } });
        if (!userFound) return res.status(404).json({ message: "No user found." });

        await userFound.destroy();

        res.status(200).json({ message: "User deleted." });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error deleting user.');
    }
};

exports.getRoles = async function (req, res) {
    try {
        const roles = await Role.findAll({ order: [['id', 'ASC']] });
        res.status(200).json(roles);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error retrieving roles.');
    }
};

exports.getWorkplaces = async function (req, res) {
    try {
        const workplaces = await Workplace.findAll({ order: [['id', 'ASC']] });
        res.status(200).json(workplaces);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error retrieving workplaces.');
    }
};