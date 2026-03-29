const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
const TimerEvent = require('../models/timer_event');
const OperationTimeTotal = require('../models/operation_time_total');
const { isNetsuiteConfigured, getNetsuiteConfigStatus } = require('../services/netsuite/config');
const { fetchFullDataset } = require('../services/netsuite/datasetClient');
const { pushActualsBatch } = require('../services/netsuite/restletClient');
const { buildActualsPayload } = require('../services/netsuite/buildActualsPayload');
const { clearTokenCache } = require('../services/netsuite/oauthToken');

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
      last_pushed_actual_run_time: Math.max(0, Math.floor(Number(src.actual_run_time) || 0)),
      last_pushed_completed_quantity: Math.max(0, Math.floor(Number(src.completed_quantity) || 0))
    });
  }
  if (updates.length === 0) return 0;
  await WorkOrderOperation.bulkCreate(updates, {
    updateOnDuplicate: ['last_pushed_actual_run_time', 'last_pushed_completed_quantity', 'updatedAt']
  });
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
    const restletItems = items.map((it) => ({
      netsuite_operation_id: it.netsuite_operation_id,
      actual_setup_time: it.actual_setup_time,
      actual_run_time: it.actual_run_time,
      completed_quantity: it.completed_quantity
    }));
    pushResult = await pushActualsBatch(restletItems);
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
    // #region agent log
    console.log('[dbg][H4][after-persist]', runId, JSON.stringify({ replace, imported: result.imported, elapsedMs: Date.now() - pullStartedAt }));
    // #endregion

    return res.status(200).json({
      message: replace
        ? 'Pull OUT aplicado (replace total de work_order_operations).'
        : 'Pull OUT aplicado (upsert). completed_quantity local no se sobrescribe en duplicados.',
      imported: result.imported,
      totalRows,
      maxRowsApplied: fetchOptions.maxRows || null
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

  const rawIds = req.body && req.body.operation_ids;
  const operationIds = Array.isArray(rawIds)
    ? rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : null;

  try {
    const { items } = await buildActualsPayload(
      operationIds && operationIds.length ? { operationIds } : {}
    );
    if (items.length === 0) {
      return res.status(400).json({
        message: 'No hay operaciones con tiempo cronometrado para publicar en NetSuite.'
      });
    }

    const restletItems = items.map((it) => ({
      netsuite_operation_id: it.netsuite_operation_id,
      actual_setup_time: it.actual_setup_time,
      actual_run_time: it.actual_run_time,
      completed_quantity: it.completed_quantity
    }));
    const netsuite = await pushActualsBatch(restletItems);
    const marked = await markSuccessfulPushes(items, netsuite);
    return res.status(200).json({
      message: 'Batch enviado a MCV_Cronometro_In.',
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

exports.clearOAuthCache = async function clearOAuthCacheController(req, res) {
  clearTokenCache();
  return res.status(200).json({ message: 'Token cache cleared.' });
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
