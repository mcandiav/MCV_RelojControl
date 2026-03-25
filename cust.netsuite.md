# Configuración funcional NetSuite para vínculo con Cronómetro

## Estado
Documento de handoff operativo consolidado a partir de la documentación del proyecto, la inspección directa de NetSuite y la configuración realizada en sandbox.

> **Corrección crítica de contrato (2026-03-25)**
>
> La salida correcta de **Cronómetro → NetSuite** **no** es un único valor genérico de “tiempo consolidado” como contrato mínimo de negocio.
>
> El contrato correcto de retorno por operación está compuesto por **3 datos reales**:
>
> 1. **tiempo real de configuración**
> 2. **tiempo real de trabajo / ejecución**
> 3. **cantidad terminada**
>
> Estos 3 datos son la contraparte directa de los 3 datos planificados que NetSuite entrega a Cronómetro para cronometrar y contar:
>
> 1. **tiempo de montaje planificado**
> 2. **tiempo de operación / ejecución planificado**
> 3. **cantidad planificada**
>
> Cualquier referencia anterior a “un único tiempo consolidado” debe considerarse simplificación vieja o formulación incompleta. Para integración funcional correcta, otro hilo debe usar siempre este contrato de **3 datos de retorno por operación**.

Este archivo debe contener el contexto suficiente para que un hilo nuevo pueda asumir el rol **Configurador NetSuite** y continuar la configuración sin perder decisiones ya cerradas.

---

## Cómo usar este documento en un hilo nuevo

Tratar este archivo como fuente base de contexto.

### Rol a asumir
- **Configurador NetSuite**

### Decisiones ya cerradas
1. La fuente funcional actual validada es la **saved search `710`**.
2. **No se debe modificar la search `710`** para la integración nueva.
3. La integración de salida NetSuite → Cronómetro debe construirse con un **dataset nuevo** basado en la lógica funcional de la `710`.
4. El nombre del dataset nuevo es **`MCV_cronometro_out`**.
5. La separación por áreas `ME` / `ES` se obtiene desde el prefijo oficial del recurso.
6. Existen dos tiempos por operación de origen NetSuite:
   - montaje planificado
   - ejecución planificada
7. Desde NetSuite hacia Cronómetro solo deben venir los **tiempos planificados** y la **cantidad planificada** de la operación.
8. El contrato real de retorno desde Cronómetro hacia NetSuite es por operación e incluye exactamente:
   - **tiempo real de configuración**
   - **tiempo real de trabajo / ejecución**
   - **cantidad terminada**
9. NetSuite es maestro estructural y destino publicado.
10. La publicación hacia NetSuite se hace por **batch al cierre de turno** o **cierre manual administrativo**.
11. El mismo contrato soporta además **volcados manuales intermedios** o programados, siempre por overwrite del valor vigente.
12. La publicación de los 3 datos se hace por **overwrite del valor vigente**, no por eventos ni deltas.
13. El dataset `MCV_cronometro_out` es solo de **salida desde NetSuite**; no debe usarse como mecanismo de escritura de retorno desde Cronómetro.
14. La columna `area` **no se implementó dentro de Workbook** porque el editor de fórmulas no permitió derivarla desde el display value del centro de trabajo; se derivará fuera del dataset, usando `resource_code`.
15. **No** se implementará log, staging ni custom records de integración en NetSuite en esta etapa.
16. Toda la trazabilidad de integración queda del lado de **Cronómetro**.
17. La intervención en NetSuite debe ser la **mínima estrictamente necesaria**.
18. La **sincronización completa** queda a cargo de **Cronómetro**.
19. La sincronización completa tiene dos flujos separados pero coordinados por Cronómetro:
   - **pull** de lectura desde NetSuite usando el dataset `MCV_cronometro_out`
   - **push** de escritura hacia NetSuite usando el RESTlet `MCV_Cronometro_In`
20. El programador no debe asumir que el mismo endpoint que recibe el batch devuelve el dataset de operaciones; la lectura y la escritura son flujos distintos.
21. El dataset oficial OUT debe consumirse **directamente**, no se creará otro RESTlet para OUT.
22. El RESTlet funcional de escritura quedó renombrado como **IN**.

### Temas abiertos a cerrar en configuración
1. confirmar si se incorpora o no el **ID interno de la OT** dentro del dataset
2. decidir si en producción se crea un **usuario técnico dedicado** para la integración, en lugar de usar una entidad personal
3. terminar de documentar las credenciales/secrets que guardará Cronómetro del lado aplicación
4. validar end-to-end la autenticación M2M + llamado al RESTlet + update de `manufacturingoperationtask`

