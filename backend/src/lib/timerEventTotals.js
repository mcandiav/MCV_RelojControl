const config = require('../config/config');

function getShiftDateString(date = new Date(), timeZone = config.NS_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function normalizeTimerMode(value, fallback = 'RUN') {
  const mode = String(value || '').trim().toUpperCase();
  return mode === 'SETUP' ? 'SETUP' : fallback;
}

function readTimerModeFromEvent(event, fallback = 'RUN') {
  try {
    const raw = event && event.details_json;
    if (!raw) return fallback;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeTimerMode(parsed && parsed.timer_mode, fallback);
  } catch (_) {
    return fallback;
  }
}

function computeTotalsFromEvents(events) {
  let totalActiveMs = 0;
  let totalRunMs = 0;
  let totalSetupMs = 0;
  let totalPauseMs = 0;
  let activeStart = null;
  let pauseStart = null;
  let currentMode = 'RUN';

  function pushActiveDuration(endAtMs) {
    if (!activeStart) return;
    const segmentMs = Math.max(0, endAtMs - activeStart);
    totalActiveMs += segmentMs;
    if (currentMode === 'SETUP') totalSetupMs += segmentMs;
    else totalRunMs += segmentMs;
    activeStart = null;
  }

  for (const event of events) {
    const at = new Date(event.event_at).getTime();
    if (!Number.isFinite(at)) continue;

    if (event.event_type === 'START' || event.event_type === 'RESUME') {
      if (pauseStart) {
        totalPauseMs += at - pauseStart;
        pauseStart = null;
      }
      currentMode = readTimerModeFromEvent(event, currentMode);
      if (!activeStart) activeStart = at;
      continue;
    }

    if (event.event_type === 'MODE_CHANGE') {
      if (activeStart) {
        pushActiveDuration(at);
        activeStart = at;
      }
      currentMode = readTimerModeFromEvent(event, currentMode);
      continue;
    }

    if (event.event_type === 'PAUSE') {
      pushActiveDuration(at);
      if (!pauseStart) pauseStart = at;
      continue;
    }

    if (event.event_type === 'STOP' || event.event_type === 'AUTO_STOP_SHIFT_END') {
      pushActiveDuration(at);
      if (pauseStart) {
        totalPauseMs += at - pauseStart;
        pauseStart = null;
      }
    }
  }

  return {
    total_active_seconds: Math.max(0, Math.floor(totalActiveMs / 1000)),
    total_run_seconds: Math.max(0, Math.floor(totalRunMs / 1000)),
    total_setup_seconds: Math.max(0, Math.floor(totalSetupMs / 1000)),
    total_pause_seconds: Math.max(0, Math.floor(totalPauseMs / 1000))
  };
}

module.exports = {
  getShiftDateString,
  computeTotalsFromEvents
};
