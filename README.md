# MCV_RelojControl / Cronometro

README oficial y consolidado del proyecto. Este archivo es la fuente documental principal para programacion, diagnostico, despliegue, operacion y validacion funcional del Cronometro.

Toda informacion relevante de documentos sueltos del directorio `cronometro/` queda consolidada aqui. Los documentos separados deben leerse como historicos o auxiliares hasta que el equipo decida eliminarlos del repositorio.

## Bitacora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Seccion afectada |
|---|---|---|---|---|
| 2026-07-31 | Se corrige el payload V4/V5 por STOP: cada STOP publica solo el tramo desde el STOP anterior del mismo `operation_timer_id` (setup/run), no el acumulado historico del timer. | En SB/PROD TEK suma cada `Importacion OT`; reenviar setup/run acumulado duplicaba tiempos (caso OT18905 y reproduccion OT16955 seq 5: setup 3+3=6). | `buildActualsPayloadForStopEvent` + `selectEventsForStopSegment`; ZIM400 hereda el delta correcto via `pushItem`. Sin cambio de contrato RESTlet ni de campos NetSuite. | Integracion NetSuite IN, Flujo V4, timer_events, Poblar Reporte ZIM400 |
| 2026-07-31 | Se evalua la incorporacion de Spec Kit como capa de gobernanza y se define no instalarlo directamente sobre la raiz del proyecto. | Cronometro ya esta avanzado, sin `.specify`, con `specs/` manual y reglas de agente que requieren saneamiento previo. | No afecta NetSuite ni runtime; evita introducir estructura generada antes de ordenar la documentacion y reglas vigentes. | Gobernanza documental / Spec Kit |
| 2026-07-14 | Se cierra la definicion de la advertencia por operaciones anteriores pendientes: regla de finalizacion, alcance completo de la OT, contrato HTTP `409 PREVIOUS_OPERATIONS_PENDING`, override auditado y prioridad de entrega. | Reducir errores de seleccion de operacion y eliminar ambiguedades para la implementacion. | Validacion obligatoria en backend sobre todas las secuencias anteriores de la OT, confirmacion en frontend y trazabilidad en `timer_events.details_json`. Sin tabla nueva ni cambios en NetSuite, Saved Search OUT, RESTlet, import_ot, ZIM400 o payload de sincronizacion. | Requisitos funcionales de UI y operacion, Auditoria operativa, timer_events |
| 2026-06-26 | Se define nuevo reporte administrativo `Log Usuarios` V5.3 con filtros visibles, ordenamiento por columnas y paginacion para auditar acciones Play, Pause y Stop sobre OT's. | Dar trazabilidad operativa por usuario, OT, operacion, fecha/hora y accion ejecutada en el cronometro. | Cambio en frontend y backend de Cronometro; usa `timer_events` como fuente interna. Sin impacto en NetSuite, Saved Search OUT, RESTlet, import_ot, ZIM400 ni payload de sincronizacion. | Reportes administrativos, Auditoria operativa, timer_events |
| 2026-06-26 | Se define mejora visual no disruptiva para multiplicar el tiempo planificado visible de EJECUCION por la cantidad de entrada. | Evitar que la barra y el color del cronometro indiquen sobretiempo prematuro cuando NetSuite entrega `runRate` como tiempo por unidad y la OT tiene cantidad a fabricar mayor que 1. | Cambio solo de presentacion en frontend: no modifica NetSuite, Saved Search OUT, backend, base de datos, RESTlet, import_ot, ZIM400 ni payload de sincronizacion. | Requisitos funcionales de UI y operacion, Tablero operativo V3, Integracion NetSuite OUT |
| 2026-06-23 | Se elimina el bloqueo cronometrico por recurso compartido (V5.1): varios operarios pueden cronometrar OT distintas sobre el mismo `resource_code` en paralelo. | En planta el mismo centro de trabajo NetSuite (ej. ES411) puede tener varias OT en curso; el bloqueo por recurso impedia cronometrar OT18584/2 mientras otro operario tenia ACTIVE otra OT en ES411. | La unicidad operativa queda solo en `work_order_operation_id + current_user_id + station_id`. Se elimina validacion `lockTimer` por `resource_code` en start/resume/transicion montaje. No cambia contrato NetSuite ni envio por STOP. | Requerimiento V5.1, chronometer.js, mensajes operativos |
| 2026-06-21 | Se documenta de forma explicita la diferencia entre **Tablero Grande** (protector 2x2 por estacion) y **Operaciones Activas** (tabla con controles por rol). | Evitar confusion entre el screensaver de planta/terminal y la tabla operativa con play/pause/stop. | Tablero Grande: todos los cronometros ACTIVE/PAUSED de la estacion (`x-station-id`). Operaciones Activas sin cambio: operario ve solo los suyos; admin ve todos los terminales y usuarios. | Terminal compartida, Tableros operativos, V5 |
| 2026-06-21 | Se crea estructura inicial QA del proyecto en `QA/README.md` y `QA/system-prompt.md`. | Implementar el proceso oficial definido en `QA Tester` para preparar rondas QA especificas de Cronometro sin adelantar pruebas aun no definidas. | Cronometro queda preparado para operar QA documentado por mejora, version o flujo, usando una futura ronda unica `QA-YYYY-MM-DD.md` cuando Miguel defina que validar. | Bitacora, Documentos QA |
| 2026-06-19 | Se define requerimiento V5 de multioperario/multiterminal por operacion: una misma OT/operacion puede tener multiples cronometros simultaneos diferenciados por operacion, usuario y terminal. | Algunas operaciones, como pintura, pueden ser ejecutadas por varios operarios en paralelo y cada tiempo debe conservar trazabilidad individual para ZIM400. | La rama V5 debe eliminar el bloqueo global de cronometro unico por operacion y reemplazarlo por unicidad operacional `work_order_operation_id + current_user_id + station_id` para timers activos/pausados. No cambia contrato NetSuite ni logica vigente de envio; cada STOP debe seguir publicandose con la logica actual hacia `import_ot` y ZIM400. | Requisitos funcionales de UI y operacion, Terminal compartida, Integracion NetSuite IN, Poblar Reporte ZIM400, Ramas |
| 2026-06-08 | Se define que MONTAJE debe usar el mismo patron de confirmacion que EJECUCION: el boton STOP solo abre popup y el STOP real ocurre al confirmar una opcion del popup. | Evitar inconsistencias operativas entre montaje y ejecucion, donde un popup podria quedar desacoplado del cierre real del cronometro. | Frontend debe abrir popup inmediatamente al presionar STOP en MONTAJE; backend debe cerrar montaje solo cuando el usuario confirme `Iniciar ejecucion` o `No iniciar ahora`. Si confirma iniciar, el backend debe cerrar montaje e iniciar ejecucion en la misma accion. No cambia el contrato NetSuite. | Requisitos funcionales de UI y operacion, Tablero operativo V3 |
| 2026-06-04 | Se define que el cierre programado operational debe publicar a `import_ot` y ZIM400 dentro del mismo `sync_run`, sin reutilizar el flujo completo `v4_stop_queue`. | Evitar duplicacion de PUSH hacia `import_ot` y mantener estable el cierre programado, incorporando ZIM400 como segundo destino obligatorio. | El Programador debe extraer/reutilizar ZIM400 como publisher independiente, agregar el step `PUSH_ZIM400` al flujo operational y mantener idempotencia/logs por destino. | Flujo oficial de sincronizacion, Integracion NetSuite IN, Poblar Reporte ZIM400, Decisiones cerradas |
| 2026-05-22 | Se corrige el mapping de empleado ZIM400: se elimina el hardcode temporal `42027` y se define que `custrecord_zim_reloj_empleado` debe poblarse desde `Users.netsuiteEmployeeId`. | Se poblo MariaDB con usuarios vinculados al ID interno real de empleado NetSuite y ya no corresponde enviar un empleado generico. | El programador debe agregar/usar `Users.netsuiteEmployeeId` como fuente obligatoria para enviar el empleado correcto a NetSuite ZIM400. La carga inicial de usuarios queda como CSV controlado, con passwords bcrypt y sin passwords planos. | Gestion de usuarios, MariaDB, Poblar Reporte ZIM400 |
| 2026-05-20 | Se agrega requerimiento de log diagnostico util para `PUSH_ZIM400`, incluyendo payload, destino NetSuite, status HTTP y respuesta completa de NetSuite. | La primera prueba del modulo ZIM400 retorno `Request failed with status code 400`, mensaje insuficiente para diagnosticar campo, formato, referencia o permisos. | El programador debe persistir y exponer error detallado por etapa, sin secretos, para poder indagar y corregir despues de programar. | Poblar Reporte ZIM400, Logs, Diagnostico |
| 2026-05-20 | Se define el modulo Poblar Reporte ZIM400 como segunda entrega paralela del worker STOP hacia `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL`, destino de la Saved Search `customsearch400`. | `import_ot` no alimenta el reporte Data Reloj Control y se requiere poblarlo desde Cronometro con un registro por STOP. | El worker debera ejecutar dos push independientes: el push vigente a `import_ot` sin modificar y un nuevo push ZIM400 con payload ampliado, trazabilidad e idempotencia propia. El fallo ZIM400 no debe bloquear `import_ot`. | Integracion NetSuite IN, Flujo V4, Poblar Reporte ZIM400 |
| 2026-05-19 | Se define arquitectura objetivo V4 para sincronizacion NetSuite por evento STOP desacoplado: STOP crea pendiente persistente y un worker/servicio procesa el envio; el cron queda como rescate/fallback, no como generador principal. | Evitar ejecuciones vacias por cron cada 15 minutos y desacoplar la experiencia del operario de la disponibilidad inmediata de NetSuite. | V3 queda como baseline funcional intacta. La modificacion debe desarrollarse en nueva linea/rama V4 y requiere idempotencia, reintentos, control de concurrencia, auditoria y trazabilidad. | Ramas, Integracion NetSuite IN, Flujo oficial de sincronizacion, Logs |
| 2026-05-07 | Se prohibe la carga automatica de usuarios desde archivos, seeds o cualquier origen distinto a la administracion propia del Cronometro. | En EasyPanel se detecto que la API ejecuta `load_users()` al iniciar y vuelve a insertar usuarios desde `backend/src/libs/usuarios.txt` cuando la tabla `Users` queda con 10 o menos registros. Esto no debe ocurrir en SB ni PROD operativo. | El programador debe eliminar/desactivar esta actividad, retirar el seed automatico de usuarios del arranque y asegurar que los usuarios validos sean solo los creados/administrados dentro del Cronometro. | Gestion de usuarios, seguridad, arranque backend, initialSetup |
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

