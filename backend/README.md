# Backend de Cronómetro

Este directorio contiene el backend actual usado en el sandbox.

## Fuente de verdad documental

Para evitar ambigüedades, la documentación autoritativa del proyecto está en:

- `../Arquitectura MCV_Cronometro.md`
- `../cust.netsuite.md`

Este README solo resume el backend técnico actual.

---

## Corrección crítica sobre NetSuite

El retorno correcto **Cronómetro -> NetSuite** no es un único valor genérico de tiempo.

El contrato correcto de retorno por operación incluye estos **3 datos reales**:

1. **tiempo real de configuración**
2. **tiempo real de trabajo / ejecución**
3. **cantidad terminada**

Estos 3 datos corresponden a los 3 datos planificados que NetSuite entrega a Cronómetro:

1. **tiempo de montaje planificado**
2. **tiempo de ejecución planificado**
3. **cantidad planificada**

Si alguna referencia heredada habla de un solo consolidado ambiguo, debe considerarse desactualizada para efectos de integración.

---

## Flujo vigente con NetSuite

### Entrada: NetSuite -> Cronómetro

La lectura oficial desde NetSuite se basa en una Saved Search:

- `customsearch_mcv_cronometro_out` (Saved Search 823)
- Referencia documental: `../NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`

Campos funcionales principales:

- `NETSUITE_OPERATION_ID`
- `OT_NUMBER`
- `TIEMPO_MONTAJE_MIN`
- `OPERATION_NAME`
- `OPERATION_SEQUENCE`
- `RESOURCE_CODE`
- `PLANNED_QUANTITY`
- `TIEMPO_OPERACION_MIN_UNIT`
- `SOURCE_STATUS`

### Salida: Cronómetro -> NetSuite

Cronómetro devuelve por operación:

- tiempo real de configuración
- tiempo real de trabajo / ejecución
- cantidad terminada

Reglas:

- envío por batch al cierre de turno o cierre manual administrativo
- no se envían eventos individuales
- no se envían deltas aislados
- la granularidad correcta es **operación**

### Implementación en este repo (capa 3)

Módulos en `src/services/netsuite/`: OAuth 2.0 M2M (JWT **PS256** con *fallback* **RS256**), cliente de extracción OUT (Saved Search), y push IN por `Importación OT`, `workOrderCompletion` o RESTlet legado según configuración.

Endpoints (cabecera JWT de **admin**):

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/chronometer/netsuite/status` | Comprobación de entorno |
| GET | `/chronometer/netsuite/peek-dataset` | Nombre legado; hoy inspecciona el OUT de Saved Search |
| POST | `/chronometer/netsuite/pull-dataset` | Nombre legado; hoy ejecuta pull + upsert desde Saved Search OUT |
| POST | `/chronometer/netsuite/push-actuals` | Push de los 3 datos vigentes hacia NetSuite (`NETSUITE_PUSH_MODE=import_ot`, `workorder_completion` o `restlet`) |
| POST | `/chronometer/netsuite/sync-official` | Flujo oficial: push confirmado + pull + replace total WIP |
| POST | `/chronometer/netsuite/oauth/clear-cache` | Invalida token en memoria |

| GET | `/chronometer/admin/shift-schedule` | Tres horarios de cierre (admin) |
| PUT | `/chronometer/admin/shift-schedule` | Body `{ "slots": [{ "sequence":1,"hhmm":"07:00","enabled":true }, …] }` |

Variables: ver `../NETSUITE_ENV_TEMPLATE.md`. Para sincronizacion oficial automatica tras cierre de turno: `NETSUITE_PUSH_ON_SHIFT_CLOSE=true` (por defecto desactivado).

Semilla inicial de los 3 horarios (solo si la tabla está vacía): `NS_SHIFT_BATCH_TIMES=06:00,14:00,22:00` o el legado `NS_SHIFT_BATCH_TIME` para el primer slot.

### Pull NetSuite fuera de Docker (host)

Si la lectura OUT debe hacerse **desde la máquina anfitriona** (sin salir al NetSuite desde el contenedor), usá el script:

```bash
cd backend
# .env.local en la raíz del repo con NETSUITE_* o exportá variables en la shell
npm run netsuite:pull:standalone > ../tmp/netsuite-wip.json
```

Para cargar el resultado en la base del servidor (API en Docker / EasyPanel), con JWT de **admin**:

```bash
npm run netsuite:pull:standalone -- --sync-api https://reloj-api.at-once.cl --jwt "TU_JWT"
# o: set CRONOMETRO_ADMIN_JWT=... y omitir --jwt
```

Eso llama a `POST /chronometer/admin/netsuite-ingest-wip`, mismo upsert que el pull interno (no pisa `completed_quantity` en duplicados).

### Network Error al instante desde el navegador (HTTPS)

Suele ser **mixed content** (front en HTTPS y `axios` apuntando a `http://localhost`) o **503 sin CORS** mientras el API arranca. El front carga `/api-config.js` antes del bundle; el API añade CORS en **503**.

Si la **baseURL ya es `https://reloj-api…`** y sigue “Network Error”, suele ser **certificado TLS**, **DNS**, **firewall** o **proxy** — no la variable del front. Probar en el navegador: `https://reloj-api…/health` y el botón del front **Probar conexión API** (`GET /cors-ping`, sin JWT).

CORS: cabeceras explícitas para `x-access-token`. Diagnóstico extremo: `CORS_ALLOW_ALL=true` en el contenedor del API (solo pruebas).

**Nota de modelo:** `actual_setup_time` hacia NetSuite se envía en **0** hasta que existan eventos o reglas que distingan montaje frente a ejecución (la arquitectura exige no inferir setup solo desde pausa). `actual_run_time` se deriva del tiempo activo acumulado en eventos (minutos). `completed_quantity` sale del campo local al cerrar operación.

---

## Stack técnico actual

- Node.js
- Express.js
- Sequelize
- JWT
- bcrypt-nodejs
- Multer
- XLSX

---

## Endpoints heredados existentes

### Autenticación (`/api/auth`)

- `POST /signin`
- `POST /signup`
- `POST /signout`
- `GET /me`
- `GET /users`
- `PUT /users/:id`
- `DELETE /users/:id`

### Órdenes (`/api/orders`)

- `GET /`
- `POST /`
- `POST /edit`
- `POST /delete`
- `POST /deleteAll`
- `POST /play`
- `POST /pause`
- `POST /stop`
- `GET /download`
- `GET /workers`
- `POST /report`
- `POST /reportbyDay`
- `POST /timerReport`
- `GET /inconsistency`
- `POST /fixInconsistency`
- `GET /roles`
- `GET /workplaces`

### Archivos (`/api/files`)

- `POST /upload`

---

## Qué debe asumir otro hilo

1. La arquitectura vigente no se define por este README aislado.
2. El retorno correcto hacia NetSuite incluye 3 datos reales por operación.
3. `completed_quantity` no pertenece al input desde NetSuite; pertenece al retorno desde Cronómetro.
4. La fuente oficial de lectura OUT es la Saved Search `customsearch_mcv_cronometro_out` (solo `En curso`).