---

## Objetivo

Dejar documentada la fuente oficial de extracción desde NetSuite hacia Cronómetro, el mapeo funcional de campos, las reglas de transformación, la configuración M2M realizada en sandbox, el receptor mínimo ya configurado para actualizar NetSuite y la responsabilidad de sincronización completa que queda del lado de Cronómetro.

Este documento no define código de implementación del lado Cronómetro. Define el contrato funcional y la configuración NetSuite que debe respetarse.

---

## Base funcional de referencia

La fuente funcional hoy validada en NetSuite es la **saved search `710`**.

Se confirmó contra:
- link real de NetSuite con `searchid=710`
- archivo XLS exportado desde NetSuite
- ejecución directa vía herramienta NetSuite usando `searchId = "710"`

La `710` debe tratarse como **referencia funcional** y **no debe tocarse** para la integración nueva.

---

## Decisión arquitectónica de extracción

### Regla
La integración NetSuite → Cronómetro no debe depender directamente de la saved search `710` como contrato técnico final.

### Decisión
Se debe crear un dataset nuevo, desde cero, basado en la lógica funcional de la `710`.

### Nombre obligatorio del dataset
- **`MCV_cronometro_out`**

### Motivo
- no romper exportaciones o vistas actuales
- aislar el contrato técnico de integración del uso funcional humano
- permitir agregar columnas técnicas sin contaminar la búsqueda actual
- reducir el riesgo de cambios manuales sobre una saved search ya operativa

---

## Qué representa la search 710

La `710` es la referencia funcional que demuestra qué datos necesita Cronómetro desde NetSuite.

Columnas observadas:
1. `Orden de trabajo`
2. `Secuencia de operaciones`
3. `Centro de trabajo de fabricación`
4. `CONFIGURACION RUTA`
5. `EJECUCION RUTA`
6. `Cantidad de entrada`
7. `Estado`
8. `Nombre de la operación`

---

## Significado funcional de cada columna base

| Columna base | Significado funcional |
|---|---|
| `Orden de trabajo` | Número visible de la OT |
| `Secuencia de operaciones` | Secuencia de la operación dentro del ruteo |
| `Centro de trabajo de fabricación` | Recurso / máquina / centro de trabajo |
| `CONFIGURACION RUTA` | **Tiempo de montaje planificado** |
| `EJECUCION RUTA` | **Tiempo de operación planificado** |
| `Cantidad de entrada` | **Cantidad planificada** de la operación |
| `Estado` | Estado origen de la tarea |
| `Nombre de la operación` | Nombre visible de la operación |

---

## Implementación realizada en sandbox para extracción

### Dataset creado
Se creó en sandbox el dataset:
- **`MCV_cronometro_out`**

### Dataset ID en sandbox
- **`17`**

### Registro raíz finalmente utilizado
Después de probar alternativas como:
- `Ruta de fabricación`
- `Transacción de fabricación`

se optó por trabajar sobre:
- **`Tiempo planificado de fabricación`**

### Motivo del cambio de raíz
`Ruta de fabricación` multiplicaba filas por estructura de ruta y no servía bien para representar una fila operativa limpia por operación.

`Tiempo planificado de fabricación` permitió exponer mejor:
- operación
- secuencia
- centro de trabajo
- tiempo de configuración planificado
- velocidad de ejecución planificada
- cantidad de entrada
- estado

Y además permitió aplicar correctamente filtro para excluir trabajos terminados.

---

## Filtro aplicado en sandbox

Se configuró criterio sobre:
- **`Operación: Estado`**

Regla aplicada:
- **ninguno de `Completado`**

### Efecto funcional
El dataset queda orientado a operaciones no terminadas / WIP operativo.

### Regla de negocio asociada
- Trabajo terminado **no va** a Cronómetro.

---

## Columnas efectivamente armadas en sandbox

Las columnas visibles y ya normalizadas en el dataset quedaron así:

| Columna final | Origen funcional |
|---|---|
| `ID EXTERNO` | valor por defecto del dataset raíz; no es clave funcional para Cronómetro |
| `NETSUITE_OPERATION_ID` | `Operación: ID interno` |
| `OT_NUMBER` | `Orden de trabajo` |
| `TIEMPO_MONTAJE_MIN` | `Operación: Tiempo de configuración (minutos)` |
| `OPERATION_NAME` | `Operación` |
| `OPERATION_SEQUENCE` | `Operación: Secuencia de operaciones` |
| `RESOURCE_CODE` | `Operación: Centro de trabajo de fabricación` |
| `PLANNED_QUANTITY` | `Operación: Cantidad de entrada` |
| `TIEMPO_OPERACION_MIN_UNIT` | `Operación: Velocidad de ejecución (minutos/unidad)` |
| `SOURCE_STATUS` | `Operación: Estado` |

