# MCV_RelojControl / Cronometro (Sandbox)

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|---|---|---|---|---|
| 2026-04-07 | Se agrega **Reporte admin** con dos vistas: **Operaciones (WIP)** y **Log de sincronizaciones** (stop/push/wait/pull) con estado + warning. | Necesidad operativa de auditoría y diagnóstico de sincronizaciones. | Requiere rebuild/redeploy **backend + front**. Se crean tablas nuevas en MariaDB vía `db.sync({ alter: true })`. | `backend/src/controllers/netsuiteSync.js`, `backend/src/models/sync_run*.js`, `front/src/views/Home.vue` |
| 2026-04-07 | Se fija el formateo de hora/fechas a **Chile** (`America/Santiago`) en la UI. | Evitar desfase por cambio de horario de invierno cuando el PC/kiosco está mal configurado. | Afecta visualización (header Operación y fechas del log). | `front/src/views/Home.vue` |
| 2026-04-05 | El front adopta paleta, tipografías y cabecera alineadas al sitio corporativo **bignottihnos.cl** (referencia: `styles.css` público del sitio). | Unificar marca visual entre web institucional y Cronómetro. | Solo capa de presentación (Vuetify + CSS global + vistas login/home/app bar). Rebuild del contenedor front para desplegar. | `front/src/plugins/vuetify.js`, `front/src/styles/bignotti-brand.css`, `front/public/index.html`, `Login.vue`, `appbar.vue`, `Home.vue` |
| 2026-04-05 | Se ordena la documentación final del proyecto y se consolida el contrato NetSuite vigente. | El proyecto ya está terminado y había referencias históricas que mezclaban Dataset con Saved Search. | Se aclara la fuente OUT oficial, el contrato de datos y el flujo operativo final. | Estado actual, integración NetSuite, contrato de datos, documentos relacionados |
| 2026-03-31 | Se consolida el flujo operativo oficial Stop -> Push -> Pull(+replace). | Alinear operación real del sistema con la documentación. | Define el orden de sincronización recomendado. | Estado actual, sincronización operativa |
| 2026-03-28 | Se cambia la fuente OUT oficial de Dataset a Saved Search. | Dataset no reproducía correctamente la granularidad requerida. | La extracción NetSuite -> Cronometro queda alineada con 1 operación lógica = 1 fila. | Integración NetSuite OUT |
| 2026-03-25 | Se corrige el contrato de retorno hacia NetSuite a 3 datos reales por operación. | Evitar la simplificación incorrecta de “un tiempo consolidado” único. | Se define correctamente el push funcional desde Cronometro hacia NetSuite. | Regla de negocio clave |

## Estado actual final (2026-04-05)

- Proyecto **terminado**.
- Fuente OUT oficial: `savedsearch` (`customsearch_mcv_cronometro_out`).
- Push IN oficial: RESTlet `MCV_Cronometro_Restlet_In` (script `1271`, deploy `1`).
- Modo de push recomendado y vigente: `import_ot`.
- Fuente de verdad operativa: **NetSuite**.
- Flujo operativo final recomendado: **Stop -> Push -> Pull(+replace)**.

## Regla de negocio clave

Cronometro publica a NetSuite **3 datos reales por operación**:

1. `actual_setup_time`
2. `actual_run_time`
3. `completed_quantity`

Luego Cronometro vuelve a sincronizar desde NetSuite para recalzar el estado local.

## Contrato de datos que Cronometro recibe desde NetSuite

La extracción NetSuite -> Cronometro representa el universo **WIP operativo**.

### Regla de granularidad obligatoria

- **1 operación lógica = 1 fila**

### Fuente oficial de extracción

- Tipo: Saved Search
- ID: `customsearch_mcv_cronometro_out`
- Saved Search UI: `823`
- Título visible: `BG - Control de HH por OT Detalle VF - CARGA`
- Record base: `manufacturingoperationtask`
- Filtro operativo: solo operaciones **En curso** (`PROGRESS`)

### Columnas operativas mínimas

1. `Orden de trabajo`
2. `Secuencia de operaciones`
3. `Centro de trabajo de fabricación`
4. `CONFIGURACION RUTA`
5. `EJECUCION RUTA`
6. `Cantidad de entrada`
7. `Estado`
8. `Nombre de la operación`

### Mapeo funcional recomendado en Cronometro

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

### Interpretación funcional

NetSuite entrega a Cronometro, por cada operación activa:

- OT visible
- secuencia de operación
- recurso / centro de trabajo
- tiempo planificado de configuración
- tiempo planificado de ejecución por unidad
- cantidad planificada
- estado operativo
- nombre de la operación

### Área operativa

- La separación `ME` / `ES` depende del recurso o centro de trabajo.
- La documentación histórica muestra dos alternativas:
  - columna `AREA` en la Saved Search,
  - derivación desde el prefijo del recurso.
- Como el proyecto está terminado, esta diferencia queda tratada como detalle de implementación histórica y no cambia el contrato principal del sistema.

## Integración NetSuite

### OUT (NetSuite -> Cronometro)

- Tipo oficial: Saved Search
- ID oficial: `customsearch_mcv_cronometro_out`
- Universo: operaciones WIP en curso
- Granularidad obligatoria: **1 operación lógica = 1 fila**

### IN (Cronometro -> NetSuite)

- Tipo: RESTlet
- URL base: `NETSUITE_RESTLET_IN_URL`
- Modo vigente: `NETSUITE_PUSH_MODE=import_ot`
- Staging record: `customrecord_3k_importacion_ot`

## Decisiones ya cerradas

### 1. Escritura directa sobre `manufacturingoperationtask`

- Se evaluó y se descartó como camino principal por bloqueos funcionales y de permisos en WIP.

### 2. Escritura vía `workordercompletion` REST

- Se evaluó y quedó descartada como canal principal de alto volumen.

### 3. Escritura vía Importación OT

- Queda como camino operativo recomendado y vigente.
- Cronometro envía lotes al RESTlet IN.
- El RESTlet agrupa por OT y crea registros en `customrecord_3k_importacion_ot`.
- Scripts de NetSuite procesan esos registros y aplican cambios al módulo operativo.

## Sincronización operativa (admin)

Endpoint:

- `POST /chronometer/netsuite/sync-operational`

Secuencia:

1. detener relojes activos/pausados,
2. push a NetSuite,
3. esperar (`pull_delay_seconds`),
4. pull + replace WIP.

### Log de sincronizaciones (admin)

El backend registra cada sincronización operativa como un **run** con **4 etapas**:

- `STOP` (detener relojes)
- `PUSH` (publicar deltas a NetSuite)
- `WAIT` (espera `pull_delay_seconds`)
- `PULL` (pull + replace WIP)

Endpoints:

- `GET /chronometer/netsuite/sync-runs` (lista)
- `GET /chronometer/netsuite/sync-runs/:id` (detalle + etapas)

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

## Alcance de cierre documental

- Toda referencia al dataset OUT como fuente oficial debe leerse como **histórica/deprecada**.
- La arquitectura vigente y final del proyecto debe leerse desde la integración por **Saved Search OUT + RESTlet IN**.

## Identidad visual del frontend (2026-04-05)

El Cronómetro en sandbox (**rama `V2`**) usa la misma línea cromática y tipográfica que **https://www.bignottihnos.cl** (tokens tomados del `styles.css` del sitio, no se incrusta HTML de terceros).

| Token / elemento | Valor / notas |
|---|---|
| Primario (botones, acentos, `primary` Vuetify) | `#FF5722` |
| Secundario (texto fuerte) | `#212121` |
| Fondo aplicación | `#F5F5F5` |
| Barra superior (app bar) | `#f7f5f2`, borde `#e0ddd8`, sombra ligera |
| Tipografías (Google Fonts en `index.html`) | **Lato** (cuerpo), **Roboto Condensed** (títulos), **Montserrat** (carga disponible), **Roboto** (respaldo Vuetify) |
| Tema Vuetify | `front/src/plugins/vuetify.js` (`customProperties: true` para variables CSS del tema) |
| Estilos globales de marca | `front/src/styles/bignotti-brand.css` (import en `main.js`) |

**Rebuild:** cambios solo en front; en EasyPanel reconstruir el servicio **`reloj-front`** (mismo `VUE_APP_API_URL` que antes).

Detalle operativo adicional: [SANDBOX_CONFIG.md](./SANDBOX_CONFIG.md) (sección Frontend → identidad visual).

## Documentos relacionados

- [Arquitectura MCV_Cronometro.md](./Arquitectura%20MCV_Cronometro.md)
- [NETSUITE_RESTLET_IMPORT_OT_MODE.md](./NETSUITE_RESTLET_IMPORT_OT_MODE.md)
- [NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md](./NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md)
- [NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md](./NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md)
- [cust.netsuite.md](./cust.netsuite.md)
