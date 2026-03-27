# MCV_RelojControl / Cronómetro - Sandbox de Desarrollo

> **Este repositorio es el ambiente sandbox/desarrollo.**
> La arquitectura oficial vigente está documentada en [`Arquitectura MCV_Cronometro.md`](./Arquitectura%20MCV_Cronometro.md).
> El handoff operativo específico de NetSuite está documentado en [`cust.netsuite.md`](./cust.netsuite.md).
> Este README resume el entorno sandbox, la plataforma técnica y el flujo de integración actualmente aceptado.

> **Corrección importante para evitar ambigüedad en nuevos hilos**
>
> El contrato correcto de retorno **Cronómetro → NetSuite** no es un único valor genérico de “tiempo consolidado”.
>
> El retorno correcto por operación está compuesto por **3 datos reales**:
>
> 1. **tiempo real de configuración**
> 2. **tiempo real de trabajo / ejecución**
> 3. **cantidad terminada**
>
> Estos 3 datos son la contraparte real de los 3 datos planificados que NetSuite entrega a Cronómetro:
>
> 1. **tiempo de montaje planificado**
> 2. **tiempo de ejecución planificado**
> 3. **cantidad planificada**
>
> Si otro documento o hilo habla de “un único tiempo consolidado” como retorno mínimo, debe considerarse desactualizado o incompleto para efectos de integración.

---

## Diferencias clave con Producción

| Aspecto | Producción | Sandbox (este repo) |
|---------|-----------|---------------------|
| Base de datos | **MSSQL** (SQL Server) | **MariaDB** |
| Despliegue frontend | IIS en Windows (`C:\inetpub\wwwroot`) | Nginx en Docker + EasyPanel |
| Despliegue backend | Windows + PM2 | Docker + EasyPanel |
| Configuración | Credenciales en `config.js` | Variables de entorno |
| CI/CD | Manual (reemplazo de archivos) | GitHub -> EasyPanel rebuild |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Vue.js 2, Vuetify 2, Vuex, Axios |
| Backend | Node.js 16, Express.js, Sequelize ORM |
| Base de datos | MariaDB (dialecto configurable via `DB_DIALECT`) |
| Autenticación | JWT (`x-access-token`), bcrypt-nodejs |
| Servidor web | Nginx (sirve la SPA compilada) |
| Contenedores | Docker (Dockerfile en backend/ y front/) |
| PaaS | EasyPanel (proyecto: `bignotti`) |
| DNS / SSL | Cloudflare Tunnels |

---

## Variables de entorno

### Backend (`reloj-api`)

| Variable | Descripción | Valor sandbox |
|----------|-------------|--------------|
| `DB_HOST` | Host de la base de datos | `mariadb` |
| `DB_PORT` | Puerto | `3306` |
| `DB_USER` | Usuario DB | `relojcontrol` |
| `DB_PASSWORD` | Contraseña DB | _(ver bitácora privada)_ |
| `DB_NAME` | Nombre de la DB | `relojcontrol` |
| `DB_DIALECT` | Dialecto Sequelize | `mariadb` |
| `JWT_SECRET` | Secreto JWT | _(ver bitácora privada)_ |
| `DELETE_SECRET` | Clave para borrado masivo | _(ver bitácora privada)_ |

### Frontend (`reloj-front`)

Configurado en `front/.env.production`:

```env
VUE_APP_API_URL=https://reloj-api.at-once.cl/
```

Vue CLI lee este archivo automáticamente en `npm run build`.

---

## Servicios en EasyPanel (proyecto: bignotti)

| Servicio | Tipo | Fuente | Dominio | Puerto |
|----------|------|--------|---------|--------|
| `mariadb` | MariaDB | imagen oficial | interno | 3306 |
| `adminer` | Adminer 4.8.1 | imagen oficial | `badminer.at-once.cl` | 8080 |
| `reloj-api` | App (Dockerfile) | `mcandiav/MCV_RelojControl` rama `main` | `reloj-api.at-once.cl` | **8000** |
| `reloj-front` | App (Dockerfile) | `mcandiav/MCV_RelojControl` rama `main` | `reloj.at-once.cl` | 80 |

### Notas operativas EasyPanel

- El proxy del dominio `reloj-api.at-once.cl` debe apuntar al puerto **8000**.
- La conexión a MariaDB desde el backend usa `DB_HOST=mariadb`, no `localhost`.

### Build path `test` (diagnóstico NetSuite)

Se agregó `test/Dockerfile` para levantar un front de diagnóstico separado del front operativo:

- Login igual que el front normal.
- Si `VUE_APP_BUILD_PATH=test`, al autenticar redirige a `/diagnostic`.
- La vista `/diagnostic` permite correr `cors-ping`, `netsuite/status`, `peek-dataset`, `pull-dataset`, `push-actuals` y limpiar caché OAuth.

Build args recomendados para ese servicio:

- `VUE_APP_API_URL=https://reloj-api.at-once.cl/`
- `VUE_APP_BUILD_PATH=test`
- Si al crear un nuevo servicio App desde GitHub aparece `no actions found`, refrescar el token de GitHub en configuración para disparar el primer build.
- Al hacer cambios, rebuild solo del servicio afectado.

---

## Desarrollo local

### Prerrequisitos
- Node.js 16
- MariaDB local (o MySQL)

### Backend

```bash
cd backend
npm install
npm run dev
```

Crear archivo `.env` en la raíz de `backend/` con las variables listadas arriba. El servidor escucha en `http://localhost:8000`.

### Frontend

```bash
cd front
npm install
npm run serve
```

Crear `front/.env.development.local`:

```env
VUE_APP_API_URL=http://localhost:8000/
```

La app estará disponible en `http://localhost:8080`.

---

## Cambios aplicados en el sandbox

### Infraestructura

- Migración MSSQL -> MariaDB: `backend/src/config/config.js` y `db.js` usan `process.env.DB_DIALECT` (default `mariadb`).
- Todas las credenciales movidas a variables de entorno.
- Creados `Dockerfile` para backend y frontend.
- `front/nginx.conf` para servir la SPA con `try_files` y gzip.
- `front/.env.production` para configurar la URL del backend en build time.

### Backend

- `initialSetup.js`: exporta funciones en vez de ejecutarlas al importar. Se ejecutan en el `.then()` de `db.sync()` para evitar race conditions.
- Modelo `Discharged`: eliminado `indexes` explícito. Usa solo `unique: true` en el campo `key`.
- Endpoint `GET /auth/operarios`: público, retorna lista de operarios para la pantalla de login.
- `auth.js` -> `updateUser`: usa `instance.save()` en vez de `Model.update()` para garantizar el hasheo de contraseñas.

### Frontend

- `Login.vue`: login dual Operario / Administrador.
- `createUser.vue`: campos explícitos de contraseña y confirmación.
- `editButton.vue`: corrección de `data()` en Vue 2.
- `store/auth.js`: evita llamada innecesaria a `/auth/me` si no hay token.
- `store/subscriber.js`: elimina header `x-access-token` en logout en vez de dejar string `null`.
- `App.vue`: validación null antes de leer `user.name`.

---

## Flujo de datos con NetSuite

## Entrada: NetSuite -> Cronómetro

La fuente funcional validada en NetSuite es la search `710`, pero el contrato técnico de extracción quedó formalizado mediante el dataset:

- **`MCV_cronometro_out`**

Ese dataset entrega a Cronómetro, por operación:

- `NETSUITE_OPERATION_ID`
- `OT_NUMBER`
- `TIEMPO_MONTAJE_MIN`
- `OPERATION_NAME`
- `OPERATION_SEQUENCE`
- `RESOURCE_CODE`
- `PLANNED_QUANTITY`
- `TIEMPO_OPERACION_MIN_UNIT`
- `SOURCE_STATUS`

### Significado funcional de los 3 datos planificados relevantes

| NetSuite entrega | Significado |
|---|---|
| `TIEMPO_MONTAJE_MIN` | tiempo de montaje planificado |
| `TIEMPO_OPERACION_MIN_UNIT` | tiempo de trabajo / ejecución planificado |
| `PLANNED_QUANTITY` | cantidad planificada |

## Salida: Cronómetro -> NetSuite

El contrato correcto de retorno hacia NetSuite es **por operación** y devuelve estos **3 datos reales**:

| Cronómetro devuelve | Significado |
|---|---|
| tiempo real de configuración | resultado real del montaje |
| tiempo real de trabajo / ejecución | resultado real del trabajo |
| cantidad terminada | resultado real del conteo |

### Reglas de integración vigentes

- El retorno es por **batch** al cierre de turno o cierre manual administrativo.
- No se envían eventos `start`, `pause`, `resume`, `stop`.
- No se envían deltas aislados.
- NetSuite recibe el valor vigente publicado por Cronómetro.
- El dataset `MCV_cronometro_out` es solo para **lectura**; no debe usarse para retorno.

### Nivel correcto del retorno

La granularidad correcta del retorno es **operación**, no solo cabecera de OT.

El candidato natural en NetSuite para recibir estos 3 datos es:

- `manufacturingoperationtask`

Porque expone campos estándar compatibles con la lógica de negocio:
- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

---

## Referencias

- Arquitectura general vigente: [`Arquitectura MCV_Cronometro.md`](./Arquitectura%20MCV_Cronometro.md)
- Handoff operativo NetSuite: [`cust.netsuite.md`](./cust.netsuite.md)
- Bitácora de configuración del sandbox: [`SANDBOX_CONFIG.md`](./SANDBOX_CONFIG.md)
- README del backend: [`backend/README.md`](./backend/README.md)
