const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
const TimerEvent = require('../models/timer_event');
const OperationTimeTotal = require('../models/operation_time_total');
const { isNetsuiteConfigured, getNetsuiteConfigStatus } = require('../services/netsuite/config');
const { fetchFullDataset } = require('../services/netsuite/datasetClient');
const { pushActualsBatch } = require('../services/netsuite/restletClient');
const { buildActualsPayload } = require('../services/netsuite/buildActualsPayload');
const { clearTokenCache } = require('../services/netsuite/oauthToken');
const SyncRun = require('../models/sync_run');
const SyncRunStep = require('../models/sync_run_step');
const config = require('../config/config');
let netsuitePushInFlight = false;
let netsuiteOperationalSyncInFlight = false;

function resolveAreaFromResource(resourceCode) {
  const code = String(resourceCode || '').trim().toUpperCase();
  if (code.startsWith('ME')) return 'ME';
  if (code.startsWith('ES')) return 'ES';
  return null;
}

const NS_UPSERT_UPDATE_FIELDS = [
  'operation_code',
  'operation_name',
  'area',
  'planned_setup_minutes',
  'planned_operation_minutes',
  'planned_quantity',
  'actual_setup_time',
  'actual_run_time',
  'completed_quantity',
  'last_pushed_actual_run_time',
  'last_pushed_completed_quantity',
  'netsuite_work_order_id',
  'netsuite_operation_id',
  'source_status',
  'last_synced_at',
  'updatedAt'
];

function dedupeWipRows(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    if (!row) continue;
    const key = `${row.ot_number || ''}__${row.operation_sequence || ''}__${row.resource_code || ''}`;
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

async function markSuccessfulPushes(payloadItems, netsuiteResult) {
  if (!Array.isArray(payloadItems) || payloadItems.length === 0) return 0;
  const byNsId = new Map();
  for (const item of payloadItems) {
    byNsId.set(String(item.netsuite_operation_id), item);
  }
  const results = Array.isArray(netsuiteResult && netsuiteResult.results) ? netsuiteResult.results : [];
  const updates = [];
  for (const r of results) {
    if (!r || r.success !== true) continue;
    const key = String(r.netsuite_operation_id || '');
    const src = byNsId.get(key);
    if (!src || !Number.isInteger(src.operation_id)) continue;
    updates.push({
      id: src.operation_id,
      last_pushed_actual_run_time: Math.max(
        0,
        Math.floor(
          Number(
            src.absolute_actual_run_time != null ? src.absolute_actual_run_time : src.actual_run_time
          ) || 0
        )
      ),
      last_pushed_completed_quantity: Math.max(
        0,
        Math.floor(
          Number(
            src.absolute_completed_quantity != null ? src.absolute_completed_quantity : src.completed_quantity
          ) || 0
        )
      )
    });
  }
  if (updates.length === 0) return 0;
  await Promise.all(
    updates.map((u) =>
      WorkOrderOperation.update(
        {
          last_pushed_actual_run_time: u.last_pushed_actual_run_time,
          last_pushed_completed_quantity: u.last_pushed_completed_quantity
        },
        { where: { id: u.id } }
      )
    )
  );
  return updates.length;
}

function explainSequelizeError(err) {
  if (!err) return 'unknown_error';
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const first = err.errors[0];
    const path = first && first.path ? String(first.path) : '';
    const msg = first && first.message ? String(first.message) : String(err.message || err);
    return path ? `${path}: ${msg}` : msg;
  }
  if (err.parent && err.parent.sqlMessage) return String(err.parent.sqlMessage);
  if (err.original && err.original.sqlMessage) return String(err.original.sqlMessage);
  return String(err.message || err);
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return JSON.stringify({ error: 'stringify_failed', message: String(e && e.message ? e.message : e) });
  }
}

async function createSyncRun({ flowType, trigger, req }) {
  return SyncRun.create({
    flow_type: flowType,
    trigger,
    status: 'RUNNING',
    started_at: new Date(),
    requested_by_user_id: req && req.userId ? Number(req.userId) : null,
    station_id: req && req.stationId ? String(req.stationId) : null,
    warning: false,
    summary_json: null,
    error_message: null
  });
}

