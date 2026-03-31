# MCV Cronometro IN (SuiteScript)

Este documento contiene el script propio para procesar Importación OT y publicar los 3 datos del cronómetro en Work Order Completion.

- Script: MCV_Cronometro_IN.js
- Tipo: Map/Reduce
- Entrada: customrecord_3k_importacion_ot
- JSON esperado por fila:

`json
[
  {
    "secuencia": 1,
    "horasConfiguracion": 0,
    "horasEjecucion": 1108,
    "cantidadCompletada": 1
  }
]
`

## Script completo

`javascript
/**
 * MCV Cronometro IN
 * Procesa registros de Importacion OT y crea Work Order Completion con:
 * - horasConfiguracion (machinesetuptime)
 * - horasEjecucion    (machineruntime)
 * - cantidadCompletada (completedquantity de cabecera)
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/error'], (record, search, error) => {
  const CFG = {
    importRecordType: 'customrecord_3k_importacion_ot',
    fieldWorkOrder: 'custrecord_3k_ot_principal',
    fieldJson: 'custrecord_3k_imp_ot_json',
    fieldStatus: 'custrecord_3k_imp_ot_estado',
    fieldDetail: 'custrecord_3k_imp_ot_det_proc',
    fieldTransaction: 'custrecord_3k_imp_ot_transaccion',

    statusPending: 1,
    statusOk: 2,
    statusError: 3,

    // Ajustar si prefieres 'sum'
    completedQtyMode: 'max',

    // Si existe esta busqueda, la usamos. Si no, fallback a search.create.
    pendingSavedSearchId: 'customsearch_tek_imp_ot_pend'
  };

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  function toInt(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  function normalizeTaskId(v) {
    if (v === null || v === undefined) return null;
    const asNum = Number(v);
    if (Number.isFinite(asNum) && asNum > 0) return Math.floor(asNum);
    const cleaned = String(v).replace(/[^\d]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }

  function parsePayload(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(String(jsonText || '[]'));
    } catch (e) {
      throw error.create({
        name: 'INVALID_JSON',
        message: `JSON invalido: ${e.message}`
      });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw error.create({
        name: 'EMPTY_PAYLOAD',
        message: 'El JSON debe ser un arreglo no vacio.'
      });
    }

    const ops = parsed.map((row, idx) => {
      const sec = toInt(row && row.secuencia, NaN);
      if (!Number.isFinite(sec) || sec <= 0) {
        throw error.create({
          name: 'INVALID_SEQUENCE',
          message: `Fila ${idx + 1}: secuencia invalida.`
        });
      }
      return {
        secuencia: sec,
        horasConfiguracion: toInt(row && row.horasConfiguracion, 0),
        horasEjecucion: toInt(row && row.horasEjecucion, 0),
        cantidadCompletada: toInt(row && row.cantidadCompletada, 0)
      };
    });

    return ops;
  }

  function computeHeaderCompletedQty(ops) {
    const values = ops.map((x) => toInt(x.cantidadCompletada, 0));
    if (values.length === 0) return 0;
    if (CFG.completedQtyMode === 'sum') {
      return values.reduce((a, b) => a + b, 0);
    }
    return values.reduce((m, x) => (x > m ? x : m), 0);
  }

  function loadPendingSearch() {
    try {
      return search.load({ id: CFG.pendingSavedSearchId });
    } catch (_) {
      return search.create({
        type: CFG.importRecordType,
        filters: [[CFG.fieldStatus, 'anyof', String(CFG.statusPending)]],
        columns: ['internalid', CFG.fieldWorkOrder, CFG.fieldJson]
      });
    }
  }

  function getInputData() {
    return loadPendingSearch();
  }

  function map(context) {
    const row = JSON.parse(context.value);
    const importId = row.id || (row.values && row.values.internalid && row.values.internalid.value);
    const woVal = row.values && row.values[CFG.fieldWorkOrder];
    const woId = woVal && typeof woVal === 'object' ? woVal.value : woVal;
    const jsonVal = row.values && row.values[CFG.fieldJson];

    context.write({
      key: String(importId),
      value: JSON.stringify({
        importId: Number(importId),
        woId: Number(woId),
        json: jsonVal
      })
    });
  }

  function markImport(importId, ok, detail, wocId) {
    const values = {};
    values[CFG.fieldStatus] = ok ? CFG.statusOk : CFG.statusError;
    values[CFG.fieldDetail] = String(detail || (ok ? 'Procesado exitosamente.' : 'Error sin detalle'));
    if (ok && wocId) {
      values[CFG.fieldTransaction] = Number(wocId);
    }
    record.submitFields({
      type: CFG.importRecordType,
      id: Number(importId),
      values,
      options: { enableSourcing: true, ignoreMandatoryFields: true }
    });
  }

  function reduce(context) {
    let payload;
    try {
      payload = JSON.parse(context.values[0]);
      const importId = Number(payload.importId);
      const woId = Number(payload.woId);

      if (!Number.isFinite(importId) || importId <= 0) {
        throw error.create({ name: 'MISSING_IMPORT_ID', message: 'importId invalido.' });
      }
      if (!Number.isFinite(woId) || woId <= 0) {
        throw error.create({ name: 'MISSING_WO_ID', message: 'No se pudo resolver OT interna.' });
      }

      const ops = parsePayload(payload.json);
      const sortedSeq = ops.map((x) => x.secuencia).sort((a, b) => a - b);
      const seqStart = sortedSeq[0];
      const seqEnd = sortedSeq[sortedSeq.length - 1];

      const woc = record.transform({
        fromType: record.Type.WORK_ORDER,
        fromId: woId,
        toType: record.Type.WORK_ORDER_COMPLETION,
        isDynamic: false
      });

      const lineCount = woc.getLineCount({ sublistId: 'operation' }) || 0;
      if (lineCount <= 0) {
        throw error.create({ name: 'NO_OPERATION_LINES', message: 'WOC sin lineas de operacion.' });
      }

      const lineBySequence = {};
      const taskIdBySequence = {};

      for (let i = 0; i < lineCount; i += 1) {
        const seq = toInt(
          woc.getSublistValue({ sublistId: 'operation', fieldId: 'operationsequence', line: i }),
          NaN
        );
        if (Number.isFinite(seq) && seq > 0) {
          lineBySequence[seq] = i;
          const taskRaw =
            woc.getSublistValue({ sublistId: 'operation', fieldId: 'taskid', line: i }) ||
            woc.getSublistText({ sublistId: 'operation', fieldId: 'taskid', line: i });
          const taskId = normalizeTaskId(taskRaw);
          if (taskId) taskIdBySequence[seq] = taskId;
        }
      }

      const startTaskId = taskIdBySequence[seqStart];
      const endTaskId = taskIdBySequence[seqEnd];
      if (!startTaskId || !endTaskId) {
        throw error.create({
          name: 'START_END_OPERATION_NOT_FOUND',
          message: `No se pudo resolver taskId para secuencias ${seqStart}-${seqEnd}.`
        });
      }

      woc.setValue({ fieldId: 'startoperation', value: startTaskId });
      woc.setValue({ fieldId: 'endoperation', value: endTaskId });

      for (let k = 0; k < ops.length; k += 1) {
        const op = ops[k];
        const line = lineBySequence[op.secuencia];
        if (line === undefined || line === null) continue;

        if (op.horasConfiguracion >= 0) {
          woc.setSublistValue({
            sublistId: 'operation',
            fieldId: 'recordsetup',
            line,
            value: true
          });
          woc.setSublistValue({
            sublistId: 'operation',
            fieldId: 'machinesetuptime',
            line,
            value: op.horasConfiguracion
          });
        }

        woc.setSublistValue({
          sublistId: 'operation',
          fieldId: 'machineruntime',
          line,
          value: op.horasEjecucion
        });
      }

      const headerQty = computeHeaderCompletedQty(ops);
      woc.setValue({ fieldId: 'completedquantity', value: headerQty });

      const wocId = woc.save({ enableSourcing: true, ignoreMandatoryFields: false });
      markImport(importId, true, 'Procesado exitosamente.', wocId);
      context.write({ key: context.key, value: String(wocId) });
    } catch (e) {
      const importId = payload && payload.importId ? payload.importId : Number(context.key);
      const msg = `${e.name || 'ERROR'}: ${e.message || e}`;
      if (Number.isFinite(importId) && importId > 0) {
        markImport(importId, false, msg);
      }
      log.error('reduce_error', { key: context.key, error: msg });
    }
  }

  function summarize(summary) {
    if (summary.inputSummary && summary.inputSummary.error) {
      log.error('input_error', summary.inputSummary.error);
    }
    summary.mapSummary.errors.iterator().each((k, v) => {
      log.error('map_error', { key: k, error: v });
      return true;
    });
    summary.reduceSummary.errors.iterator().each((k, v) => {
      log.error('reduce_error', { key: k, error: v });
      return true;
    });
    log.audit('summarize', {
      usage: summary.usage,
      concurrency: summary.concurrency,
      yields: summary.yields
    });
  }

  return { getInputData, map, reduce, summarize };
});


`

## Notas de despliegue

1. Subir MCV_Cronometro_IN.js al File Cabinet de NetSuite.
2. Crear Script Record de tipo Map/Reduce.
3. Crear Deployment apuntando a Importación OT pendiente.
4. Desactivar el MR anterior para evitar doble procesamiento.
5. Probar con una OT y validar:
- tiempos en operación,
- completedquantity en WOC,
- estado del registro de importación (OK/Error).
