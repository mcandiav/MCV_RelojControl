const axios = require('axios');
const { getNetsuiteConfig } = require('./config');
const { getNetsuiteAccessToken } = require('./oauthToken');

function getFieldCaseInsensitive(row, canonicalName) {
  const target = String(canonicalName).toUpperCase();
  const keys = Object.keys(row || {});
  const hit = keys.find((k) => String(k).toUpperCase() === target);
  return hit === undefined ? undefined : row[hit];
}

/**
 * Maps a SuiteAnalytics dataset row to the internal WIP shape.
 * Column names may vary in casing; see cust.netsuite.md.
 */
function mapDatasetRowToWip(row, resolveAreaFromResource) {
  const netsuite_operation_id = getFieldCaseInsensitive(row, 'NETSUITE_OPERATION_ID');
  let ot_number = String(getFieldCaseInsensitive(row, 'OT_NUMBER') ?? '').trim();
  const digits = ot_number.replace(/[^0-9]/g, '');
  if (digits && !/^OT/i.test(ot_number)) {
    ot_number = `OT${digits}`;
  } else if (digits && /^OT/i.test(ot_number)) {
    ot_number = `OT${digits}`;
  }

  const resource_code = String(getFieldCaseInsensitive(row, 'RESOURCE_CODE') ?? '')
    .trim()
    .toUpperCase();
  const operation_name = String(getFieldCaseInsensitive(row, 'OPERATION_NAME') ?? '').trim();
  const operation_sequence = Number(getFieldCaseInsensitive(row, 'OPERATION_SEQUENCE'));
  const planned_setup = getFieldCaseInsensitive(row, 'TIEMPO_MONTAJE_MIN');
  const planned_op_unit = getFieldCaseInsensitive(row, 'TIEMPO_OPERACION_MIN_UNIT');
  const planned_quantity = getFieldCaseInsensitive(row, 'PLANNED_QUANTITY');
  const source_status = String(getFieldCaseInsensitive(row, 'SOURCE_STATUS') ?? '').trim() || 'WIP';

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
async function fetchFullDataset(resolveAreaFromResource) {
  const cfg = getNetsuiteConfig();
  if (!cfg.datasetResultUrl) {
    throw new Error('NetSuite dataset URL not derivable; set NETSUITE_ACCOUNT_ID');
  }

  const token = await getNetsuiteAccessToken();
  const limit = 1000;
  let offset = 0;
  const mapped = [];
  let hasMore = true;

  while (hasMore) {
    const page = await fetchDatasetPage(cfg.datasetResultUrl, token, limit, offset);
    const items = Array.isArray(page.items) ? page.items : [];
    for (const raw of items) {
      const out = mapDatasetRowToWip(raw, resolveAreaFromResource);
      if (!out.skip) mapped.push(out.row);
    }
    hasMore = Boolean(page.hasMore);
    offset += items.length;
    if (items.length === 0) hasMore = false;
  }

  return { rows: mapped, totalRows: mapped.length };
}

module.exports = {
  fetchFullDataset,
  mapDatasetRowToWip,
  getFieldCaseInsensitive
};
