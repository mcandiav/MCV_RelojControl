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
NETSUITE_DATASET_OUT_ID=custdataset17
NETSUITE_DATASET_OUT_NAME=MCV_cronometro_out
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

- `NETSUITE_DATASET_OUT_ID` se usa para el **pull** del dataset `MCV_cronometro_out`
- `NETSUITE_RESTLET_IN_URL` se usa para el **push** al RESTlet `MCV_Cronometro_In`
- `NETSUITE_PRIVATE_KEY` debe leerse desde entorno y nunca desde un archivo versionado dentro del repo

## Aprendizaje clave (mar 2026): dataset id REST ≠ id de pantalla

NetSuite REST (SuiteTalk) ejecuta datasets con un **id string** tipo `custdataset17`, no necesariamente con el número que se ve en URLs de UI como `dataset.nl?dataset=17`.

Cómo obtener el ID correcto:

1. Desde Cronómetro (admin/JWT), usar `GET /chronometer/netsuite/list-datasets` (diagnóstico).
2. Buscar el item con `name: "MCV_cronometro_out"` y copiar su `id` (ej. `custdataset17`).
3. Pegar ese valor en `NETSUITE_DATASET_OUT_ID`.

Referencia Oracle: “Getting a List of Datasets Through REST Web Services” y “Executing Datasets Through REST Web Services” en [Working with SuiteAnalytics Datasets in REST Web Services](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_156577938018.html).

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
- `GET /chronometer/netsuite/peek-dataset?limit=5` — muestra nombres de columnas y primeras filas
- `POST /chronometer/netsuite/pull-dataset` — pull paginado de `MCV_cronometro_out` y upsert en `work_order_operations` (no pisa `completed_quantity` en duplicados)
- `POST /chronometer/netsuite/push-actuals` — push batch al RESTlet IN; cuerpo opcional `{ "operation_ids": [1,2] }`
- `POST /chronometer/netsuite/oauth/clear-cache` — limpia caché del access token

**Importante:** el registro de integración en NetSuite debe permitir el alcance **`suite_analytics`** además de RESTlets, o el GET del dataset fallará. Ajustar según documentación Oracle y rol `MCV_Cronometro_Rol`.

### Pull solo desde el host (fuera de Docker)

Si el dataset se lee con Node **en la máquina anfitriona**, usá `backend/scripts/netsuite-pull-standalone.js` (mismas variables `NETSUITE_*`). Opcionalmente `--sync-api` + JWT admin para enviar las filas a `POST /chronometer/admin/netsuite-ingest-wip`. Detalle en `backend/README.md`.
