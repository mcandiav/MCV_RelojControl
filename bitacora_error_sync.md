# Bitacora Error Sync NetSuite -> MariaDB

## Objetivo
Documentar, en orden cronologico, todas las acciones realizadas para destrabar la sincronizacion desde NetSuite hacia MariaDB (tabla `work_order_operations`), incluyendo cambios de configuracion, codigo, despliegue y resultados observados.

## Contexto inicial
- Se creo un entorno de diagnostico separado (`reloj-test`) para no tocar el flujo productivo.
- El backend expone endpoints de integracion:
  - `GET /chronometer/netsuite/status`
  - `GET /chronometer/netsuite/peek-dataset`
  - `POST /chronometer/netsuite/pull-dataset`
  - `POST /chronometer/netsuite/push-actuals`

## Problemas detectados y acciones

### 1) Build/Deploy de `reloj-test` fallaba por rutas de Docker context
- **Sintoma:** errores `.../code/test/test/Dockerfile` y `COPY front/ ./ not found`.
- **Causa:** confusion entre `Build Path` (contexto) y `Dockerfile path`.
- **Resolucion:** en EasyPanel:
  - `Build Path`: `/` (raiz repo)
  - `Dockerfile`: `test/Dockerfile`
- **Resultado:** `reloj-test` levanto correctamente.

### 2) Front test no mostraba diagnostico util
- **Sintoma:** vista cargaba pero sin trazabilidad suficiente.
- **Accion:** se implemento pantalla `NetsuiteDiagnostic` y flujo `VUE_APP_BUILD_PATH=test`.
- **Resultado:** se pudo ejecutar `status`, `peek`, `pull`, `push` desde UI de prueba.

### 3) Error CORS desde `reloj-test` a `reloj-api`
- **Sintoma:** navegador mostraba `No 'Access-Control-Allow-Origin'`.
- **Acciones:**
  - Ajustes de CORS para origen `reloj-test.at-once.cl`.
  - Manejo de `OPTIONS`.
  - Logs de entrada/salida para rutas `/chronometer/netsuite/*`.
  - Respuestas de error NetSuite en HTTP 200 con `ok:false` para exponer detalle al front.
- **Resultado:** se pudo leer el error real de NetSuite en UI.

### 4) `invalid_client` en OAuth M2M
- **Sintoma:** `{"error":"invalid_client"}`.
- **Causas encontradas:**
  - `NETSUITE_CERTIFICATE_ID` incorrecto (se usaba ID de aplicacion, no `kid` de credencial M2M).
  - formato/confusion en variables.
- **Acciones:**
  - Corregir `NETSUITE_ACCOUNT_ID` a formato `6099999_SB1`.
  - Obtener `kid` correcto desde "Configuracion de credenciales de cliente OAuth 2.0".
  - Verificar permisos/scopes en integration y rol.
- **Resultado:** token OAuth comenzo a funcionar.

### 5) Dataset "no existe" (`NONEXISTENT_ID`)
- **Sintoma:** REST respondia `404 NONEXISTENT_ID` con `dataset=17`.
- **Causa:** el ID usado no era el ID REST ejecutable.
- **Accion clave:** listar datasets por REST (`GET /services/rest/query/v1/dataset/`).
- **Hallazgo:** dataset valido era:
  - `name`: `MCV_cronometro_out`
  - `id`: `custdataset17`
- **Resultado:** `NETSUITE_DATASET_OUT_ID` se actualizo a `custdataset17`.

### 6) `peek-dataset` funcionaba pero `pull-dataset` no poblaba filas
- **Sintoma:** `Dataset sin filas validas tras mapeo`.
- **Causa:** esquema real del dataset no coincidia con columnas esperadas por backend:
  - venian campos como `manufacturingworkcenter`, `workorder`, `operationsequence`, etc.
  - no venian aliases canonicos (`OT_NUMBER`, `RESOURCE_CODE`, `OPERATION_NAME`) en forma directa.
- **Accion:** adaptar mapeo en backend para aceptar esquema real y enriquecer datos faltantes con lookups REST.
- **Resultado:** se habilito procesamiento de filas, pero con alto costo temporal.

### 7) Pull largo terminaba en `Network Error` en front
- **Sintoma:** request entra (`[netsuite][in]`) pero no llega a `out`; front reporta `Network Error`.
- **Hipotesis principal:** operacion larga por volumen + enriquecimiento por lookups (latencia alta).
- **Acciones:**
  - agregar opcion de limite en backend: `maxRows`.
  - agregar acciones UI:
    - `Pull + Replace WIP`
    - `Pull + Replace 500`
- **Resultado:** se habilito prueba controlada por lotes.

### 8) Necesidad funcional definida por negocio
- **Decision operativa acordada:**
  - sincronizacion oficial con cronometros detenidos.
  - orden oficial: **push -> pull**.
  - para pull en modo "verdad NetSuite", se habilito `replace=1` sobre `work_order_operations` (con bloqueo si hay timers `ACTIVE/PAUSED`).
- **Decision de consolidacion futura:**
  - al hacer push, considerar base previa en NetSuite + delta local (publicar total vigente).

## Cambios de codigo relevantes (resumen)
- Backend:
  - CORS/diagnostico NetSuite.
  - `list-datasets` REST para descubrir ID real.
  - `pull-dataset` con:
    - `replace=1`
    - `maxRows`
    - validacion de timers activos/pausados.
  - mapeo dataset adaptado al esquema real recibido.
- Front:
  - modo test y vista diagnostico.
  - botones admin de sync (`Pull`, `Pull + Replace`, `Pull + Replace 500`).
  - titulo con etiqueta de build (ej. `V2`) para validar despliegue.

## Configuracion NetSuite/ENV validada
- `NETSUITE_ACCOUNT_ID=6099999_SB1`
- `NETSUITE_DATASET_OUT_ID=custdataset17`
- `NETSUITE_CERTIFICATE_ID=<kid OAuth2 client credentials>`
- scopes con `suite_analytics` + `rest_webservices` + `restlets`
- dataset compartido al rol tecnico usado por M2M

## Estado actual
- Conexion OAuth y descubrimiento de dataset: **OK**.
- `peek-dataset`: **OK**.
- `pull-dataset` completo: **inestable por tiempo/latencia** en ejecuciones largas (en analisis con instrumentacion).
- `pull-dataset?replace=1&maxRows=500`: habilitado para pruebas controladas.
- Logica funcional oficial documentada: **push -> pull** con cronometros detenidos.

## Proximo paso recomendado
1. Ejecutar `Pull + Replace 500` y capturar trazas `[dbg]` + `[netsuite]` en `reloj-api`.
2. Confirmar punto exacto de bloqueo (fetch de dataset vs persistencia DB).
3. Si el cuello es enriquecimiento por lookups, optimizar estrategia (menos llamadas por fila o dataset con aliases finales).
