# Configuración funcional NetSuite para vínculo con Cronómetro

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|---|---|---|---|---|
| 2026-04-29 | Se incorpora protocolo operativo correcto para configurar ambientes NetSuite, OAuth2 M2M, RESTlet IN, registro `Importación OT` y checklist de diagnóstico. | En productivo se detectaron errores por confusión de `NETSUITE_CERTIFICATE_ID`, por mover la M2M común a pull/push y por permisos efectivos del custom record `Importación OT`. | Queda documentado que pull y push comparten OAuth M2M, que el `kid` debe copiarse exactamente, y que `Importación OT` debe permitir acceso a roles internos para que RESTlet/REST API creen registros. | Configuración por ambiente, OAuth2 M2M, push, troubleshooting |
| 2026-04-05 | Se ordena y consolida el documento de handoff NetSuite con estado final del proyecto. | El proyecto ya estaba estabilizado y había mezcla entre decisiones históricas y vigentes. | Se aclara qué quedó operativo, qué quedó histórico y qué no debe reabrirse. | Estado, decisiones cerradas, integración OUT/IN, resumen ejecutivo |
| 2026-03-28 | Se consolida Saved Search como fuente OUT vigente. | Dataset no garantizaba la granularidad correcta. | Se corrige la fuente de extracción NetSuite -> Cronómetro. | Fuente OUT |
| 2026-03-27 | Se invalida la raíz `Tiempo planificado de fabricación` para Dataset OUT. | Multiplicaba una misma operación lógica en varias filas. | Queda descartada como base válida. | Dataset OUT histórico |
| 2026-03-25 | Se corrige el contrato de retorno a 3 datos reales por operación. | Evitar pérdida de significado funcional. | Se fija el contrato correcto del push hacia NetSuite. | Contrato funcional |

---

## Estado operativo actual

Este documento es la fuente base para configurar o reconstruir un ambiente NetSuite para Cronómetro.

La integración tiene dos flujos funcionales separados, pero ambos usan la misma autenticación OAuth2 M2M:

1. **Pull / OUT:** NetSuite -> Cronómetro.
2. **Push / IN:** Cronómetro -> NetSuite.

Regla crítica:

> **Pull y push NO tienen credenciales OAuth separadas.**
>
> Ambos usan el mismo bloque OAuth M2M del backend.
>
> Si se rompe OAuth M2M, se rompen pull y push al mismo tiempo.

Arquitectura vigente:

- Autenticación: **OAuth 2.0 M2M / Client Credentials**.
- Rol técnico: `MCV_Cronometro_Rol`.
- Entidad usada en configuración actual: `MIGUEL CANDIA` o usuario técnico equivalente.
- RESTlet IN: `MCV_Cronometro_Restlet_In`.
- Script RESTlet: `MCV_cronometro_restlet.js`.
- Push vigente: crear staging en `Importación OT` (`customrecord_3k_importacion_ot`), ya sea vía RESTlet o vía REST Record API según `NETSUITE_PUSH_MODE`.
- Flujo operativo: **Stop -> Push -> Pull**.

---

## Principios que no se deben olvidar

1. **Nunca tocar la M2M común solo porque falla el push si el pull funciona.**
   - Si pull funciona, OAuth M2M funciona.
   - En ese caso el problema del push está después del token: RESTlet, permisos, payload, custom record, script o deployment.

2. **`NETSUITE_CERTIFICATE_ID` es el `kid` exacto del certificado OAuth2 Client Credentials.**
   - No es el ID de aplicación.
   - No es el script ID.
   - No es el deployment ID.
   - No es el nombre del archivo.
   - Es sensible a mayúsculas/minúsculas y a cada carácter.
   - Cuidado extremo con caracteres visualmente parecidos:
     - `l` ele minúscula
     - `I` i mayúscula
     - `0` cero
     - `O` o mayúscula

3. **NetSuite recibe el certificado público; Cronómetro conserva la private key.**
   - En NetSuite se carga el certificado público: archivo con `BEGIN CERTIFICATE`.
   - En el backend se configura la clave privada: `BEGIN PRIVATE KEY`.
   - Nunca subir la private key a NetSuite.

