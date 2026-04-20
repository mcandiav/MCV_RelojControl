# MCV_RelojControl / Cronometro (Sandbox)

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|---|---|---|---|---|
| 2026-04-20 | Se publica **V3** con mejora de Reporte admin: nueva pestaña **Log NetSuite** para comparación directa por operación con columnas `T_mon_base`, `T_mon_enviado`, `T_mon_netsuite`, `T_eje_base`, `T_eje_enviado`, `T_eje_netsuite`, `Qty_base`, `Qty_enviado`, `Qty_netsuite`. | Facilitar validación de paralelo preproducción y contraste 1:1 contra NetSuite tras `import_ot_via_restlet`. | Requiere deploy de **backend + front** en la misma rama (`V3`), porque agrega endpoint `GET /chronometer/netsuite/push-log` y tercera pestaña en UI. | `backend/src/controllers/netsuiteSync.js`, `backend/src/routes/chronometer.js`, `front/src/views/Home.vue` |
| 2026-04-19 | Se aclara y consolida el **modo real de push NetSuite vigente**: el backend opera con `NETSUITE_PUSH_MODE=restlet`, pero el RESTlet actual implementa internamente `import_ot_via_restlet` creando staging en `customrecord_3k_importacion_ot`. Se descarta como referencia vigente el RESTlet antiguo de escritura directa sobre `manufacturingoperationtask`. | Había ambigüedad entre documentación consolidada, `.env` real y script vigente en NetSuite. | Queda una sola lectura correcta del flujo IN y se separa explícitamente lo vigente de lo histórico. | Estado actual final, Integración NetSuite, variables, decisiones cerradas |
| 2026-04-19 | **Decisión ejecutiva operativa:** no aplicar cambios de app por ahora. Se mantiene la configuración vigente porque `reloj.at-once.cl` y `reloj-sb.at-once.cl` ya operan correctamente. | Priorizar estabilidad y evitar regresiones al cierre de validación SB/PROD. | Documentación actualizada; sin cambios de código ni de despliegue funcional inmediato. | Estado actual final, dominios y despliegue |
| 2026-04-19 | Se fija decisión arquitectónica de **una sola versión cerrada** para SB y PROD, con diferencias solo por configuración de entorno. El frontend debe resolver la URL del API por configuración del despliegue y no por un dominio fijo versionado en el repo. | Evitar bifurcación SB vs PROD y permitir dos instancias operativas en paralelo con el mismo código. | Requiere ajuste del frontend para externalizar completamente `VUE_APP_API_URL` / `window.__CRONOMETRO_API_BASE__` por entorno de despliegue. No cambia lógica de negocio. | Estado actual final, Frontend / despliegue, criterios de configuración |
| 2026-04-07 | Se agrega **Reporte admin** con dos vistas: **Operaciones (WIP)** y **Log de sincronizaciones** (stop/push/wait/pull) con estado + warning. | Necesidad operativa de auditoría y diagnóstico de sincronizaciones. | Requiere rebuild/redeploy **backend + front**. Se crean tablas nuevas en MariaDB vía `db.sync({ alter: true })`. | `backend/src/controllers/netsuiteSync.js`, `backend/src/models/sync_run*.js`, `front/src/views/Home.vue` |
| 2026-04-07 | Se fija el formateo de hora/fechas a **Chile** (`America/Santiago`) en la UI. | Evitar desfase por cambio de horario de invierno cuando el PC/kiosco está mal configurado. | Afecta visualización (header Operación y fechas del log). | `front/src/views/Home.vue` |
| 2026-04-05 | El front adopta paleta, tipografías y cabecera alineadas al sitio corporativo **bignottihnos.cl** (referencia: `styles.css` público del sitio). | Unificar marca visual entre web institucional y Cronómetro. | Solo capa de presentación (Vuetify + CSS global + vistas login/home/app bar). Rebuild del contenedor front para desplegar. | `front/src/plugins/vuetify.js`, `front/src/styles/bignotti-brand.css`, `front/public/index.html`, `Login.vue`, `appbar.vue`, `Home.vue` |
| 2026-04-05 | Se ordena la documentación final del proyecto y se consolida el contrato NetSuite vigente. | El proyecto ya está terminado y había referencias históricas que mezclaban Dataset con Saved Search. | Se aclara la fuente OUT oficial, el contrato de datos y el flujo operativo final. | Estado actual, integración NetSuite, contrato de datos, documentos relacionados |
| 2026-03-31 | Se consolida el flujo operativo oficial Stop -> Push -> Pull(+replace). | Alinear operación real del sistema con la documentación. | Define el orden de sincronización recomendado. | Estado actual, sincronización operativa |
| 2026-03-28 | Se cambia la fuente OUT oficial de Dataset a Saved Search. | Dataset no reproducía correctamente la granularidad requerida. | La extracción NetSuite -> Cronometro queda alineada con 1 operación lógica = 1 fila. | Integración NetSuite OUT |
| 2026-03-25 | Se corrige el contrato de retorno hacia NetSuite a 3 datos reales por operación. | Evitar la simplificación incorrecta de “un tiempo consolidado” único. | Se define correctamente el push funcional desde Cronometro hacia NetSuite. | Regla de negocio clave |

## Estado actual final (2026-04-19)

