/**
 * MCV Cronometro SS
 * Valida y normaliza payload en customrecord_3k_importacion_ot
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/error'], (error) => {
  const CFG = {
    fieldJson: 'custrecord_3k_imp_ot_json',
    fieldStatus: 'custrecord_3k_imp_ot_estado',
    fieldDetail: 'custrecord_3k_imp_ot_det_proc',
    statusPending: 1
  };

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  function toInt(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  function normalizePayload(rawJson) {
    let parsed;
    try {
      parsed = JSON.parse(String(rawJson || '[]'));
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

  function beforeSubmit(context) {
    const rec = context.newRecord;
    const eventType = context.type;
    const allowed = ['create', 'edit', 'xedit', 'copy'];
    if (!allowed.includes(String(eventType).toLowerCase())) return;

    const rawJson = rec.getValue(CFG.fieldJson);
    if (isBlank(rawJson)) {
      throw error.create({
        name: 'MCV_MISSING_JSON',
        message: 'Debe ingresar JSON con secuencia/horas/cantidad.'
      });
    }

    const normalized = normalizePayload(rawJson);
    rec.setValue({
      fieldId: CFG.fieldJson,
      value: JSON.stringify(normalized)
    });

    const status = rec.getValue(CFG.fieldStatus);
    if (isBlank(status)) {
      rec.setValue({
        fieldId: CFG.fieldStatus,
        value: CFG.statusPending
      });
    }

    // Limpia detalle previo para reintento limpio.
    rec.setValue({
      fieldId: CFG.fieldDetail,
      value: ''
    });
  }

  return { beforeSubmit };
});