async function createSyncStep(syncRunId, stepName, payload) {
  return SyncRunStep.create({
    sync_run_id: syncRunId,
    step_name: stepName,
    status: 'RUNNING',
    started_at: new Date(),
    result_json: payload != null ? safeJsonStringify(payload) : null
  });
}

async function finishSyncStep(step, { ok, result, errorMessage }) {
  if (!step) return;
  step.status = ok ? 'SUCCESS' : 'ERROR';
  step.finished_at = new Date();
  step.duration_ms = step.started_at ? Math.max(0, Date.now() - new Date(step.started_at).getTime()) : null;
  if (result != null) step.result_json = safeJsonStringify(result);
  if (!ok && errorMessage) step.error_message = String(errorMessage);
  await step.save();
}

async function finishSyncRun(run, { ok, summary, errorMessage, warning }) {
  if (!run) return;
  run.status = ok ? 'SUCCESS' : 'ERROR';
  run.finished_at = new Date();
  run.duration_ms = run.started_at ? Math.max(0, Date.now() - new Date(run.started_at).getTime()) : null;
  run.warning = !!warning;
  if (summary != null) run.summary_json = safeJsonStringify(summary);
  if (!ok && errorMessage) run.error_message = String(errorMessage);
  await run.save();
}

function clampOperationalPullDelaySeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return config.NS_OPERATIONAL_PULL_DELAY_SECONDS;
  return Math.max(0, Math.min(120, Math.floor(n)));
}

/**
 * PUSH + WAIT + PULL con pasos en sync_run_steps (después de STOP ya cerrado).
 */
async function runOperationalPushWaitPullLogged(syncRun, { delaySeconds, startedAt, shift }) {
  const delayMs = delaySeconds * 1000;
  let stepPush = null;
  let stepWait = null;
  let stepPull = null;
  try {
    stepPush = await createSyncStep(syncRun.id, 'PUSH', { note: 'pushActualsBatch(buildActualsPayload())' });
    const { items } = await buildActualsPayload();
    let netsuitePush = null;
    let markedSuccessfulPushes = 0;
    if (items.length > 0) {
      netsuitePush = await pushActualsBatch(items);
      markedSuccessfulPushes = await markSuccessfulPushes(items, netsuitePush);
    }
    await finishSyncStep(stepPush, {
      ok: true,
      result: { itemCount: items.length, markedSuccessfulPushes, netsuite: netsuitePush }
    });

    stepWait = await createSyncStep(syncRun.id, 'WAIT', { delaySecondsApplied: delaySeconds });
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await finishSyncStep(stepWait, { ok: true, result: { delaySecondsApplied: delaySeconds } });

    stepPull = await createSyncStep(syncRun.id, 'PULL', { note: 'fetchFullDataset + replaceAllWipRows' });
    const { rows, totalRows } = await fetchFullDataset(resolveAreaFromResource, {});
    const replaced = await replaceAllWipRows(rows);
    await finishSyncStep(stepPull, { ok: true, result: { totalRows, imported: replaced.imported } });

    const summary = {
      elapsedMs: Date.now() - startedAt,
      delaySecondsApplied: delaySeconds,
      shift,
      push: { itemCount: items.length, markedSuccessfulPushes },
      pull: { totalRows, imported: replaced.imported }
    };
    const warning = Array.isArray(netsuitePush && netsuitePush.results)
      ? netsuitePush.results.some((r) => r && r.success === false)
      : false;
    await finishSyncRun(syncRun, { ok: true, summary, warning });

    return {
      shift,
      delaySecondsApplied: delaySeconds,
      items,
      netsuitePush,
      markedSuccessfulPushes,
      totalRows,
      replaced,
      elapsedMs: Date.now() - startedAt
    };
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : explainSequelizeError(err);
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
    try {
      if (stepPull && stepPull.status === 'RUNNING') await finishSyncStep(stepPull, { ok: false, errorMessage: msg });
      if (stepWait && stepWait.status === 'RUNNING') await finishSyncStep(stepWait, { ok: false, errorMessage: msg });
      if (stepPush && stepPush.status === 'RUNNING') await finishSyncStep(stepPush, { ok: false, errorMessage: msg });
      await finishSyncRun(syncRun, {
        ok: false,
        errorMessage: msg,
        summary: { elapsedMs: Date.now() - startedAt, delaySecondsApplied: delaySeconds, shift }
      });
    } catch (_) {}
    throw err;
  }
}

