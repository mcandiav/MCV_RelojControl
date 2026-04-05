# Arquitectura MCV_Cronometro
## Version 7.0 (2026-04-05)

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|---|---|---|---|---|
| 2026-04-05 | Se ordena la arquitectura final del proyecto y se consolida el contrato NetSuite vigente. | El proyecto ya está terminado y la documentación mezclaba decisiones históricas con vigentes. | Queda una lectura única y estable de la arquitectura final. | Objetivo, integración NetSuite, flujo operativo, referencias |
| 2026-03-31 | Se consolida el flujo Stop -> Push -> Pull(+replace). | Alinear operación y documentación. | Define la secuencia oficial de sincronización. | Flujo oficial de sincronización |
| 2026-03-28 | Se cierra la decisión de OUT por Saved Search. | Dataset no garantizaba granularidad correcta. | Se corrige la fuente de extracción NetSuite -> Cronometro. | Integración NetSuite OUT |
| 2026-03-25 | Se corrige el contrato de retorno a 3 datos reales por operación. | El retorno no podía seguir interpretándose como un único tiempo consolidado. | Se fija el contrato funcional del push. | Objetivo, principio rector, integración IN |

## 1. Objetivo

Cronometro captura tiempo real de operaciones WIP y publica a NetSuite tres datos por operación:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

Después del push, Cronometro vuelve a leer NetSuite para mantener consistencia local.

## 2. Principio rector

La verdad operativa final yace en NetSuite.
Cronometro es el motor de captura y consolidación local, pero se realinea por pull.

## 3. Estado final de la solución

La arquitectura vigente y final del proyecto queda definida así:

1. **OUT por Saved Search** sobre `manufacturingoperationtask`.
2. **IN por RESTlet** en modo `import_ot`.
3. **Flujo operativo oficial:** `Stop -> Push -> Pull(+replace)`.
4. **Granularidad obligatoria de extracción:** `1 operación lógica = 1 fila`.
5. **Contrato de retorno hacia NetSuite:** 3 datos reales por operación.

Toda referencia anterior a Dataset como fuente oficial OUT debe leerse como histórica/deprecada.

## 4. Capas de arquitectura

### 4.1 Capa de negocio (backend)

- Control de timers: `start`, `pause`, `resume`, `stop`
- Cierre de turno
- Consolidación de segundos/minutos y cantidades
- Reglas por área (`ME`, `ES`, `ALL`)
- Endpoints admin de sincronización

### 4.2 Capa de presentación (front)

- Vista Operación (tablero + operaciones)
- Vista Usuarios
- Vista Sistema (NetSuite y controles admin)
- Vista Sincronización operativa (stop -> push -> pull)
- **Identidad visual (2026-04-05):** Vue 2 + Vuetify 2 con tema claro alineado al sitio corporativo **bignottihnos.cl** (primario `#FF5722`, secundario `#212121`, app bar `#f7f5f2`, fondo de aplicación `#F5F5F5`). Tipografías: **Lato** / **Roboto Condensed** (+ Montserrat y Roboto como respaldo), cargadas desde `front/public/index.html`. Implementación: `front/src/plugins/vuetify.js`, `front/src/styles/bignotti-brand.css`, ajustes en login, barra superior y cabecera de operación.

### 4.3 Capa de integración NetSuite

- OUT: Saved Search (`customsearch_mcv_cronometro_out`)
- IN: RESTlet (`MCV_Cronometro_Restlet_In`)
- Auth: OAuth 2.0 M2M
- Push recomendado y vigente: `import_ot`

## 5. Flujo oficial de sincronización

### 5.1 Sincronización operativa manual

1. Detener relojes activos/pausados
2. Push a NetSuite
3. Espera controlada (`pull_delay_seconds`)
4. Pull + replace en tabla local WIP

### 5.2 Cierre de turno programado

- Ejecuta auto-stop
- Consolida
- Puede disparar sincronización según configuración

## 6. Modelo de datos funcional

### 6.1 Entidades principales

- `work_order_operations`
- `operation_timers`
- `timer_events`
- `operation_time_totals`

### 6.2 Reglas de datos

- Unidad funcional: operación de OT, no cabecera OT
- Una máquina/recurso no debe tener dos operaciones activas simultáneas
- Visibilidad por área de operario
- Snapshot local WIP se puede reemplazar completo desde NetSuite

## 7. Integración NetSuite OUT

### 7.1 Decisión vigente y final