### Observaciones
- `ID EXTERNO` quedó presente porque es columna por defecto del dataset raíz. Actualmente **no se considera clave funcional** para Cronómetro.
- `NETSUITE_OPERATION_ID` sí es la clave técnica útil de operación.
- `OT_NUMBER` quedó como número visible de la OT.
- `TIEMPO_MONTAJE_MIN` corresponde al planificado de montaje.
- `TIEMPO_OPERACION_MIN_UNIT` corresponde al planificado de ejecución por unidad.

---

## Columnas descartadas durante la construcción

### `DURACIÓN`
Se descartó.

Motivo:
- no representa el dato planificado que se quiere enviar a Cronómetro
- estaba mezclando información operativa no deseada para el contrato de salida
- para el out se necesitan tiempos **planificados**, no tiempos reales/operativos acumulados

### `Cantidad completada`
Se descartó del dataset de extracción.

Motivo:
- NetSuite no debe imponerla como input de Cronómetro
- la cantidad terminada la devuelve Cronómetro al retorno
- no debe venir desde NetSuite como dato de origen del out

### Fórmula `area`
Se intentó implementar dentro de Workbook.

Intentos fallidos:
- `CASE WHEN ...`
- `LEFT(...)`
- `SUBSTR(...)`
- `BUILTIN.DF(...)`

Resultado:
- el editor de fórmulas de Workbook no permitió resolver correctamente el display value del centro de trabajo
- el campo base se evaluaba como ID interno numérico y no como texto visible

Decisión:
- **`area` no se implementa dentro del dataset**
- debe derivarse fuera del dataset, desde `RESOURCE_CODE`

Regla de derivación:
- `ME...` → `ME`
- `ES...` → `ES`

---

## Dataset oficial de extracción: `MCV_cronometro_out`

### Propósito
Ser la única fuente técnica oficial para entregar a Cronómetro las operaciones de OT, recursos, tiempos planificados, cantidades planificadas y claves necesarias.

### Naturaleza
- dataset técnico de integración
- derivado de la lógica funcional de la `710`
- no orientado a uso humano manual
- estable y controlado

### Columnas mínimas del dataset según implementación actual

| Campo dataset | Estado actual | Observación |
|---|---|---|
| `NETSUITE_OPERATION_ID` | implementado | clave técnica principal |
| `OT_NUMBER` | implementado | número visible de OT |
| `TIEMPO_MONTAJE_MIN` | implementado | planificado |
| `OPERATION_NAME` | implementado | texto visible |
| `OPERATION_SEQUENCE` | implementado | secuencia |
| `RESOURCE_CODE` | implementado | recurso visible |
| `PLANNED_QUANTITY` | implementado | cantidad planificada |
| `TIEMPO_OPERACION_MIN_UNIT` | implementado | ejecución planificada por unidad |
| `SOURCE_STATUS` | implementado | filtrado para excluir completado |
| `area` | pendiente / derivado fuera | derivar desde `RESOURCE_CODE` |
| `netsuite_work_order_id` | pendiente | aún no expuesto en el dataset |

### Campo que no debe formar parte del dataset de extracción
- `completed_quantity`

Motivo:
- la cantidad terminada pertenece al retorno de Cronómetro hacia NetSuite y no al input de extracción desde NetSuite.

---

## Contrato funcional recomendado para Cronómetro (input desde NetSuite)

```json
{
  "netsuite_operation_id": 109286,
  "ot_number": "OT16993",
  "tiempo_montaje_min": 60,
  "operation_name": "RECTIFICADO B",
  "operation_sequence": 8,
  "resource_code": "ME103 RECTIFICADORA CIL...",
  "planned_quantity": 3,
  "tiempo_operacion_min_unit": 180,
  "source_status": "En curso"
}
```

### Campo derivado fuera del dataset
```json
{
  "area": "ME"
}
```

Derivación:
- prefijo de `resource_code`

---

## Regla de normalización de estados

El dataset hoy deja visible `SOURCE_STATUS` como valor funcional de NetSuite.

Recomendación de normalización posterior:

| Valor NetSuite | Valor interno recomendado |
|---|---|
| `No iniciado` | `not_started` |
| `En curso` | `in_progress` |
| `Completado` | `completed` |

Observación:
- `Completado` ya queda excluido en el dataset por filtro.

---

## Validaciones funcionales para la carga

