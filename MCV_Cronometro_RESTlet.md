# MCV_Cronometro RESTlet para NetSuite

## Estado
Documento operativo para crear el receptor mínimo en NetSuite que permita a **Cronómetro** volcar por batch los 3 datos reales por operación sobre `manufacturingoperationtask`.

Este documento deja:
- el contrato de entrada del RESTlet
- el script SuiteScript 2.1 listo para copiar y pegar
- el comportamiento esperado
- el despliegue mínimo que debe hacerse en NetSuite

## Objetivo

Recibir desde Cronómetro un lote de operaciones y actualizar, por cada `netsuite_operation_id`, estos 3 campos estándar de NetSuite:

- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

## Alcance

Este RESTlet es **mínimo** y no agrega:
- custom records
- staging en NetSuite
- log técnico persistente en NetSuite
- lógica adicional de negocio fuera de la actualización directa del record

La trazabilidad queda del lado de Cronómetro.

## Contrato de entrada

Payload esperado:

```json
{
  "items": [
    {
      "netsuite_operation_id": 3208,
      "actual_setup_time": 60,
      "actual_run_time": 360,
      "completed_quantity": 4
    }
  ]
}
```

### Reglas del payload

- `items` es obligatorio
- `items` debe ser un arreglo no vacío
- `netsuite_operation_id` es obligatorio por cada item
- `actual_setup_time`, `actual_run_time` y `completed_quantity` deben ser numéricos y mayores o iguales a 0
- la actualización es por **overwrite** del valor vigente
- el RESTlet no suma deltas

## Respuesta esperada

Respuesta sugerida del RESTlet:

```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "netsuite_operation_id": 3208,
      "success": true,
      "record_id": "3208"
    }
  ]
}
```

Si una fila falla, debe devolverse por item:

```json
{
  "netsuite_operation_id": 3208,
  "success": false,
  "error": "mensaje de error"
}
```

---

## Script SuiteScript 2.1

Copiar este archivo como, por ejemplo:

- `MCV_Cronometro_RESTlet.js`

```javascript
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
```

---

## Qué hace el script

### GET
Responde un `health check` mínimo para verificar que el endpoint está desplegado y disponible.

### POST
- valida el payload
- recorre `items`
- carga cada `manufacturingoperationtask`
- actualiza:
  - `actualsetuptime`
  - `actualruntime`
  - `completedquantity`
- guarda el record
- devuelve resultado por item

## Decisiones de implementación

### Se usa `record.load` + `save`
Se eligió `load/save` en lugar de `submitFields` para reducir el riesgo de incompatibilidad con un record parcialmente scriptable y mantener la actualización clara a nivel de record.

### Se usa `ignoreMandatoryFields: true`
Se deja activado para evitar que requisitos de campos no relevantes para esta integración bloqueen la actualización del record objetivo.

### No se hace suma incremental
El RESTlet pisa el valor actual con el valor recibido desde Cronómetro.

---

## Despliegue mínimo en NetSuite

### 1. Crear archivo
Subir `MCV_Cronometro_RESTlet.js` al File Cabinet.

### 2. Crear script
- Tipo: `RESTlet`
- Nombre sugerido: `MCV_Cronometro_RESTlet`
- Archivo: el `.js` anterior

### 3. Crear deployment
- Estado: `Released / Liberado`
- Rol permitido: `MCV_Cronometro_Rol`
- usar el deployment para obtener la URL final del RESTlet

### 4. Autenticación
Este endpoint debe consumirse con la integración M2M ya creada:
- aplicación `MCV_Cronometro_M2M`
- rol `MCV_Cronometro_Rol`
- entidad `MIGUEL CANDIA` en sandbox
- certificado público ya cargado

---

## Variables / secretos que debe guardar Cronómetro

Cronómetro debe guardar de forma segura:

- `client_id` de la integración `MCV_Cronometro_M2M`
- `certificate_id` del mapping M2M
- `private_key` correspondiente a `MCV_Cronometro_M2M_private.pem`
- `account_id` de NetSuite
- URL del token endpoint OAuth 2.0 M2M
- URL del RESTlet desplegado

La `private_key` **no** se sube a NetSuite.

---

## Prueba mínima sugerida

Payload de prueba:

```json
{
  "items": [
    {
      "netsuite_operation_id": 3208,
      "actual_setup_time": 60,
      "actual_run_time": 360,
      "completed_quantity": 4
    }
  ]
}
```

Resultado esperado:
- respuesta `success: true`
- la operación `3208` actualizada en `manufacturingoperationtask`

---

## Observaciones

- Este documento deja el receptor mínimo, no la lógica del lado Cronómetro para firmar el JWT OAuth 2.0 M2M.
- En sandbox se usa la entidad `MIGUEL CANDIA` para acelerar pruebas.
- En producción, lo recomendable sigue siendo migrar a un usuario técnico dedicado.

---

## Estado de decisión

Queda definido que el primer receptor operativo mínimo para Cronómetro en NetSuite es:

- un **RESTlet SuiteScript 2.1**
- autenticado por **OAuth 2.0 M2M**
- que actualiza directamente `manufacturingoperationtask`
- sin staging ni logs persistentes en NetSuite
