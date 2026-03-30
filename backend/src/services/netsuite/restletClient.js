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

function normalizeInt(v) {
  return Math.max(0, Math.floor(Number(v) || 0));
}

async function recordGet(url, token, params = undefined) {
  const { data } = await axios.get(url, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Prefer: 'transient'
    },
    timeout: 120000
  });
  return data;
}

async function recordPost(url, token, body = {}) {
  const { data, headers } = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'transient'
    },
    timeout: 120000
  });
  return { data, headers };
}

async function recordPatch(url, token, body = {}) {
  const { data } = await axios.patch(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'transient'
    },
    timeout: 120000
  });
  return data;
}

function extractIdFromUrl(url, recordType) {
  if (!url) return null;
  const rx = new RegExp(`/${recordType}/([0-9]+)`, 'i');
  const m = String(url).match(rx);
  return m && m[1] ? Number(m[1]) : null;
}

function extractCompletionId(postResult) {
  const byData = Number(postResult && postResult.data && postResult.data.id);
  if (Number.isInteger(byData) && byData > 0) return byData;
  const byHref = extractIdFromUrl(postResult && postResult.data && postResult.data.href, 'workOrderCompletion');
  if (Number.isInteger(byHref) && byHref > 0) return byHref;
  const byLocation = extractIdFromUrl(postResult && postResult.headers && postResult.headers.location, 'workOrderCompletion');
  if (Number.isInteger(byLocation) && byLocation > 0) return byLocation;
  return null;
}

