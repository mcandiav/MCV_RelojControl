# MCV_RelojControl / Cronometro (Sandbox)

Repositorio de trabajo para Cronometro conectado con NetSuite (sandbox).

## Estado actual (2026-03-31)

- Fuente OUT oficial: `savedsearch` (`customsearch_mcv_cronometro_out`).
- Push IN oficial: RESTlet `MCV_Cronometro_Restlet_In` (script `1271`, deploy `1`).
- Modo de push recomendado: `import_ot` (rapido, por lotes agrupados por OT).
- Fuente de verdad operativa: **NetSuite**.
- Flujo operativo recomendado: **Stop -> Push -> Pull(+replace)**.

## Regla de negocio clave

Cronometro publica 3 datos reales por operacion:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

Luego Cronometro vuelve a sincronizar desde NetSuite para recalzar el estado local.

## Integracion NetSuite

### OUT (NetSuite -> Cronometro)

- Tipo: Saved Search
- ID: `customsearch_mcv_cronometro_out`
- Filtro operativo: operaciones en curso (WIP)
- Granularidad obligatoria: **1 operacion logica = 1 fila**

### IN (Cronometro -> NetSuite)

- Tipo: RESTlet
- URL base: `NETSUITE_RESTLET_IN_URL`
- Modo recomendado: `NETSUITE_PUSH_MODE=import_ot`
- Staging record: `customrecord_3k_importacion_ot`

## Lo que aprendimos para actualizar ordenes desde otro modulo de NetSuite

### 1. Actualizacion directa de `manufacturingoperationtask` en WIP

- Resultado: bloqueos funcionales y de permisos en varias OTs en curso.
- Error tipico: "No puede editar la tarea de operacion de fabricacion despues de que se haya iniciado la orden de trabajo."
- Conclusion: no usar como camino principal para produccion.

### 2. Actualizacion via `workordercompletion` (REST)

- Tecnicamente posible, pero:
  - requiere resolver linea de sublista (`operation` line key),
  - puede requerir campos adicionales (operacion inicio/fin),
  - es mas sensible a permisos,
  - y suele ser mas lenta cuando se procesa una a una.
- Conclusion: util para pruebas y casos puntuales, no ideal como canal principal de alto volumen.

### 3. Actualizacion via modulo Importacion OT (recomendado en este proyecto)

- Cronometro envia lotes al RESTlet IN.
- El RESTlet agrupa por OT y crea registros en `customrecord_3k_importacion_ot`.
- Scripts de NetSuite procesan esos registros y aplican cambios al modulo operativo.
- Ventajas:
  - mejor performance en lote,
  - menos friccion de permisos por registro operativo,
  - desacople entre captura de cronometro y aplicacion final en NetSuite.

### 4. Leccion critica de tiempos

- En el flujo con Importacion OT, enviar acumulados mal definidos puede duplicar valores si el lado NetSuite suma.
- Regla final del proyecto:
  - Cronometro controla su logica de consolidacion.
  - El push debe enviar los campos en el formato esperado por el flujo NetSuite activo.
  - Despues del push, ejecutar pull para recalzar estado real.

## Sincronizacion operativa (admin)

Endpoint:

- `POST /chronometer/netsuite/sync-operational`

Secuencia:

1. detener relojes activos/pausados,
2. push a NetSuite,
3. esperar (`pull_delay_seconds`),
4. pull + replace WIP.

## Controles admin en Sistema

Disponibles en UI (tab Sistema):

- Detener todos los relojes (`ALL`)
- Detener relojes de `ME`
- Detener relojes de `ES`

Endpoint backend:

- `POST /chronometer/timers/stop-batch`
  - body: `{ "area": "ALL" | "ME" | "ES" }`

## Variables de entorno relevantes (API)

```env
NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out

NETSUITE_PUSH_MODE=import_ot
NETSUITE_RESTLET_IN_URL=https://.../restlet.nl?script=1271&deploy=1
NETSUITE_RESTLET_IN_SCRIPT_ID=customscriptmcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy1

NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha
```

## Deploy rapido

1. Push a GitHub (rama `V2`).
2. Rebuild `reloj-api` y `reloj-front` en EasyPanel.
3. Hard refresh navegador (`Ctrl+F5`).

## Documentos relacionados

- [Arquitectura MCV_Cronometro.md](./Arquitectura%20MCV_Cronometro.md)
- [NETSUITE_RESTLET_IMPORT_OT_MODE.md](./NETSUITE_RESTLET_IMPORT_OT_MODE.md)
- [NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md](./NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md)
- [NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md](./NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md)
- [cust.netsuite.md](./cust.netsuite.md)
