const axios = require('axios');
const { getNetsuiteConfig } = require('./config');
const { getNetsuiteAccessToken } = require('./oauthToken');

function escapeSqlString(v) {
  return String(v).replace(/'/g, "''");
}

function isoDateOnly(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function buildImportJsonPayload(ops) {
  return JSON.stringify(
    ops.map((op) => ({
      secuencia: Number(op.operation_sequence) || 0,
      horasConfiguracion: Math.max(0, Number(op.actual_setup_time) || 0),
      horasEjecucion: Math.max(0, Number(op.actual_run_time) || 0),
      cantidadCompletada: Math.max(0, Number(op.completed_quantity) || 0)
    }))
  );
}

async function runSuiteQl(suiteqlUrl, token, query, limit = 1000, offset = 0) {
  const { data } = await axios.post(
    suiteqlUrl,
    { q: query },
    {
      params: { limit, offset },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'transient'
      },
      timeout: 120000
    }
  );
  return data;
}

async function resolveWorkOrderIdsByTranId(cfg, token, otNumbers) {
  const unique = Array.from(new Set((otNumbers || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const out = new Map();
  if (unique.length === 0) return out;
  if (!cfg.suiteqlUrl) return out;

  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const inList = chunk.map((x) => `'${escapeSqlString(x)}'`).join(',');
    const q = `SELECT id, tranid FROM workorder WHERE tranid IN (${inList})`;
    const data = await runSuiteQl(cfg.suiteqlUrl, token, q);
    const rows = Array.isArray(data && data.items) ? data.items : [];
    for (const row of rows) {
      const tranid = row.tranid || row.TRANID || row.TranId;
      const id = row.id || row.ID || row.Id;
      if (tranid != null && id != null) out.set(String(tranid), String(id));
    }
  }
  return out;
}

async function pushViaRestlet(cfg, token, items) {
  if (!cfg.restletInUrl) throw new Error('NETSUITE_RESTLET_IN_URL is not set');
  const { data } = await axios.post(
    cfg.restletInUrl,
    {
      items: items.map((it) => ({
        netsuite_operation_id: it.netsuite_operation_id,
        actual_setup_time: it.actual_setup_time,
        actual_run_time: it.actual_run_time,
        completed_quantity: it.completed_quantity
      }))
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );
  return data;
}

async function pushViaImportOt(cfg, token, items) {
  if (!cfg.recordApiBaseUrl) throw new Error('record API base URL is not available; check NETSUITE_ACCOUNT_ID');

  const byOt = new Map();
  for (const it of items) {
    const key = String(it.ot_number || '').trim();
    if (!key) continue;
    if (!byOt.has(key)) byOt.set(key, []);
    byOt.get(key).push(it);
  }

  const otKeys = Array.from(byOt.keys());
  const resolvedByTranId = await resolveWorkOrderIdsByTranId(cfg, token, otKeys);

  const results = [];
  let successful = 0;
  let failed = 0;
  const endpoint = `${cfg.recordApiBaseUrl}/${cfg.importOtRecordType}`;

  for (const ot of otKeys) {
    const ops = byOt.get(ot) || [];
    const woIdFromRow = ops.find((x) => x.netsuite_work_order_id != null && String(x.netsuite_work_order_id).trim() !== '');
    const woId = woIdFromRow ? String(woIdFromRow.netsuite_work_order_id) : resolvedByTranId.get(ot);

    if (!woId) {
      for (const op of ops) {
        failed += 1;
        results.push({
          netsuite_operation_id: op.netsuite_operation_id,
          success: false,
          error: `No se pudo resolver Work Order interno para ${ot}`
        });
      }
      continue;
    }

    const externalId = `mcv_ot_${ot}_${Date.now()}`;
    const body = {
      externalId,
      [cfg.importOtJsonField]: buildImportJsonPayload(ops),
      [cfg.importOtWorkOrderField]: { id: String(woId) }
    };
    if (cfg.importOtDateField) body[cfg.importOtDateField] = isoDateOnly();

    try {
      await axios.post(endpoint, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'transient'
        },
        timeout: 120000
      });

      for (const op of ops) {
        successful += 1;
        results.push({
          netsuite_operation_id: op.netsuite_operation_id,
          success: true,
          ot_number: ot,
          import_external_id: externalId
        });
      }
    } catch (err) {
      const detail = err.response && err.response.data ? err.response.data : err.message || String(err);
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      for (const op of ops) {
        failed += 1;
        results.push({
          netsuite_operation_id: op.netsuite_operation_id,
          success: false,
          ot_number: ot,
          error: msg
        });
      }
    }
  }

  return {
    success: failed === 0,
    processed: items.length,
    successful,
    failed,
    mode: 'import_ot',
    results
  };
}

async function pushActualsBatch(items) {
  const cfg = getNetsuiteConfig();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  const token = await getNetsuiteAccessToken();
  if (cfg.pushMode === 'restlet') {
    const data = await pushViaRestlet(cfg, token, items);
    return { ...data, mode: 'restlet' };
  }
  return pushViaImportOt(cfg, token, items);
}

module.exports = {
  pushActualsBatch
};
