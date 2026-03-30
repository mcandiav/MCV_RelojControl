const { Op } = require('sequelize');
const WorkOrderOperation = require('../../models/work_order_operation');
const TimerEvent = require('../../models/timer_event');
const { computeTotalsFromEvents } = require('../../lib/timerEventTotals');

/**
 * Arquitectura v6: overwrite de los 3 datos vigentes por operación hacia manufacturingoperationtask.
 * Nota: actual_setup_time queda en 0 hasta modelar fases de montaje explícitas en eventos (no inferir desde pausa).
 */
async function buildActualsPayload({ operationIds } = {}) {
  const where = {
    netsuite_operation_id: {
      [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }]
    }
  };
  if (operationIds && operationIds.length) {
    where.id = { [Op.in]: operationIds };
  }

  const ops = await WorkOrderOperation.findAll({ where });
  const opIds = ops.map((op) => op.id).filter((id) => Number.isInteger(id));
  const eventsByOp = new Map();

  if (opIds.length > 0) {
    const allEvents = await TimerEvent.findAll({
      where: { work_order_operation_id: { [Op.in]: opIds } },
      order: [['work_order_operation_id', 'ASC'], ['event_at', 'ASC']]
    });
    for (const ev of allEvents) {
      const key = ev.work_order_operation_id;
      if (!eventsByOp.has(key)) eventsByOp.set(key, []);
      eventsByOp.get(key).push(ev);
    }
  }

  const items = [];

  for (const op of ops) {
    const nsId = Number(op.netsuite_operation_id);
    if (!Number.isFinite(nsId)) continue;

    const events = eventsByOp.get(op.id) || [];
    const totals = computeTotalsFromEvents(events);
    const base_run_time =
      op.actual_run_time != null && Number.isFinite(Number(op.actual_run_time))
        ? Math.max(0, Math.floor(Number(op.actual_run_time)))
        : 0;
    const base_setup_time =
      op.actual_setup_time != null && Number.isFinite(Number(op.actual_setup_time))
        ? Math.max(0, Math.floor(Number(op.actual_setup_time)))
        : 0;
    const delta_run_time = Math.max(0, Math.floor(totals.total_active_seconds / 60));
    const actual_run_time = base_run_time + delta_run_time;
    const actual_setup_time = base_setup_time;
    const cq = op.completed_quantity;
    const completed_quantity =
      cq != null && cq !== '' && Number.isFinite(Number(cq)) ? Math.max(0, Math.floor(Number(cq))) : 0;
    const lastPushedRun =
      op.last_pushed_actual_run_time != null && Number.isFinite(Number(op.last_pushed_actual_run_time))
        ? Math.max(0, Math.floor(Number(op.last_pushed_actual_run_time)))
        : base_run_time;
    const lastPushedQty =
      op.last_pushed_completed_quantity != null && Number.isFinite(Number(op.last_pushed_completed_quantity))
        ? Math.max(0, Math.floor(Number(op.last_pushed_completed_quantity)))
        : completed_quantity;

    // Si aún no existe baseline de push (columnas nuevas en 0) pero la fila ya vino sincronizada desde NetSuite,
    // tomar los reales actuales como baseline para evitar push masivo falso.
    const lastSyncedAt = op.last_synced_at ? new Date(op.last_synced_at) : null;
    const hasSyncedStamp = lastSyncedAt instanceof Date && !Number.isNaN(lastSyncedAt.getTime());
    const baselineRun = (lastPushedRun === 0 && hasSyncedStamp && base_run_time > 0) ? base_run_time : lastPushedRun;
    const baselineQty = (lastPushedQty === 0 && hasSyncedStamp && completed_quantity > 0) ? completed_quantity : lastPushedQty;

    // Regla definitiva: solo enviar operaciones con tiempo real cronometrado.
    if ((actual_run_time + actual_setup_time) <= 0) {
      continue;
    }
    // Solo enviar cambios pendientes reales contra el último push exitoso.
    if (actual_run_time <= baselineRun && completed_quantity <= baselineQty) {
      continue;
    }

    items.push({
      operation_id: op.id,
      ot_number: op.ot_number,
      operation_sequence: op.operation_sequence,
      netsuite_work_order_id: op.netsuite_work_order_id || null,
      netsuite_operation_id: nsId,
      actual_setup_time,
      actual_run_time,
      completed_quantity
    });
  }

  return { items };
}

module.exports = {
  buildActualsPayload
};