## Evaluacion arquitectonica: Spec Kit

Spec Kit no queda incorporado directamente en la raiz de Cronometro en esta etapa.

Criterio vigente:

1. Cronometro es una aplicacion productiva/operativa ya avanzada, con arquitectura, QA, reglas de agente y documentacion tecnica existentes.
2. La instalacion directa de Spec Kit agregaria `.specify`, plantillas, workflows y skills generadas que pueden convivir tecnicamente con la app, pero aumentan el ruido documental si no se ordena antes la gobernanza actual.
3. La carpeta `specs/` ya existe como practica documental manual, por lo que no debe asumirse que Spec Kit es la fuente oficial hasta hacer una migracion controlada.
4. Antes de cualquier instalacion se debe sanear la capa de agentes: `AGENTS.md`, `.cursor/rules/`, ramas reales de trabajo, versionado y reglas de deploy deben quedar consistentes con Cronometro.
5. Si se decide probar Spec Kit, debe hacerse en rama o copia experimental, con comparacion posterior contra este README, QA y reglas vigentes. Solo despues de esa validacion se podra declarar como herramienta oficial del proyecto.

Decision actual: usar Spec Kit solo como evaluacion experimental futura, no como cambio inmediato sobre la linea principal de Cronometro.

Impacto por area:

| Area | Impacto |
|---|---|
| NetSuite | Ninguno directo. No cambia Saved Search, RESTlet, Import OT ni ZIM400. |
| Configuracion | Ninguno directo. No requiere cambios en NetSuite ni EasyPanel. |
| Desarrollo | Potencial beneficio futuro para ordenar nuevas mejoras, pero riesgo de friccion si se instala antes de sanear reglas y documentacion. |
| Operacion | Ninguno directo para operarios. La app sigue funcionando igual. |
| Documentacion | Alto impacto potencial; por eso la adopcion debe ser controlada y documentada. |

Siguiente accion recomendada: crear primero una revision de gobernanza documental de agentes para Cronometro y corregir inconsistencias visibles antes de evaluar una instalacion experimental de Spec Kit.

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
- Flujo operativo final base: `Stop -> Push -> Gate Import OT -> Pull(+replace)`.
- Cierre programado operational: debe usar un unico `sync_run` con `STOP_BATCH -> PUSH_IMPORT_OT -> PUSH_ZIM400 -> GATE_IMPORT_OT -> GATE_ZIM400_STATUS -> PULL`, evitando cualquier doble publicacion de actuals hacia `import_ot`.
- Usuarios vigentes: solo los creados y administrados desde Cronometro. No se permite carga automatica desde `usuarios.txt`, seeds, archivos estaticos ni scripts de arranque.

## Principios rectores

1. NetSuite es la verdad operativa final.
2. Cronometro captura, consolida y publica datos reales por operacion.
3. Despues del push, Cronometro debe recalzar su estado local con pull desde NetSuite.
4. El pull no debe cancelarse definitivamente, porque tambien evita que contadores locales ya enviados se dupliquen o tripliquen en un push posterior.
5. La unidad funcional es la operacion de OT, no la cabecera de OT.
6. La arquitectura vigente es una sola para SB y PROD; las diferencias son de entorno.
7. No se deben versionar secretos reales, private keys ni certificados privados.
8. No se deben crear usuarios automaticamente desde archivos o semillas en ambientes operativos.

## Regla de versionado

La decision tecnica de que archivos se versionan en Git la define el equipo de desarrollo, usando buenas practicas de repositorio. La validacion funcional y de negocio la define el responsable del proyecto.

Criterio por defecto:

- Se versiona: codigo fuente, configuraciones no secretas, scripts, documentacion, `package.json` y lockfiles.
- No se versiona: archivos generados (`node_modules`, `build`, `dist`, caches), binarios temporales y secretos (`.env`, llaves, certificados privados).
- No se deben versionar archivos de carga de usuarios operativos como fuente activa para SB/PROD. Si existen por historia, deben quedar deshabilitados y tratados como legado.

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

### Gestion de usuarios

Los usuarios validos del sistema son exclusivamente los creados y administrados dentro del Cronometro por las pantallas o endpoints administrativos autorizados.

#### Vinculo usuario Cronometro con empleado NetSuite

La tabla MariaDB `Users` debe contener la columna `netsuiteEmployeeId` (`VARCHAR(50) NULL`) para guardar el ID interno real del empleado NetSuite asociado al usuario Cronometro. Este campo es distinto de `Users.id`: `Users.id` es la llave local autoincremental y nunca debe enviarse como empleado NetSuite.

La carga inicial de usuarios se realizo por CSV controlado desde empleados NetSuite, incluyendo `ID interno`, nombre, apellido, email y `BG - Rut Empleado`. El password inicial se genera como bcrypt a partir de los primeros 4 digitos numericos del RUT; no se permite guardar ni importar passwords en texto plano.

Reglas obligatorias para Programador:

1. El modelo `User` debe declarar `netsuiteEmployeeId` y persistirlo en la tabla `Users`.
2. El builder ZIM400 debe leer el empleado desde `timer/user -> Users.netsuiteEmployeeId`.
3. El payload ZIM400 debe enviar `custrecord_zim_reloj_empleado = Number(Users.netsuiteEmployeeId)` cuando el campo exista y sea numerico.
4. No usar `Users.id`, `username`, nombre/apellido, email ni constantes hardcodeadas como empleado NetSuite.
5. Si `netsuiteEmployeeId` falta, es nulo o no es numerico, el modulo ZIM400 debe omitir `custrecord_zim_reloj_empleado` y registrar advertencia/error diagnostico con `user_id`, `username` y `timer_event_id` para corregir datos maestros.
6. El modulo de Usuarios del Cronometro debe permitir ver y editar el campo `netsuiteEmployeeId` desde la administracion, con etiqueta funcional `ID empleado NetSuite` o equivalente. Esta edicion debe quedar restringida a administradores.
7. La pantalla/API de usuarios debe validar que `netsuiteEmployeeId`, cuando se informe, sea numerico y corresponda al ID interno del empleado en NetSuite. No debe autocompletarlo con `Users.id` ni con valores hardcodeados.


Queda prohibido que el backend cree, recargue o regenere usuarios automaticamente desde:

- `backend/src/libs/usuarios.txt`;
- `backend/build/libs/usuarios.txt`;
- cualquier archivo `.txt`, `.csv`, `.json` o similar;
- seeds ejecutados en cada arranque;
- `initialSetup.load_users()` o funcion equivalente;
- scripts que corran durante deploy, rebuild o reinicio de la API;
- cualquier origen externo no autorizado expresamente por administracion del Cronometro.

Hallazgo operativo 2026-05-07:

```text
La API estaba ejecutando load_users() al iniciar.
La funcion leia usuarios.txt.
La condicion era Users.length <= 10.
Al borrar usuarios, el siguiente reinicio/redeploy intentaba volver a insertarlos.
```

Esto debe eliminarse para SB y PROD operativo.

Requerimiento para el programador:

1. Eliminar del arranque de la API la llamada a `load_users()`.
2. Deshabilitar o borrar la logica que lee `usuarios.txt` para crear usuarios automaticamente.
3. Asegurar que ningun reinicio, rebuild o redeploy cree usuarios por debajo de un umbral de cantidad.
4. Mantener solo seeds minimos estructurales si son necesarios para roles/workplaces, pero no para usuarios operativos.
5. Si se requiere un usuario admin inicial en una base limpia, debe crearse mediante mecanismo explicito, controlado y no recurrente, nunca por carga masiva automatica.
6. Agregar log claro cuando el seed de usuarios esta deshabilitado, por ejemplo: `User auto-seed disabled in operational environments`.
7. Verificar que `backend/src/libs/usuarios.txt` y `backend/build/libs/usuarios.txt` no sean usados por el proceso de arranque.

Criterio de aceptacion:

1. Borrar usuarios desde la administracion o base de datos no provoca que reaparezcan al reiniciar la API.
2. El log de EasyPanel no imprime listas de usuarios con passwords de seed.
3. El arranque de la API no ejecuta `load_users()` en SB ni PROD.
4. El backend no depende de `usuarios.txt` para operar.
5. Los usuarios existentes despues de reiniciar son solo los que estaban previamente en la base o fueron creados manualmente desde el Cronometro.
6. No se exponen passwords de usuarios en logs.

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

#### Tiempo planificado visible para el operador

Decision arquitectonica V5.2:

NetSuite entrega el tiempo de EJECUCION RUTA como `runRate`, es decir, tiempo por unidad/pieza. En Cronometro ese valor se persiste como `planned_operation_minutes` y la cantidad de entrada se persiste como `planned_quantity`.

Para evitar una alerta visual prematura en operaciones con cantidad a fabricar mayor que 1, el frontend debe calcular un plan visible de EJECUCION multiplicado por cantidad:

```text
planned_run_display_minutes = planned_operation_minutes * planned_quantity
```

Reglas obligatorias para Programador:

1. Esta regla es solo de presentacion visual para el operador.
2. No modificar NetSuite, Saved Search OUT, RESTlet, `import_ot`, ZIM400, backend ni estructura de base de datos por esta mejora.
3. No modificar el valor persistido `planned_operation_minutes`; debe seguir representando el `runRate` recibido desde NetSuite.
4. Para EJECUCION/RUN, las barras, porcentajes, colores y textos de plan visible deben usar `planned_operation_minutes * planned_quantity`.
5. Para MONTAJE/SETUP, mantener `planned_setup_minutes` sin multiplicar por cantidad, porque el montaje/configuracion es un tiempo fijo de preparacion.
6. Si `planned_quantity` viene vacio, cero, negativo o no numerico, usar `planned_operation_minutes` sin multiplicar.
7. Si `planned_operation_minutes` viene vacio o no numerico, mantener el comportamiento actual de `sin plan` o equivalente.
8. Aplicar la regla en todas las vistas donde el operador compara real contra plan:
   - Operaciones Activas.
   - Operaciones de Tu Area.
   - Tablero Grande 2x2.
   - Porcentaje de barra.
   - Color verde/amarillo/rojo.
   - Texto del tiempo planificado mostrado al usuario.
9. Mantener el payload de sincronizacion hacia NetSuite con los datos reales actuales: `actual_setup_time`, `actual_run_time` y `completed_quantity`.
10. Si el reporte administrativo necesita mostrar ambos valores, se debe distinguir claramente entre `runRate NetSuite` y `plan visible total`, sin reemplazar semanticamente el dato original.

Ejemplo funcional:

```text
planned_operation_minutes = 10
planned_quantity = 10
planned_run_display_minutes = 100

Si el operario lleva 12 minutos reales de ejecucion:
- porcentaje incorrecto historico: 12 / 10 = 120% rojo
- porcentaje correcto visible: 12 / 100 = 12% verde
```

Criterio de aceptacion:

1. Una operacion con 10 minutos por pieza y cantidad de entrada 10 muestra 100 minutos como plan visual de EJECUCION.
2. La barra de EJECUCION no cambia a rojo hasta alcanzar el plan visual total.
3. MONTAJE no multiplica su tiempo por cantidad.
4. El push a NetSuite no cambia.
5. El pull desde NetSuite no cambia.
6. ZIM400 e `import_ot` no cambian.
7. La mejora puede revertirse solo en frontend sin afectar datos historicos ni integraciones.

### Advertencia por operaciones anteriores pendientes

Al presionar **Montar** o **Ejecutar**, el sistema debe comprobar si la misma OT contiene operaciones con `operation_sequence` menor que la operacion seleccionada y que todavia no esten finalizadas.

La validacion debe ejecutarse en backend usando `work_order_operations` y el estado operativo local vigente. El frontend no debe decidir por si solo si existen pendientes, porque la advertencia y su auditoria deben conservarse aunque cambie la interfaz.

#### Regla cerrada de operacion finalizada

Para esta validacion, una operacion anterior se considera **pendiente** cuando cumple cualquiera de estas condiciones:

1. Tiene al menos un cronometro `ACTIVE` o `PAUSED`.
2. Su `source_status` continua indicando operacion abierta o WIP.
3. `completed_quantity < planned_quantity`, cuando ambas cantidades existen, son numericas y la cantidad planificada es mayor que cero.

Una operacion anterior se considera **finalizada** solamente cuando:

1. No tiene cronometros `ACTIVE` ni `PAUSED`; y
2. NetSuite ya no la informa como WIP despues del ultimo pull, **o** `completed_quantity >= planned_quantity` cuando ambas cantidades existen y son validas.

Prioridad de interpretacion:

```text
ACTIVE o PAUSED siempre significa pendiente.
Luego se evalua source_status.
completed_quantity sirve como evidencia adicional de termino.
```

No se debe considerar finalizada una operacion solo porque tenga cantidad completa si todavia existe un cronometro activo o pausado sobre ella.

#### Ambito de validacion

El backend debe revisar **todas las operaciones con secuencia menor de la misma OT**, aunque pertenezcan a otra area `ME` o `ES` distinta del usuario que intenta iniciar.

La secuencia productiva pertenece a la OT completa. Limitar la validacion al area del usuario permitiria iniciar una operacion posterior mientras una operacion anterior de otra area continua pendiente.

Cada operacion pendiente devuelta al frontend debe incluir, cuando este disponible:

- `work_order_operation_id`;
- `operation_sequence`;
- `operation_name`;
- `resource_code`;
- `area`;
- estado funcional detectado.

#### Contrato HTTP

Cuando existan operaciones anteriores pendientes y la solicitud no incluya override confirmado, el backend debe responder:

```text
HTTP 409 Conflict
code: PREVIOUS_OPERATIONS_PENDING
```

Contrato minimo esperado:

```json
{
  "code": "PREVIOUS_OPERATIONS_PENDING",
  "message": "Existen operaciones anteriores pendientes para esta OT.",
  "pending_operations": [
    {
      "work_order_operation_id": 123,
      "operation_sequence": 10,
      "operation_name": "CORTE",
      "resource_code": "ES101",
      "area": "ES",
      "status": "ACTIVE"
    }
  ]
}
```

El reintento confirmado debe incluir un campo explicito:

```json
{
  "work_order_operation_id": 456,
  "timer_mode": "RUN",
  "ignore_previous_operations_warning": true
}
```

El backend debe volver a consultar el estado real antes de aceptar el override. No debe confiar en el listado de pendientes enviado por el frontend.

#### Prioridad de entrega

Primera entrega obligatoria:

1. Validacion de operaciones anteriores.
2. Warning con opcion de cancelar o continuar.
3. Reintento confirmado mediante override explicito.
4. Registro de `warning_ignored=true` en `timer_events.details_json`.

El filtro especifico `warning_ignored` dentro de `Log Usuarios` queda fuera de esta primera entrega y se implementara como mejora posterior. Los datos deben quedar almacenados desde la primera version para no perder historial.

Flujo esperado:

```text
Usuario intenta iniciar operacion N
  -> backend busca operaciones anteriores de la misma OT
  -> si no existen pendientes: inicia normalmente
  -> si existen pendientes y no hay confirmacion: responde warning con listado
  -> frontend muestra popup no bloqueante
  -> usuario cancela o confirma "Continuar de todas formas"
  -> si confirma: frontend repite la solicitud con override explicito
  -> backend vuelve a validar, inicia y registra la excepcion en el evento START
```

Decision de persistencia:

No crear una tabla nueva en la primera version. Reutilizar `timer_events`, porque el modelo vigente ya registra el usuario, la operacion, la fecha/hora y dispone de `details_json`.

Cuando el usuario ignore la advertencia, el evento `START` debe guardar como minimo:

```json
{
  "resource_code": "ES411",
  "timer_mode": "RUN",
  "precedence_warning": true,
  "warning_ignored": true,
  "selected_operation_sequence": 30,
  "pending_previous_operations": [
    {
      "work_order_operation_id": 123,
      "operation_sequence": 10,
      "operation_name": "CORTE",
      "status": "PENDING"
    },
    {
      "work_order_operation_id": 124,
      "operation_sequence": 20,
      "operation_name": "ARMADO",
      "status": "ACTIVE"
    }
  ]
}
```

Reglas obligatorias para Programador:

1. La deteccion de pendientes debe ocurrir en backend dentro del flujo de `startTimer` y en cualquier transicion que inicie EJECUCION automaticamente.
2. El backend debe responder `HTTP 409 Conflict` con el codigo funcional estable `PREVIOUS_OPERATIONS_PENDING` y el listado de operaciones pendientes.
3. La primera solicitud no debe iniciar el cronometro cuando existan pendientes.
4. Solo una segunda solicitud con confirmacion explicita, por ejemplo `ignore_previous_operations_warning=true`, puede continuar.
5. Antes de aceptar el override, el backend debe volver a consultar las operaciones pendientes; no debe confiar en el listado enviado por frontend.
6. Al continuar, la excepcion debe guardarse dentro del mismo evento `START` mediante `details_json`.
7. El usuario que ignoro la advertencia queda identificado por `timer_events.user_id`; la terminal queda trazada mediante el `OperationTimer.station_id` asociado.
8. El snapshot debe incluir las operaciones que seguian pendientes en el momento real del inicio.
9. Cancelar el popup no debe crear timer ni evento.
10. Esta mejora no debe bloquear permanentemente la operacion ni modificar NetSuite.
11. La primera entrega solo debe persistir `warning_ignored=true`; el filtro especifico en `Log Usuarios` queda como mejora posterior.
12. No agregar un nuevo `event_type` para esta primera version; mantener `START` y distinguir la excepcion mediante `details_json`, evitando migracion de esquema y cambios en los calculos de tiempo.

Criterios de aceptacion:

1. Al intentar iniciar operacion 3 con operaciones 1 o 2 pendientes, aparece el warning antes del inicio.
2. Al cancelar, no se inicia cronometro y no se registra `START`.
3. Al continuar, el cronometro inicia normalmente.
4. El evento `START` conserva usuario, OT/operacion, fecha/hora y snapshot de las operaciones pendientes ignoradas.
5. Si las operaciones anteriores dejan de estar pendientes antes de confirmar, el backend inicia sin marcar una advertencia ignorada falsa.
6. La mejora no crea registros ni campos en NetSuite y no cambia los payloads actuales.

### Reporte Log Usuarios V5.3

El sistema debe exponer una vista administrativa llamada `Log Usuarios` dentro de la pestaña `Reporte`. Esta vista debe permitir auditar las acciones ejecutadas por los usuarios sobre las OT's desde la tabla interna `timer_events`.

La finalidad del reporte es trazabilidad operativa interna del Cronometro. No debe modificar ni enviar informacion a NetSuite.

#### Fuente de datos

Fuente principal:

```text
timer_events
```

Relaciones esperadas:

```text
timer_events.operation_timer_id -> operation_timers.id
timer_events.work_order_operation_id -> work_order_operations.id
timer_events.user_id -> users.id
```

#### Mapeo visual de acciones

```text
START  -> Play
RESUME -> Play
PAUSE  -> Pause
STOP   -> Stop
```

Los eventos `AUTO_STOP_SHIFT_END` y `MODE_CHANGE` pueden quedar fuera de la primera version visible, salvo que Programador los necesite para diagnostico tecnico. Si se muestran, deben diferenciarse claramente de las acciones manuales del usuario.

#### Columnas minimas

El reporte debe incluir como minimo:

1. Fecha/hora del evento.
2. Usuario.
3. Accion visual: Play, Pause o Stop.
4. Evento tecnico: START, RESUME, PAUSE o STOP.
5. OT.
6. Operacion.
7. Centro/recurso, si esta disponible en la operacion.
8. Modo: MONTAJE o EJECUCION, si esta disponible.
9. Timer ID.
10. Detalle tecnico resumido desde `details_json`, si existe.

#### Filtros obligatorios

La vista debe tener una zona superior de filtros visibles. Los filtros minimos obligatorios son:

1. Fecha desde.
2. Fecha hasta.
3. Usuario.
4. OT.
5. Accion: Play, Pause, Stop.
6. Evento tecnico: START, RESUME, PAUSE, STOP.
7. Operacion.
8. Centro/recurso.

Reglas de filtro:

1. El rango de fechas debe ser obligatorio o tener un valor por defecto para evitar consultas historicas muy grandes.
2. Valor por defecto recomendado: ultimos 7 dias.
3. Debe existir boton `Buscar` o equivalente para aplicar filtros.
4. Debe existir boton `Limpiar filtros` o equivalente.
5. El filtro por OT debe aceptar busqueda parcial por numero visible de OT.
6. El filtro por usuario debe permitir seleccionar por nombre visible, no solo por ID tecnico.
7. El filtro por accion debe usar etiquetas operativas: Play, Pause, Stop.

#### Ordenamiento por columnas

La tabla debe permitir ordenar por columnas desde la interfaz.

Columnas ordenables obligatorias:

1. Fecha/hora.
2. Usuario.
3. Accion.
4. OT.
5. Operacion.
6. Centro/recurso.

Orden por defecto:

```text
Fecha/hora DESC
```

Esto significa que los eventos mas recientes aparecen arriba.

#### Paginacion

El reporte debe tener paginacion para evitar cargar todo el historial en una sola respuesta.

