const User = require('../models/user');
const Role = require('../models/role');
const config = require('../config/config');

/**
 * Valida PIN del usuario del JWT (re-autenticación en acciones de cronómetro).
 * Los administradores quedan exentos (suelen tener password fuera del formato PIN 4 dígitos).
 * @returns {Promise<boolean>} false si ya respondió res con error
 */
async function assertOperatorPinForTimer(req, res) {
  if (!config.REQUIRE_PIN_FOR_TIMER_ACTIONS) return true;

  const userWithRole = await User.findByPk(req.userId, { include: [Role] });
  if (userWithRole && userWithRole.Role && String(userWithRole.Role.name).toLowerCase() === 'admin') {
    return true;
  }

  const pin = req.body && req.body.pin != null ? String(req.body.pin).trim() : '';
  if (!/^\d{4}$/.test(pin)) {
    res.status(400).json({ message: 'Se requiere PIN de 4 digitos para esta accion.' });
    return false;
  }

  const user = userWithRole || (await User.findByPk(req.userId));
  if (!user) {
    res.status(401).json({ message: 'Usuario invalido.' });
    return false;
  }

  if (!user.validPassword(pin, user.password)) {
    res.status(401).json({ message: 'PIN incorrecto.' });
    return false;
  }

  return true;
}

module.exports = { assertOperatorPinForTimer };
