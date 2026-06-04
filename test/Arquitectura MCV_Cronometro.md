# Arquitectura MCV_Cronometro
## Version 7.1 (2026-05-10)

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|---|---|---|---|---|
| 2026-05-10 | Se define sincronización parcial a `import_ot` cada 15 minutos mediante deltas, sin cambiar el cierre 16:59 ni el pull 17:02. | `import_ot` se procesa en NetSuite por batch cada 15 minutos; enviar solo al cierre deja demasiado desfase para el pull. | Cronometro debe recordar lo ya enviado entre pulls para no duplicar. NetSuite sigue siendo la verdad final después del pull. | Flujo de sincronización, contrato IN, consistencia |
| 2026-04-07 | Se agrega log persistente de sincronizaciones operativas (STOP/PUSH/WAIT/PULL) y vista admin en Reporte. | Auditoría y diagnóstico del flujo Stop -> Push -> Pull(+replace). | Nuevas tablas y endpoints; front muestra log. | Flujo de sincronización, modelo de datos, capa de presentación |
| 2026-04-05 | Se ordena la arquitectura final del proyecto y se consolida el contrato NetSuite vigente. | El proyecto ya está terminado y la documentación mezclaba decisiones históricas con vigentes. | Queda una lectura única y estable de la arquitectura final. | Objetivo, integración NetSuite, flujo operativo, referencias |
| 2026-03-31 | Se consolida el flujo Stop -> Push -> Pull(+replace). | Alinear operación y documentación. | Define la secuencia oficial de sincronización. | Flujo oficial de sincronización |
| 2026-03-28 | Se cierra la decisión de OUT por Saved Search. | Dataset no garantizaba granularidad correcta. | Se corrige la fuente de extracción NetSuite -> Cronometro. | Integración NetSuite OUT |
| 2026-03-25 | Se corrige el contrato de retorno a 3 datos reales por operación. | El retorno no podía seguir interpretándose como un único tiempo consolidado. | Se fija el contrato funcional del push. | Objetivo, principio rector, integración IN |

## 1. Objetivo

Cronometro captura tiempo real de operaciones WIP y publica a NetSuite tres datos por operación:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

Después del push/pull operativo, Cronometro vuelve a leer NetSuite para mantener consistencia local.

## 2. Principio rector

La verdad operativa final yace en NetSuite.
Cronometro es el motor de captura y consolidación local, pero se realinea por pull.

A partir de la sincronización parcial cada 15 minutos, Cronometro mantiene una memoria local temporal de lo ya enviado a `import_ot` solamente para evitar duplicados entre pulls. Esa memoria local no reemplaza la verdad de NetSuite.

## 3. Estado final de la solución

La arquitectura vigente del proyecto queda definida así:

1. **OUT por Saved Search** sobre `manufacturingoperationtask`.
2. **IN por RESTlet** en modo `import_ot`.
3. **Flujo operativo oficial de cierre:** `Stop -> Push -> Pull(+replace)`.
4. **Sincronización parcial durante el turno:** push de deltas a `import_ot` cada 15 minutos.
5. **Granularidad obligatoria de extracción:** `1 operación lógica = 1 fila`.
6. **Contrato de retorno hacia NetSuite:** 3 datos reales por operación.

Toda referencia anterior a Dataset como fuente oficial OUT debe leerse como histórica/deprecada.

## 4. Capas de arquitectura

### 4.1 Capa de negocio (backend)

- Control de timers: `start`, `pause`, `resume`, `stop`
- Cierre de turno
- Consolidación de segundos/minutos y cantidades
- Cálculo de deltas pendientes para `import_ot`
- Reglas por área (`ME`, `ES`, `ALL`)
- Endpoints admin de sincronización

### 4.2 Capa de presentación (front)

