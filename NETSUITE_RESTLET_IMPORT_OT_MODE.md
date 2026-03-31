# NetSuite RESTlet IN - Modo Importacion OT

Este documento describe el nuevo comportamiento de `MCV_cronometro_restlet.js`.

## Cambio principal

Antes: intentaba actualizar `manufacturingoperationtask` directamente (bloqueado en WIP).

Ahora: recibe el batch del cronometro y crea registros en `customrecord_3k_importacion_ot` agrupados por OT.

## Campos de entrada por item

- `ot_number` (opcional si viene `netsuite_operation_id`)
- `netsuite_work_order_id` (opcional)
- `operation_sequence` (opcional si viene `netsuite_operation_id`)
- `netsuite_operation_id` (opcional si vienen `ot_number + operation_sequence`)
- `actual_setup_time`
- `actual_run_time`
- `completed_quantity`

## Salida esperada

- `results`: validacion por item recibido
- `import_results`: registros de importacion creados por OT

## Ajuste en backend API

Se actualizo `pushViaRestlet` para enviar tambien:
- `ot_number`
- `operation_sequence`
- `netsuite_work_order_id`

De esta forma el RESTlet puede operar en modo staging sin depender exclusivamente de `netsuite_operation_id`.
