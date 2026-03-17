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

## Notas importantes

- El repo de **producción NO se toca**. Todos los cambios van al repo sandbox.
- La base de datos de producción es **SQL Server (MSSQL)**. El sandbox usa **MariaDB**.
- El flujo con NetSuite es **manual**: Excel entra → operarios trabajan → CSV sale → se sube a NetSuite.
- A futuro se puede automatizar usando la **NetSuite REST API** (OAuth 2.0).
- Las credenciales de NetSuite (sandbox y productivo) las administra Miguel.
