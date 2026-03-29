# NetSuite OUT por Saved Search: campos y mapeo oficial (2026-03-28)

## Estado
Este documento reemplaza el contrato OUT basado en Dataset.

- Fuente OUT oficial: Saved Search
- Search operativa objetivo: `customsearch_mcv_cronometro_out` (Saved Search 823 en UI)
- Titulo visible: `BG - Control de HH por OT Detalle VF - CARGA`
- Tipo: `Tarea de operacion de fabricacion` (`manufacturingoperationtask`)

## Evidencia consultada en NetSuite
- Nota de conector: en esta sesión el rol técnico no pudo listar/ejecutar `customsearch_mcv_cronometro_out`; se documenta por validación funcional de negocio.
- `ns_runsavedsearch` (muestra): devuelve columnas de salida en uso
- `ns_getrecordtypemetadata(recordType=manufacturingoperationtask)`: confirma `field_id` tecnicos del record base

## Columnas OUT y field_id tecnico

| Columna en Saved Search | field_id NetSuite (record base) | Tipo esperado | Columna destino MariaDB sugerida |
|---|---|---|---|
| `Orden de trabajo` | `workOrder` (usar `id` o numero visible segun API) | texto/referencia | `ot_number` |
| `Secuencia de operaciones` | `operationSequence` | entero | `operation_sequence` |
| `Centro de trabajo de fabricacion` | `manufacturingWorkCenter` (usar `id`) | referencia | `resource_code` o `workcenter_id` |
| `CONFIGURACION RUTA` | `setupTime` | decimal (minutos) | `planned_setup_minutes` |
| `EJECUCION RUTA` | `runRate` | decimal (minutos/unidad) | `planned_operation_minutes` |
| `Cantidad de entrada` | `inputQuantity` | decimal | `planned_quantity` |
| `Estado` | `status` (usar `id`) | enum (para OUT usar solo `PROGRESS`) | `source_status` |
| `Nombre de la operacion` | `title` | texto | `operation_name` |

## Regla de normalizacion para sync a MariaDB
- El backend debe consumir esta Saved Search y mapear por nombre de columna.
- Para `status`, guardar el codigo (`id`) y no solo la etiqueta.
- Para `workOrder` y `manufacturingWorkCenter`, preferir `id` si la respuesta lo trae estructurado; si llega texto plano, aplicar parser controlado y registrar warning.
- La tabla WIP local puede pisarse por reemplazo total en el flujo oficial `push -> pull -> replace`.

## Variables recomendadas (nuevo contrato)
```env
NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
NETSUITE_OUT_SAVEDSEARCH_NAME=BG - Control de HH por OT Detalle VF - CARGA
```

## Regla de filtro obligatoria (consistencia de origen)
- Search nueva (`customsearch_mcv_cronometro_out`): solo `Estado = En curso` (`PROGRESS`).
- Search antigua (`customsearch_zim_tarea_operacion_2_2_3_2`): mezcla `En curso` + `Sin empezar` (`PROGRESS` + `NOTSTART`).
- Para evitar inconsistencias de universo WIP, Cronómetro debe consumir solo la nueva.

## Columna `area` requerida en Saved Search 823
Agregar una columna nueva en la Saved Search 823:

- Tipo de campo: `Formula (Texto)`
- Etiqueta sugerida: `AREA`
- Fórmula sugerida (si el nombre del centro viene en texto):
```sql
CASE
  WHEN UPPER({manufacturingworkcenter.name}) LIKE 'ES%' THEN 'ES'
  WHEN UPPER({manufacturingworkcenter.name}) LIKE 'ME%' THEN 'ME'
  ELSE NULL
END
```

Si el prefijo está en otra columna (por ejemplo código de recurso), usar esa referencia de campo en lugar de `{manufacturingworkcenter.name}`.

## Notas importantes
- El contrato anterior con `NETSUITE_DATASET_OUT_ID` queda historico/deprecado.
- Si se crea una nueva search tecnica (`MCV_Cronometro_Out_Search`), actualizar este documento con su `searchId` exacto y mantener el mismo mapping funcional.
