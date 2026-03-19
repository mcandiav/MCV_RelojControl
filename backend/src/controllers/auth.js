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

// =========================================
// FLUJO DE AUTENTICACIÓN
// =========================================

/**
 * Registra un nuevo usuario en el sistema.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.signUp = async function (req, res) {
    const { username, name, lastname, password, RoleId, WorkplaceId } = req.body;

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

        const { password, id, ...fields } = req.body;

        userFound.name        = fields.name        ?? userFound.name;
        userFound.lastname    = fields.lastname    ?? userFound.lastname;
        userFound.RoleId      = fields.RoleId      ?? userFound.RoleId;
        userFound.WorkplaceId = fields.WorkplaceId ?? userFound.WorkplaceId;

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