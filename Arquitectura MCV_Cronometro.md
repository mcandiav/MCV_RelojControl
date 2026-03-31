# Arquitectura MCV_Cronometro
## Version 6.3 (2026-03-31)

## 1. Objetivo

Cronometro captura tiempo real de operaciones WIP y publica a NetSuite tres datos por operacion:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

Despues del push, Cronometro vuelve a leer NetSuite para mantener consistencia local.

## 2. Principio rector

La verdad operativa final yace en NetSuite.  
Cronometro es el motor de captura y consolidacion local, pero se realinea por pull.

## 3. Capas de arquitectura

### 3.1 Capa de negocio (backend)

- Control de timers: `start`, `pause`, `resume`, `stop`
- Cierre de turno
- Consolidacion de segundos/minutos y cantidades
- Reglas por area (`ME`, `ES`, `ALL`)
- Endpoints admin de sincronizacion

### 3.2 Capa de presentacion (front)

- Vista Operacion (tablero + operaciones)
- Vista Usuarios
- Vista Sistema (NetSuite y controles admin)
- Vista Sincronizacion operativa (stop -> push -> pull)

### 3.3 Capa de integracion NetSuite

- OUT: Saved Search (`customsearch_mcv_cronometro_out`)
- IN: RESTlet (`MCV_Cronometro_Restlet_In`)
- Auth: OAuth 2.0 M2M
- Push recomendado: `import_ot`

## 4. Flujo oficial de sincronizacion

### 4.1 Sincronizacion operativa manual

1. Detener relojes activos/pausados
2. Push a NetSuite
3. Espera controlada (`pull_delay_seconds`)
4. Pull + replace en tabla local WIP

### 4.2 Cierre de turno programado

- Ejecuta auto-stop
- Consolida
- Puede disparar sincronizacion segun configuracion

## 5. Modelo de datos funcional

### 5.1 Entidades principales

- `work_order_operations`
- `operation_timers`
- `timer_events`
- `operation_time_totals`

### 5.2 Reglas de datos

- Unidad funcional: operacion de OT, no cabecera OT
- Una maquina/recurso no debe tener dos operaciones activas simultaneas
- Visibilidad por area de operario
- Snapshot local WIP se puede reemplazar completo desde NetSuite

## 6. Integracion NetSuite OUT

### 6.1 Decision vigente

El OUT oficial es Saved Search. Dataset queda descartado para este caso de uso.

### 6.2 Requisito de granularidad

Debe cumplirse: **1 operacion logica = 1 fila**.

## 7. Integracion NetSuite IN y aprendizaje clave

## 7.1 Caminos evaluados

### A) Escritura directa sobre `manufacturingoperationtask`

- Problema observado: bloqueo de edicion en WIP.
- Resultado: no recomendado como canal principal.

### B) Escritura por `workordercompletion` REST

- Funciona en algunos escenarios, pero requiere resolver sublistas/line keys y permisos finos.
- Puede degradar rendimiento en lotes grandes (uno a uno).

### C) Escritura via Importacion OT (camino recomendado)

- RESTlet recibe batch.
- Agrupa por OT.
- Crea registro de staging en `customrecord_3k_importacion_ot`.
- Scripts internos NetSuite procesan y aplican al modulo operativo.

Ventajas:

- mejor throughput en lote,
- menos friccion de permisos sobre registros operativos directos,
- desacople entre captura y aplicacion final.

## 7.2 Regla de implementacion vigente

Modo push recomendado:

```env
NETSUITE_PUSH_MODE=import_ot
```

Con campos:

- `NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot`
- `NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal`
- `NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json`
- `NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha`

## 8. Controles operativos admin

En tab Sistema:

- `Detener todos` (`ALL`)
- `Detener ME`
- `Detener ES`

Backend:

- `POST /chronometer/timers/stop-batch`

Body:

```json
{ "area": "ALL" }
```

## 9. Performance y consistencia

### 9.1 Consistencia

- Nunca push parcial con timers activos si se busca foto operativa consistente.
- Siempre realinear con pull despues de publicar.

### 9.2 Performance

- `import_ot` reduce tiempo total frente a escritura directa uno-a-uno.
- Sincronizacion masiva depende de:
  - volumen de operaciones,
  - latencia NetSuite,
  - procesamiento interno de scripts NetSuite.

## 10. Decision final vigente

1. OUT por Saved Search.
2. IN por RESTlet en modo `import_ot`.
3. Flujo operativo recomendado: **Stop -> Push -> Pull(+replace)**.
4. NetSuite mantiene la verdad final y Cronometro se recalza en cada ciclo operativo.

## 11. Referencias

- `README.md`
- `NETSUITE_RESTLET_IMPORT_OT_MODE.md`
- `NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md`
- `NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`
- `cust.netsuite.md`
