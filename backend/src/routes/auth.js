const express = require('express');
const router = express.Router();

const auth = require('../controllers/auth');
const security = require('../middlewares/authJwt')
// =============================
// RUTAS DE AUTENTICACIÓN
// =============================

// Iniciar sesión
router.post('/signin', auth.signIn);

// Registrarse
router.post('/signup', auth.signUp);

// Cerrar sesión
router.post('/signout', security.verifyToken, auth.logOut)

// Obtener información del usuario autenticado
router.get('/me', security.verifyToken, auth.me);

// Obtener lista de usuarios (solo admin)
router.get('/users', security.verifyToken, security.isAdmin, auth.getUsers);

// Actualizar usuario (solo admin)
router.put('/users/:id', security.verifyToken, security.isAdmin, auth.updateUser);

// Eliminar usuario (solo admin)
router.delete('/users/:id', security.verifyToken, security.isAdmin, auth.deleteUser);


module.exports = router;


