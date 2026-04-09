# Bitácora de Configuración — Sandbox Bignotti RelojControl

## Fecha de creación
17 de marzo de 2026

---

## Infraestructura

| Componente | Detalle |
|------------|---------|
| Servidor | Físico con VMware sobre Linux |
| Panel de administración | EasyPanel v2.26.3 (Deasy) |
| IP del servidor | 177.136.6.181 |
| Proyecto EasyPanel | `bignotti` |

---

## Repositorio

| Componente | Detalle |
|------------|---------|
| Repo producción (NO TOCAR) | https://github.com/mcandiav/RelojControl |
| Repo sandbox | https://github.com/mcandiav/MCV_RelojControl |
| Rama de trabajo sandbox (EasyPanel) | **`V2`** — aquí se itera y se despliega el cronómetro v2 |
| Rama `main` | Reservada para **congelar la versión final** al salir a producción (misma versión probada que `V2`, sin merges improvisados) |
| Remote local producción | `origin` |
| Remote local sandbox | `sandbox` (si está configurado) |

### Cómo hacer push al sandbox
```bash
git add .
git commit -m "descripción del cambio"
git push origin V2
```
*(Si el remoto `sandbox` apunta al mismo repo, puede usarse `git push sandbox V2` según la configuración local.)*

### Congelación — baseline antes del refactor de UI (mar 2026)

| Campo | Valor |
|-------|--------|
| **Tag** | **`v2-freeze-pre-ui`** |
| **Rama** | **`V2`** (misma rama; el tag marca el commit exacto) |
| **Propósito** | Última versión **probada y subida a GitHub** antes de cambios **solo de presentación** (componentes, tema, layout). API y reglas de negocio se mantienen estables salvo correcciones puntuales acordadas. |

**Crear y subir el tag** (después de `git pull` y con árbol limpio):

```bash
git fetch origin
git checkout V2
git pull origin V2
git tag -a v2-freeze-pre-ui -m "Baseline antes de refactor UI (presentación)"
git push origin v2-freeze-pre-ui
```

**Volver a esta base:** `git checkout v2-freeze-pre-ui` o `git checkout -b hotfix/desde-freeze v2-freeze-pre-ui`.

**Commit exacto:** ver en GitHub → tag `v2-freeze-pre-ui` → “Tagged commit”.

---

## Dominios (Cloudflare + at-once.cl)

| Servicio | Dominio |
|----------|---------|
| Frontend | `reloj.at-once.cl` |
| Backend API | `reloj-api.at-once.cl` |

---

## Servicios EasyPanel — Proyecto `bignotti`

### 1. MariaDB
| Campo | Valor |
|-------|-------|
| Nombre del servicio | `mariadb` |
| Database | `relojcontrol` |
| Usuario | `reloj` |
| Password | `Reloj2024!` |
| Root Password | `Root2024!` |
| Host interno (para backend) | `mariadb` |
| Puerto interno | `3306` |

### 2. Adminer (Web UI para MariaDB)
| Campo | Valor |
|-------|-------|
| Nombre del servicio | `adminer` |
| Docker Image | `adminer:5.4.2` |
| Puerto interno | `8080` |
| Dominio | `badminer.at-once.cl` |
| Tunnel | Cloudflare (configurado desde EasyPanel → Domains) |

**Cómo conectarse:**
- URL: https://badminer.at-once.cl
- Sistema: MySQL
- Servidor: `mariadb`
- Usuario: `reloj`
- Contraseña: `Reloj2024!`
- Base de datos: `relojcontrol`

---

### 3. Backend (reloj-api)
| Campo | Valor |
|-------|-------|
| Nombre del servicio | `reloj-api` |
| Repo | `https://github.com/mcandiav/MCV_RelojControl` |
| Carpeta build | `backend/` |
| Puerto interno | `8000` |
| Dominio | `reloj-api.at-once.cl` |

**Variables de entorno del backend:**
```
DB_HOST=mariadb
DB_PORT=3306
DB_USER=reloj
DB_PASSWORD=Reloj2024!
DB_NAME=relojcontrol
DB_DIALECT=mariadb
JWT_SECRET=api-secret-od
DELETE_SECRET=b1234
```

### 3. Frontend (reloj-front)
| Campo | Valor |
|-------|-------|
| Nombre del servicio | `reloj-front` |
| Repo | `https://github.com/mcandiav/MCV_RelojControl` |
| Carpeta build | `front/` |
| Puerto interno | `80` |
| Dominio | `reloj.at-once.cl` |

