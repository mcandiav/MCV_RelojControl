const { Op } = require('sequelize');
const WorkOrderOperation = require('../models/work_order_operation');
const OperationTimer = require('../models/operation_timer');
const TimerEvent = require('../models/timer_event');
const OperationTimeTotal = require('../models/operation_time_total');
const User = require('../models/user');
const { isNetsuiteConfigured, getNetsuiteConfigStatus } = require('../services/netsuite/config');
const { fetchFullDataset } = require('../services/netsuite/datasetClient');
const { pushActualsBatch } = require('../services/netsuite/restletClient');
const {
  buildActualsPayload,
  buildActualsPayloadForStopEvent
} = require('../services/netsuite/buildActualsPayload');
const { resolveStopSegmentTiming } = require('../lib/timerEventTotals');
const { clearTokenCache } = require('../services/netsuite/oauthToken');
const { getNetsuiteConfig } = require('../services/netsuite/config');
const { getNetsuiteAccessToken } = require('../services/netsuite/oauthToken');
const axios = require('axios');
const {
  beginNetsuiteSyncWindow,
  endNetsuiteSyncWindow,
  isNetsuiteSyncWindowActive
} = require('../services/netsuiteSyncLock');
const SyncRun = require('../models/sync_run');
const SyncRunStep = require('../models/sync_run_step');
const NetsuiteSyncQueue = require('../models/netsuite_sync_queue');
const NetsuiteSyncZim400 = require('../models/netsuite_sync_zim400');
const { requeueStuckProcessing } = require('../services/netsuiteSyncQueue');
const { createZim400Record } = require('../services/netsuite/zim400Client');
const config = require('../config/config');
let netsuitePushInFlight = false;
let netsuiteOperationalSyncInFlight = false;
const IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE =
  'WARNING: import_ot no estaba terminado antes del pull. Posible inconsistencia en la data del Cronometro.';
const ZIM400_ENABLED = process.env.V4_ZIM400_ENABLED !== 'false';

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
  'last_pushed_actual_setup_time',
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
  let updated = 0;
  for (const r of results) {
    if (!r || r.success !== true) continue;
    const key = String(r.netsuite_operation_id || '');
    const src = byNsId.get(key);
    if (!src || !Number.isInteger(src.operation_id)) continue;

    const op = await WorkOrderOperation.findByPk(src.operation_id, {
      attributes: [
        'id',
        'last_pushed_actual_run_time',
        'last_pushed_actual_setup_time',
        'last_pushed_completed_quantity'
      ]
    });
    if (!op) continue;

    const curRun = Math.max(0, Math.floor(Number(op.last_pushed_actual_run_time) || 0));
    const curSetup = Math.max(0, Math.floor(Number(op.last_pushed_actual_setup_time) || 0));
    const curQty = Math.max(0, Math.floor(Number(op.last_pushed_completed_quantity) || 0));
    const deltaRun = Math.max(0, Math.floor(Number(src.actual_run_time) || 0));
    const deltaSetup = Math.max(0, Math.floor(Number(src.actual_setup_time) || 0));
    const deltaQty = Math.max(0, Math.floor(Number(src.completed_quantity) || 0));
    const absRun =
      src.absolute_actual_run_time != null
        ? Math.max(0, Math.floor(Number(src.absolute_actual_run_time) || 0))
        : null;
    const absSetup =
      src.absolute_actual_setup_time != null
        ? Math.max(0, Math.floor(Number(src.absolute_actual_setup_time) || 0))
        : null;
    const absQty =
      src.absolute_completed_quantity != null
        ? Math.max(0, Math.floor(Number(src.absolute_completed_quantity) || 0))
        : null;

    await WorkOrderOperation.update(
      {
        last_pushed_actual_run_time: Math.max(curRun + deltaRun, absRun != null ? absRun : 0),
        last_pushed_actual_setup_time: Math.max(curSetup + deltaSetup, absSetup != null ? absSetup : 0),
        last_pushed_completed_quantity: Math.max(curQty + deltaQty, absQty != null ? absQty : 0)
      },
      { where: { id: src.operation_id } }
    );
    updated += 1;
  }
  return updated;
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

function asNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function asNullableInt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function formatPayloadSummary({ setup, run, qty } = {}) {
  return `setup=${asNonNegativeInt(setup)} run=${asNonNegativeInt(run)} qty=${asNonNegativeInt(qty)}`;
}

function normalizeEmployeeId(value) {
  if (value == null || value === '') return null;
  const asInt = asNullableInt(value);
  if (asInt != null) return String(asInt);
  const raw = String(value).trim();
  return raw || null;
}

/** Actor del STOP (usuario Cronometro + emp NS) para Log NetSuite / ZIM400. */
async function resolvePushActorFromStopEventId(stopEventId) {
  const evId = Number(stopEventId);
  if (!Number.isInteger(evId) || evId <= 0) {
    return { user_id: null, username: null, netsuite_employee_id: null, stop_event_id: null };
  }
  const ev = await TimerEvent.findByPk(evId, { attributes: ['id', 'user_id'] });
  if (!ev) {
    return { user_id: null, username: null, netsuite_employee_id: null, stop_event_id: evId };
  }
  const uid = Number(ev.user_id);
  if (!Number.isInteger(uid) || uid <= 0) {
    return { user_id: null, username: null, netsuite_employee_id: null, stop_event_id: evId };
  }
  const user = await User.findByPk(uid, { attributes: ['id', 'username', 'netsuiteEmployeeId'] });
  if (!user) {
    return { user_id: uid, username: null, netsuite_employee_id: null, stop_event_id: evId };
  }
  return {
    user_id: Number(user.id),
    username: user.username ? String(user.username) : null,
    netsuite_employee_id: normalizeEmployeeId(user.netsuiteEmployeeId),
    stop_event_id: evId
  };
}

function stampPushActorOnItems(items, actor, extra = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!actor && !extra) return list;
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    if (actor) {
      if (it.user_id == null && actor.user_id != null) it.user_id = actor.user_id;
      if (it.username == null && actor.username != null) it.username = actor.username;
      if (it.netsuite_employee_id == null && actor.netsuite_employee_id != null) {
        it.netsuite_employee_id = actor.netsuite_employee_id;
      }
      if (it.stop_event_id == null && actor.stop_event_id != null) it.stop_event_id = actor.stop_event_id;
    }
    if (extra.payload_source != null && it.payload_source == null) it.payload_source = extra.payload_source;
    if (extra.queue_id != null && it.queue_id == null) it.queue_id = extra.queue_id;
  }
  return list;
}

function compactPayload(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

function safeJsonString(obj) {
  try {
    return JSON.stringify(obj == null ? null : obj);
  } catch (_) {
    return JSON.stringify({ non_serializable: true });
  }
}

function sanitizeAxiosErrorForDiagnostic(error) {
  const resp = error && error.response ? error.response : null;
  const data = resp && resp.data !== undefined ? resp.data : null;
  const oErrorDetails =
    data && typeof data === 'object' && Array.isArray(data['o:errorDetails'])
      ? data['o:errorDetails']
      : [];
  return {
    ok: false,
    http_status: resp && Number.isFinite(Number(resp.status)) ? Number(resp.status) : null,
    status_text: resp && resp.statusText ? String(resp.statusText) : null,
    code: error && error.code ? String(error.code) : null,
    data,
    error_details: oErrorDetails
  };
}

function maskTail(value, visible = 6) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (s.length <= visible) return s;
  return `***${s.slice(-visible)}`;
}

function buildInvalidGrantDiagnostic(error) {
  const resp = error && error.response ? error.response : null;
  const data = resp && resp.data !== undefined ? resp.data : null;
  const payloadError =
    data && typeof data === 'object' && data.error != null ? String(data.error).toLowerCase() : '';
  const payloadDesc =
    data && typeof data === 'object' && data.error_description != null
      ? String(data.error_description)
      : '';
  const raw = `${payloadError} ${payloadDesc} ${String((error && error.message) || '')}`.toLowerCase();
  if (!raw.includes('invalid_grant')) return null;

  const cfg = getNetsuiteConfig();
  return {
    code: 'invalid_grant',
    message: 'NetSuite rechazo la obtencion de token OAuth2.',
    probable_causes: [
      'NETSUITE_CERTIFICATE_ID (kid) no coincide con la credencial OAuth2 Client Credentials activa.',
      'El certificado publico en NetSuite no corresponde a la private key cargada en backend.',
      'NETSUITE_CLIENT_ID / NETSUITE_ACCOUNT_ID / NETSUITE_TOKEN_URL apuntan a otro ambiente.',
      'Reloj del servidor desfasado (NTP) y JWT fuera de ventana temporal.'
    ],
    context: {
      account_id: cfg.accountId || null,
      token_url: cfg.tokenUrl || null,
      client_id_masked: maskTail(cfg.clientId, 6),
      certificate_id_masked: maskTail(cfg.certificateId, 6)
    }
  };
}

async function fetchManufacturingTaskContextByTaskId(taskId) {
  const nsTaskId = Number(taskId);
  if (!Number.isInteger(nsTaskId) || nsTaskId <= 0) return null;
  const cfg = getNetsuiteConfig();
  if (!cfg.suiteqlUrl) return null;
  const token = await getNetsuiteAccessToken();
  const query = [
    'SELECT',
    '  id,',
    '  operationsequence,',
    '  title,',
    '  workorder,',
    '  manufacturingworkcenter',
    'FROM manufacturingoperationtask',
    `WHERE id = ${nsTaskId}`
  ].join(' ');
  const { data } = await axios.post(
    cfg.suiteqlUrl,
    { q: query },
    {
      params: { limit: 1, offset: 0 },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'transient'
      },
      timeout: 120000
    }
  );
  const row = Array.isArray(data && data.items) && data.items.length > 0 ? data.items[0] : null;
  if (!row) return null;
  return {
    taskId: Number(row.id || nsTaskId),
    operationSequence: Number(row.operationsequence || 0),
    title: row.title != null ? String(row.title) : '',
    workOrder: row.workorder != null ? String(row.workorder) : null,
    manufacturingWorkCenter:
      row.manufacturingworkcenter != null ? String(row.manufacturingworkcenter) : null
  };
}