- Vista Operación (tablero + operaciones)
- Vista Usuarios
- Vista Sistema (NetSuite y controles admin)
- Vista Sincronización operativa (stop -> push -> pull)
- Vista Reporte (admin): Operaciones WIP + Log de sincronizaciones
- **Identidad visual (2026-04-05):** Vue 2 + Vuetify 2 con tema claro alineado al sitio corporativo **bignottihnos.cl** (primario `#FF5722`, secundario `#212121`, app bar `#f7f5f2`, fondo de aplicación `#F5F5F5`). Tipografías: **Lato** / **Roboto Condensed** (+ Montserrat y Roboto como respaldo), cargadas desde `front/public/index.html`. Implementación: `front/src/plugins/vuetify.js`, `front/src/styles/bignotti-brand.css`, ajustes en login, barra superior y cabecera de operación.
- Hora Chile: el front formatea hora/fechas con zona `America/Santiago` para evitar desfase por horario de invierno cuando el PC/kiosco está mal configurado.

### 4.3 Capa de integración NetSuite

- OUT: Saved Search (`customsearch_mcv_cronometro_out`)
- IN: RESTlet (`MCV_Cronometro_Restlet_In`)
- Auth: OAuth 2.0 M2M
- Push recomendado y vigente: `import_ot`

## 5. Flujo oficial de sincronización

### 5.1 Sincronización parcial durante el turno

Durante el turno, Cronometro debe enviar a `import_ot` cada 15 minutos los deltas pendientes de relojes detenidos.

Reglas:

1. No enviar relojes corriendo.
2. No enviar relojes pausados.
3. Solo considerar relojes detenidos con datos liquidables.
4. Enviar delta, nunca el acumulado total si ya hubo envíos previos.
5. El delta se calcula contra lo ya enviado desde el último pull/recalce.
6. Después de un envío exitoso, registrar lo enviado para que el próximo ciclo no lo duplique.
7. Registrar en logs locales y trazabilidad NetSuite/import_ot el payload enviado, montos enviados y resultado.

### 5.2 Sincronización operativa de cierre

El flujo actual de cierre se mantiene. No se debe cambiar su lógica general:

1. A las 16:59 el sistema detiene los relojes activos.
2. Se envía lo pendiente a `import_ot` usando la misma regla de delta.
3. A las 17:02 se ejecuta pull + replace según lógica vigente.

El pull trae la verdad completa de NetSuite en ese momento. Si la última data enviada no alcanzó a ser procesada por el batch de `import_ot`, se acepta como desfase temporal y no como corrupción de datos.

### 5.3 Pull y verdad operativa

- NetSuite sigue siendo la verdad final.
- El pull no debe usarse para calcular qué enviar durante el día.
- Cronometro usa memoria local de envíos solo para evitar duplicar deltas entre pulls.
- Después del pull, Cronometro se realinea con NetSuite.

## 6. Modelo de datos funcional

### 6.1 Entidades principales

- `work_order_operations`
- `operation_timers`
- `timer_events`
- `operation_time_totals`
- `sync_runs` (log de sincronizaciones)
- `sync_run_steps` (etapas STOP/PUSH/WAIT/PULL)
- registro/log de deltas enviados a `import_ot` (nombre físico a definir por implementación)

### 6.2 Reglas de datos

- Unidad funcional: operación de OT, no cabecera OT
- Una máquina/recurso no debe tener dos operaciones activas simultáneas
- Visibilidad por área de operario
- Snapshot local WIP se puede reemplazar completo desde NetSuite
- Para envíos parciales, se debe persistir cuánto ya fue enviado por operación/reloj desde el último pull.

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
- `import_ot` se procesa en NetSuite por batch cada 15 minutos.

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

### 9.1 Regla funcional vigente: deltas para `import_ot`

Para `import_ot`, Cronometro debe enviar **deltas**, no acumulados totales ya enviados.

Motivo: NetSuite suma/aplica lo que recibe por `import_ot`. Si Cronometro vuelve a enviar un acumulado completo que ya tuvo envíos previos, NetSuite duplicará horas/cantidades.

Fórmula obligatoria:

```text
delta_a_enviar = acumulado_actual_del_dia - acumulado_ya_enviado_desde_el_ultimo_pull
```