**Build argument del frontend (EasyPanel / Docker):**
```
VUE_APP_API_URL=https://reloj-api.at-once.cl/
```

> **Importante (mar 2026):** `front/.env.production` no está en el ZIP de GitHub (gitignore). El **`front/Dockerfile`** define por defecto `ARG VUE_APP_API_URL=https://reloj-api.at-once.cl/` para que el build en EasyPanel **no** empaquete `axios` apuntando a `http://localhost:8000` (eso rompe el sitio en HTTPS: pantalla en blanco o login roto). Podés sobrescribir el ARG en EasyPanel si cambia el dominio del API.

#### Identidad visual corporativa (abr 2026)

El UI del Cronómetro quedó alineado con **https://www.bignottihnos.cl** (colores y tipografías coherentes con el `styles.css` del sitio institucional).

| Qué | Dónde |
|-----|--------|
| Colores del tema Vuetify (primary, secondary, accent, anchor, etc.) | `front/src/plugins/vuetify.js` |
| Variables CSS, fuentes en `.v-application`, fondo `#F5F5F5` | `front/src/styles/bignotti-brand.css` (import en `front/src/main.js`) |
| Fuentes web | `front/public/index.html` (Google Fonts: Lato, Montserrat, Roboto Condensed, Roboto) |
| Login (fondo oscuro tipo hero, acento naranja, botones operario en primary) | `front/src/views/Login.vue` |
| App bar crema, texto oscuro, botón Salir outlined primary | `front/src/components/navegation/appbar.vue` |
| Título “CRONÓMETRO” en color primario | `front/src/views/Home.vue` |

No se requieren variables de entorno nuevas para el tema. Tras un `git pull` en la rama **`V2`**, **rebuild** del servicio **`reloj-front`** en EasyPanel para ver los cambios en `reloj.at-once.cl`.

#### Reporte admin + log de sincronizaciones (abr 2026)

En la pestaña **Reporte** (solo administradores) existen dos vistas:

- **Operaciones**: listado WIP (mismo universo que “WIP sincronizado en MariaDB”), con estado de cronómetro y “sync pendiente”.
- **Sincronizaciones**: log persistente de sincronizaciones operativas con etapas **STOP / PUSH / WAIT / PULL**, estado y warning.

Backend:

- Tablas nuevas en MariaDB (creadas por Sequelize con `db.sync({ alter: true })`):
  - `sync_runs`
  - `sync_run_steps`
- Endpoints (admin):
  - `GET /chronometer/netsuite/sync-runs`
  - `GET /chronometer/netsuite/sync-runs/:id`

Requiere **rebuild/redeploy de backend + front** para que:

- el backend registre corridas,
- el front muestre el tablero de log.

#### Hora Chile (horario de invierno)

La UI formatea la hora y fechas del log usando zona horaria fija **`America/Santiago`** para evitar desfase cuando el kiosco/PC no aplica correctamente el cambio de horario.

**Terminal compartida (varios operarios, mismo PC):** el front envía **`x-station-id`** en todas las peticiones. Se genera una vez en `localStorage` (`reloj_station_id`) por navegador; el tablero de cronómetros activos filtra por ese valor (columna **`station_id`** en `operation_timers`), no solo por usuario. Opcional en build: **`VUE_APP_STATION_ID`** (fijo por máquina en Docker/EasyPanel, p. ej. `LINEA-ME-01`). **Pausa / stop / resume** (y **Play** sobre un timer en pausa) rechazan otra terminal con `403`. **Tablero protector:** lista todas las tareas activas/pausadas de la terminal; vista **2×2** con **carrusel** si hay más de 4 (`VUE_APP_IDLE_BOARD_SLOTS`, máx. 4). **Carrusel automático** cada **2 s** por defecto (`VUE_APP_IDLE_BOARD_CAROUSEL_SEC`, rango 1–120).

---

## Desarrollo local — puertos (contrato fijo, no improvisar)

En este proyecto **el API Express siempre escucha en el puerto `8000`** (`backend/src/index.js`: `server.listen(8000)`). **No usar `4000`** ni otro puerto para el backend en documentación, proxy ni ejemplos.