Reglas recomendadas:

1. Tamano de pagina por defecto: 50 registros.
2. Opciones de tamano: 25, 50, 100.
3. La paginacion debe ejecutarse en backend, no solo en frontend.
4. El endpoint debe devolver total de registros filtrados para que la interfaz pueda mostrar cantidad total y paginas.

#### Backend esperado

Programador debe crear un endpoint de solo lectura para consultar el log de usuarios.

Contrato funcional minimo:

```text
GET /api/chronometer/user-log
```

Parametros sugeridos:

```text
from
to
user_id
work_order
action
event_type
operation
resource_code
page
page_size
sort_by
sort_dir
```

El backend debe validar `sort_by` contra una lista blanca de columnas permitidas para evitar ordenamientos inseguros o ambiguos.

#### Frontend esperado

En la pestaña `Reporte`, Programador debe agregar una subvista o pestaña interna llamada `Log Usuarios`.

La interfaz debe incluir:

1. Panel de filtros arriba.
2. Tabla de resultados abajo.
3. Ordenamiento por columnas.
4. Paginacion.
5. Indicador de carga.
6. Mensaje claro cuando no existan registros.
7. Etiquetas visuales claras para Play, Pause y Stop.

#### Seguridad y permisos

Este reporte es administrativo. Debe quedar visible solo para usuarios con permiso admin del Cronometro, igual que la pestaña `Reporte` actual.

No debe exponer passwords, tokens, payloads sensibles ni informacion tecnica innecesaria en pantalla.

#### Criterios de aceptacion

1. Un administrador puede entrar a `Reporte > Log Usuarios`.
2. Puede filtrar por rango de fecha.
3. Puede filtrar por usuario.
4. Puede filtrar por OT.
5. Puede filtrar por accion Play, Pause o Stop.
6. Puede ordenar por fecha, usuario, accion, OT y operacion.
7. La tabla muestra los eventos mas recientes primero por defecto.
8. La vista pagina los resultados.
9. El reporte usa `timer_events` como fuente.
10. No cambia NetSuite ni la sincronizacion hacia NetSuite.
11. No cambia el comportamiento operativo del cronometro.
12. El reporte es solo lectura.

#### Transicion asistida de MONTAJE a EJECUCION

Cuando el usuario presiona **Detener** sobre un cronometro de tipo **MONTAJE**, el sistema debe cerrar correctamente el tramo de montaje y mostrar un popup de transicion para proponer continuar con **EJECUCION** de la misma OT y operacion.

El comportamiento esperado debe copiar el patron vigente del STOP de **EJECUCION** con popup de cantidad: el boton STOP no ejecuta el cierre definitivo por si solo; solo abre el popup. El cierre real se ejecuta cuando el usuario confirma una opcion del popup.

```text
Usuario presiona STOP en MONTAJE
  -> frontend muestra popup de transicion inmediatamente
  -> todavia no se debe cerrar MONTAJE en backend
  -> usuario elige `Iniciar ejecucion` o `No iniciar ahora`
  -> backend cierra MONTAJE al confirmar la opcion
  -> si eligio `Iniciar ejecucion`, backend inicia EJECUCION en la misma accion
```

Texto funcional del popup:

```text
Montaje detenido.
¿Quieres seguir cronometrando ejecucion?
```

Acciones del popup:

| Accion | Comportamiento esperado |
|---|---|
| `Iniciar ejecucion` | Inicia inmediatamente un nuevo cronometro de tipo EJECUCION usando el mismo contexto operativo: OT, operacion, recurso, usuario y terminal. |
| `No iniciar ahora` | Cierra el popup y deja la operacion sin cronometro activo, sin iniciar ejecucion. |

Reglas obligatorias para Programador:

1. El popup solo aplica al presionar STOP sobre **MONTAJE** activo o pausado.
2. MONTAJE debe seguir el mismo patron de **EJECUCION**: el boton STOP abre popup; el endpoint de cierre se llama solo al confirmar el popup.
3. No cerrar MONTAJE antes de mostrar el popup.
4. No mostrar el popup como confirmacion de algo ya cerrado; el popup es la decision previa al cierre real.
5. No aplica al detener **EJECUCION**; en ejecucion se mantiene la regla vigente del popup de cantidad terminada.
6. La ejecucion no debe iniciarse automaticamente solo por presionar STOP en montaje; debe iniciarse cuando el usuario presiona `Iniciar ejecucion`.
7. Si el usuario presiona `Iniciar ejecucion`, backend debe cerrar MONTAJE e iniciar EJECUCION en una misma accion transaccional/logica.
8. Si el usuario presiona `No iniciar ahora`, backend debe cerrar MONTAJE y no crear/iniciar cronometro de EJECUCION.
9. Si la llamada al backend falla, el frontend debe mantener el popup o mostrar error claro; no debe simular que montaje quedo detenido.
10. Si el usuario presiona `Iniciar ejecucion`, el cronometro de ejecucion debe quedar visible en Operaciones Activas inmediatamente.
11. El nuevo cronometro de ejecucion debe heredar el mismo contexto operativo del montaje: OT, operacion, recurso, usuario, area/workplace y `station_id`.
12. No se debe pedir cantidad, observacion, motivo ni datos adicionales en esta transicion.
13. Esta transicion no cambia el contrato NetSuite: montaje y ejecucion siguen consolidandose como tiempos reales separados de la misma operacion.

Criterios de aceptacion:

1. Al presionar STOP en MONTAJE, el popup aparece inmediatamente, igual que el popup de cantidad al detener EJECUCION.
2. Antes de confirmar una opcion del popup, MONTAJE no debe quedar cerrado en backend.
3. El boton principal del popup permite iniciar EJECUCION sin volver a buscar ni seleccionar la OT.
4. Al confirmar `Iniciar ejecucion`, el backend registra STOP de MONTAJE y START de EJECUCION para la misma OT/operacion, y la pantalla muestra etiqueta `EJECUCION` con cronometro corriendo.
5. Al confirmar `No iniciar ahora`, el backend registra STOP de MONTAJE y no crea/inicia cronometro de EJECUCION.
6. Si la confirmacion falla, el usuario ve error y no se debe mostrar un estado falso de montaje detenido.
7. Al detener EJECUCION, se conserva el flujo existente de cantidad terminada.

### Terminal compartida

- El front envia `x-station-id` en todas las peticiones.
- Se genera en `localStorage` como `reloj_station_id` por navegador (mismo valor para todos los operarios que usen ese navegador/PC).
- Opcionalmente puede fijarse por entorno con `VUE_APP_STATION_ID`.
- Pausa, stop, resume y play sobre un timer en pausa deben rechazar otra terminal con `403` si el `station_id` del timer no corresponde a la terminal actual.

### Tableros operativos (dos vistas distintas)

El sistema expone **dos tableros** con propositos diferentes. No deben mezclarse ni unificarse.

#### Tablero Grande (protector / screensaver 2x2)

Vista de solo lectura para monitor de planta en el PC de la estacion.

| Aspecto | Regla |
|---|---|
| **Que muestra** | Todas las operaciones en estado **ACTIVE** o **PAUSED** cronometradas en **esta estacion** (`station_id` = `x-station-id` del navegador), de **todos los operarios** que trabajen en ese PC. |
| **Quien lo ve** | Operario y admin (misma regla por estacion: lo que ocurre en este terminal). |
| **Controles** | Ninguno (solo visualizacion). |
| **Apertura** | Automatica tras inactividad (`VUE_APP_IDLE_BOARD_MINUTES`, default 2 min) o boton **Ver tablero grande**. |
| **Layout** | Rejilla **2x2**; **carrusel** automatico si hay mas de 4 tareas (`VUE_APP_IDLE_BOARD_CAROUSEL_SEC`). |
| **API** | `GET /chronometer/board/active?scope=station` |

#### Operaciones Activas (tabla con controles)

Tabla operativa debajo de la busqueda de OT, con botones play / pause / stop por fila.

| Rol | Que muestra | API |
|---|---|---|
| **Operario** | Solo las operaciones que **el usuario logueado** esta cronometrando (su timer en esta sesion). | `GET /chronometer/board/active?scope=mine` |
| **Admin** | Todas las operaciones activas/pausadas de **todos los terminales y todos los usuarios** de la planta. | `GET /chronometer/board/active?scope=mine` (sin filtro adicional de usuario/estacion) |

Esta tabla **no se modifica** con los cambios del Tablero Grande: el operario sigue viendo solo lo suyo para operar sin confusion; el admin sigue teniendo vision global para supervisar y liberar relojes.

Variables opcionales del Tablero Grande: `VUE_APP_IDLE_BOARD_ENABLED`, `VUE_APP_IDLE_BOARD_SLOTS`, `VUE_APP_IDLE_BOARD_CAROUSEL_SEC`, `VUE_APP_IDLE_BOARD_POLL_SEC`.

### Requerimiento V5: multioperario y multiterminal por operacion

Este requerimiento debe desarrollarse en una nueva rama `V5`, porque cambia una regla central del cronometraje: la cardinalidad de cronometros activos por operacion.

Situacion funcional:

Una misma operacion puede ser ejecutada por varios operarios en paralelo. Ejemplo: `OT10534 / operacion 1 / Pintura` puede estar siendo cronometrada al mismo tiempo por mas de un usuario. En ese caso, cada usuario debe conservar su propio tiempo y trazabilidad. No corresponde bloquear la operacion completa solo porque otro usuario ya la esta cronometrando.

Decision arquitectonica V5:

```text
Una misma OT/operacion puede tener multiples cronometros simultaneos.
La unicidad del cronometro activo/pausado no es por operacion, sino por:
  work_order_operation_id + current_user_id + station_id
```

Reglas obligatorias para Programador:

1. Eliminar el bloqueo global que impide iniciar un cronometro sobre una operacion si ya existe otro cronometro activo/pausado de la misma `work_order_operation_id`.
2. No reutilizar un `OperationTimer` existente solo por `work_order_operation_id`.
3. Al iniciar cronometro, buscar o crear el timer usando como identidad funcional minima `work_order_operation_id + current_user_id + station_id`.
4. Una misma combinacion `work_order_operation_id + current_user_id + station_id` no debe tener mas de un timer activo/pausado.
5. El mismo usuario puede cronometrar la misma operacion desde otra terminal si el `station_id` es distinto.
6. Usuarios distintos pueden cronometrar simultaneamente la misma operacion, incluso desde la misma terminal, siempre que cada timer quede asociado al usuario correcto.
7. Pausar, reanudar, detener o cambiar modo debe operar sobre el timer propio de esa combinacion o sobre un `timer_id` explicito validado.
8. Un usuario no debe detener ni modificar el timer de otro usuario/terminal, salvo rol supervisor/admin cuando exista una accion administrativa explicita.
9. `current_user_id`, `station_id` y `timer_events.user_id` deben conservar trazabilidad correcta durante START, PAUSE, RESUME, MODE_CHANGE y STOP.
10. En **Operaciones Activas**, el operario solo ve y controla **su** cronometro; en la busqueda de OT puede indicarse `other_active_timers` si otros operarios cronometran la misma operacion. El **Tablero Grande** muestra en cambio todos los cronometros activos/pausados de la estacion (solo lectura).
11. Si el mismo usuario ya tiene la operacion activa en otra terminal, el sistema puede permitir iniciar otro cronometro, pero debe evitar que el usuario lo confunda con el timer de la terminal actual (mensajes y scope `mine` en Operaciones Activas).
12. El cierre programado/STOP_BATCH debe detener todos los timers activos/pausados, incluyendo multiples timers asociados a la misma operacion.
13. No cambiar el contrato NetSuite ni la logica vigente de envio como parte de este requerimiento.
14. Cada STOP debe seguir generando/publicandose con la logica actual hacia `import_ot` y ZIM400.
15. ZIM400 debe conservar un registro por STOP con empleado derivado de `Users.netsuiteEmployeeId`.
16. `import_ot` debe seguir recibiendo los envios tal como los genera hoy el sistema; si existen tres STOP de 60 minutos sobre la misma operacion, se deben procesar como tres aportes de tiempo equivalentes a 180 minutos totales aplicados por NetSuite.
17. La cantidad terminada no debe duplicarse automaticamente por existir varios usuarios cronometrando la misma operacion. Si varios usuarios detienen ejecucion, la regla de cantidad debe mantenerse igual que hoy hasta que se defina un cambio funcional especifico.

Ejemplo esperado:

```text
OT10534 / operacion 1 / Pintura

Usuario A / Terminal 1 -> cronometra 60 min -> STOP A
Usuario B / Terminal 2 -> cronometra 60 min -> STOP B
Usuario C / Terminal 3 -> cronometra 60 min -> STOP C

Resultado esperado:
- Se conservan tres timers/eventos independientes.
- ZIM400 recibe tres registros, cada uno con su empleado real.
- import_ot recibe los envios segun la logica vigente, sin contrato nuevo.
- El tiempo total operativo aplicado a la operacion equivale a 180 minutos.
```

Criterios de aceptacion V5:

1. Usuario A puede iniciar OT/operacion aunque Usuario B ya la tenga activa.
2. Usuario A y Usuario B no pisan el mismo `OperationTimer`.
3. `current_user_id` no se sobrescribe con el ultimo usuario que presiona play.
4. Cada STOP queda asociado al usuario real que cronometro.
5. ZIM400 puede identificar el empleado correcto para cada STOP.
6. **Operaciones Activas** no mezcla controles del timer propio con timers ajenos; el **Tablero Grande** puede listar varios operarios en la misma estacion sin permitir operarlos.
7. El cierre programado detiene todos los timers paralelos de la misma operacion.
8. La sincronizacion sigue usando la logica vigente sin modificar RESTlet, Saved Search, OAuth ni custom records NetSuite.
9. No se duplica cantidad terminada por multioperario.
10. V3 queda como baseline estable; V5 se desarrolla y valida en rama separada.

### Requerimiento V5.1: multi-OT por mismo recurso (centro de trabajo)

Este requerimiento extiende V5 y **revoca** la regla historica de **una sola operacion ACTIVE por recurso** (`resource_code` / centro de trabajo NetSuite).

Situacion funcional:

En planta, el mismo centro de trabajo puede aparecer en el ruteo de **varias OT en curso** (NetSuite WIP). Distintos operarios pueden trabajar **OT distintas** que comparten el mismo codigo de recurso (ej. `ES411 ARMADO`). Cada operario debe poder cronometrar **su** operacion sin que el sistema bloquee el play porque otro operario tiene ACTIVE otra OT en ese recurso.

Decision arquitectonica V5.1:

```text
El resource_code identifica el centro de trabajo NetSuite de la operacion, pero NO es llave de exclusividad del cronometro.
La unicidad del cronometro activo/pausado sigue siendo unicamente:
  work_order_operation_id + current_user_id + station_id
```

Reglas obligatorias para Programador:

1. **Eliminar** cualquier bloqueo en `startTimer`, `resumeTimer` o transiciones de montaje que impida iniciar/reanudar cuando exista otro `OperationTimer` ACTIVE con el mismo `resource_code` y distinta `work_order_operation_id`.
2. **No** mostrar error `RESOURCE_BUSY_BY_OTHER_USER` ni equivalente por recurso compartido entre OT distintas.
3. Permitir que el operario A cronometre `OT1 / secuencia 1` en recurso `ESXX` aunque el operario B tenga ACTIVE `OT2 / secuencia 1` en el mismo `ESXX`.
4. Permitir tambien que el **mismo operario** cronometre dos OT distintas en el mismo recurso si corresponde operativamente (identidad distinta por `work_order_operation_id`).
5. Mantener intactas las reglas V5 de control por terminal/usuario: un operario no controla el timer ajeno; admin puede liberar.
6. `resource_code` se sigue persistiendo en `operation_timers` y eventos para trazabilidad y NetSuite; solo deja de usarse como candado global.
7. No cambiar contrato NetSuite: cada STOP sigue enviando tiempos a **su** operacion de OT (`import_ot` / ZIM400 por operacion).

Ejemplo esperado:

```text
Recurso: ES411 ARMADO

Operario B / Terminal 2 -> OT17847 / operacion 4 -> ACTIVE (montaje)
Operario A / Terminal 1 -> OT18584 / operacion 2 -> puede iniciar sin error

Resultado esperado:
- Dos timers independientes, misma resource_code, distintas work_order_operation_id.
- Cada STOP acumula tiempo en su operacion NetSuite correspondiente.
- No hay mensaje de recurso ocupado entre OT distintas.
```

Criterios de aceptacion V5.1:

1. Operario A puede dar Play en `OT18584/2` aunque operario B tenga ACTIVE otra OT en `ES411 ARMADO`.
2. Operario A y operario B conservan timers, eventos y tiempos independientes.
3. El sistema no rechaza start/resume por `resource_code` compartido.
4. Los bloqueos por terminal/usuario ajeno (V5) siguen vigentes al pausar/detener/cambiar modo.
5. Sincronizacion NetSuite sin cambio de contrato.

Regla historica revocada (no implementar):

```text
Una maquina/recurso no debe tener dos operaciones activas simultaneas en el cronometro.
```

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

Reglas vigentes (flujo V4/V5 por STOP + RESTlet/`import_ot`):

- Cada STOP publica un **delta de tramo**, no el acumulado historico del timer ni el valor absoluto vigente de la tarea.
- El tramo de un STOP es: desde el STOP anterior del mismo `operation_timer_id` (exclusivo) hasta el STOP actual (inclusivo). Si es el primer STOP del timer, desde el primer START hasta ese STOP.
- NetSuite TEK/`Importacion OT` **suma** cada aporte; reenviar acumulados duplica setup y/o run.
- La cantidad enviada en un STOP es la del evento (`details_json.completed_quantity`), no un recalculo del historial.
- ZIM400 usa el mismo `actual_run_time` del item de push (minutos del tramo).
- Tras el push, Cronometro debe hacer pull para recalzar estado local (`last_pushed_*` / actuals).

Nota historica (batch previo a V4): existia documentacion de "valor vigente, no delta" y envio por batch agrupado por OT. Eso **no** aplica al worker V4 por `stop_event_id`.

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

### Modulo Poblar Reporte ZIM400

Se define el modulo **Poblar Reporte ZIM400** como una segunda entrega NetSuite reutilizable para publicar registros en `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL`, destino de la Saved Search `customsearch400` / `ZIM - Data Reloj Control Default View`.

Este modulo no reemplaza ni modifica el flujo vigente hacia `import_ot`. `import_ot` conserva su contrato transaccional actual hacia `customrecord_3k_importacion_ot`; ZIM400 agrega una publicacion independiente para alimentar el reporte Data Reloj Control.

Decision arquitectonica vigente 2026-06-04:

- ZIM400 debe implementarse como **publisher independiente y reutilizable**, no como orquestador completo.
- El worker V4 puede usar el publisher ZIM400 para STOP individuales desacoplados.
- El cierre programado operational tambien debe usar el publisher ZIM400, pero dentro de su propio `sync_run` operational.
- El cierre programado **no debe reutilizar el flujo completo `v4_stop_queue`**, porque ese flujo fue concebido para reprocesar pendientes STOP y puede volver a ejecutar `PUSH_IMPORT_OT`, duplicando publicaciones de actuals.
- Para cierre programado, el responsable de la orquestacion es el `sync_run` operational, no el worker V4.

Arquitectura esperada para STOP individual desacoplado V4:

```text
STOP del operario
  -> consolidar tiempo local
  -> crear/procesar pendiente del worker
  -> push 1: import_ot vigente, sin modificar
  -> push 2: Poblar Reporte ZIM400
```

Arquitectura esperada para cierre programado operational:

```text
Cierre programado operational
  -> STOP_BATCH
  -> PUSH_IMPORT_OT una sola vez para el conjunto consolidado
  -> PUSH_ZIM400 usando los STOP generados por el cierre
  -> GATE_IMPORT_OT
  -> GATE_ZIM400_STATUS
  -> PULL
```

La entrega a ZIM400 debe tratarse como un modulo independiente, con armado de payload propio, trazabilidad propia y manejo de errores propio. El fallo del push a ZIM400 no debe bloquear ni invalidar el envio exitoso a `import_ot`. Si `import_ot` fue enviado correctamente y ZIM400 falla, el flujo operativo queda valido y solo debe quedar pendiente el reintento o diagnostico del modulo ZIM400.

La granularidad del modulo sera **un registro por STOP**. Cada STOP cerrado en Cronometro debe producir, cuando corresponda, un registro en `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL`, poblando el maximo de campos disponibles con la informacion ya existente en Cronometro y en la data OUT de NetSuite.

#### Destino NetSuite ZIM400

| Elemento | Valor |
|---|---|
| Saved Search | `customsearch400` |
| Titulo visible | `ZIM - Data Reloj Control Default View` |
| URL observada SB | `searchresults.nl?searchid=400` |
| Record visible | `ZIM - Data Reloj Control` |
| Record tecnico SuiteQL | `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL` |
| Tipo de escritura esperada | Creacion de custom record por STOP |

#### Campos NetSuite detectados para ZIM400