El OUT oficial es una **Saved Search**.
Dataset queda descartado como fuente oficial para este caso de uso.

### 7.2 Fuente oficial

- Saved Search ID: `customsearch_mcv_cronometro_out`
- Saved Search UI: `823`
- Título visible: `BG - Control de HH por OT Detalle VF - CARGA`
- Tipo base: `manufacturingoperationtask`
- Filtro operativo: `Estado = En curso` (`PROGRESS`)

### 7.3 Requisito de granularidad

Debe cumplirse siempre:

- **1 operación lógica = 1 fila**

### 7.4 Contrato funcional que NetSuite entrega a Cronometro

Por cada operación activa, NetSuite entrega:

- `Orden de trabajo`
- `Secuencia de operaciones`
- `Centro de trabajo de fabricación`
- `CONFIGURACION RUTA`
- `EJECUCION RUTA`
- `Cantidad de entrada`
- `Estado`
- `Nombre de la operación`

### 7.5 Mapeo funcional recomendado

| Columna NetSuite | Campo interno recomendado |
|---|---|
| `Orden de trabajo` | `ot_number` |
| `Secuencia de operaciones` | `operation_sequence` |
| `Centro de trabajo de fabricación` | `resource_code` |
| `CONFIGURACION RUTA` | `planned_setup_minutes` |
| `EJECUCION RUTA` | `planned_run_minutes_per_unit` |
| `Cantidad de entrada` | `planned_quantity` |
| `Estado` | `source_status` |
| `Nombre de la operación` | `operation_name` |

### 7.6 Significado funcional del contrato OUT

NetSuite entrega a Cronometro tres datos planificados clave por operación:

1. tiempo planificado de configuración,
2. tiempo planificado de ejecución por unidad,
3. cantidad planificada.

Además entrega los identificadores operativos necesarios para ubicar cada operación dentro del universo WIP.

### 7.7 Área operativa

La separación `ME` / `ES` depende del recurso o centro de trabajo.
La documentación histórica deja trazas de dos variantes de implementación:

- columna `AREA` dentro de la Saved Search,
- derivación desde el prefijo del recurso.

Como la arquitectura del proyecto ya está cerrada, esto se considera un detalle de implementación histórica que no altera el contrato principal.

## 8. Integración NetSuite IN

### 8.1 Caminos evaluados

#### A) Escritura directa sobre `manufacturingoperationtask`

- Problema observado: bloqueo de edición en WIP.
- Resultado: descartado como canal principal.

#### B) Escritura por `workordercompletion` REST

- Posible en algunos escenarios, pero más sensible a permisos, sublistas y rendimiento.
- Resultado: descartado como canal principal de alto volumen.

#### C) Escritura vía Importación OT

- RESTlet recibe batch.
- Agrupa por OT.
- Crea registro de staging en `customrecord_3k_importacion_ot`.
- Scripts internos de NetSuite procesan y aplican al módulo operativo.

### 8.2 Regla de implementación vigente

Modo push recomendado:

```env
NETSUITE_PUSH_MODE=import_ot
```

Con campos:

- `NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot`
- `NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal`
- `NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json`
- `NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha`

## 9. Contrato de retorno desde Cronometro hacia NetSuite

Cronometro publica tres datos reales por operación:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

### Regla funcional clave

- El envío es por **overwrite del valor vigente**.
- No se envían deltas.
- Después del push, Cronometro vuelve a hacer pull para recalzar el estado local.

## 10. Controles operativos admin

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

## 11. Performance y consistencia

### 11.1 Consistencia

- Nunca hacer push parcial si se busca foto operativa consistente.
- Siempre realinear con pull después de publicar.
- La extracción debe mantener unicidad efectiva por operación lógica.

### 11.2 Performance

- `import_ot` reduce tiempo total frente a escritura directa uno a uno.
- La sincronización masiva depende de:
  - volumen de operaciones,
  - latencia NetSuite,
  - procesamiento interno de scripts NetSuite.

## 12. Decisión final vigente

1. OUT por Saved Search.
2. IN por RESTlet en modo `import_ot`.
3. Flujo operativo oficial: **Stop -> Push -> Pull(+replace)**.
4. NetSuite mantiene la verdad final y Cronometro se recalza en cada ciclo operativo.
5. Dataset OUT queda como referencia histórica, no como fuente oficial vigente.

## 13. Referencias

- `README.md`
- `NETSUITE_RESTLET_IMPORT_OT_MODE.md`
- `NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md`
- `NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`
- `cust.netsuite.md`