| Qué | Puerto / URL |
|-----|----------------|
| **Backend (Node)** | **`http://localhost:8000`** |
| **Front dev (`npm run serve`)** | Suele ser **`http://localhost:8080`** (Vue CLI) |
| **Proxy del front hacia el API** | En **`front/vue.config.js`** → `devServer.proxy` debe apuntar a **`http://localhost:8000`** para que rutas relativas (`/auth/operarios`, etc.) lleguen al backend. |
| **Axios sin `.env` local** | En **`front/src/main.js`**, fallback: **`http://localhost:8000/`** vía `VUE_APP_API_URL`. |

**Producción / EasyPanel:** el front compilado **no** usa ese proxy; usa **`VUE_APP_API_URL`** (HTTPS del API). Los problemas “en un entorno anda y en otro no” suelen ser mezclar **proxy dev (8000)** con **URL empaquetada distinta** o un **`vue.config.js` apuntando a un puerto incorrecto**.

### Login: “Network Error” / operarios no cargan (HTTPS)

Si el front está en **`https://reloj.at-once.cl`** y en el navegador el bundle sigue con **`axios.defaults.baseURL = http://localhost:8000/`**, el pedido va al **localhost de la PC del usuario** → falla siempre. **Causa:** imagen del front buildada **sin** `VUE_APP_API_URL` (o build local subido a nginx). **Qué hacer:** rebuild del servicio front en EasyPanel asegurando **`ARG`/`ENV` `VUE_APP_API_URL=https://reloj-api.at-once.cl/`** (el `front/Dockerfile` ya lo trae por defecto si construís desde ese archivo). Tras redeploy, en F12 → Red la URL de `/auth/operarios` debe ser **`https://reloj-api.at-once.cl/auth/operarios`**.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | MariaDB (Docker) |
| Backend | Node.js 16 + Express + Sequelize |
| Frontend | Vue.js 2 + Vuetify 2 + Vuex |
| Servidor web frontend | nginx (Alpine) |
| ORM | Sequelize (dialect: mariadb) |
| Autenticación | JWT |

---

## Cambios realizados respecto al código original

| Archivo | Cambio |
|---------|--------|
| `front/src/main.js` | URL del API hardcodeada → `process.env.VUE_APP_API_URL` |
| `backend/src/config/config.js` | Credenciales hardcodeadas → variables de entorno |
| `backend/src/config/db.js` | Dialect `mssql` hardcodeado → `config.dialect` dinámico |
| `backend/Dockerfile` | Nuevo — build y run del backend en Node 16 Alpine |
| `front/Dockerfile` | Nuevo — build Vue + serve con nginx (multi-stage) |
| `front/nginx.conf` | Nuevo — configuración nginx para SPA (Vue Router) |
| `front/src/styles/bignotti-brand.css` | Estilos globales de marca (fuentes, fondo, variables CSS) |
| `front/src/plugins/vuetify.js` | Tema claro corporativo (`#FF5722`, `#212121`, etc.) |

---

## Datos iniciales cargados

### Roles
| id | name |
|----|------|
| 1 | admin |
| 2 | operario |

### Workplaces
| id | name |
|----|------|
| 1 | IN *(legacy / no usar en UI; se trata como Todos)* |
| 2 | ES |
| 3 | ME |
| 4 | ALL *(se muestra como “Todos” en UI)* |

### Usuario admin
| Campo | Valor |
|-------|-------|
| username | `admin` |
| password | `Admin2024!` |
| name | Admin Bignotti |
| RoleId | 1 (admin) |
| WorkplaceId | 4 (ALL) |

---

## Decisiones técnicas tomadas

### URL del backend en el frontend
- **Build local:** Vue CLI usa `front/.env.production` si existe (útil en desarrollo).
- **Build en EasyPanel (ZIP GitHub):** ese archivo **a menudo no va** en el repo; el **`front/Dockerfile`** incorpora **`ARG VUE_APP_API_URL`** con default `https://reloj-api.at-once.cl/` para que `npm run build` empaquete bien la URL sin depender del `.env`.
- En EasyPanel se puede **sobrescribir** el build-arg si el dominio del API cambia.

```
VUE_APP_API_URL=https://reloj-api.at-once.cl/
```

---

## Bugs conocidos de EasyPanel

### Primer build no se dispara automáticamente
Al crear un nuevo servicio App desde GitHub, EasyPanel muestra "no actions found" y no ejecuta el primer build. **Solución:** ir a Settings → GitHub token → guardar el mismo token sin modificarlo. Esto refresca la conexión y dispara el build. Es un bug conocido de EasyPanel, no un problema del código ni del token.

