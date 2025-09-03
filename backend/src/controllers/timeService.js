// Archivo: services/timeService.js
const MILLISECONDS_IN_MINUTE = 60 * 1000;

function getSafeTimer(targetTime) {
  const now = Date.now();
  const diff = Math.floor((new Date(targetTime).getTime() - now) / MILLISECONDS_IN_MINUTE);
  if (!Number.isFinite(diff) || Math.abs(diff) > 10000) return 1;
  return diff;
}

function minutesToMs(minutes) {
  return minutes * MILLISECONDS_IN_MINUTE;
}

function getChileOffsetHours(reference = new Date()) {
  // Creamos una fecha fija (23:59 del día dado)
  const localReference = new Date(reference);
  localReference.setHours(23, 59, 0, 0);

  // Obtenemos la misma fecha pero en la zona horaria de Chile
  const chileTime = new Date(localReference.toLocaleString("en-US", { timeZone: "America/Santiago" }));

  // Obtenemos la misma fecha pero en UTC
  const utcTime = new Date(localReference.toLocaleString("en-US", { timeZone: "UTC" }));

  // Calculamos la diferencia en minutos y la convertimos a horas
  const offsetMinutes = (chileTime.getTime() - utcTime.getTime()) / (1000 * 60);
  return offsetMinutes / 60;
}

module.exports = {
  getSafeTimer,
  minutesToMs,
  getChileOffsetHours
};