4. **El mismo certificado público puede verse como `.crt`, `.cer` o `.pem`, pero lo que importa es el contenido.**
   - Para NetSuite debe ser certificado público.
   - La extensión puede confundir; el contenido manda.

5. **El custom record `Importación OT` debe permitir acceso efectivo al contexto M2M/REST.**
   - No basta con que el rol muestre `Completo` si el tipo de acceso del custom record bloquea la ejecución REST/SuiteScript.

---

## Checklist de configuración completa por ambiente

Usar este checklist para configurar PROD, SB o cualquier ambiente nuevo.

### 1. Features / funciones NetSuite

Verificar habilitadas:

- Servicios web REST.
- OAuth 2.0.
- Client Credentials / Machine to Machine.
- SuiteScript 2.1.
- RESTlets.

### 2. Integration Record M2M

Crear o verificar una integración M2M del ambiente.

Debe tener:

- Estado: `Habilitado`.
- OAuth 2.0 habilitado.
- `Otorgamiento de credenciales de cliente (equipo a equipo)` marcado.
- `Otorgamiento de código de autorización` desmarcado si no se usa.
- `Cliente público` desmarcado.
- Scopes / Alcance:
  - `RESTlets`
  - `Servicios Web REST`
  - `SuiteAnalytics Connect` si el pull/diagnóstico usa SuiteAnalytics/SuiteQL.

Luego generar/restablecer credenciales de cliente y guardar en el backend:

- `NETSUITE_CLIENT_ID`
- `NETSUITE_CLIENT_SECRET`

Aunque el backend actual firma con JWT/private key y no depende funcionalmente del secret en el flujo M2M, dejar `NETSUITE_CLIENT_SECRET` actualizado por trazabilidad y compatibilidad futura.

### 3. Certificado OAuth2 Client Credentials

Ruta funcional:

`Configuración -> Integración -> Configuración de credenciales de cliente OAuth 2.0`

Crear una asignación con:

- Entidad: `MIGUEL CANDIA` o usuario técnico definido.
- Rol: `MCV_Cronometro_Rol`.
- Aplicación: integración M2M vigente del ambiente.
- Algoritmo: `RSA`.
- Certificado: certificado público correcto.

Al guardar, copiar el **ID de certificado** exactamente. Ese valor va en:

```env
NETSUITE_CERTIFICATE_ID=<KID_EXACTO_COPIADO_DESDE_NETSUITE>
```

No tipear este valor a mano si se puede evitar. Copiar/pegar desde NetSuite.

### 4. Certificado público vs private key

El certificado público que se sube a NetSuite debe iniciar con:

```text
BEGIN CERTIFICATE
```

La private key que va en el backend debe iniciar con:

```text
BEGIN PRIVATE KEY
```

Si el certificado público cargado en NetSuite no corresponde a la private key del backend, NetSuite rechazará el token.

Errores típicos:

- `invalid_client`: `CLIENT_ID`, `kid`, app M2M o asociación M2M inválida.
- `invalid_grant`: assertion/grant inválido, certificado/key incorrectos o claims no aceptados.
- `ENOTFOUND`: problema DNS/red/host.

### 5. Rol `MCV_Cronometro_Rol`

El rol debe estar asignado a la entidad usada por M2M.

En la ficha del empleado/entidad:

- Acceso concedido.
- Rol asignado: `MCV_Cronometro_Rol`.

En el rol:

- No marcar `Rol único de servicios web` salvo que se valide expresamente contra el ambiente funcional.
- Permisos técnicos esperados:
  - Servicios web REST.
  - RESTlets / SuiteScript, según disponibilidad de la cuenta.
  - OAuth 2.0 / tokens de acceso, según nomenclatura del ambiente.
- Permisos funcionales mínimos:
  - `Orden de trabajo` con nivel suficiente para leer/resolver OT.
  - `Buscar transacción` con nivel suficiente.
  - Registros personalizados:
    - `Importación OT` -> `Completo`.
    - `Importación OT - Detalle` -> `Completo`, si existe y participa del flujo.