---

## Git, despliegue y lecciones aprendidas (mar 2026)

### Ramas: `V2` vs `main`
- El **trabajo diario** en sandbox debe hacerse en **`V2`** (EasyPanel: front y API apuntando a esa rama).
- **`main`** no es obligatoria mientras dure el desarrollo; al **cerrar** y pasar a producción, se **alinea `main` al mismo commit** que la `V2` final probada (“copiar la versión buena”), en lugar de merges grandes que mezclan historiales divergentes y pueden reintroducir regresiones.

### MariaDB vs rebuild de contenedores
- **Rebuild** de `reloj-api` / `reloj-front` **no borra** MariaDB si el volumen de datos persiste.
- Síntomas como “no aparecen operarios” o “falla el login” **no implican** por sí solos que falten usuarios en BD: pueden ser **caché del navegador**, **URL del API mal empaquetada en el front**, o **error puntual de red/API**. Conviene mirar **F12 → Red** (`/auth/operarios`, `auth/me`) antes de asumir pérdida de datos.

### Front: caché y archivos JS (Vue)
- Tras cada deploy, el `index.html` referencia **chunks con hash** (`chunk-vendors.xxxxx.js`). Si el navegador guarda un **HTML viejo** y pide **JS que ya no existe**, el servidor puede devolver **`index.html` en lugar del `.js`** → consola: `Unexpected token '<'`.
- **Mitigación:** `Ctrl+Shift+R` (recarga forzada), incógnito, o borrar datos del sitio para `reloj.at-once.cl`.
- En el repo, **`front/nginx.conf`** evita servir `index.html` como si fuera un `.js`/`.css` faltante (404 en `/js/` y `/css/`) y reduce caché agresiva del `index.html` donde aplica.

### Build del front desde GitHub (ZIP)
- **`front/.env.production`** suele **no** estar en el archivo que descarga EasyPanel (gitignore). Sin variable en build, el bundle puede quedar con **`http://localhost:8000`** → HTTPS roto / pantalla en blanco.
- **`front/Dockerfile`** define **`ARG`/`ENV` `VUE_APP_API_URL`** con valor por defecto del sandbox para que el build desde GitHub sea correcto sin depender del `.env` local.

### API: arranque y healthcheck (Docker)
- Si el proceso solo abre el puerto **después** de un `db.sync({ alter: true })` largo, un **healthcheck** agresivo puede mandar **SIGTERM** y reinicios en bucle.
- Patrón sano: puerto HTTP abierto pronto + rutas **`/` / `/health`** que respondan durante el arranque; **`CMD`** con **`node build/index.js`** (evitar `npm` como PID 1) mejora el manejo de señales.

### Cambios de código y alcance
- Ampliar un cambio pedido con “mejoras” extra (nginx, seed, auth, etc.) sin acordarlo antes aumenta el riesgo de **regresiones** y **pérdida de tiempo**. Convención del proyecto: **discutir → acordar → implementar**; un problema (ej. lista de operarios) debe **aislarse** (log de API, red del navegador) antes de tocar datos demo o tablas.

### Poblar WIP (OT de prueba) sin redeploy
- MariaDB **no** recibe `POST` HTTP. Para cargar operaciones WIP desde Windows: **`POST /chronometer/wip/upsert`** al API con JWT **admin** y JSON `{ "operations": [ ... ] }`.
- En el repo: `backend/scripts/wip-upsert-ot1-9.json` + instrucciones en `backend/scripts/README-wip-upsert-ot1-9.md` (PowerShell / curl).

---

## Notas importantes

- El repo de **producción NO se toca**. Todos los cambios van al repo sandbox.
- La base de datos de producción es **SQL Server (MSSQL)**. El sandbox usa **MariaDB**.
- El flujo con NetSuite es **manual**: Excel entra → operarios trabajan → CSV sale → se sube a NetSuite.
- A futuro se puede automatizar usando la **NetSuite REST API** (OAuth 2.0).
- Las credenciales de NetSuite (sandbox y productivo) las administra Miguel.

---

## Configuración específica de Cronómetro / Integración NetSuite (v2)

### 1) Polling de búsqueda de OTs en WIP

- La búsqueda de OTs en proceso (WIP) se realizará automáticamente desde NetSuite.
- El intervalo por defecto del polling es cada **3 horas**.
- El intervalo es configurable a un valor menor, respetando un mínimo operativo.

