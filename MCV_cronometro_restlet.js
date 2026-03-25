/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/record', 'N/log'], (record, log) => {

  const RECORD_TYPE = 'manufacturingoperationtask';

  function toNumber(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      throw new Error(`Field ${fieldName} is required`);
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Field ${fieldName} must be numeric`);
    }
    if (parsed < 0) {
      throw new Error(`Field ${fieldName} must be >= 0`);
    }
    return parsed;
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Each item must be an object');
    }

    const operationId = item.netsuite_operation_id;
    if (operationId === null || operationId === undefined || operationId === '') {
      throw new Error('Field netsuite_operation_id is required');
    }

    return {
      netsuite_operation_id: String(operationId),
      actual_setup_time: toNumber(item.actual_setup_time, 'actual_setup_time'),
      actual_run_time: toNumber(item.actual_run_time, 'actual_run_time'),
      completed_quantity: toNumber(item.completed_quantity, 'completed_quantity')
    };
  }

  function updateOperation(item) {
    const normalized = normalizeItem(item);

    const rec = record.load({
      type: RECORD_TYPE,
      id: normalized.netsuite_operation_id,
      isDynamic: false
    });

    rec.setValue({
      fieldId: 'actualsetuptime',
      value: normalized.actual_setup_time
    });

    rec.setValue({
      fieldId: 'actualruntime',
      value: normalized.actual_run_time
    });

    rec.setValue({
      fieldId: 'completedquantity',
      value: normalized.completed_quantity
    });

    const savedId = rec.save({
      enableSourcing: false,
      ignoreMandatoryFields: true
    });

    return {
      netsuite_operation_id: normalized.netsuite_operation_id,
      success: true,
      record_id: String(savedId)
    };
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

      const results = [];

      for (let i = 0; i < payload.items.length; i += 1) {
        const current = payload.items[i];
        try {
          const result = updateOperation(current);
          results.push(result);
        } catch (itemError) {
          log.error({
            title: 'MCV_Cronometro_RESTlet item error',
            details: {
              item: current,
              error: itemError.message || String(itemError)
            }
          });

          results.push({
            netsuite_operation_id: current && current.netsuite_operation_id ? String(current.netsuite_operation_id) : null,
            success: false,
            error: itemError.message || String(itemError)
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      return {
        success: failed === 0,
        processed: results.length,
        successful,
        failed,
        results
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
      recordType: RECORD_TYPE,
      expectedFields: [
        'netsuite_operation_id',
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