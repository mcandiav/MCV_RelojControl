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
  const items = [];

  for (const op of ops) {
    const nsId = Number(op.netsuite_operation_id);
    if (!Number.isFinite(nsId)) continue;

    const events = await TimerEvent.findAll({
      where: { work_order_operation_id: op.id },
      order: [['event_at', 'ASC']]
    });
    const totals = computeTotalsFromEvents(events);
    const actual_run_time = Math.max(0, Math.floor(totals.total_active_seconds / 60));
    const actual_setup_time = 0;
    const cq = op.completed_quantity;
    const completed_quantity =
      cq != null && cq !== '' && Number.isFinite(Number(cq)) ? Math.max(0, Math.floor(Number(cq))) : 0;

    items.push({
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