async function inferStopSegmentStartAt(stopEvent) {
  if (!stopEvent || !stopEvent.work_order_operation_id || !stopEvent.event_at) return null;
  const opId = Number(stopEvent.work_order_operation_id);
  if (!Number.isInteger(opId) || opId <= 0) return null;
  const allEvents = await TimerEvent.findAll({
    where: { work_order_operation_id: opId },
    order: [
      ['event_at', 'ASC'],
      ['id', 'ASC']
    ]
  });
  const timing = resolveStopSegmentTiming(allEvents, stopEvent);
  return timing.startedAt || null;
}

/** @deprecated Usar inferStopSegmentStartAt; se mantiene por compat de tests internos. */
async function inferStopStartAt(stopEvent) {
  return inferStopSegmentStartAt(stopEvent);
}

async function resolveStopSegmentTimingForEvent(stopEvent) {
  if (!stopEvent || !stopEvent.work_order_operation_id) {
    return {
      startedAt: null,
      endedAt: stopEvent && stopEvent.event_at ? stopEvent.event_at : null,
      runMinutes: 0,
      setupMinutes: 0,
      activeMinutes: 0,
      pauseMinutes: 0,
      segmentEventCount: 0
    };
  }
  const opId = Number(stopEvent.work_order_operation_id);
  const allEvents = await TimerEvent.findAll({
    where: { work_order_operation_id: opId },
    order: [
      ['event_at', 'ASC'],
      ['id', 'ASC']
    ]
  });
  return resolveStopSegmentTiming(allEvents, stopEvent);
}

/**
 * Cierre de turno: un item Import OT por operacion, sumando deltas de cada STOP/AUTO_STOP.
 * Evita atribuir el acumulado global de la OT al ZIM/empleado de un solo tramo corto.
 */
async function buildActualsPayloadFromShiftStopEvents(stopEvents) {
  const list = Array.isArray(stopEvents) ? stopEvents : [];
  const merged = new Map();

  for (const se of list) {
    const operationId = Number(se && se.work_order_operation_id);
    const stopEventId = Number(se && (se.stop_event_id != null ? se.stop_event_id : se.id));
    if (!Number.isInteger(operationId) || operationId <= 0) continue;
    if (!Number.isInteger(stopEventId) || stopEventId <= 0) continue;

    const built = await buildActualsPayloadForStopEvent({ operationId, stopEventId });
    const items = Array.isArray(built && built.items) ? built.items : [];
    for (const it of items) {
      const key = Number(it.operation_id);
      const cur = merged.get(key);
      if (!cur) {
        merged.set(key, {
          ...it,
          payload_source: 'stop_segment',
          stop_event_ids: [stopEventId]
        });
      } else {
        cur.actual_setup_time = asNonNegativeInt(cur.actual_setup_time) + asNonNegativeInt(it.actual_setup_time);
        cur.actual_run_time = asNonNegativeInt(cur.actual_run_time) + asNonNegativeInt(it.actual_run_time);
        cur.completed_quantity =
          asNonNegativeInt(cur.completed_quantity) + asNonNegativeInt(it.completed_quantity);
        cur.stop_event_ids.push(stopEventId);
      }
    }
  }

  const opIds = [...merged.keys()];
  if (opIds.length === 0) return { items: [] };

  const ops = await WorkOrderOperation.findAll({
    where: { id: { [Op.in]: opIds } },
    attributes: [
      'id',
      'last_pushed_actual_setup_time',
      'last_pushed_actual_run_time',
      'last_pushed_completed_quantity'
    ]
  });
  const opById = new Map(ops.map((op) => [Number(op.id), op]));

  for (const [opId, it] of merged.entries()) {
    const op = opById.get(opId);
    const lpSetup = op
      ? Math.max(0, Math.floor(Number(op.last_pushed_actual_setup_time) || 0))
      : 0;
    const lpRun = op ? Math.max(0, Math.floor(Number(op.last_pushed_actual_run_time) || 0)) : 0;
    const lpQty = op ? Math.max(0, Math.floor(Number(op.last_pushed_completed_quantity) || 0)) : 0;
    it.absolute_actual_setup_time = lpSetup + asNonNegativeInt(it.actual_setup_time);
    it.absolute_actual_run_time = lpRun + asNonNegativeInt(it.actual_run_time);
    it.absolute_completed_quantity = lpQty + asNonNegativeInt(it.completed_quantity);
    it.payload_source = 'stop_segment';
  }

  return { items: [...merged.values()] };
}

async function buildZim400PayloadFromQueueItem(queueItem, pushItem) {
  const stopEventId = Number(queueItem && queueItem.trigger_event_id);
  const opId = Number(queueItem && queueItem.work_order_operation_id);
  if (!Number.isInteger(stopEventId) || stopEventId <= 0) {
    throw new Error('Queue item sin trigger_event_id para ZIM400.');
  }
  const ev = await TimerEvent.findByPk(stopEventId);
  const op = await WorkOrderOperation.findByPk(opId);
  if (!ev || !op) throw new Error('No se encontro contexto STOP para ZIM400.');
  const eventUser =
    ev && Number.isInteger(Number(ev.user_id)) && Number(ev.user_id) > 0
      ? await User.findByPk(Number(ev.user_id), { attributes: ['id', 'username', 'netsuiteEmployeeId'] })
      : null;
  let qtyStop = null;
  try {
    const d = ev.details_json ? JSON.parse(String(ev.details_json)) : null;
    qtyStop = d && d.completed_quantity != null ? Number(d.completed_quantity) : null;
  } catch (_) {}
  const taskCtx = await fetchManufacturingTaskContextByTaskId(op.netsuite_operation_id);
  const workOrderIdRaw = taskCtx && taskCtx.workOrder ? taskCtx.workOrder : (op.netsuite_work_order_id || null);
  const workCenterIdRaw = taskCtx && taskCtx.manufacturingWorkCenter ? taskCtx.manufacturingWorkCenter : null;
  const workOrderId = asNullableInt(workOrderIdRaw);
  const workCenterId = asNullableInt(workCenterIdRaw);

  // Misma fuente que Import OT por STOP: tramo del timer (no ultimo START, no acumulado OT).
  const segmentTiming = await resolveStopSegmentTimingForEvent(ev);
  const startedAt = segmentTiming.startedAt || ev.event_at;
  const endedAt = ev.event_at;
  if (startedAt && endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
    throw new Error('ZIM400 local validation failed: custrecord_zim_reloj_fin es anterior a custrecord_zim_reloj_inicio.');
  }
  if (!workCenterId) {
    throw new Error(
      'ZIM400 mapping failed: manufacturingWorkCenter no resuelto para custrecord_zim_reloj_tarea.'
    );
  }
  if (!workOrderId) {
    throw new Error(
      'ZIM400 mapping failed: workOrder no resuelto como referencia numerica para custrecord_zim_reloj_ot.'
    );
  }

  const pushRunMinutesRaw = pushItem && pushItem.actual_run_time != null ? Number(pushItem.actual_run_time) : NaN;
  const segmentRunMinutes = asNonNegativeInt(segmentTiming.runMinutes);
  // Minutos ZIM = tramo STOP del empleado. No reutilizar delta acumulado de la OT (operational_accum).
  const minutesLoaded = segmentRunMinutes;
  const seqForText = taskCtx && Number.isFinite(taskCtx.operationSequence) && taskCtx.operationSequence > 0
    ? taskCtx.operationSequence
    : (op.operation_sequence || '');
  const titleForText = taskCtx && taskCtx.title ? taskCtx.title : (op.operation_name || '');
  const tareaTexto = `(${seqForText}) ${op.resource_code || ''}`.trim();
  const userNetsuiteEmployeeId = asNullableInt(eventUser && eventUser.netsuiteEmployeeId);
  const employeeDiagnostic =
    eventUser && eventUser.netsuiteEmployeeId && userNetsuiteEmployeeId == null
      ? {
          level: 'warning',
          code: 'INVALID_USER_NETSUITE_EMPLOYEE_ID',
          message: 'Users.netsuiteEmployeeId no es numerico; se omite custrecord_zim_reloj_empleado.',
          user_id: eventUser.id,
          username: eventUser.username || null,
          timer_event_id: stopEventId,
          raw_value: String(eventUser.netsuiteEmployeeId)
        }
      : (!eventUser
          ? {
              level: 'warning',
              code: 'MISSING_EVENT_USER',
              message: 'TimerEvent.user_id no disponible; se omite custrecord_zim_reloj_empleado.',
              user_id: ev && ev.user_id ? Number(ev.user_id) : null,
              username: null,
              timer_event_id: stopEventId
            }
          : (userNetsuiteEmployeeId == null
              ? {
                  level: 'warning',
                  code: 'MISSING_USER_NETSUITE_EMPLOYEE_ID',
                  message: 'Users.netsuiteEmployeeId vacio; se omite custrecord_zim_reloj_empleado.',
                  user_id: eventUser.id,
                  username: eventUser.username || null,
                  timer_event_id: stopEventId
                }
              : null));
  const pushQtyRaw = pushItem && pushItem.completed_quantity != null ? Number(pushItem.completed_quantity) : NaN;
  const qtyTerminated = Number.isFinite(pushQtyRaw)
    ? Math.max(0, Math.floor(pushQtyRaw))
    : (Number.isFinite(qtyStop) ? Math.max(0, Math.floor(qtyStop)) : 0);
  const sourceOfTruth = 'stop_segment';
  const payload = compactPayload({
    custrecord_zim_reloj_ot: workOrderId,
    custrecord_zim_reloj_ot_id: workOrderId,
    custrecord_zim_reloj_ot_text: op.ot_number ? `Orden de Trabajo #${op.ot_number}` : null,
    custrecord_zim_reloj_tarea: workCenterId,
    custrecord_zim_reloj_tarea_texto: tareaTexto,
    custrecord_zim_reloj_num_secuencia: asNullableInt(seqForText),
    custrecord_zim_reloj_operacion: titleForText || null,
    custrecord_zim_reloj_estado: 4,
    custrecord_zim_reoj_zona: 1,
    custrecord_zim_reloj_empleado: userNetsuiteEmployeeId,
    custrecord_zim_reloj_minutos_cargados: minutesLoaded,
    custrecord_zim_reloj_horas: Number((minutesLoaded / 60).toFixed(2)),
    custrecord_zim_reloj_inicio: startedAt || null,
    custrecord_zim_reloj_fin: endedAt || null,
    custrecord_zim_reloj_tiempo_planificado: Math.max(
      0,
      Math.floor(Number(op.planned_setup_minutes || 0) + Number(op.planned_operation_minutes || 0))
    ),
    custrecord_zim_reloj_cantidad: Number(op.planned_quantity || 0),
    custrecord_zim_reloj_cantidad_terminada: qtyTerminated
  });
  return {
    payload,
    stopEventId,
    op,
    taskCtx,
    employeeDiagnostic,
    sourceOfTruth,
    segmentTiming,
    pushItemRunMinutes: Number.isFinite(pushRunMinutesRaw) ? Math.max(0, Math.floor(pushRunMinutesRaw)) : null
  };
}

