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
  if (mode === 'SETUP') return 'SETUP';
  if (mode === 'RUN') return 'RUN';
  return fallback;
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

function isStopLikeEventType(eventType) {
  const t = String(eventType || '').toUpperCase();
  return t === 'STOP' || t === 'AUTO_STOP_SHIFT_END';
}

function eventAtMs(event) {
  const at = new Date(event && event.event_at).getTime();
  return Number.isFinite(at) ? at : NaN;
}

/**
 * Eventos del mismo operation_timer_id que pertenecen al tramo del STOP actual.
 * - Sin STOP anterior en el timer: desde el inicio del timer hasta el STOP actual (inclusive).
 * - Con STOP anterior: desde ese STOP (exclusivo) hasta el STOP actual (inclusive).
 * Asi cada STOP publica solo el intervalo nuevo; TEK/import_ot suma cada aporte.
 */
function selectEventsForStopSegment(allEvents, stopEvent) {
  if (!stopEvent) return [];
  const timerId = stopEvent.operation_timer_id;
  const stopId = Number(stopEvent.id);
  const stopAt = eventAtMs(stopEvent);
  if (timerId == null || timerId === '' || !Number.isInteger(stopId) || stopId <= 0 || !Number.isFinite(stopAt)) {
    return [];
  }

  const sameTimer = (allEvents || [])
    .filter((ev) => {
      if (Number(ev.operation_timer_id) !== Number(timerId)) return false;
      const at = eventAtMs(ev);
      if (!Number.isFinite(at)) return false;
      if (at < stopAt) return true;
      if (at > stopAt) return false;
      return Number(ev.id) <= stopId;
    })
    .slice()
    .sort((a, b) => {
      const da = eventAtMs(a) - eventAtMs(b);
      if (da !== 0) return da;
      return Number(a.id) - Number(b.id);
    });

  const priorStops = sameTimer.filter(
    (ev) => isStopLikeEventType(ev.event_type) && Number(ev.id) !== stopId
  );
  const prevStop = priorStops.length ? priorStops[priorStops.length - 1] : null;
  if (!prevStop) return sameTimer;

  const prevAt = eventAtMs(prevStop);
  const prevId = Number(prevStop.id);
  return sameTimer.filter((ev) => {
    const at = eventAtMs(ev);
    if (at > prevAt) return true;
    if (at === prevAt && Number(ev.id) > prevId) return true;
    return false;
  });
}

function computeTotalsFromEvents(events, options = {}) {
  const asOfRaw = options && options.asOf != null ? options.asOf : null;
  const asOfMs = asOfRaw != null ? new Date(asOfRaw).getTime() : null;
  const closeOpenIntervals = Number.isFinite(asOfMs);

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

  if (closeOpenIntervals) {
    if (activeStart) pushActiveDuration(asOfMs);
    if (pauseStart) {
      totalPauseMs += Math.max(0, asOfMs - pauseStart);
      pauseStart = null;
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
  computeTotalsFromEvents,
  normalizeTimerMode,
  isStopLikeEventType,
  selectEventsForStopSegment
};