- `NETSUITE_OPERATION_ID` no vacío
- `OT_NUMBER` no vacío
- `RESOURCE_CODE` no vacío
- `TIEMPO_MONTAJE_MIN >= 0`
- `TIEMPO_OPERACION_MIN_UNIT >= 0`
- `PLANNED_QUANTITY > 0`
- `OPERATION_NAME` no vacío
- `SOURCE_STATUS != Completado`

---

## Claves

### Clave técnica principal actual
- `NETSUITE_OPERATION_ID`

### Clave funcional de respaldo
- `OT_NUMBER + OPERATION_SEQUENCE + RESOURCE_CODE`

### Pendiente
- agregar `netsuite_work_order_id` si se logra exponer en el dataset

---

## Tiempos y cantidad que NetSuite debe entregar

Desde NetSuite hacia Cronómetro deben venir estos datos planificados por operación:

- **Tiempo de montaje planificado** = `TIEMPO_MONTAJE_MIN`
- **Tiempo de operación planificado por unidad** = `TIEMPO_OPERACION_MIN_UNIT`
- **Cantidad planificada** = `PLANNED_QUANTITY`

---

## Sincronización: responsabilidad y flujo completo

### Dueño de la sincronización
La **sincronización completa** queda a cargo de **Cronómetro**.

NetSuite no orquesta ni coordina el ciclo completo. NetSuite expone:
- una fuente de lectura (`MCV_cronometro_out`)
- un receptor de escritura (`MCV_Cronometro_In`)

Cronómetro decide cuándo leer, cuándo escribir y en qué orden operativo hacerlo.

### Modelo correcto de sincronización
La sincronización tiene **dos flujos separados**:

#### 1. Pull: NetSuite → Cronómetro
Cronómetro debe hacer **pull** del dataset:
- **`MCV_cronometro_out`**
- **dataset id: `17` en sandbox**

Ese pull es la forma oficial de recoger:
- operaciones WIP
- tiempos planificados
- cantidad planificada
- recurso/centro de trabajo
- estado de la operación

#### 2. Push: Cronómetro → NetSuite
Cronómetro debe hacer **push** de los 3 datos reales por operación al RESTlet desplegado en NetSuite.

### Regla crítica
El programador **no debe asumir** que el mismo endpoint de escritura devuelve el dataset de lectura.

La lectura y la escritura son **flujos distintos**, coordinados por Cronómetro.

---

## Integración de retorno: Cronómetro → NetSuite

### Principio arquitectónico vigente corregido
- **Cronómetro es dueño de los datos reales por operación**.
- Cronómetro devuelve a NetSuite los **3 datos reales operativos** que surgen del proceso cronometrado.
- **NetSuite es maestro estructural** de OTs, operaciones, recursos, tiempos planificados y cantidades planificadas.
- **NetSuite es destino publicado** de los resultados reales del cronometraje.

### Los 3 datos reales que Cronómetro debe devolver por operación
1. **Tiempo real de configuración**
2. **Tiempo real de trabajo / ejecución**
3. **Cantidad terminada**

### Correspondencia funcional esperada con los datos que NetSuite entregó
| NetSuite entrega a Cronómetro | Cronómetro devuelve a NetSuite |
|---|---|
| `TIEMPO_MONTAJE_MIN` | tiempo real de configuración |
| `TIEMPO_OPERACION_MIN_UNIT` | tiempo real de trabajo / ejecución |
| `PLANNED_QUANTITY` | cantidad terminada |

### Regla de interpretación
- El retorno es **por operación**.
- No debe reducirse a un solo número genérico si eso hace perder la distinción entre setup, trabajo y cantidad.
- No se devuelven eventos individuales ni deltas de cronometraje.

---

## Modo de envío vigente

- **batch al cierre de turno**
- **batch en cierre manual administrativo extraordinario**
- **batch manual/intermedio** cuando el negocio lo requiera

No se considera envío online por evento individual.
No se considera suma incremental en NetSuite.

La publicación debe realizarse por **overwrite** del valor vigente de los 3 datos de retorno por operación.

### Regla operativa cerrada
Si se vuelca cada 1 hora, el siguiente volcado debe contener el nuevo valor total vigente y NetSuite debe quedar con ese valor actualizado. Esto **no genera problema operativo** mientras el contrato siga siendo por overwrite del valor vigente y no por delta.

---

## Qué no se implementará en esta etapa

No se implementará en NetSuite:
- log técnico persistente
- custom record de integración
- staging de escritura
- reutilización del dataset `MCV_cronometro_out` como mecanismo de retorno

### Razón
Se acordó explícitamente que en esta etapa la trazabilidad y logging viven en **Cronómetro**, y que en NetSuite se tocará solo lo estrictamente necesario para recibir la data.