async function runZim400Publisher(queueItem, pushItem) {
  const {
    payload,
    stopEventId,
    op,
    employeeDiagnostic,
    sourceOfTruth,
    segmentTiming,
    pushItemRunMinutes
  } = await buildZim400PayloadFromQueueItem(queueItem, pushItem);
  const [row] = await NetsuiteSyncZim400.findOrCreate({
    where: { stop_event_id: stopEventId },
    defaults: {
      stop_event_id: stopEventId,
      queue_item_id: queueItem.id || null,
      work_order_operation_id: op.id,
      ot_number: op.ot_number || null,
      operation_sequence: op.operation_sequence || null,
      netsuite_work_order_id: op.netsuite_work_order_id || null,
      netsuite_operation_id: op.netsuite_operation_id || null,
      status: 'PENDING',
      attempt_count: 0
    }
  });
  if (row.status === 'SENT') {
    return { skipped: true, reason: 'already_sent', stop_event_id: stopEventId, netsuite_record_id: row.netsuite_record_id };
  }
  if (row.status === 'PROCESSING') {
    return { skipped: true, reason: 'already_processing', stop_event_id: stopEventId };
  }
  row.status = 'PROCESSING';
  row.attempt_count = Number(row.attempt_count || 0) + 1;
  row.payload_json = safeJsonString(payload);
  const startedAt = new Date();
  await row.save();
  const payloadMeta = {
    minutes_semantics: 'stop_segment_run_minutes',
    start_semantics: 'stop_segment_first_start_or_resume',
    qty_semantics:
      pushItem && pushItem.completed_quantity != null
        ? 'from_push_completed_quantity'
        : 'from_stop_event_fallback',
    source_of_truth: sourceOfTruth,
    segment_run_minutes: segmentTiming ? asNonNegativeInt(segmentTiming.runMinutes) : null,
    segment_setup_minutes: segmentTiming ? asNonNegativeInt(segmentTiming.setupMinutes) : null,
    segment_event_count: segmentTiming ? asNonNegativeInt(segmentTiming.segmentEventCount) : null,
    push_item_run_minutes: pushItemRunMinutes,
    employee_mapping: employeeDiagnostic || null
  };
  try {
    const out = await createZim400Record(payload);
    const diagnostic = {
      queue_id: queueItem.id || null,
      trigger_event_id: stopEventId,
      work_order_operation_id: op.id,
      destination: 'ZIM400',
      record_type: String(process.env.NETSUITE_ZIM400_RECORD_TYPE || 'CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL'),
      method: 'CREATE',
      request_payload: payload,
      request_payload_meta: payloadMeta,
      response: {
        ok: true,
        http_status: out.http_status || 200,
        status_text: out.status_text || 'OK',
        data: out.data || null,
        error_details: []
      },
      error_message: null,
      attempt: row.attempt_count,
      created_at: startedAt.toISOString(),
      finished_at: new Date().toISOString()
    };
    row.status = 'SENT';
    row.netsuite_record_id = out.id || null;
    row.sent_at = new Date();
    row.last_error = null;
    row.diagnostic_json = safeJsonString(diagnostic);
    await row.save();
    return {
      success: true,
      stop_event_id: stopEventId,
      netsuite_record_id: row.netsuite_record_id,
      diagnostic
    };
  } catch (error) {
    const response = sanitizeAxiosErrorForDiagnostic(error);
    const diagnostic = {
      queue_id: queueItem.id || null,
      trigger_event_id: stopEventId,
      work_order_operation_id: op.id,
      destination: 'ZIM400',
      record_type: String(process.env.NETSUITE_ZIM400_RECORD_TYPE || 'CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL'),
      method: 'CREATE',
      request_payload: payload,
      request_payload_meta: payloadMeta,
      response,
      error_message: String(error && error.message ? error.message : error),
      attempt: row.attempt_count,
      created_at: startedAt.toISOString(),
      finished_at: new Date().toISOString()
    };
    row.status = 'ERROR';
    row.last_error = diagnostic.error_message;
    row.diagnostic_json = safeJsonString(diagnostic);
    await row.save();
    const wrapped = new Error(diagnostic.error_message);
    wrapped.diagnostic = diagnostic;
    throw wrapped;
  }
}

async function runZim400BatchPublisher(stopEvents, pushItems) {
  const events = Array.isArray(stopEvents) ? stopEvents : [];
  const items = Array.isArray(pushItems) ? pushItems : [];
  const pushItemByOperationId = new Map(
    items
      .filter((it) => Number.isInteger(Number(it && it.operation_id)))
      .map((it) => [Number(it.operation_id), it])
  );
  const results = [];
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  for (const ev of events) {
    const operationId = Number(ev && ev.work_order_operation_id);
    const queueLike = {
      id: null,
      trigger_event_id: ev && ev.stop_event_id ? Number(ev.stop_event_id) : null,
      work_order_operation_id: operationId
    };
    const pushItem = pushItemByOperationId.get(operationId) || null;
    try {
      const out = await runZim400Publisher(queueLike, pushItem);
      if (out && out.skipped) skippedCount += 1;
      else successCount += 1;
      results.push({
        operation_id: operationId,
        stop_event_id: queueLike.trigger_event_id,
        success: true,
        skipped: !!(out && out.skipped),
        result: out
      });
    } catch (error) {
      errorCount += 1;
      results.push({
        operation_id: operationId,
        stop_event_id: queueLike.trigger_event_id,
        success: false,
        error_message: String(error && error.message ? error.message : error),
        diagnostic: error && error.diagnostic ? error.diagnostic : null
      });
    }
  }
  return {
    itemCount: events.length,
    successCount,
    skippedCount,
    errorCount,
    results
  };
}

