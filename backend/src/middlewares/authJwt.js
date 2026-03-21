const jwt = require("jsonwebtoken")
const config = require('../config/config')

const User = require('../models/user')
const Role = require('../models/role')
const Workplace = require('../models/workplace')

/**
 * Middleware para verificar el token JWT en las solicitudes entrantes.
 * Si el token es válido, se añade el ID del usuario decodificado a la solicitud.
 */
exports.verifyToken = async (req, res, next) => {
    try {
        const token = req.headers["x-access-token"]

        if(!token) return res.status(403).json({message: "No token provied."})

        const decoded = jwt.verify(token, config.SECRET)
        req.userId = decoded.id
        
        const userFound = await User.findOne({
            where: { id: decoded.id },
            include: [
                { model: Role, required: false },
                { model: Workplace, required: false }
            ]
        })
    
        if(!userFound) return res.status(404).json({message: "No user found."})
        
        next()
    } catch (error) {
        return res.status(401).json({message: 'Unauthorized.'})
    }
}

exports.isAdmin = async (req, res, next) => {
    try {
        const token = req.headers["x-access-token"]

        if(!token) return res.status(403).json({message: "No token provied."})

        const decoded = jwt.verify(token, config.SECRET)
        req.userId = decoded.id
        
        const userFound = await User.findOne({
            where: { id: req.userId },
            include: [
                { model: Role, required: false },
                { model: Workplace, required: false }
            ]
        })

        if(!userFound) return res.status(404).json({message: "No user found."})
    
        if(userFound.Role.name === "admin"){
            next()
            return
        }           
    } catch (error) {
        console.log(error)
    }
    return res.status(403).json({message: "You dont have the role for this function."})
}

const requestTimestamps = new Map();
exports.preventDuplicatePlay = (req, res, next) => {
  const userId = req.userId;
  const now = Date.now();
  const last = requestTimestamps.get(userId);

  if (last && now - last < 1000) {
    console.warn(`⛔ Usuario ${userId} bloqueado por request duplicado`);
    return res.status(429).json({ text: "Ya estás ejecutando esta acción. Intenta nuevamente en un momento." });
  }

  requestTimestamps.set(userId, now);

  setTimeout(() => {
    requestTimestamps.delete(userId);
  }, 10000);

  next();
};
