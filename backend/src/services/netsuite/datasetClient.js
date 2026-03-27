const axios = require('axios');
const { getNetsuiteConfig } = require('./config');
const { getNetsuiteAccessToken } = require('./oauthToken');
const fs = require('fs');
const path = require('path');

function debugLog(payload) {
  try {
    const logPath = path.resolve(process.cwd(), '../debug-a425f7.log');
    const line = JSON.stringify({ sessionId: 'a425f7', timestamp: Date.now(), ...payload }) + '\n';
    // #region agent log
    fs.appendFileSync(logPath, line, 'utf8');
    // #endregion
  } catch (_) {}
}

function coalesce(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function getFieldCaseInsensitive(row, canonicalName) {
  const target = String(canonicalName).toUpperCase();
  const keys = Object.keys(row || {});
  const hit = keys.find((k) => String(k).toUpperCase() === target);
  return hit === undefined ? undefined : row[hit];
}

async function fetchRecordById({ type, id, token, host }) {
  const url = `https://${host}/services/rest/record/v1/${type}/${encodeURIComponent(String(id))}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 120000
  });
  return data;
}

/**
 * Maps a SuiteAnalytics dataset row to the internal WIP shape.
 * Column names may vary in casing; see cust.netsuite.md.
 */
async function mapDatasetRowToWip(row, resolveAreaFromResource, helpers) {
  const netsuite_operation_id = coalesce(
    getFieldCaseInsensitive(row, 'NETSUITE_OPERATION_ID'),
    row && row.netsuite_operation_id,
    row && row.manufacturingoperationtask,
    row && row.id
  );

  // Prefer OT_NUMBER if dataset provides it; otherwise try to resolve from workorder record.
  const workorderId = coalesce(row && row.workorder, row && row.manufacturingworkorder);
  const otFromDataset = getFieldCaseInsensitive(row, 'OT_NUMBER');
  let ot_number = String(otFromDataset ?? '').trim();
  const digits = ot_number.replace(/[^0-9]/g, '');
  if (digits && !/^OT/i.test(ot_number)) {
    ot_number = `OT${digits}`;
  } else if (digits && /^OT/i.test(ot_number)) {
    ot_number = `OT${digits}`;
  }

  const resourceFromDataset = getFieldCaseInsensitive(row, 'RESOURCE_CODE');
  const workcenterId = coalesce(row && row.manufacturingworkcenter, row && row.workcenter);

  let resource_code = String(resourceFromDataset ?? '').trim();
  if (!resource_code && workcenterId && helpers && helpers.getWorkcenterName) {
    const wcName = await helpers.getWorkcenterName(String(workcenterId));
    if (wcName) resource_code = wcName;
  }
  resource_code = String(resource_code || workcenterId || '').trim().toUpperCase();

  const operation_name = String(
    coalesce(getFieldCaseInsensitive(row, 'OPERATION_NAME'), row && row.operation_name) ??
      `NS OP ${netsuite_operation_id || ''}`
  ).trim();

  const operation_sequence = Number(
    coalesce(getFieldCaseInsensitive(row, 'OPERATION_SEQUENCE'), row && row.operationsequence)
  );

  const planned_setup = coalesce(getFieldCaseInsensitive(row, 'TIEMPO_MONTAJE_MIN'), row && row.setuptime);
  const planned_op_unit = coalesce(getFieldCaseInsensitive(row, 'TIEMPO_OPERACION_MIN_UNIT'), row && row.runrate);
  const planned_quantity = coalesce(getFieldCaseInsensitive(row, 'PLANNED_QUANTITY'), row && row.inputquantity);
  const source_status = String(
    coalesce(getFieldCaseInsensitive(row, 'SOURCE_STATUS'), row && row.status) ?? ''
  ).trim() || 'WIP';

  if (!ot_number && workorderId && helpers && helpers.getWorkorderTranId) {
    const tranId = await helpers.getWorkorderTranId(String(workorderId));
    if (tranId) ot_number = String(tranId).trim();
  }
  if (!ot_number && workorderId) {
    // Fallback: keep something searchable/stable even before enrichment.
    ot_number = `WO${String(workorderId).trim()}`;
  }

  const area = resolveAreaFromResource(resource_code);
  if (!netsuite_operation_id || !ot_number || !resource_code || !operation_name || !Number.isFinite(operation_sequence)) {
    return { skip: true, reason: 'missing_required_fields' };
  }
  if (!area || !['ME', 'ES'].includes(area)) {
    return { skip: true, reason: 'area_not_derivable' };
  }
  const pq = planned_quantity != null && planned_quantity !== '' ? Number(planned_quantity) : null;
  if (pq != null && (!Number.isFinite(pq) || pq <= 0)) {
    return { skip: true, reason: 'invalid_planned_quantity' };
  }

  return {
    skip: false,
    row: {
      ot_number,
      operation_sequence,
      operation_code: null,
      operation_name,
      resource_code,
      area,
      planned_setup_minutes: planned_setup != null && planned_setup !== '' ? Number(planned_setup) : null,
      planned_operation_minutes: planned_op_unit != null && planned_op_unit !== '' ? Number(planned_op_unit) : null,
      planned_quantity: pq,
      netsuite_operation_id: String(netsuite_operation_id),
      netsuite_work_order_id: null,
      source_status,
      last_synced_at: new Date()
    }
  };
}

async function fetchDatasetPage(datasetBaseUrl, token, limit, offset) {
  const { data } = await axios.get(datasetBaseUrl, {
    params: { limit, offset },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    timeout: 120000
  });
  return data;
}

/**
 * Pulls all pages from MCV_cronometro_out via REST dataset execution API.
 * @see https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_156577938018.html
 */
async function fetchFullDataset(resolveAreaFromResource, options = {}) {
  const runId = options && options.runId ? String(options.runId) : `dataset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const cfg = getNetsuiteConfig();
  if (!cfg.datasetResultUrl) {
    throw new Error('NetSuite dataset URL not derivable; set NETSUITE_ACCOUNT_ID');
  }

  const token = await getNetsuiteAccessToken();
  const host = cfg.suitetalkHost;
  const workcenterCache = new Map();
  const workorderCache = new Map();
  const helpers = {
    async getWorkcenterName(id) {
      if (!id) return null;
      if (workcenterCache.has(id)) return workcenterCache.get(id);
      try {
        const rec = await fetchRecordById({ type: 'manufacturingworkcenter', id, token, host });
        const name = rec && (rec.name || rec.externalid || rec.id) ? String(rec.name || rec.externalid || rec.id) : '';
        const val = name.trim() || null;
        workcenterCache.set(id, val);
        return val;
      } catch (_) {
        workcenterCache.set(id, null);
        return null;
      }
    },
    async getWorkorderTranId(id) {
      if (!id) return null;
      if (workorderCache.has(id)) return workorderCache.get(id);
      try {
        const rec = await fetchRecordById({ type: 'workorder', id, token, host });
        const tran =
          rec && (rec.tranid || rec.transactionnumber || rec.externalid || rec.id)
            ? String(rec.tranid || rec.transactionnumber || rec.externalid || rec.id)
            : '';
        const val = tran.trim() || null;
        workorderCache.set(id, val);
        return val;
      } catch (_) {
        workorderCache.set(id, null);
        return null;
      }
    }
  };

  const limit = 1000;
  const maxRows =
    options && Number.isInteger(Number(options.maxRows)) && Number(options.maxRows) > 0
      ? Number(options.maxRows)
      : 0;
  let offset = 0;
  const mapped = [];
  let hasMore = true;
  let pageCount = 0;

  // #region agent log
  debugLog({
    runId,
    hypothesisId: 'H2',
    location: 'backend/src/services/netsuite/datasetClient.js:fetchFullDataset:start',
    message: 'dataset pull started',
    data: { datasetResultUrl: cfg.datasetResultUrl, maxRows, pageLimit: limit }
  });
  // #endregion

  while (hasMore) {
    pageCount += 1;
    const page = await fetchDatasetPage(cfg.datasetResultUrl, token, limit, offset);
    const items = Array.isArray(page.items) ? page.items : [];
    for (const raw of items) {
      const out = await mapDatasetRowToWip(raw, resolveAreaFromResource, helpers);
      if (!out.skip) {
        mapped.push(out.row);
        if (maxRows > 0 && mapped.length >= maxRows) {
          hasMore = false;
          break;
        }
      }
    }
    if (!hasMore) break;
    hasMore = Boolean(page.hasMore);
    offset += items.length;
    if (items.length === 0) hasMore = false;
    // #region agent log
    debugLog({
      runId,
      hypothesisId: 'H2',
      location: 'backend/src/services/netsuite/datasetClient.js:fetchFullDataset:page',
      message: 'dataset page processed',
      data: { pageCount, itemsOnPage: items.length, mappedRows: mapped.length, hasMore, offset, elapsedMs: Date.now() - startedAt }
    });
    // #endregion
  }

  // #region agent log
  debugLog({
    runId,
    hypothesisId: 'H2',
    location: 'backend/src/services/netsuite/datasetClient.js:fetchFullDataset:done',
    message: 'dataset pull finished',
    data: { pageCount, mappedRows: mapped.length, elapsedMs: Date.now() - startedAt }
  });
  // #endregion

  return { rows: mapped, totalRows: mapped.length };
}

module.exports = {
  fetchFullDataset,
  mapDatasetRowToWip,
  getFieldCaseInsensitive
};
