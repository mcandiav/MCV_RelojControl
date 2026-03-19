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
| Branch principal | `main` |
| Remote local producción | `origin` |
| Remote local sandbox | `sandbox` |

### Cómo hacer push al sandbox
```bash
git add .
git commit -m "descripción del cambio"
git push sandbox main
```

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

**Build argument del frontend:**
```
VUE_APP_API_URL=https://reloj-api.at-once.cl/
```

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
| 1 | IN |
| 2 | ES |
| 3 | ME |
| 4 | ALL |

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
EasyPanel no tiene sección de "Build Arguments" visible. En lugar de usar ARG en el Dockerfile, se creó el archivo `front/.env.production` con la URL del backend hardcodeada para el sandbox. Vue CLI toma este archivo automáticamente durante `npm run build`.

```
VUE_APP_API_URL=https://reloj-api.at-once.cl/
```

Si en el futuro se cambia el dominio del backend, hay que actualizar este archivo y hacer rebuild del frontend.

---

## Bugs conocidos de EasyPanel

### Primer build no se dispara automáticamente
Al crear un nuevo servicio App desde GitHub, EasyPanel muestra "no actions found" y no ejecuta el primer build. **Solución:** ir a Settings → GitHub token → guardar el mismo token sin modificarlo. Esto refresca la conexión y dispara el build. Es un bug conocido de EasyPanel, no un problema del código ni del token.

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
- La ejecución del cierre de turno se programa a las **17:00** en zona horaria `America/Santiago`.
- Al cierre de turno se ejecuta **detención automática de todos los cronómetros activos**.

**Parámetros de control**

| Variable | Descripción | Valor sugerido |
|----------|-------------|----------------|
| `NS_SHIFT_BATCH_ENABLED` | Habilita/deshabilita batch de cierre de turno | `true` |
| `NS_AUTO_STOP_AT_SHIFT_END` | Detiene automáticamente cronómetros al cierre | `true` |
| `NS_TIMEZONE` | Zona horaria oficial de ejecución | `America/Santiago` |
| `NS_RETRY_ENABLED` | Habilita reintentos si falla el envío del batch | `true` |

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