/**
 * Cierre de turno programado: mismo log que sync operativa (STOP + opcional PUSH/WAIT/PULL).
 */
async function logSchedulerShiftCloseOperational(shiftSummary, { runNetSuitePhases }) {
  const delaySeconds = clampOperationalPullDelaySeconds(config.NS_OPERATIONAL_PULL_DELAY_SECONDS);
  const startedAt = Date.now();

  if (!runNetSuitePhases) {
    const syncRun = await createSyncRun({ flowType: 'operational', trigger: 'scheduler', req: null });
    const stepStop = await createSyncStep(syncRun.id, 'STOP', { scope: 'ALL', source: 'shift_close_scheduler' });
    await finishSyncStep(stepStop, { ok: true, result: shiftSummary });
    await finishSyncRun(syncRun, {
      ok: true,
      summary: {
        shift: shiftSummary,
        netsuitePhasesSkipped: true,
        reason: 'NETSUITE_PUSH_ON_SHIFT_CLOSE_disabled'
      }
    });
    return { syncRunId: syncRun.id, netsuitePhasesSkipped: true, netsuiteSyncEnabled: false };
  }

  if (netsuiteOperationalSyncInFlight || netsuitePushInFlight) {
    const syncRun = await createSyncRun({ flowType: 'operational', trigger: 'scheduler', req: null });
    const stepStop = await createSyncStep(syncRun.id, 'STOP', { scope: 'ALL', source: 'shift_close_scheduler' });
    await finishSyncStep(stepStop, { ok: true, result: shiftSummary });
    const errMsg = 'Ya hay una sincronizacion/push en curso. Espera a que termine.';
    await finishSyncRun(syncRun, {
      ok: false,
      errorMessage: errMsg,
      summary: { shift: shiftSummary, delaySecondsApplied: delaySeconds }
    });
    console.error('Scheduled shift close NetSuite phases skipped (sync in flight):', errMsg);
    return {
      syncRunId: syncRun.id,
      netsuiteSyncEnabled: true,
      netsuiteSyncError: errMsg,
      conflict: true
    };
  }

  if (!isNetsuiteConfigured()) {
    const syncRun = await createSyncRun({ flowType: 'operational', trigger: 'scheduler', req: null });
    const stepStop = await createSyncStep(syncRun.id, 'STOP', { scope: 'ALL', source: 'shift_close_scheduler' });
    await finishSyncStep(stepStop, { ok: true, result: shiftSummary });
    const errMsg =
      'NetSuite no esta configurado. Ver NETSUITE_ENV_TEMPLATE.md y variables de entorno.';
    await finishSyncRun(syncRun, {
      ok: false,
      errorMessage: errMsg,
      summary: { shift: shiftSummary }
    });
    console.error('Scheduled shift close NetSuite phases failed:', errMsg);
    return {
      syncRunId: syncRun.id,
      netsuiteSyncEnabled: true,
      netsuiteSyncError: errMsg,
      netsuiteNotConfigured: true
    };
  }

  netsuiteOperationalSyncInFlight = true;
  netsuitePushInFlight = true;
  let syncRun = null;
  try {
    syncRun = await createSyncRun({ flowType: 'operational', trigger: 'scheduler', req: null });
    const stepStop = await createSyncStep(syncRun.id, 'STOP', { scope: 'ALL', source: 'shift_close_scheduler' });
    await finishSyncStep(stepStop, { ok: true, result: shiftSummary });

    const out = await runOperationalPushWaitPullLogged(syncRun, {
      delaySeconds,
      startedAt,
      shift: shiftSummary
    });

    const itemCount = out.items.length;
    const netsuiteSync = {
      pushed: itemCount,
      pushSkipped: itemCount === 0,
      imported: out.replaced.imported,
      totalRows: out.totalRows,
      maxRowsApplied: null,
      netsuitePush: out.netsuitePush
    };

    return {
      syncRunId: syncRun.id,
      netsuiteSyncEnabled: true,
      netsuiteSync,
      delaySecondsApplied: delaySeconds,
      elapsedMs: out.elapsedMs
    };
  } catch (error) {
    const msg = error.message || String(error);
    console.error('NetSuite operational sync after scheduled shift close failed:', msg);
    return {
      syncRunId: syncRun ? syncRun.id : null,
      netsuiteSyncEnabled: true,
      netsuiteSyncError: msg
    };
  } finally {
    netsuiteOperationalSyncInFlight = false;
    netsuitePushInFlight = false;
  }
}