Esta regla aplica a todo emisor:

- sincronización parcial cada 15 minutos,
- cierre de turno 16:59,
- cualquier reintento manual/admin.

No debe existir un camino que envíe acumulado total saltándose el cálculo de delta.

### 9.2 Ejemplo obligatorio para programador

Caso: OT1 / Operación 4 / Requerido 100 min / Cantidad 0.

```text
10:00 reloj detenido
acumulado del día = 25 min
ya enviado desde último pull = 0 min
delta = 25 - 0 = 25
se envía a import_ot: 25
se registra ya enviado = 25
```

Luego el operario vuelve a ejecutar la misma operación:

```text
12:00 reloj detenido
acumulado del día = 35 min
ya enviado desde último pull = 25 min
delta = 35 - 25 = 10
se envía a import_ot: 10
se registra ya enviado = 35
```

Cierre de turno:

```text
16:59 sistema detiene todos los relojes
acumulado del día = 49 min
ya enviado desde último pull = 35 min
delta = 49 - 35 = 14
se envía a import_ot: 14
se registra ya enviado = 49
```

Resultado esperado en NetSuite después de procesar los batch:

```text
25 + 10 + 14 = 49 min
```

Error que debe evitarse:

```text
Enviar 25, luego 35, luego 49.
Eso duplicaría porque NetSuite sumaría 109 min.
```

### 9.3 Cantidades

La misma regla aplica a cantidades si la cantidad se informa como acumulado diario:

```text
delta_cantidad = cantidad_actual_acumulada - cantidad_ya_enviada_desde_el_ultimo_pull
```

Si la interfaz cambia en el futuro para capturar “cantidad del tramo”, ese valor ya sería delta. Mientras la pantalla maneje acumulado, se debe calcular diferencia.

### 9.4 Trazabilidad de lo enviado

Cada envío a `import_ot` debe quedar trazable localmente y en NetSuite/import_ot:

- operación/OT/secuencia,
- empleado/recurso si aplica,
- acumulado actual usado para calcular,
- acumulado ya enviado,
- delta enviado,
- payload JSON exacto enviado,
- fecha/hora del envío,
- resultado del RESTlet,
- identificador de registro `customrecord_3k_importacion_ot` si NetSuite lo devuelve,
- error si falla.

Esta trazabilidad es necesaria porque entre pulls Cronometro debe saber qué ya envió para no reenviar lo mismo.

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

- NetSuite mantiene la verdad final.
- El pull trae la verdad completa disponible al momento de consultar NetSuite.
- Puede existir desfase si el último `import_ot` aún no fue procesado por el batch de NetSuite.
- Durante el día, Cronometro evita duplicados con memoria local de deltas enviados.
- El pull posterior realinea el snapshot local contra NetSuite.

### 11.2 Performance

- `import_ot` reduce tiempo total frente a escritura directa uno a uno.
- La sincronización parcial cada 15 minutos reduce el desfase acumulado al cierre.
- La sincronización masiva depende de:
  - volumen de operaciones,
  - latencia NetSuite,
  - procesamiento interno de scripts NetSuite.

## 12. Decisión final vigente

1. OUT por Saved Search.
2. IN por RESTlet en modo `import_ot`.
3. Durante el turno, enviar deltas a `import_ot` cada 15 minutos para reducir desfase.
4. Mantener cierre 16:59 y pull 17:02 como flujo vigente.
5. NetSuite mantiene la verdad final y Cronometro se recalza en cada pull operativo.
6. Dataset OUT queda como referencia histórica, no como fuente oficial vigente.

## 13. Fuera de alcance inmediato

La población de `ZIM - Data Reloj Control` queda fuera de este cambio.
Una vez estabilizado el envío de deltas a `import_ot`, ZIM podrá evaluarse como consumidor secundario del mismo bloque/delta validado.

## 14. Referencias

- `README.md`
- `NETSUITE_RESTLET_IMPORT_OT_MODE.md`
- `NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md`
- `NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`
- `cust.netsuite.md`