function lineSequenceCandidate(line, key) {
  if (!line) return null;
  const v = line[key];
  if (v == null) return null;
  if (typeof v === 'object') {
    if (v.id != null && Number.isFinite(Number(v.id))) return Number(v.id);
    if (v.refName != null && Number.isFinite(Number(v.refName))) return Number(v.refName);
    return null;
  }
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function findOperationLineIdBySequence(lines, sequence) {
  const target = Number(sequence);
  if (!Number.isFinite(target)) return null;
  const seqKeys = ['operationSequence', 'sequence', 'operationsequence', 'operationSeq', 'operationNumber', 'operation'];
  for (const line of lines || []) {
    const lineId = Number(line && line.id);
    if (!Number.isInteger(lineId)) continue;
    for (const key of seqKeys) {
      const candidate = lineSequenceCandidate(line, key);
      if (candidate != null && candidate === target) return lineId;
    }
  }
  return null;
}

function buildWocPatchCandidates(cfg, op) {
  const run = normalizeInt(op.actual_run_time);
  const setup = normalizeInt(op.actual_setup_time);
  const qty = normalizeInt(op.completed_quantity);
  const candidates = [];

  const primary = {};
  primary[cfg.wocRunField || 'machineRunTime'] = run;
  primary[cfg.wocSetupField || 'machineSetupTime'] = setup;
  if (cfg.wocCompletedQtyField) primary[cfg.wocCompletedQtyField] = qty;
  candidates.push(primary);

  if ((cfg.wocCompletedQtyField || '').toLowerCase() !== 'quantitycompleted') {
    candidates.push({ ...primary, quantityCompleted: qty });
  }
  if ((cfg.wocCompletedQtyField || '').toLowerCase() !== 'completedquantity') {
    candidates.push({ ...primary, completedQuantity: qty });
  }
  candidates.push({
    machineRunTime: run,
    machineSetupTime: setup,
    completedQuantity: qty
  });
  candidates.push({
    laborRunTime: run,
    laborSetupTime: setup,
    completedQuantity: qty
  });
  candidates.push({
    laborRunTime: run,
    laborSetupTime: setup
  });
  candidates.push({
    machineRunTime: run,
    machineSetupTime: setup
  });

  const seen = new Set();
  return candidates.filter((c) => {
    const k = JSON.stringify(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function patchOperationWithFallback(cfg, token, patchUrl, op) {
  const candidates = buildWocPatchCandidates(cfg, op);
  let lastErr = null;
  for (const body of candidates) {
    try {
      await recordPatch(patchUrl, token, body);
      return { success: true, body };
    } catch (err) {
      lastErr = err;
      const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : String(err.message || err);
      if (!/invalid|unknown|field|property|USER_ERROR/i.test(detail)) {
        break;
      }
    }
  }
  return { success: false, error: lastErr };
}

function extractOperationRange(ops) {
  const sorted = (ops || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => Number(a.operation_sequence || 0) - Number(b.operation_sequence || 0));

  const seqs = sorted
    .map((x) => Number(x.operation_sequence))
    .filter((n) => Number.isFinite(n));
  const nsIds = sorted
    .map((x) => Number(x.netsuite_operation_id))
    .filter((n) => Number.isFinite(n));

  return {
    startSequence: seqs.length ? seqs[0] : 1,
    endSequence: seqs.length ? seqs[seqs.length - 1] : 1,
    startNsId: nsIds.length ? nsIds[0] : null,
    endNsId: nsIds.length ? nsIds[nsIds.length - 1] : null
  };
}

function buildTransformBodiesForOperationRange(ops) {
  const { startSequence, endSequence, startNsId, endNsId } = extractOperationRange(ops);
  const bodies = [
    {},
    { startOperation: startSequence, endOperation: endSequence },
    { startOperation: { id: String(startSequence) }, endOperation: { id: String(endSequence) } },
    { startoperation: startSequence, endoperation: endSequence },
    { startoperation: { id: String(startSequence) }, endoperation: { id: String(endSequence) } },
    { operationStart: startSequence, operationEnd: endSequence },
    { operationStart: { id: String(startSequence) }, operationEnd: { id: String(endSequence) } }
  ];
  if (Number.isFinite(startNsId) && Number.isFinite(endNsId)) {
    bodies.push({ startOperation: startNsId, endOperation: endNsId });
    bodies.push({ startOperation: { id: String(startNsId) }, endOperation: { id: String(endNsId) } });
    bodies.push({ startoperation: startNsId, endoperation: endNsId });
    bodies.push({ startoperation: { id: String(startNsId) }, endoperation: { id: String(endNsId) } });
    bodies.push({ operationStart: startNsId, operationEnd: endNsId });
    bodies.push({ operationStart: { id: String(startNsId) }, operationEnd: { id: String(endNsId) } });
  }
  const seen = new Set();
  return bodies.filter((b) => {
    const k = JSON.stringify(b);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function createWorkOrderCompletionWithFallback(cfg, token, woId, ops) {
  const transformUrl = `${cfg.recordApiBaseUrl}/workOrder/${woId}/!transform/workOrderCompletion`;
  const bodies = buildTransformBodiesForOperationRange(ops);
  let lastErr = null;

  for (const body of bodies) {
    try {
      const res = await recordPost(transformUrl, token, body);
      const completionId = extractCompletionId(res);
      if (!Number.isInteger(completionId) || completionId <= 0) {
        throw new Error(`No se pudo obtener id de workOrderCompletion para WO ${woId}`);
      }
      return completionId;
    } catch (err) {
      lastErr = err;
      const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : String(err.message || err);
      if (!/Operaci.n de inicio|Operaci.n de finalizaci.n|startOperation|endOperation|USER_ERROR/i.test(detail)) {
        break;
      }
    }
  }
  throw lastErr || new Error(`No se pudo transformar Work Order ${woId} a Work Order Completion`);
}

async function pushViaWorkOrderCompletion(cfg, token, items) {
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
          ot_number: ot,
          error: `No se pudo resolver Work Order interno para ${ot}`
        });
      }
      continue;
    }

    try {
      const completionId = await createWorkOrderCompletionWithFallback(cfg, token, woId, ops);

      const completionUrl = `${cfg.recordApiBaseUrl}/workOrderCompletion/${completionId}`;
      const completion = await recordGet(completionUrl, token, { expandSubResources: true });
      const lines = Array.isArray(completion && completion.operation && completion.operation.items)
        ? completion.operation.items
        : [];

      for (const op of ops) {
        let lineId = findOperationLineIdBySequence(lines, op.operation_sequence);
        if (!Number.isInteger(lineId) && ops.length === 1 && lines.length === 1 && Number.isInteger(Number(lines[0].id))) {
          lineId = Number(lines[0].id);
        }
        if (!Number.isInteger(lineId)) {
          failed += 1;
          results.push({
            netsuite_operation_id: op.netsuite_operation_id,
            success: false,
            ot_number: ot,
            error: `No se pudo resolver línea de operación (secuencia ${op.operation_sequence}) en workOrderCompletion ${completionId}`
          });
          continue;
        }

        const patchUrl = `${completionUrl}/operation/${lineId}`;
        const patched = await patchOperationWithFallback(cfg, token, patchUrl, op);
        if (patched.success) {
          successful += 1;
          results.push({
            netsuite_operation_id: op.netsuite_operation_id,
            success: true,
            ot_number: ot,
            work_order_completion_id: completionId,
            operation_line_id: lineId
          });
        } else {
          const detail = patched.error && patched.error.response && patched.error.response.data
            ? patched.error.response.data
            : (patched.error && patched.error.message) || String(patched.error || 'patch_error');
          failed += 1;
          results.push({
            netsuite_operation_id: op.netsuite_operation_id,
            success: false,
            ot_number: ot,
            work_order_completion_id: completionId,
            operation_line_id: lineId,
            error: typeof detail === 'string' ? detail : JSON.stringify(detail)
          });
        }
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
    mode: 'workorder_completion',
    results
  };
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
    const recordName = `Importacion OT ${ot} ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
    const body = {
      externalId,
      name: recordName,
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
  if (cfg.pushMode === 'workorder_completion') {
    return pushViaWorkOrderCompletion(cfg, token, items);
  }
  return pushViaImportOt(cfg, token, items);
}

module.exports = {
  pushActualsBatch
};