### 6. Custom record `Importación OT`

Registro personalizado:

- Nombre: `Importación OT`.
- ID: `customrecord_3k_importacion_ot`.

Campos relevantes:

| Campo | ID |
|---|---|
| OT | `custrecord_3k_ot_principal` |
| Fecha | `custrecord_3k_imp_ot_fecha` |
| Estado | `custrecord_3k_imp_ot_estado` |
| Detalle Procesamiento | `custrecord_3k_imp_ot_det_proc` |
| Finalización OT Generada | `custrecord_3k_imp_ot_transaccion` |
| JSON | `custrecord_3k_imp_ot_json` |

Configuración crítica del tipo de registro:

- **Tipo de acceso:** `No se necesitan permisos para los roles internos`.
- Acceso de roles externos: `Ninguno`.
- Acceso de usuarios no autenticados: `Ninguno`.
- `Permitir acceso a la UI`: marcado.
- `Permitir acceso móvil`: normalmente desmarcado.
- `Permitir archivos adjuntos`: marcado.
- `Mostrar notas`: marcado.
- `Permitir edición de registros secundarios`: marcado.
- `Permitir eliminar`: desmarcado salvo decisión explícita.
- `Inactiva`: desmarcado.

Lección aprendida:

> Si `Importación OT` queda en `Se requiere permiso...`, puede fallar con `INSUFFICIENT_PERMISSION` desde OAuth/REST/SuiteScript aunque el rol `MCV_Cronometro_Rol` muestre `Completo`.

### 7. RESTlet IN

Script:

- Nombre: `MCV_Cronometro_Restlet_In`.
- Archivo esperado: `MCV_cronometro_restlet.js`.
- Tipo: RESTlet.
- API: SuiteScript 2.1.

Deployment:

- Estado: `Liberado`.
- Nivel de registro: `Auditoría`.
- URL externa por ambiente:
  - Sandbox: dominio `restlets.api.netsuite.com` con sufijo sandbox.
  - Productivo: dominio `restlets.api.netsuite.com` productivo.

Audiencia:

- Recomendado: permitir explícitamente `MCV_Cronometro_Rol` o replicar exactamente la audiencia del ambiente funcional.
- Si se usa `Todos los roles internos`, validar con push real.

### 8. Variables `.env` del backend

Bloque común OAuth para pull y push:

```env
NETSUITE_CLIENT_ID=<CLIENT_ID_DE_LA_INTEGRACION_M2M_DEL_AMBIENTE>
NETSUITE_CLIENT_SECRET=<CLIENT_SECRET_DE_LA_INTEGRACION_M2M_DEL_AMBIENTE>
NETSUITE_CERTIFICATE_ID=<KID_EXACTO_DE_LA_CREDENCIAL_OAUTH2_CLIENT_CREDENTIALS>
NETSUITE_ACCOUNT_ID=<ACCOUNT_ID_DEL_AMBIENTE>
NETSUITE_TOKEN_URL=https://<ACCOUNT_HOST>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
NETSUITE_PRIVATE_KEY=<PRIVATE_KEY_CORRESPONDIENTE_AL_CERTIFICADO_PUBLICO>
```

URLs por ambiente:

```env
# Sandbox
NETSUITE_ACCOUNT_ID=<ACCOUNT_ID_SANDBOX>
NETSUITE_TOKEN_URL=https://<ACCOUNT_SANDBOX_HOST>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
NETSUITE_RESTLET_IN_URL=https://<ACCOUNT_SANDBOX_HOST>.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=<SCRIPT_ID>&deploy=<DEPLOY_ID>

# Productivo
NETSUITE_ACCOUNT_ID=<ACCOUNT_ID_PROD>
NETSUITE_TOKEN_URL=https://<ACCOUNT_PROD_HOST>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
NETSUITE_RESTLET_IN_URL=https://<ACCOUNT_PROD_HOST>.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=<SCRIPT_ID>&deploy=<DEPLOY_ID>
```

