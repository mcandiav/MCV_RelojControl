/**
 * Validacion local del delta por STOP (sin DB).
 * Ejecutar: node scripts/test-stop-segment-delta.js
 */
const assert = require('assert');
const {
  computeTotalsFromEvents,
  selectEventsForStopSegment
} = require('../src/lib/timerEventTotals');

function minutesCeil(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s <= 0) return 0;
  return Math.ceil(s / 60);
}

function ev(id, timerId, type, at, mode) {
  return {
    id,
    operation_timer_id: timerId,
    event_type: type,
    event_at: at,
    details_json: mode ? JSON.stringify({ timer_mode: mode }) : null
  };
}

// Escenario 1: setup 180s -> STOP, luego run 90s -> STOP
const t0 = Date.parse('2026-07-31T18:23:00.000Z');
const events = [
  ev(1, 371, 'START', new Date(t0).toISOString(), 'SETUP'),
  ev(2, 371, 'STOP', new Date(t0 + 180000).toISOString()),
  ev(3, 371, 'START', new Date(t0 + 181000).toISOString(), 'RUN'),
  ev(4, 371, 'STOP', new Date(t0 + 181000 + 90000).toISOString())
];

const seg1 = selectEventsForStopSegment(events, events[1]);
const tot1 = computeTotalsFromEvents(seg1);
assert.strictEqual(seg1.map((e) => e.id).join(','), '1,2');
assert.strictEqual(minutesCeil(tot1.total_setup_seconds), 3);
assert.strictEqual(minutesCeil(tot1.total_run_seconds), 0);

const seg2 = selectEventsForStopSegment(events, events[3]);
const tot2 = computeTotalsFromEvents(seg2);
assert.strictEqual(seg2.map((e) => e.id).join(','), '3,4');
assert.strictEqual(minutesCeil(tot2.total_setup_seconds), 0);
assert.strictEqual(minutesCeil(tot2.total_run_seconds), 2);

// Escenario 2: tres STOP solo RUN (100, 50, 20 minutos)
const r0 = Date.parse('2026-07-31T10:00:00.000Z');
const runOnly = [
  ev(10, 99, 'START', new Date(r0).toISOString(), 'RUN'),
  ev(11, 99, 'STOP', new Date(r0 + 100 * 60000).toISOString()),
  ev(12, 99, 'START', new Date(r0 + 100 * 60000 + 1000).toISOString(), 'RUN'),
  ev(13, 99, 'STOP', new Date(r0 + 150 * 60000 + 1000).toISOString()),
  ev(14, 99, 'START', new Date(r0 + 150 * 60000 + 2000).toISOString(), 'RUN'),
  ev(15, 99, 'STOP', new Date(r0 + 170 * 60000 + 2000).toISOString())
];
const d1 = minutesCeil(computeTotalsFromEvents(selectEventsForStopSegment(runOnly, runOnly[1])).total_run_seconds);
const d2 = minutesCeil(computeTotalsFromEvents(selectEventsForStopSegment(runOnly, runOnly[3])).total_run_seconds);
const d3 = minutesCeil(computeTotalsFromEvents(selectEventsForStopSegment(runOnly, runOnly[5])).total_run_seconds);
assert.strictEqual(d1, 100);
assert.strictEqual(d2, 50);
assert.strictEqual(d3, 20);

// Escenario 5: timers distintos no se mezclan
const mixed = [
  ...events,
  ev(20, 999, 'START', new Date(t0).toISOString(), 'RUN'),
  ev(21, 999, 'STOP', new Date(t0 + 600000).toISOString())
];
const only371 = selectEventsForStopSegment(mixed, events[3]);
assert.ok(only371.every((e) => Number(e.operation_timer_id) === 371));
assert.strictEqual(only371.map((e) => e.id).join(','), '3,4');

console.log('OK test-stop-segment-delta: escenarios 1, 2 y separacion por timer');
