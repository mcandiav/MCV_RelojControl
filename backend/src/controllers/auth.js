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

// Modelos de la Base de Datos
const User = require('../models/user');
const Role = require('../models/role');
const Workplace = require('../models/workplace');
const Log = require('../models/log');

const USER_VALIDATION = {
    nameMax: 40,
    lastnameMax: 40,
    usernameMax: 24,
    passwordLen: 4
};

function normalizeString(v) {
    return String(v == null ? '' : v).trim();
}

function isPositiveInt(v) {
    const n = Number(v);
    return Number.isInteger(n) && n > 0;
}

function validateUserPayload(payload, { requirePassword }) {
    const username = normalizeString(payload && payload.username);
    const name = normalizeString(payload && payload.name);
    const lastname = normalizeString(payload && payload.lastname);
    const password = normalizeString(payload && payload.password);
    const RoleId = payload && payload.RoleId;
    const WorkplaceId = payload && payload.WorkplaceId;

    if (!name) return { ok: false, message: 'Nombre es obligatorio.' };
    if (name.length > USER_VALIDATION.nameMax) {
        return { ok: false, message: `Nombre excede ${USER_VALIDATION.nameMax} caracteres.` };
    }

    if (!lastname) return { ok: false, message: 'Apellido es obligatorio.' };
    if (lastname.length > USER_VALIDATION.lastnameMax) {
        return { ok: false, message: `Apellido excede ${USER_VALIDATION.lastnameMax} caracteres.` };
    }

    if (!username) return { ok: false, message: 'Usuario es obligatorio.' };
    if (username.length > USER_VALIDATION.usernameMax) {
        return { ok: false, message: `Usuario excede ${USER_VALIDATION.usernameMax} caracteres.` };
    }
    if (!/^[A-Za-z0-9._-]+$/.test(username)) {
        return { ok: false, message: 'Usuario solo permite letras, números, punto, guion y guion bajo.' };
    }

    if (!isPositiveInt(RoleId)) return { ok: false, message: 'Rol inválido.' };
    if (!isPositiveInt(WorkplaceId)) return { ok: false, message: 'Área inválida.' };

    if (requirePassword || password) {
        if (!password) return { ok: false, message: 'Contraseña/PIN es obligatorio.' };
        if (!/^\d{4}$/.test(password)) {
            return { ok: false, message: `Contraseña/PIN debe tener exactamente ${USER_VALIDATION.passwordLen} dígitos.` };
        }
    }

    return {
        ok: true,
        data: {
            username,
            name,
            lastname,
            password,
            RoleId: Number(RoleId),
            WorkplaceId: Number(WorkplaceId)
        }
    };
}

// =========================================
// FLUJO DE AUTENTICACIÓN
// =========================================

/**
 * Registra un nuevo usuario en el sistema.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.signUp = async function (req, res) {
    const v = validateUserPayload(req.body, { requirePassword: true });
    if (!v.ok) return res.status(400).json({ message: v.message });
    const { username, name, lastname, password, RoleId, WorkplaceId } = v.data;

    const exists = await User.findOne({ where: { username } });
    if (exists) return res.status(409).json({ message: 'El nombre de usuario ya existe.' });

    const newUser = new User({
        username: username,
        name: name,
        lastname: lastname,
        password: password,
        RoleId: RoleId,
        WorkplaceId: WorkplaceId
    });

    const savedUser = await newUser.save();

    // Por defecto, el token expira en 1 año una vez iniciada la sesión. En su momento se habló
    // de hacer que expirara antes, pero se decidió dejarlo así para no complicar el flujo de trabajo.
    const token = jwt.sign({ id: savedUser._id }, config.SECRET, {
        expiresIn: 86400 * 365 // 1 año
    });
    
    res.status(200).json({ token });
};

/**
 * Autentica a un usuario y le devuelve un token JWT.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.signIn = async function (req, res) {
    try {
        const userFound = await User.findOne({
            where: {
                username: req.body.username
            },
            include: [Role, Workplace],
        });

        if (!userFound) return res.status(400).json({ message: "User not found." });
    
        const matchPassword = await userFound.validPassword(req.body.password, userFound.password);

        if (!matchPassword) return res.status(401).json({ token: null, message: "Invalid password." });
    
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
        res.status(400).send('An error occurred during sign in.');
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
    const operarios = await User.findAll({
        include: [{ model: Role, where: { name: 'operario' } }],
        attributes: ['id', 'username', 'name', 'lastname'],
        order: [['name', 'ASC']]
    });
    return res.status(200).json(operarios);
};

exports.me = async function (req, res) {
    console.log('me');
    const userFound = await User.findOne({
        where:{
            id: req.userId
        },
        include: [Role, Workplace],
    });

    if (!userFound) return res.status(401).json({ message: "Invalid user." });

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
            include: [Role, Workplace],
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

        if (!userFound) return res.status(404).json({ message: "No user found." });

        const payload = {
            username: req.body && req.body.username != null ? req.body.username : userFound.username,
            name: req.body && req.body.name != null ? req.body.name : userFound.name,
            lastname: req.body && req.body.lastname != null ? req.body.lastname : userFound.lastname,
            password: req.body && req.body.password != null ? req.body.password : '',
            RoleId: req.body && req.body.RoleId != null ? req.body.RoleId : userFound.RoleId,
            WorkplaceId: req.body && req.body.WorkplaceId != null ? req.body.WorkplaceId : userFound.WorkplaceId
        };

        const v = validateUserPayload(payload, { requirePassword: false });
        if (!v.ok) return res.status(400).json({ message: v.message });

        const { username, name, lastname, password, RoleId, WorkplaceId } = v.data;

        if (String(username) !== String(userFound.username)) {
            const exists = await User.findOne({ where: { username } });
            if (exists && Number(exists.id) !== Number(userFound.id)) {
                return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
            }
        }

        userFound.username = username;
        userFound.name = name;
        userFound.lastname = lastname;
        userFound.RoleId = RoleId;
        userFound.WorkplaceId = WorkplaceId;

        if (password) {
            const salt = bcrypt.genSaltSync();
            userFound.password = bcrypt.hashSync(password, salt);
        }

        await userFound.save();

        res.status(200).json({ message: "User updated." });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error updating user.');
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
