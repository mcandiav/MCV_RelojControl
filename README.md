# MCV_RelojControl / CronÃ³metro - Sandbox de Desarrollo

> **Este repositorio es el ambiente sandbox/desarrollo.**
> La arquitectura oficial vigente estÃ¡ documentada en [`Arquitectura MCV_Cronometro.md`](./Arquitectura%20MCV_Cronometro.md).
> El handoff operativo especÃ­fico de NetSuite estÃ¡ documentado en [`cust.netsuite.md`](./cust.netsuite.md).
> **ActualizaciÃ³n crÃ­tica de la fuente OUT (2026-03-28):** la extracciÃ³n NetSuite -> CronÃ³metro **ya no debe implementarse con Dataset**. La decisiÃ³n tÃ©cnica y el diagnÃ³stico quedaron documentados en [`NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md`](./NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md).
> El mapeo oficial de campos del Saved Search quedo en [`NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`](./NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md).
> Este README resume el entorno sandbox, la plataforma tÃ©cnica y el flujo de integraciÃ³n actualmente aceptado.

> **CorrecciÃ³n importante para evitar ambigÃ¼edad en nuevos hilos**
>
> El contrato correcto de retorno **CronÃ³metro â†’ NetSuite** no es un Ãºnico valor genÃ©rico de â€œtiempo consolidadoâ€.
>
> El retorno correcto por operaciÃ³n estÃ¡ compuesto por **3 datos reales**:
>
> 1. **tiempo real de configuraciÃ³n**
> 2. **tiempo real de trabajo / ejecuciÃ³n**
> 3. **cantidad terminada**
>
> Estos 3 datos son la contraparte real de los 3 datos planificados que NetSuite entrega a CronÃ³metro:
>
> 1. **tiempo de montaje planificado**
> 2. **tiempo de ejecuciÃ³n planificado**
> 3. **cantidad planificada**
>
> Si otro documento o hilo habla de â€œun Ãºnico tiempo consolidadoâ€ como retorno mÃ­nimo, debe considerarse desactualizado o incompleto para efectos de integraciÃ³n.

---

## Diferencias clave con ProducciÃ³n

| Aspecto | ProducciÃ³n | Sandbox (este repo) |
|---------|-----------|---------------------|
| Base de datos | **MSSQL** (SQL Server) | **MariaDB** |
| Despliegue frontend | IIS en Windows (`C:\inetpub\wwwroot`) | Nginx en Docker + EasyPanel |
| Despliegue backend | Windows + PM2 | Docker + EasyPanel |
| ConfiguraciÃ³n | Credenciales en `config.js` | Variables de entorno |
| CI/CD | Manual (reemplazo de archivos) | GitHub -> EasyPanel rebuild |

---

## Stack tecnolÃ³gico

| Capa | TecnologÃ­a |
|------|-----------|
| Frontend | Vue.js 2, Vuetify 2, Vuex, Axios |
| Backend | Node.js 16, Express.js, Sequelize ORM |
| Base de datos | MariaDB (dialecto configurable via `DB_DIALECT`) |
| AutenticaciÃ³n | JWT (`x-access-token`), bcrypt-nodejs |
| Servidor web | Nginx (sirve la SPA compilada) |
| Contenedores | Docker (Dockerfile en backend/ y front/) |
| PaaS | EasyPanel (proyecto: `bignotti`) |
| DNS / SSL | Cloudflare Tunnels |

---

## Variables de entorno

### Backend (`reloj-api`)

| Variable | DescripciÃ³n | Valor sandbox |
|----------|-------------|--------------|
| `DB_HOST` | Host de la base de datos | `mariadb` |
| `DB_PORT` | Puerto | `3306` |
| `DB_USER` | Usuario DB | `relojcontrol` |
| `DB_PASSWORD` | ContraseÃ±a DB | _(ver bitÃ¡cora privada)_ |
| `DB_NAME` | Nombre de la DB | `relojcontrol` |
| `DB_DIALECT` | Dialecto Sequelize | `mariadb` |
| `JWT_SECRET` | Secreto JWT | _(ver bitÃ¡cora privada)_ |
| `DELETE_SECRET` | Clave para borrado masivo | _(ver bitÃ¡cora privada)_ |

