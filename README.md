# MCV_RelojControl / Cronometro

README oficial y consolidado del proyecto. Este archivo es la fuente documental principal para programacion, diagnostico, despliegue, operacion y validacion funcional del Cronometro.

Toda informacion relevante de documentos sueltos del directorio `cronometro/` queda consolidada aqui. Los documentos separados deben leerse como historicos o auxiliares hasta que el equipo decida eliminarlos del repositorio.

## Bitacora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Seccion afectada |
|---|---|---|---|---|
| 2026-05-07 | Se agrega requerimiento de mensaje operacional cuando una operacion ya fue lanzada o pausada desde otro terminal. | Evitar que el usuario vea errores tecnicos en ingles como `Only active timers can change mode.` y explicar como liberar la operacion. | El front/backend deben mostrar un mensaje funcional claro y el supervisor debe poder liberar la operacion. | Terminal compartida, mensajes operativos, control de timers |
| 2026-05-07 | Se agrega directorio de variables de entorno EasyPanel para PROD y SB, separado por servicio `front` y `backend`. | Evitar ambiguedad al configurar despliegues y asegurar que cada ambiente tenga variables claras sin hardcodear secretos en el repo. | Deja bloques listos para copiar como referencia en EasyPanel, usando placeholders para secretos. | Variables de entorno EasyPanel |
| 2026-05-07 | Se consolida en `README.md` la informacion funcional, tecnica, historica y operativa dispersa en documentos sueltos del proyecto. | Evitar duplicidad documental y confusion entre arquitectura vigente, alternativas historicas y pruebas. | `README.md` pasa a ser la unica fuente documental oficial del proyecto. | Todo el documento |
| 2026-05-07 | Se agrega candado de consistencia antes del pull para esperar el procesamiento `Importacion OT` / MapReduce TEK, con timeout y warning operativo. | En pruebas reales se detecto que el deployment `customdeploy_3k_procesar_imp_ot_mr_prog` corre cada 15 minutos y puede dejar una foto intermedia si el pull ocurre antes de terminar. | El pull no se cancela; si `import_ot` no termina dentro del timeout, se ejecuta igualmente con warning critico para recalzar contadores locales y evitar duplicar/triplicar datos. | Flujo oficial de sincronizacion, Integracion NetSuite IN, Consistencia |
| 2026-05-05 | Se agrega requerimiento de visibilidad operativa por rol: el operario no debe ver listado general de OTs; solo debe ver operaciones de la OT que digita. El administrador si debe poder ver todas las OTs. | Evitar que el operario seleccione por error una operacion que no corresponde a la carpeta fisica que tiene en mano. | Requiere ajustar frontend y, si aplica, backend para diferenciar carga inicial y visibilidad segun rol. Tambien reduce carga inicial para operarios. | Requisito critico: visibilidad de OTs por rol |
| 2026-05-05 | Se agrega requerimiento critico de funcionamiento offline y diagnostico obligatorio por dependencia externa detectada contra `cdn.jsdelivr.net`. | Los computadores que usan el Cronometro pueden no tener acceso a internet; se observo intento de conexion a CDN externo. | El programador debe diagnosticar y eliminar dependencias obligatorias de internet si existen, empaquetando recursos localmente. | Requisito critico offline / dependencias externas, Frontend |
| 2026-05-04 | Ajuste final de tablero 2x2 en V3: barra visual capada en 100% y etiqueta con porcentaje real, leyenda centrada en una linea y nombre completo de operario. Popup de cantidad solo al detener EJECUCION. | Cerrar definicion visual/funcional acordada para paso a productivo. | Requiere deploy de front en V3 para reflejar reglas finales del tablero operativo. | `front/src/views/Home.vue` |
| 2026-04-20 | Se publica V3 con mejora de Reporte admin: nueva pestana Log NetSuite para comparacion directa por operacion. | Facilitar validacion de paralelo preproduccion y contraste 1:1 contra NetSuite. | Requiere deploy de backend + front en la misma rama (`V3`). | Backend, front, logs |
| 2026-04-19 | Se aclara y consolida el modo real de push NetSuite vigente: backend `NETSUITE_PUSH_MODE=restlet` y RESTlet interno `import_ot_via_restlet` con staging en `customrecord_3k_importacion_ot`. | Habia ambiguedad entre documentacion consolidada, `.env` real y script vigente en NetSuite. | Queda una sola lectura correcta del flujo IN. | Integracion NetSuite |
| 2026-04-19 | Decision ejecutiva operativa: no aplicar cambios de app por ahora. Se mantiene la configuracion vigente porque `reloj.at-once.cl` y `reloj-sb.at-once.cl` ya operan correctamente. | Priorizar estabilidad y evitar regresiones al cierre de validacion SB/PROD. | Documentacion actualizada; sin cambios de codigo ni despliegue funcional inmediato. | Estado actual, dominios y despliegue |
| 2026-04-19 | Se fija decision arquitectonica de una sola version cerrada para SB y PROD, con diferencias solo por configuracion de entorno. | Evitar bifurcacion SB vs PROD. | El frontend debe resolver URL del API por configuracion del despliegue, no por dominio fijo versionado. | Entornos, Frontend, despliegue |
| 2026-04-07 | Se agrega Reporte admin con vistas Operaciones WIP y Log de sincronizaciones. | Auditoria y diagnostico de sincronizaciones. | Requiere rebuild/redeploy backend + front; crea tablas nuevas en MariaDB via `db.sync({ alter: true })`. | Backend, modelos, frontend |
| 2026-04-07 | Se fija formateo de hora/fechas a Chile (`America/Santiago`) en la UI. | Evitar desfase por cambio de horario o PC/kiosco mal configurado. | Afecta visualizacion. | Frontend |
| 2026-04-05 | El front adopta paleta, tipografias y cabecera alineadas al sitio corporativo bignottihnos.cl. | Unificar marca visual. | Solo capa de presentacion. | Vuetify, CSS global, login, appbar, Home |
| 2026-04-05 | Se ordena la documentacion final del proyecto y se consolida el contrato NetSuite vigente. | El proyecto mezclaba referencias historicas con vigentes. | Se aclara fuente OUT oficial, contrato de datos y flujo operativo final. | Estado actual, integracion NetSuite |
| 2026-03-31 | Se consolida el flujo operativo oficial Stop -> Push -> Pull(+replace). | Alinear operacion real con documentacion. | Define el orden recomendado. | Sincronizacion operativa |
| 2026-03-28 | Se cambia fuente OUT oficial de Dataset a Saved Search. | Dataset no reproducia correctamente la granularidad requerida. | Extraccion NetSuite -> Cronometro queda alineada con 1 operacion logica = 1 fila. | Integracion NetSuite OUT |
| 2026-03-25 | Se corrige contrato de retorno hacia NetSuite a 3 datos reales por operacion. | Evitar simplificacion incorrecta de un tiempo consolidado unico. | Define correctamente el push funcional hacia NetSuite. | Regla de negocio clave |