---

## Destino funcional confirmado en NetSuite

Durante la inspección del record `manufacturingoperationtask` se confirmó que existen campos estándar que calzan funcionalmente con el retorno de 3 datos por operación:

- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

### Confirmación con datos reales en sandbox
Se verificó con registros reales que `manufacturingoperationtask` ya expone y utiliza estos campos.

Ejemplo validado:
- record `manufacturingoperationtask` con `id = 3208`
- `actualSetupTime = 60`
- `actualRunTime = 360`
- `completedQuantity = 4`
- `workOrder = 57792`
- `title = CHAVETERO`

### Conclusión
- `manufacturingoperationtask` es el destino **operativo correcto**.
- No hace falta inventar un custom record para la recepción principal.
- No conviene usar `workorder` como destino operativo principal de estos 3 datos.

### Campo adicional detectado en workorder
Se identificó el campo custom existente:
- `custbody_zim_total_cant_horas`

Y el flag:
- `custbody_zim_reloj_control`

### Decisión sobre estos campos
En esta etapa **no** se usarán como destino principal del retorno. El retorno operativo se hará directo a `manufacturingoperationtask`.

---

## Configuración M2M realizada en sandbox

### Funciones habilitadas en NetSuite verificadas
Se confirmó que en sandbox ya estaban habilitados:
- **Servicios web REST**
- **Autenticación basada en token**
- **OAuth 2.0**

### Decisión de autenticación
Se eligió:
- **OAuth 2.0 M2M / Client Credentials**

### Motivo
- no depender de refresh token interactivo
- integración sistema a sistema
- más natural para volcados automáticos o manuales desde Cronómetro

### Aplicación creada
Se creó la integración:
- **`MCV_Cronometro_M2M`**

Configuración relevante:
- grant: **Otorgamiento de credenciales de cliente (equipo a equipo)**
- alcance: **RESTLETS** (y debe ampliarse según Oracle para lectura del dataset por REST)

#### Alcance OAuth necesario para el pull del dataset (Cronómetro)

La ejecución del dataset vía REST Web Services (`GET /services/rest/query/v1/dataset/{id}/result`) exige que el JWT M2M incluya el scope **`suite_analytics`** (además de **`rest_webservices`** y **`restlets`** para token y RESTlet IN). Si el token solo lleva `RESTLETS`, el GET del dataset puede responder error de autorización.

En el backend Cronómetro la variable opcional `NETSUITE_OAUTH_SCOPE` por defecto pide esos tres scopes. El **Configurador NetSuite** debe alinear el registro de integración y el rol con permisos **SuiteAnalytics Workbook** / REST según guía Oracle.

### Rol creado
Se creó el rol:
- **`MCV_Cronometro_Rol`**

### Permisos mínimos configurados en el rol
#### Configuración
- `Iniciar sesión con tokens de acceso de OAuth 2.0` = **Completo**
- `SuiteScript` = **Completo**

#### Transacciones
- `Orden de trabajo` = **Editar**

### Decisiones de rol
- **No** marcar `Rol único de servicios web`
- 2FA / duración de dispositivo de confianza no afectan el flujo M2M
- en sandbox se usó temporalmente como entidad el usuario **MIGUEL CANDIA**
- en producción sigue recomendado migrar a un usuario técnico dedicado

### Certificado generado
Se generó un certificado/couple de claves para M2M:
- `MCV_Cronometro_M2M_private.pem` → queda del lado Cronómetro
- `MCV_Cronometro_M2M_public.crt` → se cargó en NetSuite

### Regla importante del certificado
- validez máxima efectiva en NetSuite: **2 años**
- no tiene sentido intentar dejarlo a 10 años porque NetSuite lo acota

### Mapping M2M creado
Se creó el mapping de credenciales OAuth 2.0 client credentials con:
- **Entidad**: `MIGUEL CANDIA`
- **Rol**: `MCV_Cronometro_Rol`
- **Aplicación**: `MCV_Cronometro_M2M`
- **Certificado**: cargado correctamente

### Estado del mapping
- activo en sandbox
- algoritmo: RSA
- vigencia confirmada en la pantalla de configuración M2M

---

## RESTlet mínimo implementado en sandbox

### Decisión de canal de recepción
Se definió como receptor mínimo:
- **RESTlet SuiteScript 2.1**

### Naming funcional correcto
- **OUT** = `MCV_cronometro_out`
- **IN** = `MCV_Cronometro_In`

### Motivo
- mínima intervención en NetSuite
- dataset directo para lectura
- canal explícito de recepción por batch para escritura
- actualiza directo el record objetivo
- evita staging/log persistente en NetSuite