- Proyecto **terminado**.
- Baseline de mejoras actual para iteración: **rama `V3`**.
- Debe existir **una sola versión cerrada del programa** para sandbox y productivo.
- Fuente OUT oficial: `savedsearch` (`customsearch_mcv_cronometro_out`).
- Push IN externo oficial: RESTlet `MCV_Cronometro_RESTlet.js`.
- **Modo real vigente de push:** `restlet` en backend + `import_ot_via_restlet` dentro de NetSuite.
- Staging record vigente: `customrecord_3k_importacion_ot`.
- Fuente de verdad operativa: **NetSuite**.
- Flujo operativo final recomendado: **Stop -> Push -> Pull(+replace)**.
- **Diferencias entre SB y PROD:** solo por **configuración de entorno**, no por ramas ni por código divergente.

### Dominios frontend oficiales

- Sandbox: `reloj-sb.at-once.cl`
- Productivo: `reloj.at-once.cl`

### URL API operativa vigente (decisión ejecutiva)

- API vigente para operación actual: `https://reloj-api.at-once.cl/`
- Frontend productivo: `https://reloj.at-once.cl`
- Frontend sandbox: `https://reloj-sb.at-once.cl`
- Estado: **se mantiene sin cambios** por estabilidad.

## Decisión arquitectónica vigente sobre entornos (2026-04-19)

### Objetivo

Mantener **sandbox** y **productivo** operativos en paralelo usando **el mismo código fuente** y la **misma versión funcional** del sistema.

### Regla

No se debe mantener una “versión SB” y otra “versión PROD” del frontend o backend.
Las diferencias entre entornos deben vivir solamente en:

- variables de entorno,
- secretos del despliegue,
- dominios,
- credenciales de integración,
- parámetros operativos propios del entorno.

### Backend

El backend ya sigue este criterio: conexión a BD, secretos, flags operativos y credenciales NetSuite salen desde entorno.

### Frontend

El frontend **debe** seguir el mismo criterio. La URL base del API no debe quedar fijada como dominio real de un entorno dentro de archivos versionados del repo.

#### Criterio obligatorio para el front

- El código del front debe ser único para ambos entornos.
- La URL del API debe resolverse por **configuración del despliegue** (`EasyPanel` / build args / runtime config equivalente).
- El repo no debe actuar como fuente de verdad de un dominio real de sandbox o productivo.

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

## Integración NetSuite

### OUT (NetSuite -> Cronometro)

- Tipo oficial: Saved Search
- ID oficial: `customsearch_mcv_cronometro_out`
- Universo: operaciones WIP en curso
- Granularidad obligatoria: **1 operación lógica = 1 fila**

### IN (Cronometro -> NetSuite)

- Canal externo: RESTlet
- Archivo vigente: `MCV_Cronometro_RESTlet.js`
- URL base: `NETSUITE_RESTLET_IN_URL`
- Variable de backend vigente: `NETSUITE_PUSH_MODE=restlet`
- Modo funcional interno del RESTlet: `import_ot_via_restlet`
- Staging record: `customrecord_3k_importacion_ot`

### Aclaración crítica sobre el modo IN

La lectura correcta del proyecto es esta:

- **desde la API** el push vigente es `restlet`,
- **dentro de NetSuite** ese RESTlet no escribe directo sobre `manufacturingoperationtask`,
- el RESTlet agrupa por OT y crea registros en `customrecord_3k_importacion_ot`,
- scripts internos posteriores procesan ese staging.

Por eso la expresión correcta no es simplemente `import_ot` ni simplemente `restlet`, sino:

- **backend:** `restlet`
- **implementación NetSuite:** `import_ot_via_restlet`

## Decisiones ya cerradas

### 1. Escritura directa sobre `manufacturingoperationtask`

- Se evaluó y quedó como alternativa histórica.
- No corresponde a la última versión real subida a NetSuite.
- No debe usarse como referencia vigente para productivo.

### 2. Escritura vía `workordercompletion` REST

- Se evaluó y quedó descartada como canal principal.
- Debe tratarse como histórico / inoperativo para la arquitectura final.

### 3. Escritura vigente vía RESTlet + Importación OT

- Queda como camino operativo vigente.
- Cronometro envía lotes al RESTlet IN.
- El RESTlet agrupa por OT y crea registros en `customrecord_3k_importacion_ot`.
- Scripts de NetSuite procesan esos registros y aplican cambios al módulo operativo.

## Variables de entorno relevantes (API)

```env
NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out

NETSUITE_PUSH_MODE=restlet
NETSUITE_RESTLET_IN_URL=https://.../restlet.nl?script=1271&deploy=1
NETSUITE_RESTLET_IN_SCRIPT_ID=customscriptmcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy1

NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha

# Histórico / inoperativo en arquitectura final:
# NETSUITE_PUSH_MODE=workorder_completion
# NETSUITE_WOC_RUN_FIELD=machineRunTime
# NETSUITE_WOC_SETUP_FIELD=machineSetupTime
# NETSUITE_WOC_COMPLETED_QTY_FIELD=completedQuantity
```

## Alcance de cierre documental

- Toda referencia al dataset OUT como fuente oficial debe leerse como **histórica/deprecada**.
- Toda referencia al RESTlet antiguo de escritura directa sobre `manufacturingoperationtask` debe leerse como **histórica/no vigente**.
- La arquitectura vigente y final del proyecto debe leerse desde la integración por **Saved Search OUT + RESTlet IN + staging Importación OT**.
- La arquitectura vigente de despliegue entre entornos debe leerse como **una sola versión del programa + configuración por entorno**.

## Documentos relacionados

- [Arquitectura MCV_Cronometro.md](./Arquitectura%20MCV_Cronometro.md)
- [NETSUITE_RESTLET_IMPORT_OT_MODE.md](./NETSUITE_RESTLET_IMPORT_OT_MODE.md)
- [NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md](./NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md)
- [NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md](./NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md)
- [cust.netsuite.md](./cust.netsuite.md)