## Estado actual final

- Proyecto en baseline funcional `V3`.
- Debe existir una sola version cerrada del programa para sandbox y productivo.
- Las diferencias entre SB y PROD deben vivir solo en configuracion de entorno, secretos, dominios, credenciales y parametros operativos.
- Fuente OUT oficial: Saved Search `customsearch_mcv_cronometro_out`.
- Push IN externo oficial: RESTlet `MCV_Cronometro_Restlet_In`.
- Modo real vigente de push: backend `NETSUITE_PUSH_MODE=restlet` + NetSuite `import_ot_via_restlet`.
- Staging record vigente: `customrecord_3k_importacion_ot`.
- Procesamiento posterior vigente: Map/Reduce `customscript_3k_procesar_imp_ot_mr`, deployment `customdeploy_3k_procesar_imp_ot_mr_prog`.
- Fuente de verdad operativa: NetSuite.
- Flujo operativo final: `Stop -> Push -> Gate Import OT -> Pull(+replace)`.

## Principios rectores

1. NetSuite es la verdad operativa final.
2. Cronometro captura, consolida y publica datos reales por operacion.
3. Despues del push, Cronometro debe recalzar su estado local con pull desde NetSuite.
4. El pull no debe cancelarse definitivamente, porque tambien evita que contadores locales ya enviados se dupliquen o tripliquen en un push posterior.
5. La unidad funcional es la operacion de OT, no la cabecera de OT.
6. La arquitectura vigente es una sola para SB y PROD; las diferencias son de entorno.
7. No se deben versionar secretos reales, private keys ni certificados privados.

## Regla de versionado

La decision tecnica de que archivos se versionan en Git la define el equipo de desarrollo, usando buenas practicas de repositorio. La validacion funcional y de negocio la define el responsable del proyecto.

Criterio por defecto:

- Se versiona: codigo fuente, configuraciones no secretas, scripts, documentacion, `package.json` y lockfiles.
- No se versiona: archivos generados (`node_modules`, `build`, `dist`, caches), binarios temporales y secretos (`.env`, llaves, certificados privados).

## Entornos, dominios y despliegue

### Regla de una sola version

No se debe mantener una version SB y otra version PROD del frontend o backend. El mismo codigo debe operar en ambos entornos.

Las diferencias entre entornos deben vivir solo en variables de entorno, secretos del despliegue, dominios, credenciales de integracion y parametros operativos propios del entorno.

### Dominios frontend oficiales

- Sandbox: `reloj-sb.at-once.cl`
- Productivo: `reloj.at-once.cl`

### URL API operativa vigente

- API vigente para operacion actual: `https://reloj-api.at-once.cl/`
- Frontend productivo: `https://reloj.at-once.cl`
- Frontend sandbox: `https://reloj-sb.at-once.cl`
- Estado: se mantiene sin cambios por estabilidad.

### Repositorios y ramas

- Repo produccion historico: `mcandiav/RelojControl`.
- Repo sandbox / vigente: `mcandiav/MCV_RelojControl`.
- Rama de trabajo sandbox y baseline funcional: `V3`.
- `main` debe alinearse al mismo commit final probado en `V3` al cerrar paso a productivo.

### Infraestructura

- EasyPanel.
- Docker.
- MariaDB para sandbox/despliegue actual.
- nginx Alpine como servidor del frontend compilado.
- Proxy administrado por plataforma.

### Desarrollo local

El API Express escucha en puerto fijo `8000`.

| Componente | Puerto / URL |
|---|---|
| Backend Node | `http://localhost:8000` |
| Front dev Vue CLI | normalmente `http://localhost:8080` |
| Proxy dev front -> API | `front/vue.config.js` debe apuntar a `http://localhost:8000` |
| Fallback axios local | `http://localhost:8000/` via `VUE_APP_API_URL` |

No usar `4000` para backend en documentacion, proxy ni ejemplos.

