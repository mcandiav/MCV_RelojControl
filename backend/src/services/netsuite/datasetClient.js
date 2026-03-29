const axios = require('axios');
const { getNetsuiteConfig } = require('./config');
const { getNetsuiteAccessToken } = require('./oauthToken');

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

function parseWorkcenterAreaMap(raw) {
  const map = new Map();
  const text = String(raw || '').trim();
  if (!text) return map;
  const pairs = text.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [left, right] = pair.split(':').map((v) => String(v || '').trim());
    if (!left || !right) continue;
    const area = right.toUpperCase();
    if (area !== 'ME' && area !== 'ES') continue;
    map.set(left, area);
  }
  return map;
}

function inferAreaFromText(text) {
  const t = ` ${String(text || '').toUpperCase()} `;
  if (t.includes(' ME ') || t.startsWith('ME ') || t.includes('[ME]') || t.includes('(ME)')) return 'ME';
  if (t.includes(' ES ') || t.startsWith('ES ') || t.includes('[ES]') || t.includes('(ES)')) return 'ES';
  return null;
}

function parseDefaultArea(raw) {
  const area = String(raw || '').trim().toUpperCase();
  if (area === 'ME' || area === 'ES') return area;
  return null;
}

function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function clampText(value, maxLen) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeStatusCode(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'PROGRESS' || raw === 'IN PROGRESS' || raw === 'EN CURSO') return 'PROGRESS';
  if (raw === 'NOTSTART' || raw === 'NOT START' || raw === 'SIN EMPEZAR') return 'NOTSTART';
  if (raw === 'COMPLETE' || raw === 'COMPLETADO') return 'COMPLETE';
  return raw;
}

function isInProgressStatus(value) {
  return normalizeStatusCode(value) === 'PROGRESS';
}

/**
 * Maps a SuiteAnalytics dataset row to the internal WIP shape.
 * Column names may vary in casing; see cust.netsuite.md.
 */