async function assertNoActiveTimers() {
  const active = await OperationTimer.count({
    where: { status: ['ACTIVE', 'PAUSED'] }
  });
  if (active > 0) {
    const err = new Error('Hay cronómetros activos/pausados. Detenelos antes de sincronizar WIP desde NetSuite.');
    err.code = 'TIMERS_ACTIVE';
    err.activeTimers = active;
    throw err;
  }
}

async function persistNetsuiteWipRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { imported: 0 };
  }
  const deduped = dedupeWipRows(rows);
  await WorkOrderOperation.bulkCreate(deduped, {
    updateOnDuplicate: NS_UPSERT_UPDATE_FIELDS
  });
  return { imported: deduped.length };
}

async function resetChronometersForPulledRows(rows) {
  const deduped = dedupeWipRows(rows);
  if (deduped.length === 0) {
    return { operations: 0, timersDeleted: 0, eventsDeleted: 0, totalsDeleted: 0 };
  }

  const nsIds = Array.from(
    new Set(
      deduped
        .map((r) => (r && r.netsuite_operation_id != null ? String(r.netsuite_operation_id).trim() : ''))
        .filter(Boolean)
    )
  );

  const whereClauses = [];
  if (nsIds.length > 0) {
    whereClauses.push({ netsuite_operation_id: { [Op.in]: nsIds } });
  }

  for (const r of deduped) {
    if (!r) continue;
    whereClauses.push({
      ot_number: r.ot_number,
      operation_sequence: r.operation_sequence,
      resource_code: r.resource_code
    });
  }

  if (whereClauses.length === 0) {
    return { operations: 0, timersDeleted: 0, eventsDeleted: 0, totalsDeleted: 0 };
  }

  const ops = await WorkOrderOperation.findAll({
    attributes: ['id'],
    where: whereClauses.length === 1 ? whereClauses[0] : { [Op.or]: whereClauses }
  });
  const opIds = ops.map((o) => o.id).filter((id) => Number.isInteger(id));
  if (opIds.length === 0) {
    return { operations: 0, timersDeleted: 0, eventsDeleted: 0, totalsDeleted: 0 };
  }

  const eventsDeleted = await TimerEvent.destroy({
    where: { work_order_operation_id: { [Op.in]: opIds } }
  });
  const totalsDeleted = await OperationTimeTotal.destroy({
    where: { work_order_operation_id: { [Op.in]: opIds } }
  });
  const timersDeleted = await OperationTimer.destroy({
    where: { work_order_operation_id: { [Op.in]: opIds } }
  });

  return {
    operations: opIds.length,
    timersDeleted,
    eventsDeleted,
    totalsDeleted
  };
}

