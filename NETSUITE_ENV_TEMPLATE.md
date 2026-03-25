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
NETSUITE_DATASET_OUT_ID=17
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

- `NETSUITE_DATASET_OUT_ID=17` se usa para el **pull** del dataset `MCV_cronometro_out`
- `NETSUITE_RESTLET_IN_URL` se usa para el **push** al RESTlet `MCV_Cronometro_In`
- `NETSUITE_PRIVATE_KEY` debe leerse desde entorno y nunca desde un archivo versionado dentro del repo

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