### Archivo de script
Se subió al File Cabinet dentro de carpeta técnica del proyecto Cronómetro un archivo tipo JavaScript para el RESTlet.

Nombre usado en sandbox:
- `MCV_cronometro_restlet.js`

### Script record creado
Se creó el script record tipo RESTlet y luego se ajustó el naming funcional a IN:
- **Nombre**: `MCV_Cronometro_Restlet_In`
- **Script ID**: `customscriptmcv_cronometro_restlet_in`
- API version: `2.1`
- funciones técnicas visibles: `GET`, `POST`

### Aclaración importante sobre GET
Aunque el archivo actual mantiene `GET` técnicamente visible, el **contrato funcional del canal IN es de escritura**. El programador **no debe usar `GET` del RESTlet para lectura del OUT**. El OUT sigue siendo el dataset `MCV_cronometro_out`.

### Deployment creado
Se creó y luego se alineó el naming del deployment IN:
- **Nombre**: `MCV_Cronometro_Restlet_in`
- **Deployment ID**: `customdeploy1`
- **Estado**: `Liberado`
- **Nivel de registro**: `Auditoría`

### URL del RESTlet IN
#### URL interna
`/app/site/hosting/restlet.nl?script=1271&deploy=1`

#### URL externa
`https://6099999-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1`

### Propósito del RESTlet IN
Recibir un payload por batch y actualizar, por `netsuite_operation_id`, estos campos estándar de `manufacturingoperationtask`:
- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

### Contrato mínimo esperado por el RESTlet IN
```json
{
  "items": [
    {
      "netsuite_operation_id": 3208,
      "actual_setup_time": 60,
      "actual_run_time": 360,
      "completed_quantity": 4
    }
  ]
}
```

### Reglas del receptor IN
- `items` obligatorio
- cada item con `netsuite_operation_id` obligatorio
- los tres valores reales deben ser numéricos y >= 0
- actualización por overwrite del valor vigente
- sin deltas
- sin eventos individuales

---

## Especificación exacta para Cursor

Pásale este bloque tal cual al programador:

```text
Implementa la sincronización NetSuite <-> Cronómetro con esta arquitectura y estos contratos exactos.

OBJETIVO GENERAL
Cronómetro es el orquestador completo de la sincronización.
Debe hacer:
1. PULL de lectura desde NetSuite usando el dataset oficial OUT
2. PUSH de escritura hacia NetSuite usando el RESTlet oficial IN

NO mezclar ambos canales.
NO usar el RESTlet para lectura.
NO usar el dataset para escritura.

==================================================
1. CANAL OUT (LECTURA DESDE NETSUITE)
==================================================

Nombre oficial:
- MCV_cronometro_out

Tipo:
- Dataset / conjunto de datos de NetSuite

Dataset ID en sandbox:
- 17

Función:
- Cronómetro debe leer desde aquí las operaciones WIP y sus datos planificados

Campos que debe recoger Cronómetro:
- NETSUITE_OPERATION_ID
- OT_NUMBER
- TIEMPO_MONTAJE_MIN
- OPERATION_NAME
- OPERATION_SEQUENCE
- RESOURCE_CODE
- PLANNED_QUANTITY
- TIEMPO_OPERACION_MIN_UNIT
- SOURCE_STATUS

Reglas:
- El dataset ya viene filtrado para excluir operaciones completadas
- El área debe derivarse desde RESOURCE_CODE:
  - ME... => ME
  - ES... => ES
- completed_quantity NO viene desde NetSuite
- Cronómetro debe usar este dataset como fuente oficial de entrada
- NO crear otro canal OUT
- NO reutilizar el RESTlet IN para la lectura

Resultado esperado del pull:
- upsert interno de operaciones OT en Cronómetro
- actualización/refresco del universo WIP operativo
- persistencia local de:
  - netsuite_operation_id
  - ot_number
  - operation_sequence
  - resource_code
  - planned_quantity
  - tiempo_montaje_min
  - tiempo_operacion_min_unit
  - source_status
  - area derivada
  - last_synced_at

==================================================
2. CANAL IN (ESCRITURA HACIA NETSUITE)
==================================================

Nombre funcional:
- MCV_Cronometro_In

Implementación técnica actual:
- RESTlet SuiteScript 2.1

Script name:
- MCV_Cronometro_Restlet_In

Script ID:
- customscriptmcv_cronometro_restlet_in

Deployment name:
- MCV_Cronometro_Restlet_in

Deployment ID:
- customdeploy1

RESTlet URL externa en sandbox:
- https://6099999-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1

Autenticación:
- OAuth 2.0 M2M / Client Credentials

Función:
- Cronómetro debe publicar por batch los 3 datos reales por operación

Payload exacto esperado:
{
  "items": [
    {
      "netsuite_operation_id": 3208,
      "actual_setup_time": 60,
      "actual_run_time": 360,
      "completed_quantity": 4
    }
  ]
}

Reglas:
- actualizar por overwrite del valor vigente
- no enviar deltas
- no enviar eventos start/pause/resume/stop
- no enviar station_id
- no escribir en workorder como destino principal

Destino real en NetSuite:
- manufacturingoperationtask

Mapeo exacto:
- actual_setup_time -> actualsetuptime
- actual_run_time -> actualruntime
- completed_quantity -> completedquantity

==================================================
3. AUTENTICACIÓN QUE DEBE IMPLEMENTAR CRONÓMETRO
==================================================

Cronómetro debe guardar de forma segura:
- client_id de la integración MCV_Cronometro_M2M
- certificate_id del mapping M2M
- private_key correspondiente al certificado M2M
- account_id de NetSuite
- token endpoint OAuth 2.0 M2M
- URL del RESTlet IN
- referencia del dataset OUT id 17

Importante:
- la private_key NO se sube a NetSuite
- NetSuite solo tiene la public key / certificate

==================================================
4. REGLA FUNCIONAL CLAVE
==================================================

NetSuite NO es dueño del consolidado.
Cronómetro es dueño del consolidado por operación.
NetSuite solo recibe el valor vigente publicado.

Ejemplo:
- si a las 10:00 una operación lleva 60 min de run
- y a las 11:00 lleva 120 min
- Cronómetro debe enviar 120, no +60

Esto aplica a:
- cierre de turno
- volcado manual administrativo
- volcados intermedios o programados

==================================================
5. FLUJO COMPLETO QUE DEBE IMPLEMENTAR CURSOR
==================================================

A. Pull del dataset OUT
- ejecutar MCV_cronometro_out (dataset id 17)
- traer operaciones WIP y planificados
- refrescar o upsertear operación local

B. Operación interna de Cronómetro
- seguir consolidando:
  - tiempo real de configuración
  - tiempo real de trabajo
  - cantidad terminada

C. Push del batch IN
- obtener access token M2M
- hacer POST al RESTlet IN
- enviar items con los 3 datos reales por operación
- guardar respuesta y error del lado Cronómetro

==================================================
6. QUÉ NO DEBE HACER CURSOR
==================================================

- no crear otro RESTlet para OUT
- no usar el GET técnico del RESTlet IN como canal de lectura
- no mezclar OUT e IN en un mismo contrato lógico
- no sumar deltas en NetSuite
- no asumir que completed_quantity viene desde NetSuite
- no mover la lógica de consolidación a NetSuite
```

---

## Secrets / datos que debe guardar Cronómetro

Cronómetro debe guardar de forma segura:
- `client_id` de la integración `MCV_Cronometro_M2M`
- `certificate_id` del mapping M2M
- `private_key` correspondiente a `MCV_Cronometro_M2M_private.pem`
- `account_id` de NetSuite
- URL del token endpoint OAuth 2.0 M2M
- URL externa del RESTlet IN desplegado
- referencia/configuración del mecanismo con que leerá `MCV_cronometro_out`
- dataset id `17` en sandbox

### Regla
La `private_key` **no** se sube a NetSuite.

---

## Qué quedó validado y aprendido

1. `manufacturingoperationtask` ya soporta el nivel operativo correcto del retorno.
2. Los campos estándar necesarios ya existen; no hace falta crear otros.
3. El contrato correcto de retorno son 3 datos reales por operación.
4. No hay problema operativo con volcados manuales o programados intermedios si el envío es por overwrite del valor vigente.
5. El M2M no depende de la configuración de “dispositivo de confianza”.
6. En NetSuite, el mapping M2M requiere obligatoriamente:
   - entidad
   - rol
   - aplicación
   - certificado
7. El rol del M2M debe estar asignado a la entidad elegida para que aparezca como opción en el mapping.
8. No corresponde crear el script deployment antes de tener el archivo JavaScript cargado en File Cabinet.
9. No se debe pedir a otro hilo que modele esto como un único total ambiguo ni que meta logs/staging en NetSuite en esta etapa.
10. La sincronización completa debe quedar implementada del lado Cronómetro, separando lectura y escritura.
11. El dataset OUT quedó identificado en sandbox con id `17`.
12. El naming funcional correcto es:
   - OUT = dataset `MCV_cronometro_out`
   - IN = RESTlet `MCV_Cronometro_In`