Campos tecnicos confirmados por inspeccion SuiteQL / Saved Search:

```text
id
name
scriptid
created
lastmodified
isinactive
custrecord_zim_reloj_ot
custrecord_zim_reloj_ot_id
custrecord_zim_reloj_ot_text
custrecord_zim_reloj_empleado
custrecord_zim_reoj_zona
custrecord_zim_reloj_tarea
custrecord_zim_reloj_tarea_texto
custrecord_zim_reloj_num_secuencia
custrecord_zim_reloj_operacion
custrecord_zim_reloj_minutos_cargados
custrecord_zim_reloj_horas
custrecord_zim_reloj_inicio
custrecord_zim_reloj_fin
custrecord_zim_reloj_estado
custrecord_zim_reloj_tiempo_planificado
custrecord_zim_reloj_cantidad
custrecord_zim_reloj_cantidad_terminada
custrecord_zim_reloj_finalizacion
custrecord_zim_reloj_revision
custrecord_zim_reloj_ot_fecha_ini
custrecord_zim_reloj_ot_fecha_fin
custrecord_zim_reloj_ot_estado
custrecord_zim_reloj_cantidad_rechazada
```

Nota critica: el campo de zona tiene ID tecnico `custrecord_zim_reoj_zona`, sin la letra `l` en `reloj`. No corregirlo a `custrecord_zim_reloj_zona` en codigo; usar el ID real observado.

#### Mapping inicial de campos ZIM400

| Campo reporte 400 | Campo tecnico NetSuite | Podemos poblarlo | Fuente Cronometro / NetSuite OUT |
|---|---|---:|---|
| OT | `custrecord_zim_reloj_ot` | Si | `manufacturingOperationTask.workOrder`; si ya existe en `work_order_operations.netsuite_work_order_id`, usar ese valor |
| OT ID | `custrecord_zim_reloj_ot_id` | Si | mismo valor que `custrecord_zim_reloj_ot`: `manufacturingOperationTask.workOrder` |
| OT Texto | `custrecord_zim_reloj_ot_text` | Si | `ot_number` formateado como `Orden de Trabajo #<OT>` |
| Tarea | `custrecord_zim_reloj_tarea` | Si | `manufacturingOperationTask.manufacturingWorkCenter`, no `manufacturingOperationTask.id` |
| Tarea Texto | `custrecord_zim_reloj_tarea_texto` | Si | formato historico ZIM: `(<secuencia>) <centro trabajo>`, ejemplo `(4) ES217 BANCO ESTRUCTURA` |
| Numero Secuencia | `custrecord_zim_reloj_num_secuencia` | Si | `operation_sequence` |
| Operacion | `custrecord_zim_reloj_operacion` | Si | `operation_name` |
| Minutos Cargados | `custrecord_zim_reloj_minutos_cargados` | Si | duracion del STOP en minutos |
| Inicio | `custrecord_zim_reloj_inicio` | Si | inicio del timer/evento STOP |
| Fin | `custrecord_zim_reloj_fin` | Si | fin del timer/evento STOP |
| Cantidad Producir | `custrecord_zim_reloj_cantidad` | Si | `planned_quantity` |
| Cantidad Terminada | `custrecord_zim_reloj_cantidad_terminada` | Si | cantidad informada al STOP, si existe |
| Tiempo Planificado | `custrecord_zim_reloj_tiempo_planificado` | Si/medio | `planned_setup_minutes` + ejecucion planificada segun regla vigente |
| Zona | `custrecord_zim_reoj_zona` | Si/medio | mapping `ME` / `ES` / `IN` a ID interno NetSuite |
| Estado | `custrecord_zim_reloj_estado` | Si/medio | valor historico observado `4`; validar en pruebas posteriores |
| Empleado | `custrecord_zim_reloj_empleado` | Si/medio | mapping usuario Cronometro -> empleado NetSuite |
| Horas | `custrecord_zim_reloj_horas` | Si, derivado | minutos / 60 o valor historico `0`, segun prueba posterior |
| Finalizacion | `custrecord_zim_reloj_finalizacion` | No inicialmente | depende de transaccion posterior / finalizacion OT |
| Revision | `custrecord_zim_reloj_revision` | No seguro | aparece en historico, no confirmado en modelo local actual |
| OT Fecha Inicio | `custrecord_zim_reloj_ot_fecha_ini` | No seguro | podria venir de OUT si se agrega o existe en fuente NetSuite |
| OT Fecha Fin | `custrecord_zim_reloj_ot_fecha_fin` | No seguro | podria venir de OUT si se agrega o existe en fuente NetSuite |
| OT Estado | `custrecord_zim_reloj_ot_estado` | No seguro | podria venir de OUT si se agrega o existe en fuente NetSuite |
| Cantidad Rechazada | `custrecord_zim_reloj_cantidad_rechazada` | No inicialmente | Cronometro no captura rechazo hoy |

#### Correccion confirmada de mapping ZIM400 para OT y Tarea

En pruebas reales de `PUSH_ZIM400`, NetSuite rechazo el valor `82357` para `custrecord_zim_reloj_tarea` con HTTP 400. La causa confirmada es que `82357` corresponde al ID de `manufacturingOperationTask`, pero el campo ZIM400 `custrecord_zim_reloj_tarea` espera el ID del centro de trabajo (`manufacturingWorkCenter`).

Caso confirmado en NetSuite SB:

```text
OT texto: Orden de Trabajo #OT13514
manufacturingOperationTask.id: 82357
manufacturingOperationTask.operationSequence: 4
manufacturingOperationTask.title: BANCO
manufacturingOperationTask.workOrder: 668854
manufacturingOperationTask.manufacturingWorkCenter: 10332
```

Para esa misma OT en el reporte historico ZIM400 se observa:

```text
custrecord_zim_reloj_ot_id: 668854
custrecord_zim_reloj_tarea: 10332
custrecord_zim_reloj_tarea_texto: (4) ES217 BANCO ESTRUCTURA
custrecord_zim_reloj_num_secuencia: 4
custrecord_zim_reloj_operacion: BANCO
```

Regla obligatoria para Programador:

```text
NO enviar:
  custrecord_zim_reloj_tarea = manufacturingOperationTask.id

SI enviar:
  custrecord_zim_reloj_ot    = manufacturingOperationTask.workOrder
  custrecord_zim_reloj_ot_id = manufacturingOperationTask.workOrder
  custrecord_zim_reloj_tarea = manufacturingOperationTask.manufacturingWorkCenter
```

El modulo ZIM400 debe enriquecer el payload usando el `netsuite_operation_id` local para obtener, como minimo, `workOrder` y `manufacturingWorkCenter` de la `manufacturingOperationTask` correspondiente. Si estos datos ya vienen persistidos desde OUT en `work_order_operations`, puede usarlos directamente; si no estan, debe obtenerlos desde NetSuite o extender el OUT para persistirlos.

Tambien se debe validar que `custrecord_zim_reloj_fin` no sea anterior a `custrecord_zim_reloj_inicio`. Si el evento local trae fechas invertidas, el modulo debe corregir el origen del dato o rechazar el payload ZIM400 con error local explicito antes de enviar a NetSuite.

La captura funcional del reporte confirma que las columnas visibles esperadas incluyen, entre otras: `ZIM - RELOJ OT TEXTO`, `ZIM - RELOJ OT ID`, `ZIM - RELOJ TAREA TEXTO`, `ZIM - RELOJ TIEMPO PLANIFICADO`, `ZIM - RELOJ CANTIDAD PRODUCIR`, `ZIM - RELOJ CANTIDAD TERMINADA`, `ZIM - RELOJ OT FECHA FIN`, `ZIM - RELOJ OT ESTADO`, `ZIM - RELOJ REVISION`, `ZIM - RELOJ NUMERO SECUENCIA`, `ZIM - RELOJ OPERACION` y `FECHA DE CREACION`.

#### Regla de publishers independientes por destino

El programador debe entender el procesamiento como dos publishers independientes llamados por un orquestador superior. El orquestador puede ser el worker V4 para STOP individuales, o el `sync_run` operational para cierre programado.

```text
orquestador de sincronizacion
  ├─ importOtPublisher         -> customrecord_3k_importacion_ot
  └─ poblarReporteZIM400       -> CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL
```

Reglas obligatorias:

1. No modificar el payload, contrato ni semantica del push actual a `import_ot` salvo que el proyecto lo pida explicitamente.
2. El modulo ZIM400 recibe el mismo contexto funcional del STOP/cierre, pero arma su propio payload ampliado.
3. `import_ot` y ZIM400 deben tener trazabilidad y estado de envio independientes.
4. Si ZIM400 falla, no debe revertir, bloquear ni marcar como fallido el push exitoso a `import_ot`.
5. Si `import_ot` falla, no se debe asumir que ZIM400 fallo; cada destino debe registrar su resultado.
6. El modulo ZIM400 debe ser reintentable sin reejecutar necesariamente `import_ot`.
7. El modulo ZIM400 debe tener idempotencia por evento STOP para evitar duplicar registros historicos en reintentos.
8. El cierre programado operational no debe invocar el flujo completo `v4_stop_queue` si este vuelve a ejecutar `import_ot`; debe llamar directamente al publisher ZIM400 o a un servicio comun que no duplique `PUSH_IMPORT_OT`.
9. Las pruebas contra `customsearch400` / `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL` se realizaran despues de programar el modulo; no forman parte de esta definicion arquitectonica inicial.

#### Idempotencia ZIM400

El modulo debe conservar una marca local que permita saber si un STOP ya fue publicado a ZIM400. La llave recomendada debe basarse en el identificador local del evento STOP o del timer cerrado, no solo en OT/operacion, porque una misma operacion puede tener multiples STOP validos.

Campos minimos recomendados para trazabilidad local del envio ZIM400:

```text
stop_event_id / timer_event_id
work_order_operation_id
ot_number
operation_sequence
netsuite_work_order_id
netsuite_operation_id
zim400_status
zim400_attempt_count
zim400_last_error
zim400_payload_json
zim400_netsuite_record_id
zim400_sent_at
```

Estados sugeridos:

```text
PENDING
PROCESSING
SENT
ERROR
RETRY
CANCELLED
```

#### Log diagnostico obligatorio para PUSH_ZIM400

El modulo `PUSH_ZIM400` debe registrar informacion suficiente para diagnosticar errores de NetSuite. No es aceptable guardar solamente mensajes genericos de Axios como `Request failed with status code 400`, porque ese texto no permite saber si el rechazo fue por campo invalido, tipo de dato, formato de fecha, referencia inexistente, permiso insuficiente o record type incorrecto.