## Arquitectura tecnica vigente

### Frontend

- Vue.js 2.
- Vuetify 2.
- Vuex.
- nginx Alpine para servir build.
- Tema visual claro alineado a marca Bignotti.
- Hora y fechas formateadas en zona `America/Santiago`.

### Backend

- Node.js 16.
- Express.
- Sequelize ORM.
- JWT para autenticacion.
- Endpoints de operacion, administracion y sincronizacion NetSuite.

### Base de datos

- MariaDB en sandbox / despliegue Docker.
- Modelos principales:
  - `work_order_operations`
  - `operation_timers`
  - `timer_events`
  - `operation_time_totals`
  - `sync_runs`
  - `sync_run_steps`
  - `users`
  - `roles`
  - `workplaces`
  - `shift_close_slots`

### Reporte admin y logs

En la pestana Reporte, solo administradores:

- Operaciones: listado WIP, estado de cronometro y sync pendiente.
- Sincronizaciones: log persistente de STOP / PUSH / GATE / PULL.
- Log NetSuite: comparacion por operacion entre base, enviado y NetSuite para tiempo de montaje, ejecucion y cantidad.

Endpoints admin relacionados:

- `GET /chronometer/netsuite/sync-runs`
- `GET /chronometer/netsuite/sync-runs/:id`
- `GET /chronometer/netsuite/push-log`

## Requisitos funcionales de UI y operacion

### Visibilidad de OTs por rol

#### Operario

El operario no debe ver un listado general de OTs ni operaciones al iniciar sesion. Solo debe ver buscador de OT.

Comportamiento esperado:

1. Al entrar, la seccion de operaciones debe estar vacia o indicar: `Digite una OT para ver sus operaciones`.
2. No debe ejecutarse carga automatica de todas las operaciones del area.
3. No debe mostrarse tabla general de OTs/operaciones antes de buscar.
4. Al digitar una OT, se muestran solo las operaciones correspondientes a esa OT y permitidas para su perfil/area.
5. Si la OT no existe, no esta cargada o no corresponde al area/perfil, debe mostrarse mensaje claro.
6. Al limpiar el buscador, vuelve al estado vacio/instruccional.

#### Administrador

El administrador puede ver listado general de operaciones WIP, buscar OT especifica, acceder a reportes/sincronizacion/usuarios/sistema/diagnosticos y ver todas las OTs necesarias para administracion, control, soporte y validacion.

### Tablero operativo V3

- Vista operativa 2x2: 4 cuadrantes por pantalla.
- Jerarquia visual centrada: tiempo principal grande, operador menor, barra destacada y leyenda menor.
- Colores por porcentaje planificado:
  - Verde: menor a 90%.
  - Amarillo: mayor o igual a 90% y menor a 100%.
  - Rojo: mayor o igual a 100%.
- Barra visual capada en 100%, etiqueta puede mostrar sobrecumplimiento real.
- Leyenda de colores en una sola linea y centrada.
- Al detener MONTAJE no se muestra popup de cantidad terminada.
- Popup de cantidad terminada solo al detener EJECUCION.

### Terminal compartida

- El front envia `x-station-id` en todas las peticiones.
- Se genera en `localStorage` como `reloj_station_id` por navegador.
- Opcionalmente puede fijarse por entorno con `VUE_APP_STATION_ID`.
- El tablero de cronometros activos filtra por `station_id`, no solo por usuario.
- Pausa, stop, resume y play sobre un timer en pausa deben rechazar otra terminal con `403`.
- Tablero protector lista tareas activas/pausadas de la terminal.
- Vista 2x2 con carrusel si hay mas de 4.
- Variables opcionales: `VUE_APP_IDLE_BOARD_SLOTS`, `VUE_APP_IDLE_BOARD_CAROUSEL_SEC`.

### Mensaje obligatorio para operacion tomada por otro terminal

Cuando el usuario intenta operar una tarea cuyo cronometro ya fue lanzado o pausado desde otro terminal, el sistema no debe mostrar errores tecnicos en ingles como:

```text
Only active timers can change mode.
Only paused timers can be resumed.
Este cronómetro pertenece a otra terminal.
```

El front debe mostrar este mensaje funcional:

```text
Esta operación ya fue lanzada o pausada en otro terminal. Debe detenerla en el terminal original para liberarla. El supervisor también puede liberarla.
```

Condiciones donde debe aplicarse el mensaje:

1. El backend devuelve que el timer pertenece a otra terminal.
2. El usuario intenta cambiar modo MONTAJE/EJECUCION sobre un timer que ya no esta `ACTIVE` por estar pausado o detenido desde otra terminal.
3. El usuario intenta reanudar, pausar, detener o cambiar modo sobre una operacion cuyo `station_id` no corresponde a la terminal actual.
4. El front conserva un estado visual antiguo y el backend rechaza la accion porque el timer ya cambio de estado.

Criterio de implementacion:

- El backend puede devolver un codigo de error funcional estable, por ejemplo `TIMER_LOCKED_BY_OTHER_TERMINAL`.
- El front debe mapear ese codigo y tambien los mensajes tecnicos legacy al texto funcional definido.
- El mensaje debe mostrarse en español y no como alert tecnico del navegador.
- El supervisor/admin debe tener una accion clara para liberar/detener la operacion desde la vista administrativa o tablero de supervisor.

Criterio de aceptacion:

1. Un operario no ve `Only active timers can change mode.`.
2. Un operario no ve `Only paused timers can be resumed.`.
3. Un operario no ve mensajes tecnicos en ingles asociados al lock de terminal.
4. El mensaje mostrado es exactamente:

```text
Esta operación ya fue lanzada o pausada en otro terminal. Debe detenerla en el terminal original para liberarla. El supervisor también puede liberarla.
```

5. El supervisor/admin puede identificar y liberar la operacion.

### Funcionamiento offline

Los computadores donde se utiliza Cronometro pueden no tener acceso a internet. La aplicacion debe iniciar y operar completamente offline.

No deben existir dependencias obligatorias a:

- `cdn.jsdelivr.net`
- `unpkg.com`
- `cdnjs.cloudflare.com`
- `fonts.googleapis.com`
- `fonts.gstatic.com`
- `ajax.googleapis.com`
- cualquier CDN externo para scripts, estilos, fuentes, iconos o assets necesarios.

Referencias detectadas que deben eliminarse o empaquetarse localmente:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@latest/css/materialdesignicons.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">
```

Criterio de aceptacion:

1. Cronometro carga en equipo sin internet.
2. Interfaz completa, sin pantalla blanca.
3. Funciones principales operan: iniciar, pausar, reanudar, detener, reiniciar y sincronizar.
4. No hay intentos obligatorios de conexion a CDNs externos.
5. No hay errores criticos por recursos externos no cargados.

## Integracion NetSuite - resumen oficial

### Autenticacion

- OAuth 2.0 M2M / Client Credentials.
- Pull y push usan el mismo bloque OAuth M2M.
- Rol tecnico: `MCV_Cronometro_Rol`.
- RESTlets y REST Web Services deben estar habilitados.
- NetSuite recibe certificado publico; Cronometro conserva private key.
- `NETSUITE_CERTIFICATE_ID` es el `kid` exacto de la credencial OAuth2 Client Credentials, no el ID de aplicacion ni el nombre del archivo.

Regla critica:

```text
Si pull funciona, OAuth M2M funciona. Si solo falla push, revisar RESTlet, permisos, payload, custom record, script o deployment; no tocar primero la M2M.
```

### Checklist NetSuite por ambiente

1. Features habilitadas: Servicios web REST, OAuth 2.0, Client Credentials / Machine to Machine, SuiteScript 2.1 y RESTlets.
2. Integration Record M2M activo con scopes requeridos.
3. Credencial OAuth2 Client Credentials activa con entidad tecnica, rol tecnico, aplicacion M2M, certificado publico correcto y `kid` copiado exactamente.
4. Rol tecnico asignado a la entidad M2M.
5. Rol con permisos sobre Work Order, Buscar transaccion, RESTlets y Custom record `Importacion OT`.
6. RESTlet IN desplegado y liberado.
7. Custom record `Importacion OT` con acceso apto para roles internos.
8. Pull validado despues de token OK.
9. Push validado con dry run antes de envio real.

## Integracion NetSuite OUT - NetSuite hacia Cronometro

### Decision vigente

La fuente OUT oficial es una Saved Search tecnica, no un Dataset.

- ID oficial: `customsearch_mcv_cronometro_out`
- Saved Search UI: `823`
- Titulo visible: `BG - Control de HH por OT Detalle VF - CARGA`
- Tipo: `Tarea de operacion de fabricacion` / `manufacturingoperationtask`
- Filtro operativo: solo operaciones en curso (`PROGRESS`)
- Regla de granularidad: `1 operacion logica = 1 fila`

### Motivo del cambio desde Dataset

Se descarto Dataset porque no reproducia correctamente la granularidad requerida:

- Root `Tiempo planificado de fabricacion`: multiplicaba una misma operacion logica en varias filas.
- Root `Ruta de fabricacion`: representa plantilla/ruta, no universo WIP real.
- Root `Transaccion de fabricacion`: mezcla ramas y no reprodujo el universo real de operaciones en curso.

### Campos OUT esperados

| Columna Saved Search | Field ID tecnico / referencia | Campo interno recomendado |
|---|---|---|
| Orden de trabajo | `workOrder` | `ot_number` |
| Secuencia de operaciones | `operationSequence` | `operation_sequence` |
| Centro de trabajo de fabricacion | `manufacturingWorkCenter` | `resource_code` / `workcenter_id` |
| CONFIGURACION RUTA | `setupTime` | `planned_setup_minutes` |
| EJECUCION RUTA | `runRate` | `planned_run_minutes_per_unit` |
| Cantidad de entrada | `inputQuantity` | `planned_quantity` |
| Estado | `status` | `source_status` |
| Nombre de la operacion | `title` | `operation_name` |
| AREA | Formula texto | `area` |

Formula sugerida para AREA si se requiere:

```sql
CASE
  WHEN UPPER({manufacturingworkcenter.name}) LIKE 'ES%' THEN 'ES'
  WHEN UPPER({manufacturingworkcenter.name}) LIKE 'ME%' THEN 'ME'
  ELSE NULL
