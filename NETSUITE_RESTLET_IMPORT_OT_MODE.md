# NetSuite RESTlet IN - Modo `import_ot` (vigente)

## Resumen

`MCV_cronometro_restlet.js` recibe un batch desde Cronometro y crea registros de staging en:

- `customrecord_3k_importacion_ot`

El procesamiento final en NetSuite lo realizan scripts internos sobre ese custom record.

## Por que este modo es el recomendado

Comparado con escritura directa en registros operativos:

- mejor rendimiento por lotes,
- menor friccion de permisos,
- menor acoplamiento entre captura y aplicacion final.

## Entrada esperada por item

- `ot_number` (recomendado)
- `netsuite_work_order_id` (opcional)
- `operation_sequence` (recomendado)
- `netsuite_operation_id` (opcional si ya viene OT+secuencia)
- `actual_setup_time`
- `actual_run_time`
- `completed_quantity`

## Respuesta esperada

- `results`: validacion por item recibido
- `import_results`: registros de importacion creados por OT

## Reglas de implementacion en API

Variables clave:

```env
NETSUITE_PUSH_MODE=import_ot
NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha
```

## Lecciones aprendidas

1. No asumir que `completed_quantity` se aplica igual que tiempos en scripts de terceros.
2. Si tiempos actualizan y cantidad no, revisar:
   - formato JSON exacto,
   - mapeo de campos del custom record,
   - script de procesamiento que hace la aplicacion final.
3. El ciclo robusto de operacion sigue siendo: **Stop -> Push -> Pull(+replace)**.