En cada intento ZIM400, exitoso o fallido, el backend debe persistir en `sync_run_steps.result_json` y/o en la tabla local de cola ZIM400 un objeto diagnostico sin secretos con esta estructura minima:

```json
{
  "queue_id": 14,
  "trigger_event_id": 633,
  "work_order_operation_id": 114770,
  "destination": "ZIM400",
  "record_type": "CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL",
  "method": "CREATE",
  "request_payload": {
    "custrecord_zim_reloj_ot": "...",
    "custrecord_zim_reloj_tarea": "..."
  },
  "response": {
    "ok": false,
    "http_status": 400,
    "status_text": "Bad Request",
    "data": {},
    "error_details": []
  },
  "error_message": "...",
  "attempt": 1,
  "created_at": "ISO-8601",
  "finished_at": "ISO-8601"
}
```

Reglas del log ZIM400:

1. Guardar el `request_payload` exacto enviado a NetSuite, excluyendo tokens, headers de Authorization, private keys o secretos.
2. Guardar `record_type`, URL base o identificador logico del destino, metodo de operacion y `queue_id` / `trigger_event_id`.
3. Si NetSuite responde con error HTTP, guardar `error.response.status`, `error.response.statusText`, `error.response.data` y, si existe, `o:errorDetails`.
4. Si el error ocurre antes de recibir respuesta HTTP, guardar codigo tecnico (`ECONNRESET`, `ETIMEDOUT`, DNS, timeout, etc.) y mensaje completo.
5. La pantalla de detalle de sincronizacion debe mostrar o permitir ver este detalle, no solo el mensaje resumido.
6. El log debe permitir copiar el payload fallido para reproducir una prueba controlada posterior contra NetSuite SB.
7. El log debe marcar claramente si `import_ot` fue exitoso aunque ZIM400 haya fallado.

Ante un HTTP 400 en `PUSH_ZIM400`, la investigacion debe partir por este log y revisar, en este orden:

```text
1. record_type usado
2. request_payload exacto
3. response.data completo de NetSuite
4. o:errorDetails si existe
5. campo tecnico rechazado o referencia invalida
6. formato de fecha/hora
7. mapping de empleado, zona, OT y tarea
```

#### Reglas integrales de visibilidad en reporte 400

Una creacion exitosa del custom record ZIM400 no garantiza por si sola que el registro aparezca en la vista filtrada de la Saved Search `customsearch400`. En prueba real, NetSuite respondio `204 No Content` y creo el registro `1476814`, pero la busqueda filtrada por OT no lo mostro. La verificacion SuiteQL confirmo que el registro existia y estaba activo, pero quedo con valores distintos al historico usado por el reporte:

```text
id: 1476814
isinactive: F
custrecord_zim_reloj_ot: 668854
custrecord_zim_reloj_ot_id: 668854
custrecord_zim_reloj_ot_text: Orden de Trabajo #OT13514
custrecord_zim_reloj_tarea: 10332
custrecord_zim_reloj_tarea_texto: (4) ES217 BANCO ESTRUCTURA BANCO
custrecord_zim_reloj_estado: 1
custrecord_zim_reloj_empleado: null
custrecord_zim_reoj_zona: null
```

En el historico del mismo reporte para OT13514, los registros visibles usan, entre otros:

```text
custrecord_zim_reloj_estado: 4
custrecord_zim_reoj_zona: 1
custrecord_zim_reloj_revision: 6349
custrecord_zim_reloj_ot_estado: 3
custrecord_zim_reloj_ot_fecha_ini: 02/10/2024
custrecord_zim_reloj_ot_fecha_fin: 25/10/2024
```

Reglas obligatorias para que Programador implemente en el builder ZIM400:

1. Para un STOP cerrado, enviar `custrecord_zim_reloj_estado = 4`. No dejar que NetSuite asigne estado por defecto `1`.
2. Enviar `custrecord_zim_reoj_zona = 1` inicialmente, hasta que exista mapping mas fino por area/centro de trabajo.
3. Enviar todos los IDs y numericos como `Number`, no como `String`.
4. Omitir campos `null` o `undefined`; no enviarlos como null salvo que se haya validado expresamente que NetSuite los acepta.
5. Usar `custrecord_zim_reloj_ot` y `custrecord_zim_reloj_ot_id` con el ID interno de OT (`manufacturingOperationTask.workOrder`).
6. Usar `custrecord_zim_reloj_tarea` con el ID interno del centro de trabajo (`manufacturingOperationTask.manufacturingWorkCenter`).
7. Usar `custrecord_zim_reloj_tarea_texto` en formato historico sin duplicar operacion al final: `(<secuencia>) <centro trabajo>`, por ejemplo `(4) ES217 BANCO ESTRUCTURA`.
8. Enriquecer el payload con contexto de OT cuando este disponible desde NetSuite/OUT: `custrecord_zim_reloj_revision`, `custrecord_zim_reloj_ot_estado`, `custrecord_zim_reloj_ot_fecha_ini` y `custrecord_zim_reloj_ot_fecha_fin`.
9. Enviar `custrecord_zim_reloj_empleado` solo cuando exista mapping confirmado usuario Cronometro -> empleado NetSuite. Si no existe, omitirlo.
10. Validar que `custrecord_zim_reloj_fin >= custrecord_zim_reloj_inicio` antes de enviar.
11. Validar coherencia entre `custrecord_zim_reloj_minutos_cargados`, `custrecord_zim_reloj_horas`, `custrecord_zim_reloj_inicio` y `custrecord_zim_reloj_fin`; si minutos representa acumulado y no tramo, debe quedar explicito en el log diagnostico.

Matriz integral esperada para el payload ZIM400:

| Campo ZIM400 | Tipo esperado | Fuente correcta | Regla |
|---|---:|---|---|
| `custrecord_zim_reloj_ot` | Number | `manufacturingOperationTask.workOrder` | Obligatorio si existe OT interna |
| `custrecord_zim_reloj_ot_id` | Number | `manufacturingOperationTask.workOrder` | Igual a OT |
| `custrecord_zim_reloj_ot_text` | String | `Orden de Trabajo #<OT>` | Texto visible |
| `custrecord_zim_reloj_tarea` | Number | `manufacturingOperationTask.manufacturingWorkCenter` | No usar `manufacturingOperationTask.id` |
| `custrecord_zim_reloj_tarea_texto` | String | `(<secuencia>) <centro trabajo>` | No duplicar operacion |
| `custrecord_zim_reloj_num_secuencia` | Number | `operation_sequence` | Entero |
| `custrecord_zim_reloj_operacion` | String | `operation_name` | Texto |
| `custrecord_zim_reloj_estado` | Number | constante por STOP cerrado | Usar `4` |
| `custrecord_zim_reoj_zona` | Number | constante ZIM400 | Usar siempre `1` = Producción. No mapear por centro de trabajo ni por prefijo ES/ME |
| `custrecord_zim_reloj_empleado` | Number | `Users.netsuiteEmployeeId` | Usar el ID interno real del empleado NetSuite asociado al usuario Cronometro. No usar constante hardcodeada `42027`, no usar nombre/string ni `Users.id`. Si el usuario no tiene `netsuiteEmployeeId`, omitir el campo y registrar error/advertencia diagnostica para correccion de datos maestros. |
| `custrecord_zim_reloj_revision` | Number | revision OT/BOM/ruta | Enviar si disponible |
| `custrecord_zim_reloj_ot_estado` | Number | estado interno OT | Enviar si disponible |
| `custrecord_zim_reloj_ot_fecha_ini` | Date | fecha inicio OT | Enviar si disponible |
| `custrecord_zim_reloj_ot_fecha_fin` | Date | fecha fin OT | Enviar si disponible |
| `custrecord_zim_reloj_minutos_cargados` | Number | minutos a reportar | Documentar si es tramo o acumulado |
| `custrecord_zim_reloj_horas` | Number | minutos / 60 | Decimal numerico |
| `custrecord_zim_reloj_inicio` | DateTime | inicio STOP/evento | Fecha valida NetSuite |
| `custrecord_zim_reloj_fin` | DateTime | fin STOP/evento | Fecha valida NetSuite |
| `custrecord_zim_reloj_tiempo_planificado` | Number | planificado OUT/NetSuite | Numerico |
| `custrecord_zim_reloj_cantidad` | Number | cantidad a producir | Numerico |
| `custrecord_zim_reloj_cantidad_terminada` | Number | cantidad terminada | Numerico |

Despues de cada creacion exitosa, el diagnostico debe consultar o permitir consultar por `netsuite_record_id` para confirmar los valores reales persistidos. El criterio de exito funcional no es solo recibir `204`; tambien debe poder localizarse el registro en SuiteQL y en la Saved Search `customsearch400` bajo filtros equivalentes.

#### Criterio de aceptacion del modulo ZIM400

1. Cada STOP procesado por el worker genera un intento de push a `import_ot` y un intento independiente de push ZIM400.
2. El push a `import_ot` conserva el comportamiento vigente.
3. El push ZIM400 crea un registro en `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL` cuando NetSuite acepta el payload.
4. El registro creado aparece en la Saved Search `customsearch400`.
5. Un fallo ZIM400 queda registrado con error y puede reintentarse.
6. Un fallo ZIM400 no impide que `import_ot` quede enviado si ese destino respondio correctamente.
7. Reintentar un mismo STOP no duplica registros ZIM400 si ya fue enviado correctamente.
8. Los campos no disponibles se omiten o se envian nulos solo si NetSuite lo permite.
9. Los campos que NetSuite rechace durante pruebas deben poder deshabilitarse o ajustarse sin romper el modulo completo.

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

### Flujo V3 vigente

1. Detener relojes activos/pausados.
2. Push a NetSuite.
3. Gate Importacion OT: esperar estabilidad hasta 600 segundos, revisando cada 30 segundos.
4. Pull + replace en tabla local WIP.
5. Si el gate expira, ejecutar pull igualmente con warning critico.

El flujo manual y el cierre de turno programado deben usar la misma semantica de sincronizacion y dejar registro en `sync_runs` / `sync_run_steps`.

### Cierre programado operational con doble destino NetSuite

Decision vigente 2026-06-04:

El cierre programado debe operar como **un solo flujo confiable** y un solo `sync_run` operational con `trigger = scheduler`. Dentro de ese mismo `sync_run` debe publicar a ambos destinos NetSuite requeridos:

1. `import_ot`, mediante el flujo transaccional vigente.
2. ZIM400, mediante el publisher `PUSH_ZIM400` hacia `CUSTOMRECORD_ZIM_DATA_RELOJ_CONTROL`.

El cierre programado no debe depender de un worker separado que reprocesa la misma operacion si ese worker tambien ejecuta `PUSH_IMPORT_OT`. Esa reutilizacion de flujo completo duplica actuals y vuelve inestable la sincronizacion operational.

