const express = require('express');
const router = express.Router();

const auth = require('../controllers/auth');
const security = require('../middlewares/authJwt')

router.post('/signin', auth.signIn);

router.post('/signup', auth.signUp);

router.post('/signout', security.verifyToken, auth.logOut)

router.get('/me', security.verifyToken, auth.me);

router.get('/users', security.verifyToken, security.isAdmin, auth.getUsers);

router.put('/users/:id', security.verifyToken, security.isAdmin, auth.updateUser);

router.delete('/users/:id', security.verifyToken, security.isAdmin, auth.deleteUser);


module.exports = router;