END
```

### Variables OUT

```env
NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
NETSUITE_OUT_SAVEDSEARCH_NAME=BG - Control de HH por OT Detalle VF - CARGA
```

Variables historicas/deprecadas:

```env
# NETSUITE_DATASET_OUT_ID=custdataset17
# NETSUITE_DATASET_OUT_NAME=MCV_cronometro_out
```

## Integracion NetSuite IN - Cronometro hacia NetSuite

### Contrato funcional de retorno

Cronometro publica tres datos reales por operacion:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

Reglas:

- Se publica el valor vigente, no un delta.
- El envio se hace por batch.
- El retorno se agrupa por OT.
- Despues del push, Cronometro debe hacer pull para recalzar estado local.

### Modo vigente: RESTlet + Importacion OT

La lectura correcta es:

- desde el backend: `NETSUITE_PUSH_MODE=restlet`;
- en NetSuite: RESTlet `MCV_Cronometro_Restlet_In`;
- el RESTlet no escribe directo sobre `manufacturingoperationtask`;
- el RESTlet agrupa por OT y crea staging en `customrecord_3k_importacion_ot`;
- scripts internos posteriores procesan ese staging y crean/aplican `workordercompletion`.

RESTlet vigente:

```text
Nombre: MCV_Cronometro_Restlet_In
Script ID: customscript_mcv_cronometro_restlet_in
Deployment ID: customdeploy_mcv_cronometro_restlet_in
Archivo: MCV_cronometro_restlet.js
Funciones: GET, POST
```

### Staging record Importacion OT

Record:

```text
customrecord_3k_importacion_ot
```

Campos relevantes:

| Campo | ID |
|---|---|
| OT | `custrecord_3k_ot_principal` |
| Fecha | `custrecord_3k_imp_ot_fecha` |
| Estado | `custrecord_3k_imp_ot_estado` |
| Detalle Procesamiento | `custrecord_3k_imp_ot_det_proc` |
| Finalizacion OT Generada | `custrecord_3k_imp_ot_transaccion` |
| JSON | `custrecord_3k_imp_ot_json` |

JSON esperado:

```json
[
  {
    "secuencia": 1,
    "horasConfiguracion": 0,
    "horasEjecucion": 1108,
    "cantidadCompletada": 1
  }
]
```

Variables IN:

```env
NETSUITE_PUSH_MODE=restlet
NETSUITE_RESTLET_IN_URL=https://.../restlet.nl?script=1271&deploy=1
NETSUITE_RESTLET_IN_SCRIPT_ID=customscript_mcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy_mcv_cronometro_restlet_in

NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha
```

### Procesamiento posterior TEK / 3K

Proceso identificado en productivo:

```text
Script: 3K - Procesar Importacion de OT (MR)
Script ID: customscript_3k_procesar_imp_ot_mr
Deployment programado: customdeploy_3k_procesar_imp_ot_mr_prog
Busqueda pendientes: customsearch_tek_imp_ot_pend
Frecuencia observada: cada 15 minutos
```

### Candado de consistencia Importacion OT antes del Pull

El procesamiento final de `Importacion OT` no es completamente sincrono con la llamada del RESTlet.

Riesgo:

```text
Cronometro -> RESTlet -> Importacion OT -> Map/Reduce -> Finalizacion OT
```

Si el pull ocurre mientras el Map/Reduce esta activo o mientras existen importaciones reales pendientes, Cronometro puede leer una foto intermedia de NetSuite.

El pull no se cancela definitivamente porque tambien recalza/resetear contadores locales despues del push.

Flujo obligatorio:

```text
Stop -> Push -> Gate Import OT -> Pull
```

Variables recomendadas:

```env
NETSUITE_IMPORT_OT_GATE_ENABLED=true
NETSUITE_IMPORT_OT_GATE_TIMEOUT_SECONDS=600
NETSUITE_IMPORT_OT_GATE_POLL_SECONDS=30
NETSUITE_IMPORT_OT_GATE_FORCE_PULL_ON_TIMEOUT=true
```

Criterio de estabilidad:

1. No hay ejecucion activa del Map/Reduce `3K - Procesar Importacion de OT (MR)`.
2. La busqueda `customsearch_tek_imp_ot_pend` no tiene pendientes reales.

Criterio de pendiente real:

- OT informada.
- JSON informado.

Si el timeout expira, el sistema debe ejecutar el pull igualmente y registrar/mostrar:

```text
WARNING: import_ot no estaba terminado antes del pull. Posible inconsistencia en la data del Cronometro.
```

Estados sugeridos para log:

```text
GATE_WAITING_IMPORT_OT
GATE_STABLE
GATE_TIMEOUT_WARNING_PULL
PULL_SAFE_AFTER_GATE
PULL_WITH_IMPORT_OT_WARNING
```

Mitigacion horaria adicional:

- Si deployment inicia a 08:00, tambien ejecuta a 17:00.
- Se recomienda mover inicio a 08:01 y ejecutar pull operativo a 17:03.
- Esta mitigacion no reemplaza el gate porque la duracion real del Map/Reduce puede variar.

### Alternativas historicas de escritura IN

#### A) Escritura directa sobre `manufacturingoperationtask`

Historico / no vigente. Fue evaluada mediante RESTlet minimo que actualizaba `actualsetuptime`, `actualruntime` y `completedquantity`. Se descarto por bloqueo de edicion en WIP y porque no corresponde a la ultima version real operativa subida a NetSuite.

#### B) `workorder_completion` REST

Historico/evaluable solo en sandbox. Se descarto como flujo principal por sensibilidad a permisos, sublistas REST y rendimiento en alto volumen.

#### C) Scripts propios MCV SS + MR

Propuesta/evaluable, no vigente en productivo salvo decision explicita. Si se activa un MR propio sobre la misma cola, debe desactivarse el MR de terceros para evitar doble procesamiento.

## Flujo oficial de sincronizacion

1. Detener relojes activos/pausados.
2. Push a NetSuite.
3. Gate Importacion OT: esperar estabilidad hasta 600 segundos, revisando cada 30 segundos.
4. Pull + replace en tabla local WIP.
5. Si el gate expira, ejecutar pull igualmente con warning critico.

El flujo manual y el cierre de turno programado deben usar la misma semantica de sincronizacion y dejar registro en `sync_runs` / `sync_run_steps`.

### Cierre de turno

- Puede ejecutar auto-stop.
- Consolida tiempos.
- Puede disparar sincronizacion segun configuracion.
- Zona horaria: `America/Santiago`.

Variables funcionales:

```env
NS_SHIFT_BATCH_ENABLED=true
NS_AUTO_STOP_AT_SHIFT_END=true
NS_TIMEZONE=America/Santiago
NS_RETRY_ENABLED=true
NS_OPERATIONAL_PULL_DELAY_SECONDS=60
```

Nota: `NS_OPERATIONAL_PULL_DELAY_SECONDS` queda subordinada al Gate Import OT cuando el flujo usa `import_ot`.

## Endpoints backend relevantes

- `GET /chronometer/netsuite/status`: variables presentes, sin secretos.
- `GET /chronometer/netsuite/peek-dataset`: nombre legado; hoy inspecciona OUT de Saved Search.
- `POST /chronometer/netsuite/pull-dataset`: nombre legado; hoy ejecuta pull de Saved Search OUT y upsert/replace en `work_order_operations`.
- `POST /chronometer/netsuite/push-actuals`: push batch segun `NETSUITE_PUSH_MODE`.
- `POST /chronometer/netsuite/oauth/clear-cache`: limpia cache de access token.
- `POST /chronometer/timers/stop-batch`: detiene timers por area (`ALL`, `ME`, `ES`).
- `GET /chronometer/netsuite/sync-runs`: log de sincronizaciones.
- `GET /chronometer/netsuite/sync-runs/:id`: detalle de sincronizacion.
- `GET /chronometer/netsuite/push-log`: log comparativo NetSuite.

## Variables de entorno EasyPanel

Esta seccion es el directorio operativo de variables para configurar EasyPanel. Los valores secretos deben cargarse en EasyPanel, no versionarse en Git ni copiarse a documentos publicos.

### Reglas generales

- Cada ambiente debe tener sus propios secretos: `JWT_SECRET`, `DELETE_SECRET`, credenciales NetSuite, certificados y private key.
- El frontend no debe contener secretos. Solo variables publicas de build/runtime.
- El backend es el unico servicio que debe tener credenciales de BD, OAuth, NetSuite y private key.
- Si se cambia una variable de frontend que participa del build, se debe rebuildar el servicio front.
- Si se cambia una variable de backend, se debe redeploy/restart del servicio backend.

### Directorio de servicios EasyPanel

| Ambiente | Servicio | Dominio | Carpeta build | Puerto interno |
|---|---|---|---|---|
| SB | `reloj-front` | `reloj-sb.at-once.cl` | `front/` | `80` |
| SB | `reloj-api` | `https://reloj-api.at-once.cl/` o ruta API configurada | `backend/` | `8000` |
| PROD | `reloj-front` | `reloj.at-once.cl` | `front/` | `80` |
| PROD | `reloj-api` | `https://reloj-api.at-once.cl/` o ruta API configurada | `backend/` | `8000` |

### SB - servicio front

```env
VUE_APP_API_URL=https://reloj-api.at-once.cl/
VUE_APP_ENV=sb
VUE_APP_TIMEZONE=America/Santiago

# Opcional si se quiere fijar la terminal por equipo en vez de localStorage:
# VUE_APP_STATION_ID=SB-LINEA-01

# Opcional tablero protector:
# VUE_APP_IDLE_BOARD_SLOTS=4
# VUE_APP_IDLE_BOARD_CAROUSEL_SEC=2
```

### SB - servicio backend

```env
NODE_ENV=production
PORT=8000

DB_HOST=mariadb
DB_PORT=3306
DB_USER=<SB_DB_USER>
DB_PASSWORD=<SB_DB_PASSWORD>
DB_NAME=relojcontrol
DB_DIALECT=mariadb

JWT_SECRET=<SB_JWT_SECRET>
DELETE_SECRET=<SB_DELETE_SECRET>
CORS_ALLOW_ALL=true

NS_TIMEZONE=America/Santiago
NS_SHIFT_BATCH_ENABLED=true
NS_AUTO_STOP_AT_SHIFT_END=true
NS_RETRY_ENABLED=true
NS_OPERATIONAL_PULL_DELAY_SECONDS=60

NETSUITE_CLIENT_ID=<SB_NETSUITE_CLIENT_ID>
NETSUITE_CLIENT_SECRET=<SB_NETSUITE_CLIENT_SECRET>
NETSUITE_CERTIFICATE_ID=<SB_NETSUITE_CERTIFICATE_KID>
NETSUITE_ACCOUNT_ID=6099999_SB1
NETSUITE_TOKEN_URL=https://6099999-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
NETSUITE_PRIVATE_KEY="<SB_PRIVATE_KEY_BEGIN_PRIVATE_KEY>"

NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
NETSUITE_OUT_SAVEDSEARCH_NAME=BG - Control de HH por OT Detalle VF - CARGA

NETSUITE_PUSH_MODE=restlet
NETSUITE_RESTLET_IN_URL=https://6099999-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1
NETSUITE_RESTLET_IN_SCRIPT_ID=customscript_mcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy_mcv_cronometro_restlet_in
NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha

NETSUITE_IMPORT_OT_GATE_ENABLED=true
NETSUITE_IMPORT_OT_GATE_TIMEOUT_SECONDS=600
NETSUITE_IMPORT_OT_GATE_POLL_SECONDS=30
NETSUITE_IMPORT_OT_GATE_FORCE_PULL_ON_TIMEOUT=true
```

