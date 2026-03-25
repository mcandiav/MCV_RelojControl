const cron = require('node-cron');
const config = require('../config/config');
const ShiftCloseSlot = require('../models/shift_close_slot');
const chronometerController = require('../controllers/chronometer');

let tasks = [];

function stopAll() {
  tasks.forEach((t) => {
    try {
      t.stop();
    } catch (_) {
      /* ignore */
    }
  });
  tasks = [];
}

/**
 * Registra un cron por cada slot habilitado (arquitectura: hasta 3 cierres de turno).
 * Debe llamarse tras db.sync y tras PUT /admin/shift-schedule.
 */
async function registerShiftCloseCrons() {
  stopAll();
  if (!config.NS_SHIFT_BATCH_ENABLED || !config.NS_AUTO_STOP_AT_SHIFT_END) {
    console.log('Shift batch schedulers: desactivados (NS_SHIFT_BATCH_ENABLED / NS_AUTO_STOP_AT_SHIFT_END).');
    return;
  }

  const slots = await ShiftCloseSlot.findAll({ order: [['sequence', 'ASC']] });
  for (const slot of slots) {
    if (!slot.enabled) continue;
    const parts = String(slot.hhmm || '').split(':');
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      console.warn(`Shift slot ${slot.sequence}: hora inválida "${slot.hhmm}", se omite.`);
      continue;
    }
    const cronExpr = `${minute} ${hour} * * *`;
    const seq = slot.sequence;
    const hhmm = slot.hhmm;
    const task = cron.schedule(
      cronExpr,
      async () => {
        try {
          const result = await chronometerController.runShiftClose('scheduler');
          console.log(`Cierre de turno programado (slot ${seq} ${hhmm}):`, result);
        } catch (error) {
          console.error(`Cierre de turno slot ${seq} falló:`, error);
        }
      },
      { timezone: config.NS_TIMEZONE }
    );
    tasks.push(task);
    console.log(`Cron cierre turno #${seq} a las ${hhmm} (${config.NS_TIMEZONE}).`);
  }

  if (tasks.length === 0) {
    console.warn('No hay slots de cierre habilitados con hora válida.');
  }
}

module.exports = {
  registerShiftCloseCrons,
  stopAllShiftCloseCrons: stopAll
};