---

## Decisiones pendientes del configurador NetSuite

1. confirmar si se agrega `netsuite_work_order_id` al dataset
2. definir usuario técnico dedicado para producción
3. probar end-to-end el M2M + token + RESTlet + actualización real
4. cerrar la documentación exacta del token endpoint y parámetros JWT del lado Cronómetro
5. ~~documentar definitivamente el mecanismo exacto que usará Cronómetro para leer `MCV_cronometro_out`~~ **Parcialmente cerrado (2026-03-25):** Cronómetro usa la API REST de ejecución de datasets de NetSuite: `GET https://{accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/dataset/{datasetId}/result` con paginación `limit`/`offset`, Bearer token OAuth 2.0 M2M. Referencia Oracle: [Working with SuiteAnalytics Datasets in REST Web Services](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_156577938018.html). En sandbox `datasetId` = **`17`**. Queda validar end-to-end con credenciales reales y permisos de rol.

---

## Resumen ejecutivo de handoff

### Confirmado
- fuente funcional validada: `710`
- la `710` no se toca
- dataset oficial nuevo de extracción: `MCV_cronometro_out`
- dataset id en sandbox: `17`
- registro raíz usado en sandbox: `Tiempo planificado de fabricación`
- filtro aplicado: excluir `Completado`
- dos tiempos planificados por operación:
  - montaje
  - operación por unidad
- cantidad planificada por operación
- área derivada por prefijo de recurso: `ME` / `ES`, pero fuera del Workbook
- `completed_quantity` no se trae desde NetSuite
- salida desde Cronómetro: **3 datos reales por operación**
  - tiempo real de configuración
  - tiempo real de trabajo
  - cantidad terminada
- modo de publicación: batch por cierre con overwrite
- se aceptan también volcados manuales/programados intermedios sin problema operativo, siempre por overwrite
- destino operativo confirmado: `manufacturingoperationtask`
- autenticación configurada en sandbox: **OAuth 2.0 M2M**
- integración creada: `MCV_Cronometro_M2M`
- rol creado: `MCV_Cronometro_Rol`
- mapping M2M creado y activo
- RESTlet IN creado y desplegado
- URL externa del RESTlet IN ya disponible
- la sincronización completa queda del lado de Cronómetro
- Cronómetro debe hacer pull del dataset y push del RESTlet como flujos separados
- no habrá log/staging persistente en NetSuite en esta etapa

### Pendiente
- `netsuite_work_order_id`
- usuario técnico dedicado para producción
- prueba end-to-end con llamada real desde Cronómetro
- documentación fina de secrets del lado aplicación
- documentación fina del mecanismo de lectura del dataset

### No reabrir sin evidencia nueva
- no tocar la `710`
- derivación `ME` / `ES` desde recurso
- existencia de tiempo de montaje planificado, tiempo de operación planificado y cantidad planificada
- retorno correcto desde Cronómetro con 3 datos reales por operación
- batch con overwrite como modo de publicación
- destino principal en `manufacturingoperationtask`
- autenticación vía OAuth 2.0 M2M
- mínima intervención en NetSuite, sin logs ni staging
- sincronización completa orquestada por Cronómetro
- lectura y escritura como flujos separados
- OUT directo por dataset
- IN por RESTlet

---

## Conclusiones operativas

1. La `710` queda como referencia funcional validada, pero no como contrato técnico final.
2. El contrato técnico de extracción es el dataset **`MCV_cronometro_out`** ya creado en sandbox.
3. La carga de entrada se basa en operaciones de OT con recurso, tiempos planificados, cantidades planificadas y estado.
4. La división entre áreas `ME` y `ES` se obtiene oficialmente desde el prefijo del recurso, fuera del Workbook.
5. Los datos planificados requeridos por operación son:
   - montaje
   - operación por unidad
   - cantidad
6. El retorno correcto de Cronómetro hacia NetSuite son 3 datos reales por operación:
   - tiempo real de configuración
   - tiempo real de trabajo
   - cantidad terminada
7. El canal mínimo implementado para recepción en NetSuite es un **RESTlet SuiteScript 2.1** autenticado con **OAuth 2.0 M2M**.
8. La sincronización completa debe implementarse en Cronómetro como:
   - **pull** del dataset `MCV_cronometro_out` (id `17` en sandbox)
   - **push** del batch de 3 datos reales al RESTlet `MCV_Cronometro_In`
9. El punto más importante pendiente ya no es la arquitectura general, sino dejar completamente operativa la lectura del dataset y probar el flujo end-to-end desde Cronómetro.