### PROD - servicio front

```env
VUE_APP_API_URL=https://reloj-api.at-once.cl/
VUE_APP_ENV=prod
VUE_APP_TIMEZONE=America/Santiago

# Opcional si se quiere fijar la terminal por equipo en vez de localStorage:
# VUE_APP_STATION_ID=PROD-LINEA-01

# Opcional tablero protector:
# VUE_APP_IDLE_BOARD_SLOTS=4
# VUE_APP_IDLE_BOARD_CAROUSEL_SEC=2
```

### PROD - servicio backend

```env
NODE_ENV=production
PORT=8000

DB_HOST=mariadb
DB_PORT=3306
DB_USER=<PROD_DB_USER>
DB_PASSWORD=<PROD_DB_PASSWORD>
DB_NAME=relojcontrol
DB_DIALECT=mariadb

JWT_SECRET=<PROD_JWT_SECRET>
DELETE_SECRET=<PROD_DELETE_SECRET>
CORS_ALLOW_ALL=true

NS_TIMEZONE=America/Santiago
NS_SHIFT_BATCH_ENABLED=true
NS_AUTO_STOP_AT_SHIFT_END=true
NS_RETRY_ENABLED=true
NS_OPERATIONAL_PULL_DELAY_SECONDS=60

NETSUITE_CLIENT_ID=<PROD_NETSUITE_CLIENT_ID>
NETSUITE_CLIENT_SECRET=<PROD_NETSUITE_CLIENT_SECRET>
NETSUITE_CERTIFICATE_ID=<PROD_NETSUITE_CERTIFICATE_KID>
NETSUITE_ACCOUNT_ID=6099999
NETSUITE_TOKEN_URL=https://6099999.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
NETSUITE_PRIVATE_KEY="<PROD_PRIVATE_KEY_BEGIN_PRIVATE_KEY>"

NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
NETSUITE_OUT_SAVEDSEARCH_NAME=BG - Control de HH por OT Detalle VF - CARGA

NETSUITE_PUSH_MODE=restlet
NETSUITE_RESTLET_IN_URL=https://6099999.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1
NETSUITE_RESTLET_IN_SCRIPT_ID=customscript_mcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy_mcv_cronometro_restlet_in
NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha

NETSUITE_IMPORT_OT_GATE_ENABLED=true
NETSUITE_IMPORT_OT_GATE_TIMEOUT_SECONDS=600
NETSUITE_IMPORT_OT_GATE_POLL_SECONDS=30
NETSUITE_IMPORT_OT_GATE_FORCE_PULL_ON_TIMEOUT=true
```

### Validacion obligatoria despues de configurar variables

1. Backend levanta y responde `/health` o ruta equivalente.
2. Front carga desde el dominio correcto.
3. Login funciona.
4. `GET /chronometer/netsuite/status` muestra variables presentes sin exponer secretos.
5. Token OAuth NetSuite funciona.
6. Pull OUT desde Saved Search funciona.
7. Dry run o prueba controlada de push funciona.
8. Gate Import OT queda habilitado antes del pull.
9. El front no intenta cargar recursos desde CDNs externos.

## Variables de entorno consolidadas

Plantilla conceptual. No guardar valores reales ni private keys en el repositorio.

```env
DB_HOST=mariadb
DB_PORT=3306
DB_USER=<db_user>
DB_PASSWORD=<secret>
DB_NAME=relojcontrol
DB_DIALECT=mariadb
JWT_SECRET=<secret>
DELETE_SECRET=<secret>
CORS_ALLOW_ALL=true

NETSUITE_CLIENT_ID=<client_id>
NETSUITE_CLIENT_SECRET=<client_secret>
NETSUITE_CERTIFICATE_ID=<kid_oauth2_client_credentials>
NETSUITE_ACCOUNT_ID=<account_id>
NETSUITE_TOKEN_URL=https://<account>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
NETSUITE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
NETSUITE_OUT_SAVEDSEARCH_NAME=BG - Control de HH por OT Detalle VF - CARGA

NETSUITE_PUSH_MODE=restlet
NETSUITE_RESTLET_IN_URL=https://<account>.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1
NETSUITE_RESTLET_IN_SCRIPT_ID=customscript_mcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy_mcv_cronometro_restlet_in
NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha

NETSUITE_IMPORT_OT_GATE_ENABLED=true
NETSUITE_IMPORT_OT_GATE_TIMEOUT_SECONDS=600
NETSUITE_IMPORT_OT_GATE_POLL_SECONDS=30
NETSUITE_IMPORT_OT_GATE_FORCE_PULL_ON_TIMEOUT=true

NS_TIMEZONE=America/Santiago
NS_SHIFT_BATCH_ENABLED=true
NS_AUTO_STOP_AT_SHIFT_END=true
NS_RETRY_ENABLED=true

# Historico / no vigente como arquitectura principal:
# NETSUITE_PUSH_MODE=workorder_completion
# NETSUITE_WOC_RUN_FIELD=machineRunTime
# NETSUITE_WOC_SETUP_FIELD=machineSetupTime
# NETSUITE_WOC_COMPLETED_QTY_FIELD=completedQuantity
# NETSUITE_DATASET_OUT_ID=custdataset17
# NETSUITE_DATASET_OUT_NAME=MCV_cronometro_out
```

