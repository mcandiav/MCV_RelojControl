/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/record', 'N/log', 'N/search', 'N/format'], (record, log, search, format) => {

  const IMPORT_RECORD_TYPE = 'customrecord_3k_importacion_ot';
  const FIELD_WORKORDER = 'custrecord_3k_ot_principal';
  const FIELD_JSON = 'custrecord_3k_imp_ot_json';
  const FIELD_DATE = 'custrecord_3k_imp_ot_fecha';
  const FIELD_STATUS = 'custrecord_3k_imp_ot_estado';
  const FIELD_DETAIL = 'custrecord_3k_imp_ot_det_proc';

  const OP_RECORD_TYPE = 'manufacturingoperationtask';

  function toNumber(value, fieldName) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Field ${fieldName} must be numeric`);
    }
    if (parsed < 0) return 0;
    return Math.floor(parsed);
  }

  function toPositiveInt(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      throw new Error(`Field ${fieldName} is required`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Field ${fieldName} must be a positive integer`);
    }
    return Math.floor(parsed);
  }

  function todayDateValue() {
    return format.parse({ value: new Date(), type: format.Type.DATE });
  }

  function resolveWorkOrderByTranId(otNumber) {
    const term = String(otNumber || '').trim();
    if (!term) return null;
    const rs = search.create({
      type: 'workorder',
      filters: [['tranid', 'is', term]],
      columns: ['internalid', 'tranid']
    }).run().getRange({ start: 0, end: 1 });
    if (!rs || rs.length === 0) return null;
    return {
      id: String(rs[0].getValue('internalid')),
      tranid: String(rs[0].getValue('tranid'))
    };
  }

  function resolveByOperationId(operationId) {
    const opId = toPositiveInt(operationId, 'netsuite_operation_id');
    const rs = search.create({
      type: OP_RECORD_TYPE,
      filters: [['internalid', 'anyof', String(opId)]],
      columns: [
        search.createColumn({ name: 'internalid' }),
        search.createColumn({ name: 'operationsequence' }),
        search.createColumn({ name: 'internalid', join: 'workorder' }),
        search.createColumn({ name: 'tranid', join: 'workorder' })
      ]
    }).run().getRange({ start: 0, end: 1 });

    if (!rs || rs.length === 0) return null;
    return {
      operation_sequence: Number(rs[0].getValue({ name: 'operationsequence' })) || null,
      workorder_id: rs[0].getValue({ name: 'internalid', join: 'workorder' })
        ? String(rs[0].getValue({ name: 'internalid', join: 'workorder' }))
        : null,
      ot_number: rs[0].getValue({ name: 'tranid', join: 'workorder' })
        ? String(rs[0].getValue({ name: 'tranid', join: 'workorder' }))
        : null
    };
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Each item must be an object');
    }

    const out = {
      netsuite_operation_id: item.netsuite_operation_id != null ? String(item.netsuite_operation_id) : null,
      ot_number: item.ot_number ? String(item.ot_number).trim() : null,
      netsuite_work_order_id: item.netsuite_work_order_id != null && item.netsuite_work_order_id !== ''
        ? String(item.netsuite_work_order_id)
        : null,
      operation_sequence: item.operation_sequence != null && item.operation_sequence !== ''
        ? toPositiveInt(item.operation_sequence, 'operation_sequence')
        : null,
      actual_setup_time: toNumber(item.actual_setup_time, 'actual_setup_time'),
      actual_run_time: toNumber(item.actual_run_time, 'actual_run_time'),
      completed_quantity: toNumber(item.completed_quantity, 'completed_quantity')
    };

    // Solo resolver via operation id cuando faltan OT o secuencia.
    // Si OT+secuencia ya vienen en payload, no usar este fallback.
    if (!out.ot_number || !out.operation_sequence) {
      if (!out.netsuite_operation_id) {
        throw new Error('Missing identity fields. Send ot_number + operation_sequence or netsuite_operation_id.');
      }
      const resolved = resolveByOperationId(out.netsuite_operation_id);
      if (!resolved) {
        throw new Error(`Unable to resolve operation ${out.netsuite_operation_id}`);
      }
      if (!out.operation_sequence && resolved.operation_sequence) out.operation_sequence = resolved.operation_sequence;
      if (!out.ot_number && resolved.ot_number) out.ot_number = resolved.ot_number;
      if (!out.netsuite_work_order_id && resolved.workorder_id) out.netsuite_work_order_id = resolved.workorder_id;
    }

    if (!out.ot_number && out.netsuite_work_order_id) {
      // no-op: con internal id alcanza
    } else if (out.ot_number && !out.netsuite_work_order_id) {
      const wo = resolveWorkOrderByTranId(out.ot_number);
      if (wo) out.netsuite_work_order_id = wo.id;
    }

    if (!out.netsuite_work_order_id) {
      throw new Error(`Unable to resolve work order internal id for ${out.ot_number || out.netsuite_operation_id}`);
    }

    return out;
  }

  function buildImportPayloadByOt(normalizedItems) {
    const groups = new Map();
    for (let i = 0; i < normalizedItems.length; i += 1) {
      const it = normalizedItems[i];
      const key = `${it.netsuite_work_order_id}__${it.ot_number || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          ot_number: it.ot_number || null,
          workorder_id: it.netsuite_work_order_id,
          lines: []
        });
      }
      groups.get(key).lines.push({
        secuencia: it.operation_sequence,
        horasConfiguracion: it.actual_setup_time,
        horasEjecucion: it.actual_run_time,
        cantidadCompletada: it.completed_quantity,
        netsuite_operation_id: it.netsuite_operation_id
      });
    }

    const out = [];
    groups.forEach((g) => {
      const dedup = new Map();
      for (let i = 0; i < g.lines.length; i += 1) {
        const line = g.lines[i];
        dedup.set(String(line.secuencia), line);
      }
      const finalLines = Array.from(dedup.values()).sort((a, b) => Number(a.secuencia) - Number(b.secuencia));
      out.push({
        ot_number: g.ot_number,
        workorder_id: g.workorder_id,
        lines: finalLines
      });
    });
    return out;
  }

  function createImportRecord(group) {
    const rec = record.create({
      type: IMPORT_RECORD_TYPE,
      isDynamic: false
    });

    const payloadLines = group.lines.map((l) => ({
      secuencia: l.secuencia,
      horasConfiguracion: l.horasConfiguracion,
      horasEjecucion: l.horasEjecucion,
      cantidadCompletada: l.cantidadCompletada
    }));

    rec.setValue({
      fieldId: 'name',
      value: `MCV Import ${group.ot_number || group.workorder_id} ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`
    });

    rec.setValue({
      fieldId: FIELD_WORKORDER,
      value: Number(group.workorder_id)
    });

    rec.setValue({
      fieldId: FIELD_JSON,
      value: JSON.stringify(payloadLines)
    });

    try {
      rec.setValue({
        fieldId: FIELD_DATE,
        value: todayDateValue()
      });
    } catch (_) {
      // campo opcional en algunos ambientes
    }

    try {
      rec.setValue({
        fieldId: FIELD_STATUS,
        value: 1
      });
    } catch (_) {
      // si estado es manejado por defaults/scripts
    }

    const savedId = rec.save({
      enableSourcing: true,
      ignoreMandatoryFields: true
    });

    return String(savedId);
  }

  function post(payload) {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload body is required');
      }

      if (!Array.isArray(payload.items)) {
        throw new Error('Payload must contain an items array');
      }

      if (payload.items.length === 0) {
        throw new Error('Payload items array cannot be empty');
      }

      const normalizedItems = [];
      const itemLevelResults = [];

      for (let i = 0; i < payload.items.length; i += 1) {
        const current = payload.items[i];
        try {
          const n = normalizeItem(current);
          normalizedItems.push(n);
          itemLevelResults.push({
            netsuite_operation_id: n.netsuite_operation_id || null,
            ot_number: n.ot_number || null,
            operation_sequence: n.operation_sequence || null,
            success: true
          });
        } catch (itemError) {
          log.error({
            title: 'MCV_Cronometro_RESTlet item error',
            details: {
              item: current,
              error: itemError.message || String(itemError)
            }
          });

          itemLevelResults.push({
            netsuite_operation_id: current && current.netsuite_operation_id ? String(current.netsuite_operation_id) : null,
            ot_number: current && current.ot_number ? String(current.ot_number) : null,
            operation_sequence: current && current.operation_sequence != null ? Number(current.operation_sequence) : null,
            success: false,
            error: itemError.message || String(itemError)
          });
        }
      }

      const groups = buildImportPayloadByOt(normalizedItems);
      const importResults = [];
      let importFailed = 0;
      for (let g = 0; g < groups.length; g += 1) {
        const group = groups[g];
        try {
          const importId = createImportRecord(group);
          importResults.push({
            success: true,
            ot_number: group.ot_number,
            workorder_id: group.workorder_id,
            import_record_id: importId,
            line_count: group.lines.length
          });
        } catch (e) {
          importFailed += 1;
          importResults.push({
            success: false,
            ot_number: group.ot_number,
            workorder_id: group.workorder_id,
            error: e.message || String(e)
          });
        }
      }

      const successful = itemLevelResults.filter(r => r.success).length;
      const failed = itemLevelResults.length - successful;

      return {
        success: failed === 0 && importFailed === 0,
        mode: 'import_ot_via_restlet',
        processed: itemLevelResults.length,
        successful,
        failed,
        import_groups: groups.length,
        import_successful: importResults.filter(r => r.success).length,
        import_failed: importFailed,
        results: itemLevelResults,
        import_results: importResults
      };
    } catch (error) {
      log.error({
        title: 'MCV_Cronometro_RESTlet fatal error',
        details: error.message || String(error)
      });

      return {
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        error: error.message || String(error)
      };
    }
  }

  function get() {
    return {
      success: true,
      name: 'MCV_Cronometro_RESTlet',
      mode: 'import_ot_via_restlet',
      importRecordType: IMPORT_RECORD_TYPE,
      expectedFields: [
        'ot_number (optional if netsuite_operation_id is sent)',
        'netsuite_work_order_id (optional)',
        'operation_sequence (optional if netsuite_operation_id is sent)',
        'netsuite_operation_id (optional if ot_number + operation_sequence are sent)',
        'actual_setup_time',
        'actual_run_time',
        'completed_quantity'
      ]
    };
  }

  return {
    get,
    post
  };
});
