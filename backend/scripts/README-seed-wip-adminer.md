# Importar WIP OT1–OT9 con Adminer (CSV)

Misma data que `wip-upsert-ot1-9.json` / `seedWipSample`: **52 filas**, tabla **`work_order_operations`**.

## Archivos

| Archivo | Uso |
|--------|-----|
| `seed-wip-ot1-9-adminer.csv` | Importar en Adminer |
| `generate-seed-wip-csv.js` | Regenerar el CSV desde el JSON (`node backend/scripts/generate-seed-wip-csv.js`) |

## Formato del CSV

- **Separador:** coma (`,`)
- **Codificación:** UTF-8 (hay guión largo `—` en `operation_name`)
- **Cabecera:** primera línea = nombres de columnas
- **Sin columna `id`:** MariaDB asigna `AUTO_INCREMENT` al importar (mapeá solo las columnas del CSV)

### Columnas (orden — coincide con `SHOW COLUMNS` en sandbox)

Sin `id` (auto en import). Orden en el CSV:

`ot_number`, `operation_sequence`, `operation_code`, `operation_name`, `resource_code`, `area`, `planned_setup_minutes`, `planned_operation_minutes`, `netsuite_work_order_id`, `netsuite_operation_id`, `source_status`, `last_synced_at`, `createdAt`, `updatedAt`, `planned_quantity`, `completed_quantity`

*(En esta BD `planned_quantity` y `completed_quantity` van **después** de `updatedAt`.)*

- Celdas vacías → `NULL` (p. ej. `planned_setup_minutes`, NetSuite, `last_synced_at`).
- `createdAt` / `updatedAt`: valor fijo de ejemplo; podés cambiarlos en el CSV antes de importar.

### Verificar nombres en tu base

Sequelize suele crear **`createdAt`** y **`updatedAt`** (camelCase). Si tu tabla tiene **`created_at`** / **`updated_at`**, en Adminer renombrá las columnas del CSV o editá la primera línea del CSV para que coincida con `SHOW COLUMNS FROM work_order_operations;`.

## Índice único

Existe índice único sobre `(ot_number, operation_sequence, resource_code)`. Si ya hay filas iguales, el import **fallará** por duplicado: vaciá o borrá solo las filas de prueba antes, o importá en BD limpia.

## Adminer (pasos típicos)

1. Abrí la base **`relojcontrol`** → tabla **`work_order_operations`** → **Importar**.
2. Elegí el archivo **`seed-wip-ot1-9-adminer.csv`**.
3. Formato: **CSV**, separador **`,`**, **UTF-8**, **primera línea = nombres de columnas**.
4. En el mapeo, **no** incluyas `id` (o dejalo vacío si Adminer lo pide).
5. Ejecutá el import.

## Operaciones que modifican datos

Antes de importar en un entorno compartido, conviene **detener backend/front** que usen esa BD para evitar lecturas inconsistentes durante la carga (según política del proyecto).
