const ShiftCloseSlot = require('../models/shift_close_slot');
const config = require('../config/config');
const { registerShiftCloseCrons } = require('../jobs/shiftCloseScheduler');

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

exports.getShiftSchedule = async function getShiftSchedule(req, res) {
  const slots = await ShiftCloseSlot.findAll({ order: [['sequence', 'ASC']] });
  return res.status(200).json({
    timezone: config.NS_TIMEZONE,
    shift_batch_enabled: config.NS_SHIFT_BATCH_ENABLED,
    auto_stop_at_shift_end: config.NS_AUTO_STOP_AT_SHIFT_END,
    slots: slots.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      hhmm: s.hhmm,
      enabled: s.enabled
    }))
  });
};

exports.putShiftSchedule = async function putShiftSchedule(req, res) {
  const { slots } = req.body || {};
  if (!Array.isArray(slots) || slots.length !== 3) {
    return res.status(400).json({ message: 'Se requieren exactamente 3 horarios (slots).' });
  }

  const bySeq = new Map();
  for (const raw of slots) {
    const sequence = Number(raw.sequence);
    if (![1, 2, 3].includes(sequence)) {
      return res.status(400).json({ message: 'sequence debe ser 1, 2 o 3.' });
    }
    const hhmm = String(raw.hhmm || '').trim();
    if (!HHMM_RE.test(hhmm)) {
      return res.status(400).json({ message: `Hora inválida (use HH:mm 24h): ${raw.hhmm}` });
    }
    bySeq.set(sequence, {
      hhmm,
      enabled: raw.enabled !== false && raw.enabled !== 'false' && raw.enabled !== 0
    });
  }
  if (bySeq.size !== 3) {
    return res.status(400).json({ message: 'Debe enviar los 3 sequence distintos (1, 2 y 3).' });
  }

  for (let seq = 1; seq <= 3; seq += 1) {
    const row = bySeq.get(seq);
    await ShiftCloseSlot.update(
      { hhmm: row.hhmm, enabled: row.enabled },
      { where: { sequence: seq } }
    );
  }

  await registerShiftCloseCrons();

  const updated = await ShiftCloseSlot.findAll({ order: [['sequence', 'ASC']] });
  return res.status(200).json({
    message: 'Horarios de cierre actualizados y crons recargados.',
    slots: updated.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      hhmm: s.hhmm,
      enabled: s.enabled
    }))
  });
};