Secuencia objetivo:

```text
sync_run operational trigger=scheduler
  -> STOP_BATCH
  -> PUSH_IMPORT_OT
  -> PUSH_ZIM400
  -> GATE_IMPORT_OT
  -> GATE_ZIM400_STATUS
  -> PULL
```

Reglas obligatorias para Programador:

1. `PUSH_IMPORT_OT` debe ejecutarse una sola vez por cierre programado operational.
2. `PUSH_ZIM400` debe ejecutarse dentro del mismo `sync_run`, usando los eventos STOP generados o identificados por el `STOP_BATCH`.
3. No llamar al flujo completo `v4_stop_queue` desde el cierre programado si ese flujo vuelve a ejecutar `PUSH_IMPORT_OT`.
4. ZIM400 debe exponerse como publisher/servicio reutilizable, invocable por el cierre programado sin reencolar ni reprocesar `import_ot`.
5. Cada destino debe tener step, payload, resultado, error e idempotencia independiente.
6. El PULL debe ocurrir solo despues de registrar el resultado de `PUSH_IMPORT_OT`, `PUSH_ZIM400` y aplicar `GATE_IMPORT_OT`.
7. Un fallo parcial de ZIM400 no debe duplicar ni reintentar automaticamente `PUSH_IMPORT_OT`.
8. Si `import_ot` fue exitoso y ZIM400 falla parcialmente, el cierre puede terminar como `SUCCESS_WITH_ZIM400_WARNING` y dejar reintento/diagnostico para ZIM400.
9. Si `import_ot` falla completamente, el cierre debe marcar error operacional principal y no debe asumir que el PULL es seguro salvo politica explicita de pull forzado.

Estados sugeridos para `sync_run_steps`:

```text
STOP_BATCH
PUSH_IMPORT_OT
PUSH_ZIM400
GATE_IMPORT_OT
GATE_ZIM400_STATUS
PULL_AFTER_GATES
```

Estados globales sugeridos del `sync_run`:

```text
SUCCESS
SUCCESS_WITH_ZIM400_WARNING
SUCCESS_WITH_IMPORT_OT_WARNING
ERROR_IMPORT_OT
ERROR_STOP_BATCH
ERROR_PULL
```

Ejemplo de trazabilidad esperada:

```text
sync_run #123
trigger: scheduler
tipo: operational

STOP_BATCH
  status: OK
  operaciones detenidas: 40

PUSH_IMPORT_OT
  status: OK
  OTs enviadas: 12
  operaciones enviadas: 40

PUSH_ZIM400
  status: WARNING
  eventos STOP: 40
  enviados: 38
  fallidos: 2

GATE_IMPORT_OT
  status: OK

GATE_ZIM400_STATUS
  status: WARNING

PULL_AFTER_GATES
  status: OK

resultado global:
  SUCCESS_WITH_ZIM400_WARNING
```

El criterio de exito del cierre programado no es que ambos destinos compartan el mismo estado, sino que el flujo mantenga trazabilidad separada y no duplique publicaciones. `import_ot` es el destino transaccional principal; ZIM400 es obligatorio como destino de reporte, pero sus fallos deben aislarse con warning/reintento cuando `import_ot` ya fue exitoso.

### Arquitectura objetivo V4: STOP desacoplado + worker

La evolucion V4 no reemplaza automaticamente la operacion V3. V3 queda como baseline estable del sistema actual.

En V4, el evento STOP no debe invocar NetSuite de forma sincronica desde la experiencia del operario. STOP debe consolidar el cronometro localmente y crear un pendiente persistente de sincronizacion.

Flujo objetivo V4:

```text
STOP del operario
  -> consolidar tiempo local
  -> crear pendiente persistente
  -> worker/servicio procesa pendientes
  -> push 1 a NetSuite via RESTlet/import_ot, sin modificar contrato vigente
  -> push 2 a NetSuite via modulo Poblar Reporte ZIM400
```

Regla critica V4 sobre Pull:

```text
El Pull NO se ejecuta por cada STOP.
El Pull NO se ejecuta cada 15 minutos.
El Pull se ejecuta solo al cierre de turno o manualmente por operacion administrativa.
Cuando exista Pull, primero debe aplicarse Gate Import OT.
```

Principios V4:

- El operario no debe quedar bloqueado por latencia, timeout o caida temporal de NetSuite.
- El cron no debe ser el generador principal de envios cada 15 minutos.
- El cron puede quedar como watchdog/rescate para pendientes fallidos, colgados o no procesados.
- El worker debe controlar idempotencia, reintentos, concurrencia, auditoria y trazabilidad del push.
- El worker no debe disparar Pull como consecuencia de cada STOP procesado.
- Si dos operarios hacen STOP casi simultaneamente, cada STOP debe producir su propio pendiente sin duplicar envios.
- No se define todavia el mecanismo fisico exacto de cola; queda abierto para diseno de programacion.

Estados sugeridos para pendientes V4:

```text
PENDING
PROCESSING
SENT
ERROR
RETRY
CANCELLED
```

Trazabilidad minima esperada:

- OT, operacion y secuencia.
- Tipo de tiempo/cantidad involucrada.
- Acumulado local al momento del STOP.
- Valor ya enviado anteriormente.
- Delta a enviar.
- Payload enviado a NetSuite.
- Resultado RESTlet/import_ot.
- Fecha/hora de creacion, procesamiento y cierre del pendiente.
- Numero de reintentos y ultimo error si aplica.

### Cierre de turno

- Puede ejecutar auto-stop.
- Consolida tiempos.
- Puede disparar sincronizacion segun configuracion.
- Zona horaria: `America/Santiago`.
- Cuando el cierre de turno dispara sincronizacion operational, debe usar un solo `sync_run` con doble destino NetSuite: `import_ot` y ZIM400.
- No debe delegar el cierre programado al flujo completo del worker V4 si ese worker reprocesa `import_ot`; solo puede reutilizar publishers/servicios independientes que no dupliquen publicaciones.

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
- El backend no debe tener variables que habiliten carga automatica de usuarios en SB/PROD. Si se implementa una variable de seed, su valor operativo debe ser `false`.

### Directorio de servicios EasyPanel

| Ambiente | Servicio | Dominio | Carpeta build | Puerto interno |
|---|---|---|---|
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

# Usuarios:
# No habilitar seeds automaticos de usuarios en SB operativo.
INITIAL_SEED_USERS=false
USER_AUTO_SEED_ENABLED=false

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

# Usuarios:
# No habilitar seeds automaticos de usuarios en PROD.
INITIAL_SEED_USERS=false
USER_AUTO_SEED_ENABLED=false

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
10. El log de EasyPanel no imprime usuarios ni contrasenas de seed durante el arranque.
11. Reiniciar la API no crea usuarios nuevos automaticamente.

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

# Usuarios
INITIAL_SEED_USERS=false
USER_AUTO_SEED_ENABLED=false

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
- No exponer passwords de usuarios en logs.
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

### Usuarios reaparecen despues de borrarlos

Causa conocida: seed automatico de usuarios en arranque, especialmente `initialSetup.load_users()` leyendo `backend/src/libs/usuarios.txt` o `backend/build/libs/usuarios.txt`.

Accion requerida: eliminar/desactivar esa carga. En SB y PROD operativo, los usuarios no deben venir de archivos ni seeds; solo deben existir los creados en Cronometro.

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

Debe existir un usuario administrador inicial creado por mecanismo controlado y no recurrente en bases limpias. No se permite carga masiva automatica de usuarios operativos desde archivos.

## Documentos QA

La estructura QA inicial del proyecto queda definida en:

```text
Cronometro/QA/README.md
Cronometro/QA/system-prompt.md
```

Regla vigente:

- `Cronometro/QA/README.md` explica como implementar QA especifico para Cronometro.
- `Cronometro/QA/system-prompt.md` adapta el rol QA Tester al contexto de Cronometro.
- No existe todavia una ronda QA real.
- La primera ronda solo debe crearse como `Cronometro/QA/QA-YYYY-MM-DD.md` cuando Miguel defina una mejora, version, commit o flujo concreto a validar.
- Toda ronda QA debe ser un documento unico acumulativo basado en `QA Tester/plantillas/QA-YYYY-MM-DD.md`.

## Git, despliegue y lecciones aprendidas

### Ramas

- Baselines estables congeladas: `V3` y `V4`.
- Desarrollo activo multioperario/multiterminal por operacion: `V5` (creada desde `V4`).
- `V5` cambia la cardinalidad central de cronometros activos por operacion; validar en sandbox antes de alinear `main`.
- Al cerrar productivo, alinear `main` al mismo commit final probado y aprobado.
- Evitar merges grandes que mezclen historiales divergentes.

### EasyPanel

- Primer build puede no dispararse automaticamente. Solucion conocida: refrescar token GitHub desde Settings y guardar.
- Rebuild de `reloj-api` / `reloj-front` no borra MariaDB si el volumen persiste.
- Si el backend tarda por `db.sync({ alter: true })`, un healthcheck agresivo puede provocar reinicios. Mejor patron: abrir puerto HTTP temprano y exponer `/` o `/health`.
- Reiniciar/rebuildar la API no debe crear usuarios operativos automaticamente.

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

### Sincronizacion V4 por evento STOP desacoplado

Decision objetivo para V4. El STOP genera un pendiente persistente y un worker/servicio procesa el envio hacia NetSuite. El cron queda como rescate/fallback, no como generador principal de envios. El Pull no forma parte del procesamiento de cada STOP; se ejecuta solo al cierre de turno o manualmente por operacion administrativa, siempre aplicando Gate Import OT cuando corresponda.

### Cierre programado operational con ZIM400

Decision cerrada 2026-06-04. El cierre programado debe publicar a `import_ot` y ZIM400 dentro de un unico `sync_run` operational. No debe reutilizar el flujo completo `v4_stop_queue` cuando este reprocesa la misma operacion y vuelve a ejecutar `PUSH_IMPORT_OT`. Para cierre programado, ZIM400 se incorpora como etapa `PUSH_ZIM400` del mismo flujo operational, con idempotencia, log y estado independiente por destino. El resultado esperado es un solo flujo confiable, sin doble publicacion de actuals y con `PULL` posterior a los gates definidos.

### Version unica SB/PROD

Vigente. No mantener forks funcionales por entorno.

### Carga automatica de usuarios

Prohibida en SB y PROD operativo. `usuarios.txt`, `load_users()` o cualquier mecanismo equivalente no debe crear usuarios al arrancar la API. Los usuarios deben ser exclusivamente los administrados desde Cronometro.

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