function mapDatasetRowToWip(row, resolveAreaFromResource, options = {}) {
  const netsuite_operation_id = coalesce(
    getFieldCaseInsensitive(row, 'NETSUITE_OPERATION_ID'),
    row && row.netsuite_operation_id,
    row && row.manufacturingoperationtask,
    row && row.id
  );

  // Bulk real: usar solo columnas del dataset (sin lookups record/v1 por fila).
  const workorderId = coalesce(row && row.workorder, row && row.manufacturingworkorder);
  const otFromDataset = coalesce(
    getFieldCaseInsensitive(row, 'OT_NUMBER'),
    getFieldCaseInsensitive(row, 'Orden de trabajo')
  );
  let ot_number = clampText(otFromDataset ?? '', 64);
  const digits = ot_number.replace(/[^0-9]/g, '');
  if (digits && !/^OT/i.test(ot_number)) {
    ot_number = `OT${digits}`;
  } else if (digits && /^OT/i.test(ot_number)) {
    ot_number = `OT${digits}`;
  }

  const resourceFromDataset = getFieldCaseInsensitive(row, 'RESOURCE_CODE');
  const resourceFromSearch = getFieldCaseInsensitive(row, 'Centro de trabajo de fabricación');
  const workcenterId = coalesce(row && row.manufacturingworkcenter, row && row.workcenter);

  let resource_code = String(coalesce(resourceFromDataset, resourceFromSearch) ?? '').trim();
  resource_code = clampText(String(resource_code || workcenterId || '').toUpperCase(), 64);

  const operation_name = clampText(
    coalesce(
      getFieldCaseInsensitive(row, 'OPERATION_NAME'),
      getFieldCaseInsensitive(row, 'Nombre de la operación'),
      row && row.operation_name
    ) ??
      `NS OP ${netsuite_operation_id || ''}`,
    255
  );

  const operation_sequence = toIntOrNull(
    coalesce(
      getFieldCaseInsensitive(row, 'OPERATION_SEQUENCE'),
      getFieldCaseInsensitive(row, 'Secuencia de operaciones'),
      row && row.operationsequence
    )
  );

  const planned_setup = coalesce(
    getFieldCaseInsensitive(row, 'TIEMPO_MONTAJE_MIN'),
    getFieldCaseInsensitive(row, 'CONFIGURACION RUTA'),
    row && row.setuptime
  );
  const planned_op_unit = coalesce(
    getFieldCaseInsensitive(row, 'TIEMPO_OPERACION_MIN_UNIT'),
    getFieldCaseInsensitive(row, 'EJECUCION RUTA'),
    row && row.runrate
  );
  const planned_quantity = coalesce(
    getFieldCaseInsensitive(row, 'PLANNED_QUANTITY'),
    getFieldCaseInsensitive(row, 'Cantidad de entrada'),
    row && row.inputquantity
  );
  const actual_setup_time = coalesce(
    getFieldCaseInsensitive(row, 'ACTUAL_SETUP_TIME'),
    row && row.actualsetuptime
  );
  const actual_run_time = coalesce(
    getFieldCaseInsensitive(row, 'ACTUAL_RUN_TIME'),
    row && row.actualruntime
  );
  const completed_quantity = coalesce(
    getFieldCaseInsensitive(row, 'COMPLETED_QUANTITY'),
    row && row.completedquantity
  );
  const source_status_raw = clampText(
    coalesce(
      getFieldCaseInsensitive(row, 'SOURCE_STATUS'),
      getFieldCaseInsensitive(row, 'Estado'),
      row && row.status
    ) ?? '',
    24
  ) || 'WIP';
  const source_status = normalizeStatusCode(source_status_raw) || source_status_raw;
  const areaFromDataset = clampText(
    coalesce(
      getFieldCaseInsensitive(row, 'AREA'),
      getFieldCaseInsensitive(row, 'FORMULA_1'),
      row && row.formula_1
    ),
    8
  ).toUpperCase();

  if (!ot_number && workorderId) {
    // Fallback: keep something searchable/stable even before enrichment.
    ot_number = clampText(`WO${String(workorderId).trim()}`, 64);
  }

  let area = ['ME', 'ES'].includes(areaFromDataset) ? areaFromDataset : null;
  if (!area) area = resolveAreaFromResource(resource_code);
  if (!area) area = inferAreaFromText(operation_name);
  if (!area && workcenterId && options.workcenterAreaMap) {
    area = options.workcenterAreaMap.get(String(workcenterId)) || null;
  }
  if (!area && options.defaultArea) {
    area = options.defaultArea;
  }
  if (!netsuite_operation_id || !ot_number || !resource_code || !operation_name || !Number.isFinite(operation_sequence)) {
    return { skip: true, reason: 'missing_required_fields' };
  }
  if (options.outOnlyInProgress && !isInProgressStatus(source_status)) {
    return { skip: true, reason: 'status_filtered_out' };
  }
  if (!area || !['ME', 'ES'].includes(area)) {
    return { skip: true, reason: 'area_not_derivable' };
  }
  const pq = toIntOrNull(planned_quantity);
  if (pq != null && pq <= 0) {
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
      planned_setup_minutes: toIntOrNull(planned_setup),
      planned_operation_minutes: toIntOrNull(planned_op_unit),
      planned_quantity: pq,
      actual_setup_time: Math.max(0, toIntOrNull(actual_setup_time) || 0),
      actual_run_time: Math.max(0, toIntOrNull(actual_run_time) || 0),
      completed_quantity: Math.max(0, toIntOrNull(completed_quantity) || 0),
      netsuite_operation_id: clampText(netsuite_operation_id, 64),
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

function buildOutSuiteQlQuery(outOnlyInProgress) {
  const where = outOnlyInProgress ? "WHERE status = 'PROGRESS'" : '';
  return [
    'SELECT',
    '  id AS NETSUITE_OPERATION_ID,',
    '  BUILTIN.DF(workorder) AS OT_NUMBER,',
    '  operationsequence AS OPERATION_SEQUENCE,',
    '  title AS OPERATION_NAME,',
    '  BUILTIN.DF(manufacturingworkcenter) AS RESOURCE_CODE,',
    '  setuptime AS TIEMPO_MONTAJE_MIN,',
    '  runrate AS TIEMPO_OPERACION_MIN_UNIT,',
    '  inputquantity AS PLANNED_QUANTITY,',
    '  status AS SOURCE_STATUS,',
    "  CASE WHEN UPPER(BUILTIN.DF(manufacturingworkcenter)) LIKE 'ES%' THEN 'ES'",
    "       WHEN UPPER(BUILTIN.DF(manufacturingworkcenter)) LIKE 'ME%' THEN 'ME'",
    '       ELSE NULL END AS AREA',
    'FROM manufacturingoperationtask',
    where,
    'ORDER BY id'
  ].filter(Boolean).join(' ');
}

async function fetchSuiteQlPage(suiteqlUrl, token, query, limit, offset) {
  const { data } = await axios.post(
    suiteqlUrl,
    { q: query },
    {
      params: { limit, offset },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );
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
  if (cfg.outSourceType === 'savedsearch' && !cfg.suiteqlUrl) {
    throw new Error('NetSuite suiteql URL not derivable; set NETSUITE_ACCOUNT_ID');
  }
  if (cfg.outSourceType !== 'savedsearch' && !cfg.datasetResultUrl) {
    throw new Error('NetSuite dataset URL not derivable; set NETSUITE_ACCOUNT_ID');
  }

  const token = await getNetsuiteAccessToken();
  const workcenterAreaMap = parseWorkcenterAreaMap(process.env.NETSUITE_WORKCENTER_AREA_MAP);
  const defaultArea = parseDefaultArea(process.env.NETSUITE_AREA_FALLBACK);

  const maxRows =
    options && Number.isInteger(Number(options.maxRows)) && Number(options.maxRows) > 0
      ? Number(options.maxRows)
      : 0;
  const limit = maxRows > 0 ? Math.min(1000, maxRows) : 1000;
  let offset = 0;
  const mapped = [];
  let hasMore = true;
  let pageCount = 0;
  let rowProcessed = 0;
  const skipReasons = {};
  const suiteqlQuery = buildOutSuiteQlQuery(Boolean(cfg.outOnlyInProgress));

  // #region agent log
  console.log('[dbg][H2][dataset-start]', runId, JSON.stringify({ datasetResultUrl: cfg.datasetResultUrl, maxRows, pageLimit: limit }));
  // #endregion

  while (hasMore) {
    pageCount += 1;
    const page =
      cfg.outSourceType === 'savedsearch'
        ? await fetchSuiteQlPage(cfg.suiteqlUrl, token, suiteqlQuery, limit, offset)
        : await fetchDatasetPage(cfg.datasetResultUrl, token, limit, offset);
    const items = Array.isArray(page.items) ? page.items : [];
    // #region agent log
    console.log('[dbg][H2][dataset-page-start]', runId, JSON.stringify({ pageCount, itemsOnPage: items.length, offset, elapsedMs: Date.now() - startedAt }));
    // #endregion
    for (const raw of items) {
      if (rowProcessed < 3) {
        // #region agent log
        console.log('[dbg][H2][row-enter]', runId, JSON.stringify({
          rowProcessed,
          keys: Object.keys(raw || {}).slice(0, 12),
          workorder: raw && (raw.workorder || raw.manufacturingworkorder || null),
          workcenter: raw && (raw.manufacturingworkcenter || raw.workcenter || null)
        }));
        // #endregion
      }
      const out = mapDatasetRowToWip(raw, resolveAreaFromResource, {
        workcenterAreaMap,
        defaultArea,
        outOnlyInProgress: Boolean(cfg.outOnlyInProgress)
      });
      if (!out.skip) {
        mapped.push(out.row);
        if (maxRows > 0 && mapped.length >= maxRows) {
          hasMore = false;
          break;
        }
      } else {
        const r = out.reason || 'unknown';
        skipReasons[r] = (skipReasons[r] || 0) + 1;
      }
      rowProcessed += 1;
      if (rowProcessed % 100 === 0) {
        // #region agent log
        console.log('[dbg][H2][dataset-row-progress]', runId, JSON.stringify({ rowProcessed, mappedRows: mapped.length, elapsedMs: Date.now() - startedAt }));
        // #endregion
      }
    }
    if (!hasMore) break;
    hasMore = Boolean(page.hasMore);
    offset += items.length;
    if (items.length === 0) hasMore = false;
    // #region agent log
    console.log('[dbg][H2][dataset-page]', runId, JSON.stringify({ pageCount, itemsOnPage: items.length, mappedRows: mapped.length, skipReasons, hasMore, offset, elapsedMs: Date.now() - startedAt }));
    // #endregion
  }

  // #region agent log
  console.log('[dbg][H2][dataset-done]', runId, JSON.stringify({ pageCount, mappedRows: mapped.length, skipReasons, elapsedMs: Date.now() - startedAt }));
  // #endregion

  return { rows: mapped, totalRows: mapped.length };
}

module.exports = {
  fetchFullDataset,
  mapDatasetRowToWip,
  getFieldCaseInsensitive
};