async function replaceAllWipRows(rows) {
  if (!Array.isArray(rows)) rows = [];
  const deduped = dedupeWipRows(rows);
  // Si hay cronómetros corriendo/pausados, no es seguro pisar el universo WIP.
  await assertNoActiveTimers();

  return WorkOrderOperation.sequelize.transaction(async (t) => {
    // Universo WIP = verdad NetSuite: reemplazar todo lo local.
    // No usar TRUNCATE: falla con FK en MariaDB (1701).
    // Orden de borrado por dependencias:
    // timer_events -> operation_time_totals -> operation_timers -> work_order_operations
    await TimerEvent.destroy({ where: {}, transaction: t });
    await OperationTimeTotal.destroy({ where: {}, transaction: t });
    await OperationTimer.destroy({ where: {}, transaction: t });
    await WorkOrderOperation.destroy({ where: {}, transaction: t });

    if (deduped.length === 0) return { imported: 0 };
    await WorkOrderOperation.bulkCreate(deduped, { transaction: t });
    return { imported: deduped.length };
  });
}

async function runOfficialSyncFlow({ operationIds = null, maxRows = 0 } = {}) {
  if (!isNetsuiteConfigured()) {
    const err = new Error('NetSuite no esta configurado. Ver NETSUITE_ENV_TEMPLATE.md y variables de entorno.');
    err.code = 'NETSUITE_NOT_CONFIGURED';
    throw err;
  }

  // Regla oficial: no ejecutar sincronizacion con cronometros activos.
  await assertNoActiveTimers();

  const { items } = await buildActualsPayload(
    operationIds && operationIds.length ? { operationIds } : {}
  );

  let pushResult = null;
  if (items.length > 0) {
    pushResult = await pushActualsBatch(items);
    await markSuccessfulPushes(items, pushResult);
  }

  const fetchOptions = {};
  if (Number.isInteger(maxRows) && maxRows > 0) fetchOptions.maxRows = maxRows;
  const { rows, totalRows } = await fetchFullDataset(resolveAreaFromResource, fetchOptions);
  const replaceResult = await replaceAllWipRows(rows);

  return {
    pushed: items.length,
    pushSkipped: items.length === 0,
    imported: replaceResult.imported,
    totalRows,
    maxRowsApplied: fetchOptions.maxRows || null,
    netsuitePush: pushResult
  };
}

exports.getConfigStatus = async function getConfigStatus(req, res) {
  return res.status(200).json(getNetsuiteConfigStatus());
};

