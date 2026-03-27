const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
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
  'netsuite_work_order_id',
  'netsuite_operation_id',
  'source_status',
  'last_synced_at',
  'updatedAt'
];

async function persistNetsuiteWipRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { imported: 0 };
  }
  await WorkOrderOperation.bulkCreate(rows, {
    updateOnDuplicate: NS_UPSERT_UPDATE_FIELDS
  });
  return { imported: rows.length };
}

async function replaceAllWipRows(rows) {
  if (!Array.isArray(rows)) rows = [];
  // Si hay cronómetros corriendo/pausados, no es seguro pisar el universo WIP.
  const active = await OperationTimer.count({
    where: { status: ['ACTIVE', 'PAUSED'] }
  });
  if (active > 0) {
    const err = new Error('Hay cronómetros activos/pausados. Detenelos antes de sincronizar WIP desde NetSuite.');
    err.code = 'TIMERS_ACTIVE';
    err.activeTimers = active;
    throw err;
  }

  return WorkOrderOperation.sequelize.transaction(async (t) => {
    // Universo WIP = verdad NetSuite: reemplazar todo lo local.
    await WorkOrderOperation.destroy({ where: {}, truncate: true, transaction: t });
    if (rows.length === 0) return { imported: 0 };
    await WorkOrderOperation.bulkCreate(rows, { transaction: t });
    return { imported: rows.length };
  });
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
        message: 'Dataset sin filas válidas tras mapeo.',
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
        ? 'Pull MCV_cronometro_out aplicado (replace total de work_order_operations).'
        : 'Pull MCV_cronometro_out aplicado (upsert). completed_quantity local no se sobrescribe en duplicados.',
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
        message: 'No hay operaciones con netsuite_operation_id para publicar.'
      });
    }

    const netsuite = await pushActualsBatch(items);
    return res.status(200).json({
      message: 'Batch enviado a MCV_Cronometro_In.',
      itemCount: items.length,
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
    const axios = require('axios');
    const { getNetsuiteConfig } = require('../services/netsuite/config');
    const { getNetsuiteAccessToken } = require('../services/netsuite/oauthToken');
    const cfg = getNetsuiteConfig();
    const token = await getNetsuiteAccessToken();
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '5'), 10) || 5));
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
      message: 'No se pudo leer el dataset.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail)
    });
  }
};