### Frontend (`reloj-front`)

Configurado en `front/.env.production`:

```env
VUE_APP_API_URL=https://reloj-api.at-once.cl/
```

Vue CLI lee este archivo automÃ¡ticamente en `npm run build`.

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
- La conexiÃ³n a MariaDB desde el backend usa `DB_HOST=mariadb`, no `localhost`.

### Build path `test` (diagnÃ³stico NetSuite)

Se agregÃ³ `test/Dockerfile` para levantar un front de diagnÃ³stico separado del front operativo:

- Login igual que el front normal.
- Si `VUE_APP_BUILD_PATH=test`, al autenticar redirige a `/diagnostic`.
- La vista `/diagnostic` permite correr `cors-ping`, `netsuite/status`, pruebas de sincronizacion y `push-actuals`.
- Nota: las rutas historicas `peek-dataset`, `pull-dataset` y `list-datasets` quedan deprecadas para OUT desde 2026-03-28; la fuente oficial OUT es Saved Search.

Build args recomendados para ese servicio:

- `VUE_APP_API_URL=https://reloj-api.at-once.cl/`
- `VUE_APP_BUILD_PATH=test`
- Si al crear un nuevo servicio App desde GitHub aparece `no actions found`, refrescar el token de GitHub en configuraciÃ³n para disparar el primer build.
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

Crear archivo `.env` en la raÃ­z de `backend/` con las variables listadas arriba. El servidor escucha en `http://localhost:8000`.

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

La app estarÃ¡ disponible en `http://localhost:8080`.

---

## Cambios aplicados en el sandbox

### Infraestructura

- MigraciÃ³n MSSQL -> MariaDB: `backend/src/config/config.js` y `db.js` usan `process.env.DB_DIALECT` (default `mariadb`).
- Todas las credenciales movidas a variables de entorno.
- Creados `Dockerfile` para backend y frontend.
- `front/nginx.conf` para servir la SPA con `try_files` y gzip.
- `front/.env.production` para configurar la URL del backend en build time.

### Backend

- `initialSetup.js`: exporta funciones en vez de ejecutarlas al importar. Se ejecutan en el `.then()` de `db.sync()` para evitar race conditions.
- Modelo `Discharged`: eliminado `indexes` explÃ­cito. Usa solo `unique: true` en el campo `key`.
- Endpoint `GET /auth/operarios`: pÃºblico, retorna lista de operarios para la pantalla de login.
- `auth.js` -> `updateUser`: usa `instance.save()` en vez de `Model.update()` para garantizar el hasheo de contraseÃ±as.

### Frontend

- `Login.vue`: login dual Operario / Administrador.
- `createUser.vue`: campos explÃ­citos de contraseÃ±a y confirmaciÃ³n.
- `editButton.vue`: correcciÃ³n de `data()` en Vue 2.
- `store/auth.js`: evita llamada innecesaria a `/auth/me` si no hay token.
- `store/subscriber.js`: elimina header `x-access-token` en logout en vez de dejar string `null`.
- `App.vue`: validaciÃ³n null antes de leer `user.name`.

---

## Flujo de datos con NetSuite

## Entrada: NetSuite -> CronÃ³metro

La fuente funcional validada en NetSuite sigue siendo la search `710`, pero la **fuente tÃ©cnica OUT aceptada** para CronÃ³metro cambiÃ³.

### DecisiÃ³n vigente
La extracciÃ³n NetSuite -> CronÃ³metro **no debe implementarse con Dataset**.

La fuente OUT debe implementarse como una **Saved Search tÃ©cnica** basada en:

- **Tipo de bÃºsqueda:** `Tarea de operaciÃ³n de fabricaciÃ³n`
- **Record tÃ©cnico equivalente:** `manufacturingoperationtask`
- **BÃºsqueda tÃ©cnica nueva:** `MCV_Cronometro_Out_Search`
- **Script ID operativo:** `customsearch_mcv_cronometro_out` (Saved Search 823)
- **Filtro operativo:** `Estado = En curso`

### QuÃ© quedÃ³ descartado
- Dataset con root `Tiempo planificado de fabricaciÃ³n`
- Dataset con root `Ruta de fabricaciÃ³n`
- Dataset con root `TransacciÃ³n de fabricaciÃ³n`

Motivos resumidos:
- no reprodujeron correctamente el universo real de la search `710`;
- no respetaron de manera confiable la granularidad `1 operaciÃ³n = 1 fila`;
- no ofrecieron un reemplazo fiel del tipo `Tarea de operaciÃ³n de fabricaciÃ³n`.

### ValidaciÃ³n funcional cerrada
La nueva fuente tÃ©cnica Saved Search, filtrada a `Estado = En curso`, devolviÃ³ **271 registros** en sandbox, alineÃ¡ndose con el subconjunto real que se usa para subir a RelojControl.

### Columnas mÃ­nimas esperadas por CronÃ³metro
La Saved Search tÃ©cnica debe entregar, por operaciÃ³n:

- `Orden de trabajo`
- `Secuencia de operaciones`
- `Centro de trabajo de fabricaciÃ³n`
- `CONFIGURACION RUTA`
- `EJECUCION RUTA`
- `Cantidad de entrada`
- `Estado`
- `Nombre de la operaciÃ³n`

### Significado funcional de los 3 datos planificados relevantes

| NetSuite entrega | Significado |
|---|---|
| `CONFIGURACION RUTA` | tiempo de montaje planificado |
| `EJECUCION RUTA` | tiempo de trabajo / ejecuciÃ³n planificado |
| `Cantidad de entrada` | cantidad planificada |

## Salida: CronÃ³metro -> NetSuite

El contrato correcto de retorno hacia NetSuite es **por operaciÃ³n** y devuelve estos **3 datos reales**:

| CronÃ³metro devuelve | Significado |
|---|---|
| tiempo real de configuraciÃ³n | resultado real del montaje |
| tiempo real de trabajo / ejecuciÃ³n | resultado real del trabajo |
| cantidad terminada | resultado real del conteo |

### Reglas de integraciÃ³n vigentes

- El retorno es por **batch** al cierre de turno o cierre manual administrativo.
- LÃ³gica oficial de sincronizaciÃ³n (mar 2026): con cronÃ³metros detenidos (auto-stop), ejecutar **push â†’ pull**.
- No se envÃ­an eventos `start`, `pause`, `resume`, `stop`.
- No se envÃ­an deltas aislados.
- NetSuite recibe el valor vigente publicado por CronÃ³metro.
- La fuente OUT tÃ©cnica ahora es una **Saved Search**, no un Dataset.

### Nivel correcto del retorno

La granularidad correcta del retorno es **operaciÃ³n**, no solo cabecera de OT.

El candidato natural en NetSuite para recibir estos 3 datos es:

- `manufacturingoperationtask`

Porque expone campos estÃ¡ndar compatibles con la lÃ³gica de negocio:
- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

---

## Referencias

- Arquitectura general vigente: [`Arquitectura MCV_Cronometro.md`](./Arquitectura%20MCV_Cronometro.md)
- Handoff operativo NetSuite: [`cust.netsuite.md`](./cust.netsuite.md)
- Cambio de fuente OUT: [`NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md`](./NETSUITE_OUT_SOURCE_CHANGE_2026-03-28.md)
- Campos oficiales de Saved Search OUT: [`NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`](./NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md)
- BitÃ¡cora de configuraciÃ³n del sandbox: [`SANDBOX_CONFIG.md`](./SANDBOX_CONFIG.md)
- README del backend: [`backend/README.md`](./backend/README.md)