exports.pullDataset = async function pullDataset(req, res) {
  const pullStartedAt = Date.now();
  const runId = `pull_${pullStartedAt}_${Math.random().toString(36).slice(2, 8)}`;
  // #region agent log
  console.log('[dbg][H3][pull-start]', runId, JSON.stringify({ query: req.query || {}, origin: req.headers.origin || null }));
  // #endregion
  if (!isNetsuiteConfigured()) {
    return res.status(503).json({
      message: 'NetSuite no está configurado. Ver NETSUITE_ENV_TEMPLATE.md y variables de entorno.'
    });
  }

  try {
    const maxRowsRaw = String(req.query.maxRows || req.query.max_rows || '').trim();
    const maxRows = maxRowsRaw ? Number(maxRowsRaw) : 0;
    const fetchOptions = Number.isInteger(maxRows) && maxRows > 0 ? { maxRows } : {};
    fetchOptions.runId = runId;
    const { rows, totalRows } = await fetchFullDataset(resolveAreaFromResource, fetchOptions);
    // #region agent log
    console.log('[dbg][H2][after-fetch]', runId, JSON.stringify({ rows: rows.length, totalRows, maxRowsApplied: fetchOptions.maxRows || null, elapsedMs: Date.now() - pullStartedAt }));
    // #endregion
    if (rows.length === 0) {
      return res.status(200).json({
        message: 'OUT sin filas válidas tras mapeo.',
        imported: 0,
        totalRows
      });
    }

    const replace = String(req.query.replace || '').trim() === '1' || String(req.query.replace || '').toLowerCase() === 'true';
    const result = replace ? await replaceAllWipRows(rows) : await persistNetsuiteWipRows(rows);
    const resetResult = replace
      ? { operations: 'all', timersDeleted: 'all', eventsDeleted: 'all', totalsDeleted: 'all' }
      : await resetChronometersForPulledRows(rows);
    // #region agent log
    console.log('[dbg][H4][after-persist]', runId, JSON.stringify({ replace, imported: result.imported, elapsedMs: Date.now() - pullStartedAt }));
    // #endregion

    return res.status(200).json({
      message: replace
        ? 'Pull OUT aplicado (replace total de work_order_operations).'
        : 'Pull OUT aplicado (upsert) y cronometros reseteados para operaciones sincronizadas.',
      imported: result.imported,
      totalRows,
      maxRowsApplied: fetchOptions.maxRows || null,
      reset: resetResult
    });
  } catch (err) {
    // #region agent log
    console.log('[dbg][H1][pull-catch]', runId, JSON.stringify({ code: err && err.code ? err.code : null, message: err && err.message ? err.message : String(err), elapsedMs: Date.now() - pullStartedAt }));
    // #endregion
    if (err && err.code === 'TIMERS_ACTIVE') {
      return res.status(409).json({
        message: err.message,
        activeTimers: err.activeTimers
      });
    }
    const detail = err.response && err.response.data ? err.response.data : err.message;
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'Fallo al leer dataset o guardar operaciones.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

/**
 * Recibe operaciones ya leídas del dataset (p. ej. script en el host fuera de Docker) y aplica el mismo upsert que pull-dataset.
 * No incluye completed_quantity en updateOnDuplicate.
 */
exports.ingestWipFromStandalonePull = async function ingestWipFromStandalonePull(req, res) {
  const { operations } = req.body || {};
  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ message: 'Body debe incluir operations: array no vacío.' });
  }

  for (let i = 0; i < operations.length; i += 1) {
    const op = operations[i];
    if (!op || !op.ot_number || !op.resource_code || op.operation_sequence == null || !op.operation_name) {
      return res.status(400).json({
        message: `operations[${i}]: faltan ot_number, operation_sequence, operation_name o resource_code.`
      });
    }
    if (!['ME', 'ES'].includes(String(op.area || '').toUpperCase())) {
      return res.status(400).json({ message: `operations[${i}]: area debe ser ME o ES.` });
    }
  }

  try {
    const { imported } = await persistNetsuiteWipRows(operations);
    return res.status(200).json({
      message: 'Ingesta aplicada (mismo criterio que pull interno; completed_quantity local no se pisa en duplicados).',
      imported
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error al persistir operaciones.',
      error: err.message || String(err)
    });
  }
};

exports.pushActuals = async function pushActuals(req, res) {
  if (!isNetsuiteConfigured()) {
    return res.status(503).json({
      message: 'NetSuite no está configurado. Ver NETSUITE_ENV_TEMPLATE.md y variables de entorno.'
    });
  }
  if (netsuitePushInFlight) {
    return res.status(409).json({
      message: 'Ya hay un push a NetSuite en curso. Espera a que termine para evitar envios duplicados.'
    });
  }
  netsuitePushInFlight = true;

  const rawIds = req.body && req.body.operation_ids;
  const operationIds = Array.isArray(rawIds)
    ? rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : null;
  const dryRun =
    String(req.query.dryRun || req.query.dry_run || '').trim() === '1' ||
    String(req.query.dryRun || req.query.dry_run || '').toLowerCase() === 'true' ||
    Boolean(req.body && req.body.dry_run === true);

  try {
    const { items } = await buildActualsPayload(
      operationIds && operationIds.length ? { operationIds } : {}
    );
    if (items.length === 0) {
      return res.status(400).json({
        message: 'No hay operaciones con tiempo cronometrado para publicar en NetSuite.'
      });
    }

    if (dryRun) {
      const payloadPreview = items.map((it) => ({
        operation_id: it.operation_id,
        ot_number: it.ot_number,
        operation_sequence: it.operation_sequence,
        netsuite_work_order_id: it.netsuite_work_order_id,
        netsuite_operation_id: it.netsuite_operation_id,
        actual_setup_time: it.actual_setup_time,
        actual_run_time: it.actual_run_time,
        completed_quantity: it.completed_quantity
      }));
      return res.status(200).json({
        message: 'Dry run OK: payload preparado, sin envío a NetSuite.',
        itemCount: payloadPreview.length,
        items: payloadPreview
      });
    }

    const netsuite = await pushActualsBatch(items);
    const marked = await markSuccessfulPushes(items, netsuite);
    return res.status(200).json({
      message: 'Batch enviado a NetSuite.',
      itemCount: items.length,
      markedSuccessfulPushes: marked,
      netsuite
    });
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : err.message;
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'Fallo al publicar en NetSuite.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  } finally {
    netsuitePushInFlight = false;
  }
};

