const { Op } = require('sequelize');
const config = require('../config/config');

/**
 * Resuelve la estación desde header x-station-id, body.station_id o DEFAULT_STATION_ID.
 */
function resolveStationId(req) {
  const h = req.headers['x-station-id'] || req.headers['X-Station-Id'];
  const b = req.body && req.body.station_id;
  const raw =
    h != null && String(h).trim() !== ''
      ? String(h).trim()
      : b != null && String(b).trim() !== ''
        ? String(b).trim()
        : '';
  if (raw) return raw.slice(0, 64);
  return String(config.DEFAULT_STATION_ID || 'default-station').slice(0, 64);
}

function defaultStationId() {
  return String(config.DEFAULT_STATION_ID || 'default-station').trim();
}

/**
 * ¿El timer "pertenece" a la estación que está viendo/actuando?
 */
function timerBelongsToViewerStation(timer, viewerStationId) {
  if (!timer) return true;
  const tid = timer.station_id != null ? String(timer.station_id).trim() : '';
  const v = String(viewerStationId || '').trim();
  if (!tid) {
    if (config.STATION_LEGACY_NULL_MATCH_DEFAULT === false) return false;
    return v === defaultStationId();
  }
  return tid === v;
}

function assertTimerStationMatch(timer, stationId, res) {
  if (!timerBelongsToViewerStation(timer, stationId)) {
    res.status(403).json({ message: 'Cronometro pertenece a otra estacion.' });
    return false;
  }
  return true;
}

/**
 * WHERE completo para listar timers del tablero (ACTIVE/PAUSED) por estación.
 * Timers con station_id NULL solo se ven en DEFAULT_STATION_ID si legacy está activo.
 */
function getBoardTimerWhere(stationId) {
  const v = String(stationId || '').trim();
  const legacy = config.STATION_LEGACY_NULL_MATCH_DEFAULT !== false;
  const orParts = [{ station_id: v }];
  if (legacy && v === defaultStationId()) {
    orParts.push({ station_id: null });
  }
  return {
    status: { [Op.in]: ['ACTIVE', 'PAUSED'] },
    [Op.or]: orParts
  };
}

module.exports = {
  resolveStationId,
  timerBelongsToViewerStation,
  assertTimerStationMatch,
  getBoardTimerWhere,
  defaultStationId
};
