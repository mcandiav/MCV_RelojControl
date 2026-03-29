# Plantilla de variables de entorno para NetSuite

Copiar este bloque a un archivo local **no versionado** llamado `.env.local` en la raíz del proyecto Cronómetro.

> No guardar credenciales reales en el repositorio.
> Este documento existe para que Cursor sepa exactamente qué variables debe consumir.

```env
NETSUITE_CLIENT_ID=to_be_provided
NETSUITE_CERTIFICATE_ID=to_be_provided
NETSUITE_ACCOUNT_ID=to_be_provided
NETSUITE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nreplace_with_real_private_key\n-----END PRIVATE KEY-----"
NETSUITE_TOKEN_URL=to_be_provided
NETSUITE_RESTLET_IN_URL=https://6099999-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1
NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
NETSUITE_OUT_SAVEDSEARCH_NAME=BG - Control de HH por OT Detalle VF - CARGA
NETSUITE_RESTLET_IN_SCRIPT_ID=customscriptmcv_cronometro_restlet_in
NETSUITE_RESTLET_IN_DEPLOYMENT_ID=customdeploy1

# Opcional: scopes del JWT M2M (coma o espacio). Incluir suite_analytics para ejecutar el dataset por REST.
# NETSUITE_OAUTH_SCOPE=rest_webservices,restlets,suite_analytics

# Opcional: tras cierre de turno (auto o POST /chronometer/shift/close), intentar push del batch IN.
# NETSUITE_PUSH_ON_SHIFT_CLOSE=true
```

## Uso esperado por Cursor

Cursor debe implementar la integración leyendo estas variables de entorno y **no** hardcodeando valores sensibles en el código.

## Flujo correcto

- `NETSUITE_OUT_SAVEDSEARCH_ID` se usa para el **pull** del OUT en Saved Search
- `NETSUITE_RESTLET_IN_URL` se usa para el **push** al RESTlet `MCV_Cronometro_In`
- `NETSUITE_PRIVATE_KEY` debe leerse desde entorno y nunca desde un archivo versionado dentro del repo

## Aprendizaje clave (mar 2026): OUT oficial por Saved Search

Desde el cambio del 2026-03-28, la fuente OUT oficial para Cronómetro es una Saved Search y no un Dataset.

Cómo obtener el ID correcto:

1. En NetSuite, abrir la Saved Search técnica OUT.
2. Copiar el Script ID exacto (ejemplo actual: `customsearch_mcv_cronometro_out`).
3. Pegar ese valor en `NETSUITE_OUT_SAVEDSEARCH_ID`.

Detalle de mapeo de campos: `NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`.

## Aprendizaje clave (mar 2026): certificate id = kid (no “ID de aplicación”)

En OAuth 2.0 M2M con `client_assertion` (JWT firmado), `NETSUITE_CERTIFICATE_ID` debe ser el **`kid`** del certificado configurado en “Credenciales de cliente OAuth 2.0” (no el “ID de aplicación”/Integration ID).

## Recomendación operativa

1. Crear `.env.local` fuera de git
2. Pegar el bloque anterior
3. Reemplazar `to_be_provided` con los valores reales
4. Decirle a Cursor que tome las credenciales desde `.env.local`

## Integración en el backend (Cronómetro)

Con variables completas, el API expone (JWT admin):

- `GET /chronometer/netsuite/status` — qué variables están presentes (sin secretos)
- `GET /chronometer/netsuite/peek-dataset?limit=5` — nombre legado; hoy inspecciona el OUT de Saved Search
- `POST /chronometer/netsuite/pull-dataset` — nombre legado; hoy ejecuta pull paginado de Saved Search OUT y upsert en `work_order_operations` (no pisa `completed_quantity` en duplicados)
- `POST /chronometer/netsuite/push-actuals` — push batch al RESTlet IN; cuerpo opcional `{ "operation_ids": [1,2] }`
- `POST /chronometer/netsuite/oauth/clear-cache` — limpia caché del access token

**Importante:** mantener scopes M2M necesarios para lectura OUT y para RESTlet IN; validar permisos del rol técnico sobre la Saved Search y sobre `manufacturingoperationtask`.

### Pull solo desde el host (fuera de Docker)

Si el OUT se lee con Node **en la máquina anfitriona**, usá `backend/scripts/netsuite-pull-standalone.js` (mismas variables `NETSUITE_*`). Opcionalmente `--sync-api` + JWT admin para enviar las filas a `POST /chronometer/admin/netsuite-ingest-wip`. Detalle en `backend/README.md`.

## Variables deprecadas (histórico dataset)
```env
# NETSUITE_DATASET_OUT_ID=custdataset17
# NETSUITE_DATASET_OUT_NAME=MCV_cronometro_out
```