## Seguridad

- No guardar `.env` reales en Git.
- No guardar private keys en documentacion.
- NetSuite recibe certificado publico (`BEGIN CERTIFICATE`); Cronometro conserva private key (`BEGIN PRIVATE KEY`).
- Si una private key o client secret se comparte en un chat o documento, debe tratarse como comprometido y rotarse.
- En productivo deben existir secretos propios y separados de sandbox.
- No copiar `NETSUITE_CERTIFICATE_ID` manualmente caracter por caracter si se puede copiar desde NetSuite.

## Troubleshooting NetSuite

### `invalid_client`

Capa: OAuth M2M. Revisar `NETSUITE_CERTIFICATE_ID`, `NETSUITE_CLIENT_ID`, credencial OAuth2 Client Credentials, app/entidad/rol/certificado y Token URL.

### `getaddrinfo ENOTFOUND`

Capa: DNS/red. Revisar DNS del host/contenedor, host NetSuite armado y red.

### `INSUFFICIENT_PERMISSION` sobre `Importacion OT`

Capa: permisos efectivos del custom record. Revisar token OK, rol `MCV_Cronometro_Rol`, acceso al custom record, RESTlet deployment y audiencia.

### Push falla pero pull funciona

Si pull funciona, OAuth M2M funciona. Revisar `NETSUITE_PUSH_MODE`, RESTlet URL, deployment, archivo `MCV_cronometro_restlet.js`, custom record, permisos, Map/Reduce posterior y `customsearch_tek_imp_ot_pend`.

### Pull en foto intermedia

Sintoma: Cronometro queda inconsistente despues de push/pull, especialmente si el pull coincide con el Map/Reduce de Importacion OT. Accion: implementar Gate Import OT y warning obligatorio si expira.

### Mensaje tecnico al cambiar modo de timer

Si aparece `Only active timers can change mode.`, revisar si la operacion fue pausada/detenida o tomada desde otra terminal. El usuario debe ver el mensaje funcional obligatorio definido en la seccion `Mensaje obligatorio para operacion tomada por otro terminal`.

## Datos iniciales y control de acceso

### Roles

| id | name |
|---|---|
| 1 | admin |
| 2 | operario |

### Workplaces

| id | name |
|---|---|
| 1 | IN (legacy / no usar en UI; tratar como Todos) |
| 2 | ES |
| 3 | ME |
| 4 | ALL (se muestra como Todos) |

### Usuario admin inicial

Debe existir un usuario administrador inicial creado por seed o migracion controlada. Las credenciales reales no deben documentarse en texto versionado.

## Git, despliegue y lecciones aprendidas

### Ramas

- Trabajo diario en sandbox: `V3`.
- Al cerrar productivo, alinear `main` al mismo commit probado en `V3`.
- Evitar merges grandes que mezclen historiales divergentes.

### EasyPanel

- Primer build puede no dispararse automaticamente. Solucion conocida: refrescar token GitHub desde Settings y guardar.
- Rebuild de `reloj-api` / `reloj-front` no borra MariaDB si el volumen persiste.
- Si el backend tarda por `db.sync({ alter: true })`, un healthcheck agresivo puede provocar reinicios. Mejor patron: abrir puerto HTTP temprano y exponer `/` o `/health`.

### Front cache

Despues de deploy, el navegador puede conservar `index.html` viejo y pedir chunks JS que ya no existen. Sintoma: `Unexpected token '<'`.

Mitigacion: recarga forzada, incognito o borrar datos del sitio.

### Login / Network Error

Si el front HTTPS apunta a API de otro entorno o `localhost`, falla carga de operarios. Verificar URL efectiva del API en el bundle/config del entorno.

## Decisiones cerradas

### OUT por Dataset

Historico/deprecado. No reabrir sin evidencia nueva.

### Escritura directa sobre `manufacturingoperationtask`

Historico. No usar como referencia vigente para productivo.

### Escritura via `workordercompletion` REST

Historico/evaluable solo en sandbox. No usar como canal principal sin prueba controlada.

### Escritura vigente via RESTlet + Importacion OT

Camino operativo vigente. Requiere Gate Import OT antes del pull.

### Version unica SB/PROD

Vigente. No mantener forks funcionales por entorno.

## Documentos sueltos consolidados en este README

La informacion funcional de los siguientes documentos queda consolidada aqui:

- `Arquitectura MCV_Cronometro.md`
- `Arquitectura MCV_RelojControl_Historico.md`
- `MCV_Cronometro_RESTlet.md`
- `NETSUITE_ENV_TEMPLATE.md`
- `NETSUITE_MCV_CRONOMETRO_IN_SCRIPT.md`
- `NETSUITE_MCV_SS_MR_DEPLOY.md`
- `NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`
- `NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md`
- `NETSUITE_RESTLET_IMPORT_OT_MODE.md`
- `SANDBOX_CONFIG.md`
- `bitacora_error_sync.md`
- `cust.netsuite.md`

El README es la fuente oficial. Los documentos sueltos deben considerarse historicos, auxiliares o candidatos a limpieza del repositorio cuando el equipo lo autorice.