exports.officialSync = async function officialSync(req, res) {
  const rawIds = req.body && req.body.operation_ids;
  const operationIds = Array.isArray(rawIds)
    ? rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : null;
  const maxRowsRaw = String(req.query.maxRows || req.query.max_rows || '').trim();
  const maxRows = maxRowsRaw ? Number(maxRowsRaw) : 0;

  try {
    const result = await runOfficialSyncFlow({
      operationIds: operationIds && operationIds.length ? operationIds : null,
      maxRows: Number.isInteger(maxRows) && maxRows > 0 ? maxRows : 0
    });
    return res.status(200).json({
      message: 'Sincronizacion oficial completada (push confirmado + pull + replace total WIP).',
      ...result
    });
  } catch (err) {
    if (err && err.code === 'NETSUITE_NOT_CONFIGURED') {
      return res.status(503).json({ message: err.message });
    }
    if (err && err.code === 'TIMERS_ACTIVE') {
      return res.status(409).json({
        message: err.message,
        activeTimers: err.activeTimers
      });
    }
    const detail = err.response && err.response.data ? err.response.data : explainSequelizeError(err);
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'Fallo en sincronizacion oficial NetSuite.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

exports.operationalSync = async function operationalSync(req, res) {
  if (!isNetsuiteConfigured()) {
    return res.status(503).json({
      message: 'NetSuite no estÃ¡ configurado. Ver NETSUITE_ENV_TEMPLATE.md y variables de entorno.'
    });
  }
  if (netsuiteOperationalSyncInFlight || netsuitePushInFlight) {
    return res.status(409).json({
      message: 'Ya hay una sincronizacion/push en curso. Espera a que termine.'
    });
  }

  const delaySecondsRaw = req.body && req.body.pull_delay_seconds;
  const delaySeconds = Number.isFinite(Number(delaySecondsRaw))
    ? clampOperationalPullDelaySeconds(delaySecondsRaw)
    : config.NS_OPERATIONAL_PULL_DELAY_SECONDS;

  netsuiteOperationalSyncInFlight = true;
  netsuitePushInFlight = true;
  const startedAt = Date.now();

  let syncRun = null;
  let stepStop = null;

  try {
    const { runShiftClose } = require('./chronometer');
    syncRun = await createSyncRun({ flowType: 'operational', trigger: 'manual', req });

    stepStop = await createSyncStep(syncRun.id, 'STOP', { scope: 'ALL' });
    const shift = await runShiftClose('manual_operational_sync', { skipNetsuiteSync: true });
    await finishSyncStep(stepStop, { ok: true, result: shift });

    const out = await runOperationalPushWaitPullLogged(syncRun, {
      delaySeconds,
      startedAt,
      shift
    });

    return res.status(200).json({
      message: 'Sincronización operativa completada.',
      elapsedMs: out.elapsedMs,
      delaySecondsApplied: delaySeconds,
      shift: out.shift,
      push: {
        itemCount: out.items.length,
        markedSuccessfulPushes: out.markedSuccessfulPushes,
        netsuite: out.netsuitePush
      },
      pull: {
        totalRows: out.totalRows,
        imported: out.replaced.imported
      }
    });
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : explainSequelizeError(err);
    try {
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      if (stepStop && stepStop.status === 'RUNNING') await finishSyncStep(stepStop, { ok: false, errorMessage: msg });
      if (syncRun && syncRun.status === 'RUNNING') {
        await finishSyncRun(syncRun, {
          ok: false,
          errorMessage: msg,
          summary: { elapsedMs: Date.now() - startedAt, delaySecondsApplied: delaySeconds }
        });
      }
    } catch (_) {}
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'Fallo en sincronización operativa.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  } finally {
    netsuitePushInFlight = false;
    netsuiteOperationalSyncInFlight = false;
  }
};

exports.clearOAuthCache = async function clearOAuthCacheController(req, res) {
  clearTokenCache();
  return res.status(200).json({ message: 'Token cache cleared.' });
};

/** Log: últimas sincronizaciones (admin). */
exports.listSyncRuns = async function listSyncRuns(req, res) {
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const rows = await SyncRun.findAll({
    order: [['started_at', 'DESC']],
    limit
  });
  return res.status(200).json({ count: rows.length, runs: rows.map((r) => r.toJSON()) });
};

/** Log: detalle de una sincronización (admin). */
exports.getSyncRun = async function getSyncRun(req, res) {
  const id = Number(req.params.id || 0);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'id inválido' });
  const run = await SyncRun.findByPk(id);
  if (!run) return res.status(404).json({ message: 'No encontrado' });
  const steps = await SyncRunStep.findAll({
    where: { sync_run_id: id },
    order: [['started_at', 'ASC']]
  });
  return res.status(200).json({ run: run.toJSON(), steps: steps.map((s) => s.toJSON()) });
};