Push por RESTlet:

```env
NETSUITE_PUSH_MODE=restlet
```

Push directo a REST Record API / staging:

```env
NETSUITE_PUSH_MODE=import_ot
NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha
```

Ambos modos terminan creando staging en `Importación OT`; solo cambia el camino:

- `restlet`: Backend -> RESTlet -> `customrecord_3k_importacion_ot`.
- `import_ot`: Backend -> REST Record API -> `customrecord_3k_importacion_ot`.

Configuración OUT:

La documentación funcional consolidada conserva como fuente oficial la Saved Search técnica:

```env
NETSUITE_OUT_SOURCE_TYPE=savedsearch
NETSUITE_OUT_SAVEDSEARCH_ID=customsearch_mcv_cronometro_out
```

Si un ambiente usa SuiteQL por decisión técnica local, debe documentarse explícitamente en su `.env` y no asumirse como configuración general.

---

## Validaciones obligatorias después de configurar

No probar push antes de pasar estas pruebas.

### 1. Verificar OAuth/token

Desde el contenedor backend, ejecutar la prueba de token M2M.

Esperado:

```text
TOKEN_OK len=<número>
```

Si sale `invalid_client`, revisar en este orden:

1. `NETSUITE_CLIENT_ID` corresponde a la integración correcta del ambiente.
2. `NETSUITE_CERTIFICATE_ID` es el `kid` exacto, sin confundir `l/I` ni `0/O`.
3. La credencial OAuth2 Client Credentials está activa y no revocada.
4. La app/entidad/rol/certificado corresponden a la misma fila M2M.
5. `NETSUITE_TOKEN_URL` apunta al ambiente correcto.

### 2. Probar pull

Solo después de `TOKEN_OK`, probar pull.

Esperado:

- Pull ejecuta sin `invalid_client`.
- Si falla, el error ya pertenece a fuente OUT, Saved Search/SuiteQL, permisos de lectura o mapeo.

### 3. Probar dry run de push

Antes de enviar a NetSuite, generar payload.

Esperado:

- `itemCount > 0`.
- Cada item debe tener:
  - `ot_number`
  - `operation_sequence`
  - `netsuite_operation_id`
  - `actual_setup_time`
  - `actual_run_time`
  - `completed_quantity`

### 4. Probar push real controlado

Condiciones previas:

- Cronómetros detenidos.
- Dato real mínimo generado.
- Operador acepta publicación en NetSuite.

Respuesta exitosa esperada:

- `Batch enviado a NetSuite`.
- `markedSuccessfulPushes > 0` o resultado exitoso equivalente.
- Sin `invalid_client`.
- Sin `INSUFFICIENT_PERMISSION` sobre `Importación OT`.

---

## Troubleshooting rápido

### `{"error":"invalid_client"}`

Capa: OAuth M2M.

Causas probables:

- `NETSUITE_CERTIFICATE_ID` mal copiado.
- `NETSUITE_CLIENT_ID` no corresponde a la app M2M activa.
- Credencial OAuth2 Client Credentials revocada.
- App, entidad, rol o certificado no corresponden entre sí.
- Token URL de otro ambiente.

Acción:

- No tocar RESTlet ni registros.
- No cambiar permisos funcionales.
- Verificar token primero.

### `getaddrinfo ENOTFOUND`

Capa: DNS/red.

Causas probables:

- DNS del host o contenedor.
- `NETSUITE_ACCOUNT_ID` o host mal armado.
- Problema transitorio de resolución.

Acción:

- Probar resolución DNS desde host y contenedor.

### `INSUFFICIENT_PERMISSION` sobre `Importación OT`

Capa: permisos efectivos del custom record.

Causas probables:

- `Importación OT` con tipo de acceso restrictivo.
- Rol sin permiso efectivo.
- Custom record bloqueado para contexto REST/SuiteScript.

Acción:

1. Verificar que el token funciona.
2. Verificar que `MCV_Cronometro_Rol` tiene `Importación OT -> Completo`.
3. Verificar en el tipo de registro `Importación OT`:

```text
Tipo de acceso = No se necesitan permisos para los roles internos
```

### Push falla pero pull funciona

Capa: no OAuth.

Si pull funciona, no mover M2M.

Revisar:

- `NETSUITE_PUSH_MODE`.
- `NETSUITE_RESTLET_IN_URL`.
- Deployment RESTlet.
- Archivo `MCV_cronometro_restlet.js`.
- Tipo de acceso de `Importación OT`.
- Permisos del rol sobre custom records y transacciones.

---

## Flujo funcional

### Pull: NetSuite -> Cronómetro

Cronómetro obtiene operaciones WIP desde NetSuite y refresca el universo local.

Fuente funcional documentada:

- Saved Search técnica: `customsearch_mcv_cronometro_out`.
- Tipo base: `manufacturingoperationtask`.
- Granularidad: `1 operación lógica = 1 fila`.

Columnas mínimas esperadas:

1. `Orden de trabajo`
2. `Secuencia de operaciones`
3. `Centro de trabajo de fabricación`
4. `CONFIGURACION RUTA`
5. `EJECUCION RUTA`
6. `Cantidad de entrada`
7. `Estado`
8. `Nombre de la operación`

Mapeo recomendado:

| Columna Saved Search | Campo interno |
|---|---|
| `Orden de trabajo` | `ot_number` |
| `Secuencia de operaciones` | `operation_sequence` |
| `Centro de trabajo de fabricación` | `resource_code` |
| `CONFIGURACION RUTA` | `planned_setup_minutes` |
| `EJECUCION RUTA` | `planned_run_minutes_per_unit` |
| `Cantidad de entrada` | `planned_quantity` |
| `Estado` | `source_status` |
| `Nombre de la operación` | `operation_name` |

### Push: Cronómetro -> NetSuite

Cronómetro publica los datos reales vigentes por operación:

1. Tiempo real de configuración.
2. Tiempo real de trabajo / ejecución.
3. Cantidad terminada.

Reglas:

- Se publica el valor vigente, no delta.
- Se publica por batch.
- El retorno se agrupa por OT.
- El staging vigente es `Importación OT`.

Payload mínimo esperado:

```json
{
  "items": [
    {
      "netsuite_operation_id": 106206,
      "ot_number": "OT17227",
      "operation_sequence": 2,
      "actual_setup_time": 1,
      "actual_run_time": 0,
      "completed_quantity": 0
    }
  ]
}
```

---

## Qué no debe reabrirse sin evidencia nueva

- No volver a Dataset como fuente oficial OUT.
- No reutilizar la raíz `Tiempo planificado de fabricación`.
- No usar la saved search humana `710` como contrato técnico de integración.
- No reducir el retorno a un solo número ambiguo.
- No mover la lógica de consolidación a Cronómetro si el diseño vigente es staging NetSuite.
- No tocar OAuth M2M si el pull funciona y solo falla el push.
- No subir private keys a NetSuite.
- No copiar `NETSUITE_CERTIFICATE_ID` manualmente carácter por carácter si se puede copiar desde la pantalla de NetSuite.

---

## Resumen ejecutivo

Configuración mínima correcta por ambiente:

1. App OAuth2 M2M activa con client credentials.
2. Credencial OAuth2 Client Credentials activa con entidad + rol + aplicación + certificado público.
3. `NETSUITE_CERTIFICATE_ID` exacto al `kid` de NetSuite.
4. Private key correspondiente al certificado público cargado.
5. `MCV_Cronometro_Rol` asignado a la entidad M2M.
6. RESTlets y REST Web Services habilitados.
7. RESTlet IN desplegado y liberado.
8. Custom record `Importación OT` con tipo de acceso apto para roles internos.
9. Pull validado después de `TOKEN_OK`.
10. Push validado con dry run antes de envío real.

Estado operativo buscado:

```text
TOKEN_OK
Pull OK
Dry run push OK
Push OK
```