async function buildPushComparisonRows(items, netsuiteResult) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const opIds = [...new Set(items.map((it) => Number(it && it.operation_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const ops = opIds.length
    ? await WorkOrderOperation.findAll({
        where: { id: { [Op.in]: opIds } },
        attributes: ['id', 'operation_name', 'resource_code', 'area']
      })
    : [];
  const opById = new Map(ops.map((op) => [Number(op.id), op]));

  const nsResults = Array.isArray(netsuiteResult && netsuiteResult.results) ? netsuiteResult.results : [];
  const nsByOpId = new Map(nsResults.map((r) => [String(r && r.netsuite_operation_id != null ? r.netsuite_operation_id : ''), r]));

  return items.map((it) => {
    const op = opById.get(Number(it.operation_id));
    const tMonEnviado = asNonNegativeInt(it.actual_setup_time);
    const tMonNetsuite = asNonNegativeInt(it.absolute_actual_setup_time);
    const tMonBase = Math.max(0, tMonNetsuite - tMonEnviado);

    const tEjeEnviado = asNonNegativeInt(it.actual_run_time);
    const tEjeNetsuite = asNonNegativeInt(it.absolute_actual_run_time);
    const tEjeBase = Math.max(0, tEjeNetsuite - tEjeEnviado);

    const qtyEnviado = asNonNegativeInt(it.completed_quantity);
    const qtyNetsuite = asNonNegativeInt(it.absolute_completed_quantity);
    const qtyBase = Math.max(0, qtyNetsuite - qtyEnviado);

    const nsOpId = String(it.netsuite_operation_id != null ? it.netsuite_operation_id : '');
    const nsResult = nsByOpId.get(nsOpId);
    const status = nsResult
      ? nsResult.success === true
        ? 'SUCCESS'
        : 'ERROR'
      : 'UNKNOWN';
    const message = nsResult
      ? String(nsResult.message || nsResult.error || nsResult.reason || '')
      : '';

    const userId = it.user_id != null && Number.isInteger(Number(it.user_id)) ? Number(it.user_id) : null;
    const username = it.username != null && String(it.username).trim() ? String(it.username).trim() : null;
    const empId = normalizeEmployeeId(it.netsuite_employee_id);
    const stopEventId =
      it.stop_event_id != null && Number.isInteger(Number(it.stop_event_id)) ? Number(it.stop_event_id) : null;
    const payloadSource = it.payload_source != null ? String(it.payload_source) : null;
    const payloadSummary = formatPayloadSummary({
      setup: tMonEnviado,
      run: tEjeEnviado,
      qty: qtyEnviado
    });

    return {
      operation_id: Number(it.operation_id),
      ot_number: String(it.ot_number || ''),
      operation_sequence: asNonNegativeInt(it.operation_sequence),
      operation_name: op ? String(op.operation_name || '') : '',
      resource_code: op ? String(op.resource_code || '') : '',
      area: op ? String(op.area || '') : '',
      netsuite_work_order_id: it.netsuite_work_order_id != null ? String(it.netsuite_work_order_id) : '',
      netsuite_operation_id: nsOpId,
      user_id: userId,
      username,
      netsuite_employee_id: empId,
      stop_event_id: stopEventId,
      payload_source: payloadSource,
      payload_summary: payloadSummary,
      t_mon_base: tMonBase,
      t_mon_enviado: tMonEnviado,
      t_mon_netsuite: tMonNetsuite,
      t_eje_base: tEjeBase,
      t_eje_enviado: tEjeEnviado,
      t_eje_netsuite: tEjeNetsuite,
      qty_base: qtyBase,
      qty_enviado: qtyEnviado,
      qty_netsuite: qtyNetsuite,
      sync_status: status,
      sync_message: message
    };
  });
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildImportOtPendingSuiteQl(cfg) {
  const recordType = String(cfg.importOtRecordType || 'customrecord_3k_importacion_ot').trim();
  const otField = String(cfg.importOtWorkOrderField || 'custrecord_3k_ot_principal').trim();
  const jsonField = String(cfg.importOtJsonField || 'custrecord_3k_imp_ot_json').trim();
  const txField = String(cfg.importOtTransactionField || 'custrecord_3k_imp_ot_transaccion').trim();

  return [
    'SELECT',
    '  COUNT(*) AS PENDING_COUNT',
    `FROM ${recordType}`,
    'WHERE',
    `  NVL(TRIM(TO_CHAR(${otField})), '') <> ''`,
    `  AND NVL(TRIM(TO_CHAR(${jsonField})), '') <> ''`,
    `  AND NVL(TRIM(TO_CHAR(${txField})), '') = ''`
  ].join(' ');
}

async function runSuiteQlCount(query) {
  const cfg = getNetsuiteConfig();
  if (!cfg.suiteqlUrl) {
    throw new Error('NetSuite suiteql URL not derivable; set NETSUITE_ACCOUNT_ID');
  }
  const token = await getNetsuiteAccessToken();
  const { data } = await axios.post(
    cfg.suiteqlUrl,
    { q: query },
    {
      params: { limit: 1, offset: 0 },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'transient'
      },
      timeout: 120000
    }
  );
  const row = Array.isArray(data && data.items) && data.items.length > 0 ? data.items[0] : null;
  if (!row) return 0;
  const raw = row.PENDING_COUNT ?? row.pending_count ?? Object.values(row)[0];
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

async function waitImportOtGate({ itemCount }) {
  if (!config.NETSUITE_IMPORT_OT_GATE_ENABLED) {
    return { status: 'DISABLED', stable: true, timedOut: false, warning: null, elapsedMs: 0 };
  }
  if (!Number.isInteger(Number(itemCount)) || Number(itemCount) <= 0) {
    return { status: 'SKIPPED_NO_PUSH_ITEMS', stable: true, timedOut: false, warning: null, elapsedMs: 0 };
  }

  const timeoutSeconds = Math.max(0, Number(config.NETSUITE_IMPORT_OT_GATE_TIMEOUT_SECONDS || 0));
  const pollSeconds = Math.max(1, Number(config.NETSUITE_IMPORT_OT_GATE_POLL_SECONDS || 30));
  if (timeoutSeconds <= 0) {
    return {
      status: 'TIMEOUT',
      stable: false,
      timedOut: true,
      warning: IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE,
      elapsedMs: 0
    };
  }

  const startedAt = Date.now();
  const timeoutAt = startedAt + timeoutSeconds * 1000;
  const cfg = getNetsuiteConfig();
  const query = buildImportOtPendingSuiteQl(cfg);
  let lastPendingCount = null;
  const polls = [];
  while (Date.now() < timeoutAt) {
    try {
      const pendingCount = await runSuiteQlCount(query);
      lastPendingCount = pendingCount;
      polls.push({ at: new Date().toISOString(), pendingCount });
      if (pendingCount <= 0) {
        return {
          status: 'STABLE',
          stable: true,
          timedOut: false,
          warning: null,
          elapsedMs: Date.now() - startedAt,
          pendingCount,
          polls
        };
      }
    } catch (probeErr) {
      polls.push({
        at: new Date().toISOString(),
        probeError: String(probeErr && probeErr.message ? probeErr.message : probeErr)
      });
    }
    const remainingMs = Math.max(0, timeoutAt - Date.now());
    const waitMs = Math.min(pollSeconds * 1000, remainingMs);
    if (waitMs <= 0) break;
    await sleep(waitMs);
  }
  return {
    status: 'TIMEOUT',
    stable: false,
    timedOut: true,
    warning: IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE,
    elapsedMs: Date.now() - startedAt,
    pendingCount: lastPendingCount,
    polls
  };
}

/**
 * PUSH + WAIT + PULL con pasos en sync_run_steps (después de STOP ya cerrado).
 */
async function runOperationalPushWaitPullLogged(syncRun, { delaySeconds, startedAt, shift }) {
  const delayMs = delaySeconds * 1000;
  let stepPush = null;
  let stepZim400 = null;
  let stepWait = null;
  let stepPull = null;
  try {
    stepPush = await createSyncStep(syncRun.id, 'PUSH_IMPORT_OT', {
      note: 'pushActualsBatch(buildActualsPayloadFromShiftStopEvents)'
    });
    const { items: rawItems } = await buildActualsPayloadFromShiftStopEvents(
      Array.isArray(shift && shift.stopEvents) ? shift.stopEvents : []
    );
    const items = stampPushActorOnItems(Array.isArray(rawItems) ? rawItems : [], null, {
      payload_source: 'stop_segment'
    });
    let netsuitePush = null;
    let markedSuccessfulPushes = 0;
    let reportRows = [];
    let pushItems = [];
    if (items.length > 0) {
      netsuitePush = await pushActualsBatch(items);
      markedSuccessfulPushes = await markSuccessfulPushes(items, netsuitePush);
      reportRows = await buildPushComparisonRows(items, netsuitePush);
      pushItems = items.map((it) => ({
        operation_id: it.operation_id,
        ot_number: it.ot_number,
        operation_sequence: it.operation_sequence,
        netsuite_work_order_id: it.netsuite_work_order_id,
        netsuite_operation_id: it.netsuite_operation_id,
        actual_setup_time: it.actual_setup_time,
        actual_run_time: it.actual_run_time,
        completed_quantity: it.completed_quantity,
        absolute_actual_setup_time: it.absolute_actual_setup_time,
        absolute_actual_run_time: it.absolute_actual_run_time,
        absolute_completed_quantity: it.absolute_completed_quantity,
        stop_event_ids: Array.isArray(it.stop_event_ids) ? it.stop_event_ids : null,
        user_id: null,
        username: null,
        netsuite_employee_id: null,
        payload_source: 'stop_segment',
        payload_summary: formatPayloadSummary({
          setup: it.actual_setup_time,
          run: it.actual_run_time,
          qty: it.completed_quantity
        })
      }));
    }
    await finishSyncStep(stepPush, {
      ok: true,
      result: {
        itemCount: items.length,
        markedSuccessfulPushes,
        payload_source: 'stop_segment',
        user_id: null,
        username: null,
        netsuite_employee_id: null,
        push_items: pushItems,
        netsuite: netsuitePush,
        report_rows: reportRows
      }
    });

    let zim400Result = {
      itemCount: 0,
      successCount: 0,
      skippedCount: 0,
      errorCount: 0,
      results: []
    };
    if (ZIM400_ENABLED) {
      stepZim400 = await createSyncStep(syncRun.id, 'PUSH_ZIM400', {
        source: 'operational_sync',
        stopEventsCount: Array.isArray(shift && shift.stopEvents) ? shift.stopEvents.length : 0
      });
      zim400Result = await runZim400BatchPublisher(
        Array.isArray(shift && shift.stopEvents) ? shift.stopEvents : [],
        items
      );
      await finishSyncStep(stepZim400, {
        ok: zim400Result.errorCount === 0,
        result: zim400Result,
        errorMessage:
          zim400Result.errorCount > 0
            ? `${zim400Result.errorCount} envio(s) ZIM400 con error.`
            : null
      });
      const stepZimGate = await createSyncStep(syncRun.id, 'GATE_ZIM400_STATUS', {
        itemCount: zim400Result.itemCount
      });
      await finishSyncStep(stepZimGate, {
        ok: true,
        result: {
          status: zim400Result.errorCount > 0 ? 'SUCCESS_WITH_ZIM400_WARNING' : 'STABLE',
          stable: true,
          timedOut: false,
          warning: zim400Result.errorCount > 0 ? 'ZIM400 termino con errores parciales.' : null,
          itemCount: zim400Result.itemCount,
          successCount: zim400Result.successCount,
          skippedCount: zim400Result.skippedCount,
          errorCount: zim400Result.errorCount
        }
      });
    }

    stepWait = await createSyncStep(syncRun.id, 'GATE_IMPORT_OT', {
      delaySecondsApplied: delaySeconds,
      gateEnabled: config.NETSUITE_IMPORT_OT_GATE_ENABLED,
      gateTimeoutSeconds: config.NETSUITE_IMPORT_OT_GATE_TIMEOUT_SECONDS,
      gatePollSeconds: config.NETSUITE_IMPORT_OT_GATE_POLL_SECONDS
    });
    let gateResult = null;
    if (config.NETSUITE_IMPORT_OT_GATE_ENABLED) {
      gateResult = await waitImportOtGate({ itemCount: items.length });
    } else if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      gateResult = {
        status: 'DISABLED_FALLBACK_DELAY',
        stable: true,
        timedOut: false,
        warning: null,
        elapsedMs: delayMs
      };
    } else {
      gateResult = {
        status: 'DISABLED_NO_DELAY',
        stable: true,
        timedOut: false,
        warning: null,
        elapsedMs: 0
      };
    }
    await finishSyncStep(stepWait, { ok: true, result: gateResult });

    if (gateResult && gateResult.timedOut) {
      const gateTimeoutStep = await createSyncStep(syncRun.id, 'GATE_TIMEOUT_WARNING_PULL', {
        warning: IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE,
        forcePullOnTimeout: config.NETSUITE_IMPORT_OT_GATE_FORCE_PULL_ON_TIMEOUT !== false,
        gateResult
      });
      await finishSyncStep(gateTimeoutStep, {
        ok: true,
        result: {
          warning: IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE,
          forcePullOnTimeout: config.NETSUITE_IMPORT_OT_GATE_FORCE_PULL_ON_TIMEOUT !== false
        }
      });
    } else {
      const gateStableStep = await createSyncStep(syncRun.id, 'GATE_STABLE', { gateResult });
      await finishSyncStep(gateStableStep, { ok: true, result: gateResult });
    }

    stepPull = await createSyncStep(
      syncRun.id,
      'PULL_AFTER_GATES',
      {
        action: 'pull_replace_wip',
        out_source_type: String(process.env.NETSUITE_OUT_SOURCE_TYPE || 'dataset').trim().toLowerCase(),
        replace_mode: 'all_wip_rows'
      }
    );
    const { rows, totalRows } = await fetchFullDataset(resolveAreaFromResource, {});
    const replaced = await replaceAllWipRows(rows);
    await finishSyncStep(stepPull, { ok: true, result: { totalRows, imported: replaced.imported } });

    const summary = {
      elapsedMs: Date.now() - startedAt,
      delaySecondsApplied: delaySeconds,
      shift,
      gate: gateResult,
      push: { itemCount: items.length, markedSuccessfulPushes, reportRowsCount: reportRows.length },
      zim400: {
        itemCount: zim400Result.itemCount,
        successCount: zim400Result.successCount,
        skippedCount: zim400Result.skippedCount,
        errorCount: zim400Result.errorCount
      },
      pull: { totalRows, imported: replaced.imported }
    };
    const pushWarning = Array.isArray(netsuitePush && netsuitePush.results)
      ? netsuitePush.results.some((r) => r && r.success === false)
      : false;
    const timeoutWarning = Boolean(gateResult && gateResult.timedOut);
    const zim400Warning = Boolean(zim400Result && zim400Result.errorCount > 0);
    if (timeoutWarning) {
      summary.warning_message = IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE;
    } else if (zim400Warning) {
      summary.warning_message = 'ZIM400 termino con errores parciales.';
    }
    await finishSyncRun(syncRun, {
      ok: true,
      summary,
      warning: pushWarning || timeoutWarning || zim400Warning
    });

    return {
      shift,
      delaySecondsApplied: delaySeconds,
      gate: gateResult,
      warning: timeoutWarning || zim400Warning,
      warningMessage: timeoutWarning
        ? IMPORT_OT_GATE_TIMEOUT_WARNING_MESSAGE
        : (zim400Warning ? 'ZIM400 termino con errores parciales.' : null),
      items,
      netsuitePush,
      zim400: zim400Result,
      markedSuccessfulPushes,
      totalRows,
      replaced,
      elapsedMs: Date.now() - startedAt
    };
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : explainSequelizeError(err);
    const invalidGrant = buildInvalidGrantDiagnostic(err);
    const msgBase = typeof detail === 'string' ? detail : JSON.stringify(detail);
    const msg = invalidGrant
      ? `${msgBase} | diagnostic=${JSON.stringify(invalidGrant)}`
      : msgBase;
    try {
      if (stepPull && stepPull.status === 'RUNNING') await finishSyncStep(stepPull, { ok: false, errorMessage: msg });
      if (stepWait && stepWait.status === 'RUNNING') await finishSyncStep(stepWait, { ok: false, errorMessage: msg });
      if (stepZim400 && stepZim400.status === 'RUNNING') await finishSyncStep(stepZim400, { ok: false, errorMessage: msg });
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
    const stepStop = await createSyncStep(syncRun.id, 'STOP_BATCH', { scope: 'ALL', source: 'shift_close_scheduler' });
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
    const stepStop = await createSyncStep(syncRun.id, 'STOP_BATCH', { scope: 'ALL', source: 'shift_close_scheduler' });
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
    const stepStop = await createSyncStep(syncRun.id, 'STOP_BATCH', { scope: 'ALL', source: 'shift_close_scheduler' });
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
  beginNetsuiteSyncWindow();
  let syncRun = null;
  try {
    syncRun = await createSyncRun({ flowType: 'operational', trigger: 'scheduler', req: null });
    const stepStop = await createSyncStep(syncRun.id, 'STOP_BATCH', { scope: 'ALL', source: 'shift_close_scheduler' });
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
      zim400Pushed: out.zim400 ? out.zim400.successCount : 0,
      zim400Errors: out.zim400 ? out.zim400.errorCount : 0,
      imported: out.replaced.imported,
      totalRows: out.totalRows,
      maxRowsApplied: null,
      warning: !!out.warning,
      warning_message: out.warningMessage,
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
    endNetsuiteSyncWindow();
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
  beginNetsuiteSyncWindow();
  try {
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
  } finally {
    endNetsuiteSyncWindow();
  }
}

async function runV4QueueSync(queueItem) {
  if (!config.V4_SYNC_ENABLED) {
    return {
      skipped: true,
      reason: 'v4_sync_disabled'
    };
  }
  if (!isNetsuiteConfigured()) {
    throw new Error('NetSuite no esta configurado para V4 queue worker.');
  }
  const operationId = Number(queueItem && queueItem.work_order_operation_id);
  if (!Number.isInteger(operationId) || operationId <= 0) {
    throw new Error('Queue item sin work_order_operation_id valido.');
  }

  beginNetsuiteSyncWindow();
  let syncRun = null;
  let stepPush = null;
  let stepZim400 = null;
  try {
    const triggerEvent = queueItem.trigger_event_id ? await TimerEvent.findByPk(queueItem.trigger_event_id) : null;
    const isScheduledAutoStop =
      triggerEvent && String(triggerEvent.event_type || '').toUpperCase() === 'AUTO_STOP_SHIFT_END';
    syncRun = await createSyncRun({ flowType: 'v4_stop_queue', trigger: 'worker', req: null });
    stepPush = await createSyncStep(syncRun.id, 'PUSH_IMPORT_OT', {
      queue_id: queueItem.id,
      operation_id: operationId,
      note: isScheduledAutoStop
        ? 'PUSH omitido: cierre programado usa operational/scheduler como fuente unica'
        : 'V4 queue push by operation id'
    });

    let items = [];
    if (isScheduledAutoStop) {
      await finishSyncStep(stepPush, {
        ok: true,
        result: {
          itemCount: 0,
          pushSkipped: true,
          reason: 'scheduled_auto_stop_operational_scheduler_owns_push'
        }
      });
    } else {
      const stopEventId = Number(queueItem.trigger_event_id);
      const actor = await resolvePushActorFromStopEventId(stopEventId);
      const built =
        Number.isInteger(stopEventId) && stopEventId > 0
          ? await buildActualsPayloadForStopEvent({ operationId, stopEventId })
          : await buildActualsPayload({ operationIds: [operationId] });
      items = Array.isArray(built && built.items) ? built.items : [];
      stampPushActorOnItems(items, actor, {
        queue_id: queueItem.id,
        payload_source: 'v4_stop_queue'
      });
      if (items.length > 0) {
        const netsuitePush = await pushActualsBatch(items);
        const marked = await markSuccessfulPushes(items, netsuitePush);
        const reportRows = await buildPushComparisonRows(items, netsuitePush);
        const pushItems = items.map((it) => ({
          operation_id: it.operation_id,
          ot_number: it.ot_number,
          operation_sequence: it.operation_sequence,
          netsuite_work_order_id: it.netsuite_work_order_id,
          netsuite_operation_id: it.netsuite_operation_id,
          actual_setup_time: it.actual_setup_time,
          actual_run_time: it.actual_run_time,
          completed_quantity: it.completed_quantity,
          absolute_actual_setup_time: it.absolute_actual_setup_time,
          absolute_actual_run_time: it.absolute_actual_run_time,
          absolute_completed_quantity: it.absolute_completed_quantity,
          stop_event_id: it.stop_event_id != null ? it.stop_event_id : actor.stop_event_id,
          user_id: it.user_id != null ? it.user_id : actor.user_id,
          username: it.username != null ? it.username : actor.username,
          netsuite_employee_id:
            it.netsuite_employee_id != null ? it.netsuite_employee_id : actor.netsuite_employee_id,
          queue_id: queueItem.id,
          payload_source: 'v4_stop_queue',
          payload_summary: formatPayloadSummary({
            setup: it.actual_setup_time,
            run: it.actual_run_time,
            qty: it.completed_quantity
          })
        }));
        await finishSyncStep(stepPush, {
          ok: true,
          result: {
            itemCount: items.length,
            markedSuccessfulPushes: marked,
            queue_id: queueItem.id,
            trigger_event_id: Number.isInteger(stopEventId) && stopEventId > 0 ? stopEventId : null,
            user_id: actor.user_id,
            username: actor.username,
            netsuite_employee_id: actor.netsuite_employee_id,
            push_items: pushItems,
            netsuite: netsuitePush,
            report_rows: reportRows
          }
        });
      } else {
        await finishSyncStep(stepPush, {
          ok: true,
          result: {
            itemCount: 0,
            pushSkipped: true,
            queue_id: queueItem.id,
            trigger_event_id: Number.isInteger(stopEventId) && stopEventId > 0 ? stopEventId : null,
            user_id: actor.user_id,
            username: actor.username,
            netsuite_employee_id: actor.netsuite_employee_id
          }
        });
      }
    }

    if (ZIM400_ENABLED) {
      stepZim400 = await createSyncStep(syncRun.id, 'PUSH_ZIM400', {
        queue_id: queueItem.id,
        trigger_event_id: queueItem.trigger_event_id || null,
        import_ot_step_ok: true
      });
      try {
        const pushItemForZim400 = items.find((it) => Number(it && it.operation_id) === operationId) || null;
        const zimOut = await runZim400Publisher(queueItem, pushItemForZim400);
        await finishSyncStep(stepZim400, { ok: true, result: zimOut });
      } catch (zimErr) {
        const zimMsg = zimErr && zimErr.message ? zimErr.message : String(zimErr);
        await finishSyncStep(stepZim400, {
          ok: false,
          result: zimErr && zimErr.diagnostic ? zimErr.diagnostic : null,
          errorMessage: zimMsg
        });
      }
    }

    const summary = {
      queueId: queueItem.id,
      operationId
    };
    await finishSyncRun(syncRun, { ok: true, summary, warning: false });
    return summary;
  } catch (error) {
    const msg = error.message || String(error);
    try {
      if (stepZim400 && stepZim400.status === 'RUNNING') await finishSyncStep(stepZim400, { ok: false, errorMessage: msg });
      if (stepPush && stepPush.status === 'RUNNING') await finishSyncStep(stepPush, { ok: false, errorMessage: msg });
      if (syncRun && syncRun.status === 'RUNNING') await finishSyncRun(syncRun, { ok: false, errorMessage: msg });
    } catch (_) {}
    throw error;
  } finally {
    endNetsuiteSyncWindow();
  }
}

exports.getConfigStatus = async function getConfigStatus(req, res) {
  return res.status(200).json({
    ...getNetsuiteConfigStatus(),
    v4_sync_enabled: config.V4_SYNC_ENABLED,
    v4_worker_enabled: config.V4_WORKER_ENABLED,
    v4_watchdog_enabled: config.V4_WATCHDOG_ENABLED,
    v4_worker_interval_ms: config.V4_WORKER_INTERVAL_MS,
    v4_max_attempts: config.V4_MAX_ATTEMPTS,
    v4_retry_backoff_ms: config.V4_RETRY_BACKOFF_MS,
    v4_processing_timeout_ms: config.V4_PROCESSING_TIMEOUT_MS,
    v4_zim400_enabled: ZIM400_ENABLED,
    syncInProgress: isNetsuiteSyncWindowActive()
  });
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
    const invalidGrant = buildInvalidGrantDiagnostic(err);
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'Fallo al leer dataset o guardar operaciones.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail),
      diagnostic: invalidGrant
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
    const reportRows = await buildPushComparisonRows(items, netsuite);
    return res.status(200).json({
      message: 'Batch enviado a NetSuite.',
      itemCount: items.length,
      markedSuccessfulPushes: marked,
      report_rows: reportRows,
      netsuite
    });
  } catch (err) {
    const detail = err.response && err.response.data ? err.response.data : err.message;
    const invalidGrant = buildInvalidGrantDiagnostic(err);
    return res.status(200).json({
      ok: false,
      httpStatus: 502,
      message: 'Fallo al publicar en NetSuite.',
      error: typeof detail === 'string' ? detail : JSON.stringify(detail),
      diagnostic: invalidGrant
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
  beginNetsuiteSyncWindow();
  const startedAt = Date.now();

  let syncRun = null;
  let stepStop = null;

  try {
    const { runShiftClose } = require('./chronometer');
    syncRun = await createSyncRun({ flowType: 'operational', trigger: 'manual', req });

    stepStop = await createSyncStep(syncRun.id, 'STOP_BATCH', { scope: 'ALL' });
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
      warning: !!out.warning,
      warning_message: out.warningMessage,
      shift: out.shift,
      gate: out.gate,
      push: {
        itemCount: out.items.length,
        markedSuccessfulPushes: out.markedSuccessfulPushes,
        netsuite: out.netsuitePush
      },
      zim400: out.zim400 || {
        itemCount: 0,
        successCount: 0,
        skippedCount: 0,
        errorCount: 0
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
    endNetsuiteSyncWindow();
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

/** Log: filas comparables con NetSuite (base + enviado = esperado NetSuite) extraídas de pasos PUSH. */
exports.listPushLogRows = async function listPushLogRows(req, res) {
  const stepLimit = Math.min(500, Math.max(1, parseInt(String(req.query.stepLimit || '150'), 10) || 150));
  const rowLimit = Math.min(5000, Math.max(1, parseInt(String(req.query.limit || '1000'), 10) || 1000));
  const otFilter = String(req.query.ot || '').trim();
  const resourceFilter = String(req.query.resource || req.query.recurso || '').trim().toUpperCase();
  const dateFromRaw = String(req.query.date_from || req.query.dateFrom || '').trim();
  const dateToRaw = String(req.query.date_to || req.query.dateTo || '').trim();
  const hasFrom = /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw);
  const hasTo = /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw);
  const tz = 'America/Santiago';
  const toDayKey = (d) => {
    if (!d) return '';
    try {
      // YYYY-MM-DD en zona local operativa (Chile), no en UTC.
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (_) {
      return '';
    }
  };
  const parseJsonSafe = (raw) => {
    if (raw == null || raw === '') return null;
    try {
      return typeof raw === 'object' ? raw : JSON.parse(String(raw));
    } catch (_) {
      return null;
    }
  };

  const steps = await SyncRunStep.findAll({
    where: { step_name: { [Op.in]: ['PUSH_IMPORT_OT', 'PUSH'] } },
    order: [['started_at', 'DESC']],
    limit: stepLimit
  });

  const pending = [];
  const syncRunIds = new Set();

  for (const s of steps) {
    const stepTs = new Date(s.started_at);
    const stepDayKey = toDayKey(stepTs);
    if (hasFrom && stepDayKey < dateFromRaw) continue;
    if (hasTo && stepDayKey > dateToRaw) continue;
    const parsed = parseJsonSafe(s.result_json);
    const reportRows = parsed && Array.isArray(parsed.report_rows) ? parsed.report_rows : [];
    let rowsToEmit = reportRows;
    if (rowsToEmit.length === 0 && parsed && Array.isArray(parsed.push_items)) {
      const nsResults = Array.isArray(parsed.netsuite && parsed.netsuite.results) ? parsed.netsuite.results : [];
      const nsByOp = new Map(
        nsResults.map((r) => [String(r && r.netsuite_operation_id != null ? r.netsuite_operation_id : ''), r])
      );
      rowsToEmit = parsed.push_items.map((it) => {
        const nsOpId = String(it && it.netsuite_operation_id != null ? it.netsuite_operation_id : '');
        const ns = nsByOp.get(nsOpId);
        const status = ns ? (ns.success === true ? 'SUCCESS' : 'ERROR') : 'UNKNOWN';
        const message = ns ? String(ns.message || ns.error || ns.reason || '') : 'Sin resultado detallado';
        const setup = Number(it && it.actual_setup_time) || 0;
        const run = Number(it && it.actual_run_time) || 0;
        const qty = Number(it && it.completed_quantity) || 0;
        return {
          operation_id: Number(it && it.operation_id),
          ot_number: String((it && it.ot_number) || ''),
          operation_sequence: Number(it && it.operation_sequence) || 0,
          operation_name: '',
          resource_code: '',
          area: '',
          netsuite_work_order_id: it && it.netsuite_work_order_id != null ? String(it.netsuite_work_order_id) : '',
          netsuite_operation_id: nsOpId,
          user_id: it && it.user_id != null ? Number(it.user_id) : null,
          username: it && it.username != null ? String(it.username) : null,
          netsuite_employee_id: normalizeEmployeeId(it && it.netsuite_employee_id),
          stop_event_id: it && it.stop_event_id != null ? Number(it.stop_event_id) : null,
          payload_source: it && it.payload_source != null ? String(it.payload_source) : null,
          payload_summary: it && it.payload_summary ? String(it.payload_summary) : formatPayloadSummary({ setup, run, qty }),
          t_mon_base: 0,
          t_mon_enviado: setup,
          t_mon_netsuite: setup,
          t_eje_base: 0,
          t_eje_enviado: run,
          t_eje_netsuite: run,
          qty_base: 0,
          qty_enviado: qty,
          qty_netsuite: qty,
          sync_status: status,
          sync_message: message
        };
      });
    }
    for (const r of rowsToEmit) {
      if (otFilter && String(r.ot_number || '').trim() !== otFilter) continue;
      if (resourceFilter && String(r.resource_code || '').trim().toUpperCase() !== resourceFilter) continue;
      const syncRunId = Number(s.sync_run_id);
      if (Number.isInteger(syncRunId) && syncRunId > 0) syncRunIds.add(syncRunId);
      pending.push({
        row: r,
        sync_run_id: syncRunId,
        push_at: s.started_at,
        step_status: s.status,
        parsed
      });
      if (pending.length >= rowLimit) break;
    }
    if (pending.length >= rowLimit) break;
  }

  const syncRunIdList = [...syncRunIds];
  const syncRunById = new Map();
  const zimCtxBySyncRunId = new Map();
  const actorBySyncRunId = new Map();
  const zimPayloadByOpKey = new Map();

  if (syncRunIdList.length > 0) {
    const runs = await SyncRun.findAll({
      where: { id: { [Op.in]: syncRunIdList } },
      attributes: ['id', 'summary_json', 'flow_type']
    });
    for (const run of runs) {
      syncRunById.set(Number(run.id), {
        summary: parseJsonSafe(run.summary_json),
        flow_type: run.flow_type ? String(run.flow_type) : null
      });
    }

    const zimSteps = await SyncRunStep.findAll({
      where: {
        sync_run_id: { [Op.in]: syncRunIdList },
        step_name: 'PUSH_ZIM400'
      },
      attributes: ['sync_run_id', 'result_json']
    });
    for (const zs of zimSteps) {
      const zParsed = parseJsonSafe(zs.result_json);
      const sid = Number(zs.sync_run_id);
      const diagnostic =
        (zParsed && zParsed.diagnostic) ||
        (zParsed && zParsed.result && zParsed.result.diagnostic) ||
        null;
      const batchResults = Array.isArray(zParsed && zParsed.results) ? zParsed.results : [];
      zimCtxBySyncRunId.set(sid, { parsed: zParsed, diagnostic, batchResults });

      const registerZimPayload = (operationId, stopEventId, payload, meta) => {
        const opId = Number(operationId);
        const detail = {
          stop_event_id: stopEventId != null ? Number(stopEventId) : null,
          request_payload: payload || null,
          employee_mapping: meta && meta.employee_mapping ? meta.employee_mapping : null
        };
        if (Number.isInteger(opId) && opId > 0) {
          zimPayloadByOpKey.set(`${sid}:${opId}`, detail);
        }
        zimPayloadByOpKey.set(`${sid}:*`, detail);
      };

      if (diagnostic) {
        registerZimPayload(
          diagnostic.work_order_operation_id,
          diagnostic.trigger_event_id,
          diagnostic.request_payload,
          diagnostic.request_payload_meta
        );
      }
      for (const br of batchResults) {
        const nestedDiag =
          (br && br.diagnostic) ||
          (br && br.result && br.result.diagnostic) ||
          null;
        if (nestedDiag) {
          registerZimPayload(
            br.operation_id != null ? br.operation_id : nestedDiag.work_order_operation_id,
            br.stop_event_id != null ? br.stop_event_id : nestedDiag.trigger_event_id,
            nestedDiag.request_payload,
            nestedDiag.request_payload_meta
          );
        }
      }
    }

    const queueIds = new Set();
    const stopEventIds = new Set();
    for (const sid of syncRunIdList) {
      const runInfo = syncRunById.get(sid);
      const summary = runInfo && runInfo.summary;
      const qFromSummary = summary && summary.queueId != null ? Number(summary.queueId) : null;
      if (Number.isInteger(qFromSummary) && qFromSummary > 0) queueIds.add(qFromSummary);

      const zimCtx = zimCtxBySyncRunId.get(sid);
      const diag = zimCtx && zimCtx.diagnostic;
      if (diag) {
        const q = diag.queue_id != null ? Number(diag.queue_id) : null;
        if (Number.isInteger(q) && q > 0) queueIds.add(q);
        const te = diag.trigger_event_id != null ? Number(diag.trigger_event_id) : null;
        if (Number.isInteger(te) && te > 0) stopEventIds.add(te);
      }
    }
    for (const p of pending) {
      const parsed = p.parsed;
      if (parsed) {
        const q = parsed.queue_id != null ? Number(parsed.queue_id) : null;
        if (Number.isInteger(q) && q > 0) queueIds.add(q);
        const te = parsed.trigger_event_id != null ? Number(parsed.trigger_event_id) : null;
        if (Number.isInteger(te) && te > 0) stopEventIds.add(te);
        if (parsed.stop_event_id != null && Number.isInteger(Number(parsed.stop_event_id))) {
          stopEventIds.add(Number(parsed.stop_event_id));
        }
      }
      if (p.row && p.row.stop_event_id != null && Number.isInteger(Number(p.row.stop_event_id))) {
        stopEventIds.add(Number(p.row.stop_event_id));
      }
    }

    const queueById = new Map();
    if (queueIds.size > 0) {
      const queues = await NetsuiteSyncQueue.findAll({
        where: { id: { [Op.in]: [...queueIds] } },
        attributes: ['id', 'trigger_event_id', 'work_order_operation_id', 'created_by_user_id']
      });
      for (const q of queues) {
        queueById.set(Number(q.id), q);
        const te = q.trigger_event_id != null ? Number(q.trigger_event_id) : null;
        if (Number.isInteger(te) && te > 0) stopEventIds.add(te);
      }
    }

    const actorByStopEventId = new Map();
    if (stopEventIds.size > 0) {
      const events = await TimerEvent.findAll({
        where: { id: { [Op.in]: [...stopEventIds] } },
        attributes: ['id', 'user_id']
      });
      const userIds = [
        ...new Set(
          events
            .map((ev) => Number(ev.user_id))
            .filter((id) => Number.isInteger(id) && id > 0)
        )
      ];
      const userById = new Map();
      if (userIds.length > 0) {
        const users = await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ['id', 'username', 'netsuiteEmployeeId']
        });
        for (const u of users) userById.set(Number(u.id), u);
      }
      for (const ev of events) {
        const uid = Number(ev.user_id);
        const user = Number.isInteger(uid) && uid > 0 ? userById.get(uid) : null;
        actorByStopEventId.set(Number(ev.id), {
          user_id: user ? Number(user.id) : Number.isInteger(uid) && uid > 0 ? uid : null,
          username: user && user.username ? String(user.username) : null,
          netsuite_employee_id: user ? normalizeEmployeeId(user.netsuiteEmployeeId) : null,
          stop_event_id: Number(ev.id)
        });
      }
    }

    const resolveQueueIdForSyncRun = (sid, parsed) => {
      if (parsed && parsed.queue_id != null && Number.isInteger(Number(parsed.queue_id))) {
        return Number(parsed.queue_id);
      }
      const runInfo = syncRunById.get(sid);
      if (runInfo && runInfo.summary && runInfo.summary.queueId != null) {
        const q = Number(runInfo.summary.queueId);
        if (Number.isInteger(q) && q > 0) return q;
      }
      const zimCtx = zimCtxBySyncRunId.get(sid);
      if (zimCtx && zimCtx.diagnostic && zimCtx.diagnostic.queue_id != null) {
        const q = Number(zimCtx.diagnostic.queue_id);
        if (Number.isInteger(q) && q > 0) return q;
      }
      return null;
    };

    for (const sid of syncRunIdList) {
      const runInfo = syncRunById.get(sid);
      const parsedSample = pending.find((p) => p.sync_run_id === sid);
      const qid = resolveQueueIdForSyncRun(sid, parsedSample && parsedSample.parsed);
      let actor = null;
      if (qid != null && queueById.has(qid)) {
        const q = queueById.get(qid);
        const te = q.trigger_event_id != null ? Number(q.trigger_event_id) : null;
        if (Number.isInteger(te) && te > 0) actor = actorByStopEventId.get(te) || null;
      }
      if (!actor) {
        const zimCtx = zimCtxBySyncRunId.get(sid);
        const te =
          zimCtx && zimCtx.diagnostic && zimCtx.diagnostic.trigger_event_id != null
            ? Number(zimCtx.diagnostic.trigger_event_id)
            : parsedSample && parsedSample.parsed && parsedSample.parsed.trigger_event_id != null
              ? Number(parsedSample.parsed.trigger_event_id)
              : null;
        if (Number.isInteger(te) && te > 0) actor = actorByStopEventId.get(te) || null;
      }
      if (!actor && runInfo && runInfo.flow_type === 'v4_stop_queue') {
        // keep null
      }
      actorBySyncRunId.set(sid, actor);
    }

    // Attach per-row actors from stop_event_id when present
    for (const p of pending) {
      p._actorByStop =
        p.row && p.row.stop_event_id != null
          ? actorByStopEventId.get(Number(p.row.stop_event_id)) || null
          : null;
      if (
        !p._actorByStop &&
        p.parsed &&
        p.parsed.trigger_event_id != null &&
        Number.isInteger(Number(p.parsed.trigger_event_id))
      ) {
        p._actorByStop = actorByStopEventId.get(Number(p.parsed.trigger_event_id)) || null;
      }
    }

    // Enrich emp from zim payload if still missing
    const stopToSyncRuns = new Map();
    for (const sid of syncRunIdList) {
      const zimCtx = zimCtxBySyncRunId.get(sid);
      if (!zimCtx) continue;
      const addStop = (te) => {
        const id = Number(te);
        if (!Number.isInteger(id) || id <= 0) return;
        if (!stopToSyncRuns.has(id)) stopToSyncRuns.set(id, new Set());
        stopToSyncRuns.get(id).add(sid);
      };
      if (zimCtx.diagnostic && zimCtx.diagnostic.trigger_event_id != null) {
        addStop(zimCtx.diagnostic.trigger_event_id);
      }
      for (const br of zimCtx.batchResults || []) {
        if (br && br.stop_event_id != null) addStop(br.stop_event_id);
        const nested =
          (br && br.diagnostic) || (br && br.result && br.result.diagnostic) || null;
        if (nested && nested.trigger_event_id != null) addStop(nested.trigger_event_id);
      }
    }
    if (stopToSyncRuns.size > 0) {
      const zimRows = await NetsuiteSyncZim400.findAll({
        where: { stop_event_id: { [Op.in]: [...stopToSyncRuns.keys()] } },
        attributes: ['stop_event_id', 'work_order_operation_id', 'payload_json', 'diagnostic_json']
      });
      for (const zr of zimRows) {
        const payload = parseJsonSafe(zr.payload_json);
        const diagnostic = parseJsonSafe(zr.diagnostic_json);
        const emp =
          normalizeEmployeeId(payload && payload.custrecord_zim_reloj_empleado) ||
          normalizeEmployeeId(
            diagnostic &&
              diagnostic.request_payload &&
              diagnostic.request_payload.custrecord_zim_reloj_empleado
          );
        const mapping =
          diagnostic &&
          diagnostic.request_payload_meta &&
          diagnostic.request_payload_meta.employee_mapping
            ? diagnostic.request_payload_meta.employee_mapping
            : null;
        const detail = {
          stop_event_id: Number(zr.stop_event_id),
          request_payload: payload || (diagnostic && diagnostic.request_payload) || null,
          employee_mapping: mapping,
          netsuite_employee_id: emp
        };
        const sidSet = stopToSyncRuns.get(Number(zr.stop_event_id)) || new Set();
        const opId = Number(zr.work_order_operation_id);
        for (const sid of sidSet) {
          if (Number.isInteger(opId) && opId > 0) zimPayloadByOpKey.set(`${sid}:${opId}`, detail);
          zimPayloadByOpKey.set(`${sid}:*`, detail);
        }
      }
    }
  }

  const rows = pending.map((p) => {
    const r = p.row || {};
    const sid = p.sync_run_id;
    const parsed = p.parsed || {};
    const runInfo = syncRunById.get(sid);
    const flowType = runInfo && runInfo.flow_type ? runInfo.flow_type : null;
    const isOperational =
      String(r.payload_source || parsed.payload_source || '') === 'operational_accum' ||
      (flowType && String(flowType).toLowerCase().includes('operational'));

    let username =
      r.username != null && String(r.username).trim()
        ? String(r.username).trim()
        : parsed.username != null && String(parsed.username).trim()
          ? String(parsed.username).trim()
          : null;
    let userId =
      r.user_id != null && Number.isInteger(Number(r.user_id))
        ? Number(r.user_id)
        : parsed.user_id != null && Number.isInteger(Number(parsed.user_id))
          ? Number(parsed.user_id)
          : null;
    let empId =
      normalizeEmployeeId(r.netsuite_employee_id) || normalizeEmployeeId(parsed.netsuite_employee_id);

    const actor =
      p._actorByStop ||
      (Number.isInteger(sid) ? actorBySyncRunId.get(sid) : null) ||
      null;
    if (!username && actor && actor.username) username = actor.username;
    if (userId == null && actor && actor.user_id != null) userId = actor.user_id;
    if (!empId && actor && actor.netsuite_employee_id) empId = actor.netsuite_employee_id;

    const zimDetail =
      (Number.isInteger(Number(r.operation_id)) && zimPayloadByOpKey.get(`${sid}:${Number(r.operation_id)}`)) ||
      zimPayloadByOpKey.get(`${sid}:*`) ||
      null;
    if (!empId && zimDetail && zimDetail.netsuite_employee_id) {
      empId = normalizeEmployeeId(zimDetail.netsuite_employee_id);
    }
    if (!empId && zimDetail && zimDetail.request_payload) {
      empId = normalizeEmployeeId(zimDetail.request_payload.custrecord_zim_reloj_empleado);
    }
    if (!username && zimDetail && zimDetail.employee_mapping && zimDetail.employee_mapping.username) {
      username = String(zimDetail.employee_mapping.username);
    }
    if (userId == null && zimDetail && zimDetail.employee_mapping && zimDetail.employee_mapping.user_id != null) {
      userId = Number(zimDetail.employee_mapping.user_id);
    }

    if (isOperational && !username) {
      username = null;
    }

    const setup = asNonNegativeInt(r.t_mon_enviado);
    const runMin = asNonNegativeInt(r.t_eje_enviado);
    const qty = asNonNegativeInt(r.qty_enviado);
    const payloadSummary =
      r.payload_summary != null && String(r.payload_summary).trim()
        ? String(r.payload_summary).trim()
        : formatPayloadSummary({ setup, run: runMin, qty });

    const pushItemMatch =
      parsed && Array.isArray(parsed.push_items)
        ? parsed.push_items.find(
            (it) =>
              Number(it && it.operation_id) === Number(r.operation_id) ||
              String(it && it.netsuite_operation_id) === String(r.netsuite_operation_id)
          )
        : null;

    const payloadDetail = {
      import_ot: pushItemMatch
        ? {
            operation_id: pushItemMatch.operation_id,
            ot_number: pushItemMatch.ot_number,
            operation_sequence: pushItemMatch.operation_sequence,
            netsuite_work_order_id: pushItemMatch.netsuite_work_order_id,
            netsuite_operation_id: pushItemMatch.netsuite_operation_id,
            actual_setup_time: pushItemMatch.actual_setup_time,
            actual_run_time: pushItemMatch.actual_run_time,
            completed_quantity: pushItemMatch.completed_quantity,
            absolute_actual_setup_time: pushItemMatch.absolute_actual_setup_time,
            absolute_actual_run_time: pushItemMatch.absolute_actual_run_time,
            absolute_completed_quantity: pushItemMatch.absolute_completed_quantity,
            stop_event_id: pushItemMatch.stop_event_id,
            user_id: pushItemMatch.user_id != null ? pushItemMatch.user_id : userId,
            username: pushItemMatch.username != null ? pushItemMatch.username : username,
            netsuite_employee_id:
              pushItemMatch.netsuite_employee_id != null ? pushItemMatch.netsuite_employee_id : empId
          }
        : {
            operation_id: r.operation_id,
            ot_number: r.ot_number,
            operation_sequence: r.operation_sequence,
            netsuite_work_order_id: r.netsuite_work_order_id,
            netsuite_operation_id: r.netsuite_operation_id,
            actual_setup_time: setup,
            actual_run_time: runMin,
            completed_quantity: qty,
            user_id: userId,
            username,
            netsuite_employee_id: empId
          },
      zim400: zimDetail
        ? {
            stop_event_id: zimDetail.stop_event_id,
            request_payload: zimDetail.request_payload,
            employee_mapping: zimDetail.employee_mapping || null
          }
        : null
    };

    return {
      ...r,
      sync_run_id: sid,
      push_at: p.push_at,
      step_status: p.step_status,
      user_id: userId,
      username,
      netsuite_employee_id: empId,
      payload_source: r.payload_source || parsed.payload_source || (isOperational ? 'operational_accum' : null),
      payload_summary: payloadSummary,
      payload_detail: payloadDetail
    };
  });

  return res.status(200).json({ count: rows.length, rows });
};

exports.listQueue = async function listQueue(req, res) {
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
  const status = String(req.query.status || '').trim().toUpperCase();
  const where = {};
  if (status) where.status = status;
  const rows = await NetsuiteSyncQueue.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit
  });
  return res.status(200).json({ count: rows.length, rows: rows.map((r) => r.toJSON()) });
};

exports.getQueueItem = async function getQueueItem(req, res) {
  const id = Number(req.params.id || 0);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'id invalido' });
  const row = await NetsuiteSyncQueue.findByPk(id);
  if (!row) return res.status(404).json({ message: 'No encontrado' });
  return res.status(200).json({ row: row.toJSON() });
};

exports.retryQueueItem = async function retryQueueItem(req, res) {
  const id = Number(req.params.id || 0);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'id invalido' });
  const row = await NetsuiteSyncQueue.findByPk(id);
  if (!row) return res.status(404).json({ message: 'No encontrado' });
  row.status = 'RETRY';
  row.next_retry_at = new Date();
  row.locked_at = null;
  await row.save();
  return res.status(200).json({ message: 'Pendiente reencolado.', row: row.toJSON() });
};

exports.requeueStuckQueueItems = async function requeueStuckQueueItems(req, res) {
  const out = await requeueStuckProcessing();
  return res.status(200).json({ message: 'Watchdog ejecutado.', ...out });
};

exports.listZim400Log = async function listZim400Log(req, res) {
  const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
  const otFilter = String(req.query.ot || '').trim();
  const statusFilter = String(req.query.status || '').trim().toUpperCase();
  const dateFromRaw = String(req.query.date_from || req.query.dateFrom || '').trim();
  const dateToRaw = String(req.query.date_to || req.query.dateTo || '').trim();
  const where = {};
  if (otFilter) where.ot_number = otFilter;
  if (statusFilter) where.status = statusFilter;
  if (dateFromRaw || dateToRaw) {
    where.createdAt = {};
    if (dateFromRaw) where.createdAt[Op.gte] = new Date(`${dateFromRaw}T00:00:00.000Z`);
    if (dateToRaw) where.createdAt[Op.lte] = new Date(`${dateToRaw}T23:59:59.999Z`);
  }
  const rows = await NetsuiteSyncZim400.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit
  });
  return res.status(200).json({ count: rows.length, rows: rows.map((r) => r.toJSON()) });
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
exports.runV4QueueSync = runV4QueueSync;