/** Diagnóstico: listar datasets visibles por REST. */
exports.listDatasets = async function listDatasets(req, res) {
  if (!isNetsuiteConfigured()) {
    return res.status(503).json({ message: 'NetSuite no está configurado.' });
  }
  try {
    const axios = require('axios');
    const { getNetsuiteConfig } = require('../services/netsuite/config');
    const { getNetsuiteAccessToken } = require('../services/netsuite/oauthToken');
    const cfg = getNetsuiteConfig();
    const token = await getNetsuiteAccessToken();
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
    const url = `https://${cfg.suitetalkHost}/services/rest/query/v1/dataset/`;
    const { data } = await axios.get(url, {
      params: { limit, offset },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 120000
    });
    return res.status(200).json({
      url,
      ...data
    });
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : err.message;
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'No se pudo listar datasets.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

/** Diagnóstico: primera página del dataset sin persistir (útil para validar columnas). */
exports.peekDataset = async function peekDataset(req, res) {
  if (!isNetsuiteConfigured()) {
    return res.status(503).json({ message: 'NetSuite no está configurado.' });
  }
  try {
    const { getNetsuiteConfig } = require('../services/netsuite/config');
    const cfg = getNetsuiteConfig();
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '5'), 10) || 5));

    if (cfg.outSourceType === 'savedsearch') {
      const { rows, totalRows } = await fetchFullDataset(resolveAreaFromResource, { maxRows: limit });
      const sampleKeys = rows[0] ? Object.keys(rows[0]) : [];
      return res.status(200).json({
        sourceType: 'savedsearch',
        sourceId: cfg.outSavedSearchId || null,
        count: rows.length,
        hasMore: totalRows > rows.length,
        totalResults: totalRows,
        sampleFieldNames: sampleKeys,
        firstItems: rows
      });
    }

    const axios = require('axios');
    const { getNetsuiteAccessToken } = require('../services/netsuite/oauthToken');
    const token = await getNetsuiteAccessToken();
    const { data } = await axios.get(cfg.datasetResultUrl, {
      params: { limit, offset: 0 },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 120000
    });
    const sampleKeys =
      data.items && data.items[0] ? Object.keys(data.items[0]) : [];
    return res.status(200).json({
      count: data.count,
      hasMore: data.hasMore,
      totalResults: data.totalResults,
      sampleFieldNames: sampleKeys,
      firstItems: data.items || []
    });
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : err.message;
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'No se pudo leer el origen OUT.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};

exports.runOfficialSyncFlow = runOfficialSyncFlow;
exports.logSchedulerShiftCloseOperational = logSchedulerShiftCloseOperational;