**Parámetros de control**

| Variable | Descripción | Valor sugerido |
|----------|-------------|----------------|
| `NS_WIP_POLL_ENABLED` | Habilita/deshabilita polling de WIP desde NetSuite | `true` |
| `NS_WIP_POLL_INTERVAL_MINUTES` | Intervalo de ejecución del polling | `180` |
| `NS_WIP_POLL_MIN_INTERVAL_MINUTES` | Límite mínimo permitido para el intervalo | `10` |

### 2) Batch de cierre de turno

- El envío de tiempos a NetSuite se hace en **batch al cierre de turno**.
- Se envía el **total acumulado de tiempo real por operación** del turno.
- La ejecución del cierre de turno se programa por **hasta 3 horarios configurables** (slots) en zona horaria `America/Santiago`.
- Al cierre de turno se ejecuta **detención automática de todos los cronómetros activos**.
- **Contrato**: la sincronización automática del cierre de turno es **el mismo flujo** que la sincronización operativa manual
  (STOP → PUSH → WAIT → PULL) y queda registrada en el mismo log (`sync_runs` / `sync_run_steps`) con `trigger: scheduler`.

**Parámetros de control**

| Variable | Descripción | Valor sugerido |
|----------|-------------|----------------|
| `NS_SHIFT_BATCH_ENABLED` | Habilita/deshabilita batch de cierre de turno | `true` |
| `NS_AUTO_STOP_AT_SHIFT_END` | Detiene automáticamente cronómetros al cierre | `true` |
| `NS_TIMEZONE` | Zona horaria oficial de ejecución | `America/Santiago` |
| `NS_RETRY_ENABLED` | Habilita reintentos si falla el envío del batch | `true` |
| `NS_OPERATIONAL_PULL_DELAY_SECONDS` | Espera entre PUSH y PULL (0–120) | `60` |

> Nota: la política exacta de reintentos (cantidad e intervalo) queda pendiente de definición funcional.

### 3) Variables nuevas de entorno del backend

| Variable | Descripción |
|----------|-------------|
| `NS_SYNC_ENABLED` | Habilita/deshabilita integración NetSuite en backend |
| `NS_WIP_POLL_ENABLED` | Activa polling de OTs WIP |
| `NS_WIP_POLL_INTERVAL_MINUTES` | Frecuencia del polling en minutos |
| `NS_WIP_POLL_MIN_INTERVAL_MINUTES` | Mínimo permitido para el polling |
| `NS_SHIFT_BATCH_ENABLED` | Activa batch de cierre de turno |
| `NS_AUTO_STOP_AT_SHIFT_END` | Auto stop de cronómetros al fin de turno |
| `NS_TIMEZONE` | Zona horaria operativa |
| `NS_RETRY_ENABLED` | Activa reintentos de envío |

### 4) Reglas funcionales que afectan sandbox

- Login por lista de operarios + PIN de 4 dígitos.
- Atributo de operario por área: `ME`, `ES`, `Both`.
- Búsqueda manual por número de OT.
- Filtrado de operaciones por área habilitada del operario.
- Una sola operación activa por máquina (máquina = recurso).
- Tablero adaptativo de cronómetros activos como pantalla principal.

### 5) Datos y persistencia (Cronómetro v2)

**Se reutiliza del modelo actual**

- `User`
- `Role`
- `Workplace`

`Workplace` ya contiene opciones de área (`ME` / `ES`) para la visibilidad operativa.

**Se define nueva persistencia orientada a Cronómetro**

- Modelo de operación en proceso (unidad principal de trabajo por operación de OT).
- Modelo de eventos de cronometraje (`start`, `pause`, `resume`, `stop`, `auto_stop_shift_end`).
- Modelo de consolidación por operación y turno para integración.
- Staging de envío a NetSuite para trazabilidad de lotes de cierre.

### 6) Integración NetSuite (regla funcional v2)

- **Se busca desde NetSuite**: OTs en WIP y sus operaciones/ruteo con recurso asociado.
- **Se mantiene en NetSuite**: tiempos planificados de montaje y operación.
- **Se envía a NetSuite**: tiempo real consolidado por operación.
- **Modo de envío vigente**: batch al cierre de turno (no envío online por evento).
- **Identificación de la operación destino**: por OT + operación del ruteo + recurso asociado.
