const config = require('../config/config');

function getShiftDateString(date = new Date(), timeZone = config.NS_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function computeTotalsFromEvents(events) {
  let totalActiveMs = 0;
  let totalPauseMs = 0;
  let activeStart = null;
  let pauseStart = null;

  for (const event of events) {
    const at = new Date(event.event_at).getTime();
    if (!Number.isFinite(at)) continue;

    if (event.event_type === 'START' || event.event_type === 'RESUME') {
      if (pauseStart) {
        totalPauseMs += at - pauseStart;
        pauseStart = null;
      }
      if (!activeStart) activeStart = at;
      continue;
    }

    if (event.event_type === 'PAUSE') {
      if (activeStart) {
        totalActiveMs += at - activeStart;
        activeStart = null;
      }
      if (!pauseStart) pauseStart = at;
      continue;
    }

    if (event.event_type === 'STOP' || event.event_type === 'AUTO_STOP_SHIFT_END') {
      if (activeStart) {
        totalActiveMs += at - activeStart;
        activeStart = null;
      }
      if (pauseStart) {
        totalPauseMs += at - pauseStart;
        pauseStart = null;
      }
    }
  }

  return {
    total_active_seconds: Math.max(0, Math.floor(totalActiveMs / 1000)),
    total_pause_seconds: Math.max(0, Math.floor(totalPauseMs / 1000))
  };
}

module.exports = {
  getShiftDateString,
  computeTotalsFromEvents
};
