/**
 * MCV Cronometro MR
 * Procesa registros pendientes de customrecord_3k_importacion_ot
 * y genera Work Order Completion con tiempos + cantidad.
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
    statusError: 3
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
        name: 'MCV_INVALID_JSON',
        message: `JSON invalido: ${e.message}`
      });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw error.create({
        name: 'MCV_EMPTY_JSON',
        message: 'El JSON debe ser un arreglo no vacio.'
      });
    }

    return parsed.map((row, idx) => {
      const secuencia = toInt(row && row.secuencia, NaN);
      if (!Number.isFinite(secuencia) || secuencia <= 0) {
        throw error.create({
          name: 'MCV_INVALID_SEQUENCE',
          message: `Fila ${idx + 1}: secuencia invalida.`
        });
      }
      return {
        secuencia,
        horasConfiguracion: toInt(row && row.horasConfiguracion, 0),
        horasEjecucion: toInt(row && row.horasEjecucion, 0),
        cantidadCompletada: toInt(row && row.cantidadCompletada, 0)
      };
    });
  }

  function updateImport(importId, values) {
    record.submitFields({
      type: CFG.importRecordType,
      id: Number(importId),
      values,
      options: { enableSourcing: true, ignoreMandatoryFields: true }
    });
  }

  function getInputData() {
    return search.create({
      type: CFG.importRecordType,
      filters: [
        [CFG.fieldStatus, 'anyof', String(CFG.statusPending)],
        'AND',
        ['name', 'startswith', 'MCV Import ']
      ],
      columns: ['internalid', CFG.fieldWorkOrder, CFG.fieldJson]
    });
  }

  function map(context) {
    const row = JSON.parse(context.value);
    const importId = row.id;
    const woObj = row.values && row.values[CFG.fieldWorkOrder];
    const woId = woObj && typeof woObj === 'object' ? woObj.value : woObj;
    const json = row.values && row.values[CFG.fieldJson];

    context.write({
      key: String(importId),
      value: JSON.stringify({
        importId: Number(importId),
        woId: Number(woId),
        json
      })
    });
  }

  function computeHeaderQty(lines) {
    // Evita sobre-cierre accidental por suma de lineas.
    return lines.reduce((m, x) => (x.cantidadCompletada > m ? x.cantidadCompletada : m), 0);
  }

  function reduce(context) {
    let payload = null;
    try {
      payload = JSON.parse(context.values[0]);
      const importId = Number(payload.importId);
      const woId = Number(payload.woId);

      if (!Number.isFinite(importId) || importId <= 0) {
        throw error.create({ name: 'MCV_MISSING_IMPORT_ID', message: 'importId invalido.' });
      }
      if (!Number.isFinite(woId) || woId <= 0) {
        throw error.create({ name: 'MCV_MISSING_WO_ID', message: 'OT interna no resuelta.' });
      }

      const linesPayload = parsePayload(payload.json);
      const sortedSeq = linesPayload.map((x) => x.secuencia).sort((a, b) => a - b);
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
        throw error.create({ name: 'MCV_NO_OPERATION_LINES', message: 'WOC sin lineas de operacion.' });
      }

      const lineBySeq = {};
      const taskIdBySeq = {};

      for (let i = 0; i < lineCount; i += 1) {
        const seq = toInt(woc.getSublistValue({
          sublistId: 'operation',
          fieldId: 'operationsequence',
          line: i
        }), NaN);
        if (!Number.isFinite(seq) || seq <= 0) continue;

        lineBySeq[seq] = i;
        const taskRaw =
          woc.getSublistValue({ sublistId: 'operation', fieldId: 'taskid', line: i }) ||
          woc.getSublistText({ sublistId: 'operation', fieldId: 'taskid', line: i });
        const taskId = normalizeTaskId(taskRaw);
        if (taskId) taskIdBySeq[seq] = taskId;
      }

      const startTaskId = taskIdBySeq[seqStart];
      const endTaskId = taskIdBySeq[seqEnd];
      if (!startTaskId || !endTaskId) {
        throw error.create({
          name: 'MCV_START_END_NOT_FOUND',
          message: `No se pudo resolver start/end para secuencia ${seqStart}-${seqEnd}.`
        });
      }

      woc.setValue({ fieldId: 'startoperation', value: startTaskId });
      woc.setValue({ fieldId: 'endoperation', value: endTaskId });

      for (let k = 0; k < linesPayload.length; k += 1) {
        const p = linesPayload[k];
        const line = lineBySeq[p.secuencia];
        if (line === undefined || line === null) continue;

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
          value: p.horasConfiguracion
        });
        woc.setSublistValue({
          sublistId: 'operation',
          fieldId: 'machineruntime',
          line,
          value: p.horasEjecucion
        });

        // Best effort por si el formulario expone cantidad por linea.
        try {
          woc.setSublistValue({
            sublistId: 'operation',
            fieldId: 'quantitycompleted',
            line,
            value: p.cantidadCompletada
          });
        } catch (_) {
          try {
            woc.setSublistValue({
              sublistId: 'operation',
              fieldId: 'completedquantity',
              line,
              value: p.cantidadCompletada
            });
          } catch (_) {}
        }
      }

      const headerQty = computeHeaderQty(linesPayload);
      woc.setValue({ fieldId: 'completedquantity', value: headerQty });

      const wocId = woc.save({ enableSourcing: true, ignoreMandatoryFields: false });

      updateImport(importId, {
        [CFG.fieldStatus]: CFG.statusOk,
        [CFG.fieldDetail]: `Procesado OK (${new Date().toISOString()})`,
        [CFG.fieldTransaction]: Number(wocId)
      });
    } catch (e) {
      const importId = payload && payload.importId ? Number(payload.importId) : Number(context.key);
      const detail = `${e.name || 'ERROR'}: ${e.message || e}`;
      if (Number.isFinite(importId) && importId > 0) {
        updateImport(importId, {
          [CFG.fieldStatus]: CFG.statusError,
          [CFG.fieldDetail]: detail
        });
      }
      log.error('MCV_REDUCE_ERROR', { key: context.key, detail });
    }
  }

  function summarize(summary) {
    if (summary.inputSummary && summary.inputSummary.error) {
      log.error('MCV_INPUT_ERROR', summary.inputSummary.error);
    }
    summary.mapSummary.errors.iterator().each((k, v) => {
      log.error('MCV_MAP_ERROR', { key: k, error: v });
      return true;
    });
    summary.reduceSummary.errors.iterator().each((k, v) => {
      log.error('MCV_REDUCE_ERROR', { key: k, error: v });
      return true;
    });
    log.audit('MCV_SUMMARY', {
      usage: summary.usage,
      concurrency: summary.concurrency,
      yields: summary.yields
    });
  }

  return { getInputData, map, reduce, summarize };
});
