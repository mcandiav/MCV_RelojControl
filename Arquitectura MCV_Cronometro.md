# Arquitectura MCV_Cronometro
## Versión 6.0

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|------|-------------------|--------|---------|------------------|
| 2026-03-25 | Se actualiza **Cronómetro** a versión 6.0 y se formaliza el **input oficial desde NetSuite** usando el dataset técnico **`MCV_cronometro_out`** creado en sandbox, junto con el canal oficial de retorno **`MCV_Cronometro_In`** autenticado por **OAuth 2.0 M2M** | Se cerró la definición del contrato de lectura desde NetSuite, el contrato mínimo de escritura hacia NetSuite y la separación explícita entre OUT e IN según el lado del sistema | Cambian y se precisan la lectura desde NetSuite, el naming IN/OUT, el dataset de extracción, el carácter WIP del input, el retorno de 3 datos reales por operación, el destino operativo `manufacturingoperationtask` y la responsabilidad de sincronización completa del lado Cronómetro | Objetivo, principios, integración con NetSuite, modelo de datos, roles, decisiones vigentes |
| 2026-03-24 | Se actualiza **Cronómetro** a versión 5.1 y se define que **Cronómetro es el dueño del tiempo real consolidado** por operación; NetSuite recibe únicamente ese valor acumulado mediante **overwrite** en cada cierre de turno configurable o cierre manual administrativo | Se cerró la discusión arquitectónica sobre conciliación y sincronización, evitando ambigüedad entre sistema fuente del consolidado y sistema destino publicado | Cambian las reglas de lectura desde NetSuite, escritura hacia NetSuite, cierres de turno, sincronización, consolidación y decisiones vigentes | Objetivo, principios, cierre de turno, integración con NetSuite, roles, decisiones vigentes |
| 2026-03-22 | Se actualiza **Cronómetro** a versión 5.0 para operar con datos reales, consolidar **tiempo y cantidad** por operación, permitir sincronización administrable con NetSuite y definir **3 cierres de turno** con auto-stop obligatorio | El proyecto ya está operativo con datos seed y requiere pasar a una arquitectura productiva alineada con la operación real y la integración directa con NetSuite | Cambian las reglas de consolidación, sincronización, cierre de turno, API mínima, modelo de datos y decisiones vigentes; RelojControl queda solo como antecedente histórico | Objetivo, núcleo operativo, cierre de turno, integración con NetSuite, modelo de datos, roles, decisiones vigentes |
| 2026-03-22 | Reemplazo integral del documento para definir **Cronómetro** como nueva solución objetivo, limpia y construible desde cero | El sistema heredado y su documentación anterior mezclaban lógica operativa, presentación e integración, dificultando evolucionar sin regresiones | Se establece una arquitectura nueva, clara y ejecutable para desarrollo desde cero, manteniendo la infraestructura actual | Documento completo |

---

# 1. Propósito del documento

Este documento define la **arquitectura objetivo oficial** del proyecto **MCV_Cronometro** y su evolución vigente hacia una solución productiva de **Cronómetro** conectada con NetSuite.

Su propósito es establecer de forma clara y trazable:

- el problema real de negocio que debe resolverse,
- la arquitectura funcional y operativa objetivo,
- la separación explícita en capas,
- las entidades principales del dominio,
- los flujos de interacción en planta,
- la arquitectura física de captura,
- la integración actual y futura con NetSuite,
- la estrategia de implementación sobre la plataforma actual,
- y la división de responsabilidades entre Programador y Configurador NetSuite.

Este documento es la **única fuente oficial de arquitectura vigente** del proyecto.

La bitácora técnica y operativa del sandbox se mantiene en `SANDBOX_CONFIG.md`.
El detalle de configuración NetSuite se mantiene en `cust.netsuite.md`.

---

# 2. Objetivo de la solución

La solución objetivo del proyecto se define como:

# **Cronómetro**

Cronómetro tiene como objetivo:

- capturar el tiempo real de ejecución sobre **operaciones de OTs en proceso**,
- hacerlo de forma consistente con la realidad operativa de planta,
- minimizar errores de imputación manual,
- consolidar el tiempo real por operación,
- sincronizar datos con NetSuite mediante lectura del input estructural/planificado y escritura de los datos reales vigentes,
- permitir un cierre manual administrativo que detenga todos los cronómetros,
- y poblar correctamente NetSuite con los **3 datos reales vigentes** de cada operación.

La lógica del sistema debe responder al hecho de que:

- una **OT** contiene múltiples operaciones,
- esas operaciones pueden pertenecer a distintas áreas de fabricación,
- cada operación está asociada a una máquina o recurso,
- el tiempo real relevante para el negocio se entiende a nivel de **operación**, no solo a nivel de cabecera de OT,
- y la **conciliación de los datos reales vigentes** pertenece a Cronómetro, no a NetSuite.

En esta versión queda además definido que el **input oficial proveniente desde NetSuite** debe aportar solo datos **estructurales y planificados** de la operación; Cronómetro no depende de NetSuite para cantidad completada ni para tiempo real real consolidado.

---

# 3. Decisión arquitectónica central

La solución objetivo **no debe seguir evolucionando como una sola pantalla mezclada con lógica, integración y presentación**.

La arquitectura oficial se define en **tres capas claramente separadas**:

1. **Capa 1: Núcleo operativo / negocio**
2. **Capa 2: Presentación / experiencia de usuario**
3. **Capa 3: Integración y plataforma**

Esta separación es obligatoria para:

- reducir riesgo de regresión cuando cambie la UI,
- permitir evolución visual sin romper la base,
- aislar la lógica operativa del cronómetro,
- y mantener desacoplada la integración formal con NetSuite.

---

# 4. Principios arquitectónicos

La solución se gobierna por los siguientes principios:

1. **La operación es la unidad real de trabajo**.
2. **La presentación no debe romper la lógica**.
3. **La máquina es un recurso exclusivo de ejecución**.
4. **La visibilidad debe respetar el área del operario**.
5. **La captura y la consolidación son niveles distintos**.
6. **La infraestructura actual se conserva**.
7. **La estación es un contexto operativo obligatorio**.
8. **Toda acción crítica debe quedar asociada a un operario identificado**.
9. **La integración con NetSuite debe permanecer desacoplada**.
10. **La arquitectura debe soportar tanto el escenario actual como la evolución futura**.
11. **Cronómetro es el dueño de los datos reales vigentes por operación**.
12. **NetSuite es maestro estructural y destino publicado**.
13. **El naming IN/OUT depende del lado del sistema**.
14. **La sincronización completa queda del lado de Cronómetro**: pull del OUT y push del IN.
15. **La intervención en NetSuite debe ser mínima**: sin staging persistente ni logging técnico adicional en esta etapa.

---

# 5. Capas oficiales de la arquitectura

## 5.1 Capa 1: Núcleo operativo / negocio

### Responsabilidades

- modelo de dominio,
- reglas de cronometraje,
- restricciones de máquina,
- sesiones de turno,
- cierres automáticos de turno,
- cierre manual administrativo,
- consolidación de datos reales por operación,
- auditoría operativa,
- reglas de autorización,
- filtrado por área,
- filtrado por estación,
- visibilidad de operaciones,
- reglas de batch,
- derivación de `area` desde `resource_code`.

### Resultado esperado

Un motor estable que siga funcionando aunque cambie completamente la UI.

---

## 5.2 Capa 2: Presentación / experiencia de usuario

### Responsabilidades

- layout de pantalla,
- componentes visuales,
- tablero de cronómetros,
- consola temporal,
- colores,
- tipografías,
- jerarquía visual,
- adaptación a pantallas grandes,
- feedback visual.

---

## 5.3 Capa 3: Integración y plataforma

### Responsabilidades

- EasyPanel,
- Docker,
- dominio actual,
- backend API,
- persistencia,
- jobs,
- lotes de cierre de turno,
- batch de sincronización,
- configuración de `station_id`,
- variables de entorno,
- integración con NetSuite,
- dataset técnico de extracción,
- autenticación M2M,
- receptor de escritura en NetSuite.

---

# 6. Nombre y alcance de la solución objetivo

## 6.1 Nombre oficial

# **Cronómetro**

## 6.2 Alcance funcional

Cronómetro cubre:

- autenticación operativa del operario,
- búsqueda manual de OTs,
- despliegue de operaciones filtradas,
- selección de operación,
- inicio, pausa, reanudación y detención de cronometraje,
- visibilidad de cronómetros activos por estación,
- detención automática al cierre de turno,
- cierre manual administrativo total,
- consolidación de 3 datos reales por operación,
- consumo del input estructural/planificado proveniente de NetSuite,
- sincronización automática o manual hacia NetSuite,
- y soporte para evolución futura sin rehacer la plataforma.

---

# 7. Dominio funcional de Cronómetro

## 7.1 Entidades principales

- **Operario**
- **Área del operario**
- **OT**
- **Operación de OT en proceso**
- **Máquina / recurso / puesto**
- **Estación**
- **Cronómetro activo**
- **Evento de cronometraje**
- **Datos reales vigentes por operación**
- **Input estructural/planificado de NetSuite**
- **Turno**
- **Supervisor**
- **Autorización**
- **Lote de sincronización NetSuite**

## 7.2 Definiciones principales

### Datos reales vigentes por operación
Valor vigente que Cronómetro mantiene y publica a NetSuite por operación, compuesto por:

1. **tiempo real de configuración**
2. **tiempo real de trabajo / ejecución**
3. **cantidad terminada**

### Input estructural/planificado de NetSuite
Conjunto de datos que Cronómetro consume desde NetSuite para conocer:

- OT visible,
- operación,
- secuencia,
- recurso,
- tiempos planificados,
- cantidad planificada,
- estado de la operación.

En esta versión, ese input queda formalizado por el dataset `MCV_cronometro_out` del lado NetSuite, que del lado Cronómetro debe tratarse como **input oficial**.

---

# 8. Modelo de áreas de fabricación

## 8.1 Áreas oficiales

- **ME**
- **ES**

## 8.2 Regla de pertenencia del operario

- `ME`
- `ES`
- `Both`

## 8.3 Regla de visibilidad de operaciones

- operario `ME` → ve solo operaciones `ME`
- operario `ES` → ve solo operaciones `ES`
- operario `Both` → ve operaciones `ME` y `ES`

## 8.4 Regla de derivación de área desde NetSuite

El área no se materializa dentro del Workbook de NetSuite.  
Debe derivarse en Cronómetro desde el prefijo del `resource_code`:

- `ME...` → `ME`
- `ES...` → `ES`

---

# 9. Escenario operativo real soportado

La arquitectura debe soportar que una sola pantalla física sea usada por varios operarios y que una misma estación opere sobre múltiples recursos o múltiples cronómetros visibles.

---

# 10. Reglas operativas núcleo

1. La unidad principal de trabajo es la **operación de una OT en proceso**.
2. La OT se ingresa manualmente por número.
3. Una máquina solo puede tener una operación activa a la vez.
4. Un operario puede trabajar sobre múltiples máquinas en distintos momentos.
5. El cronómetro registra eventos y consolida datos reales por operación.
6. Todos los cronómetros deben detenerse automáticamente en cada cierre configurado de turno.
7. El administrador puede ejecutar un cierre manual extraordinario que detiene todos los cronómetros.
8. Las acciones que cambian estado requieren autenticación válida.
9. Los cronómetros visibles se filtran por estación.
10. La visibilidad de operaciones se filtra por área del operario.
11. Los datos reales vigentes son únicos por operación y representan el estado histórico acumulado publicado por Cronómetro.
12. El cierre de turno ejecuta auto-stop, consolidación operativa, preparación del lote y sincronización automática con NetSuite.
13. Cronómetro consume solo operaciones no completadas provenientes del input NetSuite.
14. Cronómetro no depende de `completed_quantity` proveniente de NetSuite.
15. “Pausa” no equivale automáticamente a setup; la partición exacta setup/run pertenece a la lógica de Cronómetro y no debe inferirse desde NetSuite.

---

# 11. Estaciones y aislamiento por pantalla

Cada PC o pantalla operativa debe tener un identificador único:
- `station_id`

`station_id` es un concepto **interno de planta** y no forma parte del payload funcional hacia NetSuite.

---

# 12. Autenticación y sesión operativa

El login se compone de:
- selección del operario desde una lista,
- ingreso de un PIN de **4 dígitos**.

Las acciones que cambian estado del cronómetro requieren autenticación válida del operario.

---

# 13. Flujo principal del operario

1. El operario inicia sesión
2. El operario ingresa manualmente el número de OT
3. El sistema obtiene operaciones no completadas desde el input NetSuite vigente
4. El sistema filtra operaciones según área del operario
5. El operario selecciona la operación correspondiente
6. Se abre la consola del cronómetro seleccionado
7. El operario inicia, pausa, reanuda o detiene
8. El sistema vuelve al tablero general de cronómetros activos de la estación

---

# 14. Cierre de turno

El sistema debe permitir que el administrador defina **3 horarios oficiales de cierre de turno**.

En cada cierre configurado, el sistema debe:

- detener cronómetros activos,
- consolidar datos reales pendientes,
- registrar auditoría,
- preparar y ejecutar sincronización oficial hacia NetSuite.

También debe existir un cierre manual administrativo total.

---

# 15. API y modelo de datos propuestos

## 15.1 Cambios mínimos de modelo de datos

- `operario`
- `operario_area`
- `station_id`
- `operation_timer`
- `operation_timer_events`
- `shift_session`
- `operation_actuals`
- `netsuite_operation_input`
- `netsuite_sync_batch`
- `batch_status`
- `authorization_request`
- `supervisor_approval`
- `planned_time_override`
- `operator_operation_authorization`

## 15.2 Input mínimo requerido desde NetSuite

Cronómetro debe poder consumir al menos:

- `netsuite_operation_id`
- `ot_number`
- `tiempo_montaje_min`
- `operation_name`
- `operation_sequence`
- `resource_code`
- `planned_quantity`
- `tiempo_operacion_min_unit`
- `source_status`

### Campo derivado fuera del dataset
- `area`

## 15.3 Datos reales mínimos a publicar a NetSuite

Cronómetro debe publicar por operación:

- `actual_setup_time`
- `actual_run_time`
- `completed_quantity`

### Unidad
La arquitectura y la configuración actual de NetSuite trabajan en **minutos** para setup/run.
`completed_quantity` se trata como cantidad numérica.

## 15.4 API mínima requerida del lado Cronómetro

- login de operario
- búsqueda de OT por número
- lectura del input NetSuite vigente por OT
- inicio de cronómetro
- pausa de cronómetro
- reanudación de cronómetro
- detención de cronómetro
- listado de cronómetros activos por estación
- batch de cierre de turno
- cierre manual administrativo
- ejecución de sincronización al cierre
- consulta de consolidados pendientes
- auditoría de acciones críticas
- pull del dataset OUT
- push del RESTlet IN

---

# 16. Integración con NetSuite

## 16.1 Rol de NetSuite

NetSuite sigue siendo:

- fuente formal de OTs y ruteo de operaciones,
- fuente formal de recursos, tiempos planificados y contexto funcional,
- destino de los datos reales vigentes publicados por Cronómetro.

## 16.2 Regla de lectura

Cronómetro debe obtener desde NetSuite solo los datos que **Cronómetro no gobierna**, entre ellos:

- OT,
- operaciones de la OT,
- recursos/centros de trabajo,
- tiempos planificados,
- cantidad planificada,
- contexto funcional para validación y despliegue.

Cronómetro **no debe usar NetSuite como fuente normal** de:

- tiempo real,
- cantidad completada,
- cantidad operativa real.

## 16.3 Dataset oficial de lectura

Se formaliza como contrato técnico del lado NetSuite:

- **`MCV_cronometro_out`**

### Implementación actual en sandbox
- dataset id: `17`
- raíz: `Tiempo planificado de fabricación`
- filtro: `Operación: Estado` excluyendo `Completado`

### Columnas confirmadas en sandbox
- `NETSUITE_OPERATION_ID`
- `OT_NUMBER`
- `TIEMPO_MONTAJE_MIN`
- `OPERATION_NAME`
- `OPERATION_SEQUENCE`
- `RESOURCE_CODE`
- `PLANNED_QUANTITY`
- `TIEMPO_OPERACION_MIN_UNIT`
- `SOURCE_STATUS`

### Campo derivado fuera del dataset
- `area`

## 16.4 Canal oficial de escritura

Se formaliza como contrato técnico del lado NetSuite:

- **`MCV_Cronometro_In`**

### Implementación actual en sandbox
- tipo: RESTlet SuiteScript 2.1
- script id: `customscriptmcv_cronometro_restlet_in`
- deployment: `customdeploy1`
- URL externa sandbox:
  `https://6099999-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1271&deploy=1`

### Autenticación
- **OAuth 2.0 M2M / Client Credentials**
- integración: `MCV_Cronometro_M2M`
- rol: `MCV_Cronometro_Rol`

## 16.5 Regla de naming IN/OUT

- Desde **NetSuite**, el dataset `MCV_cronometro_out` es **OUT**.
- Desde **Cronómetro**, ese mismo dataset es **IN**.
- Desde **Cronómetro**, el RESTlet `MCV_Cronometro_In` es **OUT**.
- Desde **NetSuite**, ese RESTlet es **IN**.

## 16.6 Regla de sincronización completa

La sincronización completa queda del lado de **Cronómetro**.

Cronómetro debe hacer:

1. **Pull** del dataset `MCV_cronometro_out`
2. **Push** del batch al RESTlet `MCV_Cronometro_In`

Lectura y escritura son flujos distintos.  
No deben mezclarse ni asumirse en un mismo endpoint.

## 16.7 Payload mínimo de escritura

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

## 16.8 Destino operativo en NetSuite

El destino operativo correcto del retorno es:

- **`manufacturingoperationtask`**

Campos estándar objetivo:
- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

## 16.9 Regla de publicación

El valor publicado hacia NetSuite es siempre el **valor vigente total** por operación.

Por lo tanto:

- Cronómetro **pisa** el valor anterior en NetSuite,
- NetSuite no realiza la conciliación,
- NetSuite no suma deltas,
- y Cronómetro conserva la responsabilidad del valor correcto.

Esto aplica a:
- cierre de turno,
- cierre manual administrativo,
- volcados manuales o programados intermedios.

## 16.10 Alcance actual del Configurador NetSuite

Debe mantenerse un apartado específico para el **Configurador NetSuite**, quien debe definir y preparar:

- autenticación M2M,
- dataset de extracción,
- receptor de escritura,
- permisos,
- estrategia de batch,
- validaciones y errores de integración.

No se implementa staging persistente ni logging técnico adicional en NetSuite en esta etapa.

---

# 17. Estrategia de implementación

La estrategia oficial es:

- congelar la base funcional actual válida,
- evolucionar la capa de presentación,
- mantener la plataforma,
- operar Cronómetro con datos reales consolidados,
- consumir como input el dataset técnico proveniente de NetSuite,
- integrar NetSuite mediante cierres configurables y canales desacoplados de lectura/escritura.

---

# 18. Roles y responsabilidades de ejecución

## 18.1 Rol Programador

El Programador debe implementar o refactorizar:

- la aplicación Cronómetro,
- su frontend,
- su backend,
- su modelo de datos,
- el tablero por estación,
- la autenticación de operario,
- la búsqueda manual de OT,
- el filtro por área,
- la derivación de `area` desde `resource_code`,
- la lógica de cronómetros,
- la re-autenticación para acciones críticas,
- los 3 cierres automáticos de turno,
- el cierre manual administrativo,
- la consolidación de los 3 datos reales por operación,
- la lectura del input oficial proveniente de NetSuite,
- la generación de lotes de sincronización,
- y la trazabilidad de lotes e integraciones del lado Cronómetro.

## 18.2 Rol Configurador NetSuite

El Configurador NetSuite debe preparar, cuando corresponda:

- conexión M2M con NetSuite,
- autenticación y certificados,
- dataset técnico de extracción,
- RESTlet de escritura,
- permisos,
- mapeo de OT, operaciones y tiempos,
- batch de integración,
- validaciones mínimas del lado NetSuite.

---

# 19. Decisiones arquitectónicas vigentes

1. La solución objetivo del proyecto se denomina **Cronómetro**.
2. La arquitectura oficial se divide en **tres capas**.
3. La unidad principal de trabajo es la **operación de una OT en proceso**.
4. La OT se ingresa manualmente por número.
5. Las operaciones visibles se filtran por área del operario: `ME`, `ES` o `Both`.
6. Una máquina solo puede tener una operación activa a la vez.
7. Un operario puede utilizar varias máquinas.
8. La interfaz principal es un tablero adaptativo de cronómetros activos por estación.
9. El tiempo real de negocio se consolida por operación.
10. Cronómetro es el dueño de los datos reales vigentes por operación.
11. NetSuite provee datos estructurales y planificados que Cronómetro no modifica.
12. El input oficial actual desde NetSuite es el dataset `MCV_cronometro_out`.
13. El lado NetSuite lo trata como `out`, pero el lado Cronómetro lo trata como `in`.
14. El canal oficial de retorno es el RESTlet `MCV_Cronometro_In`.
15. La actualización hacia NetSuite se realiza automáticamente al cierre de turno o al cierre manual administrativo, y puede además ejecutarse en volcados manuales/programados intermedios.
16. El valor enviado a NetSuite es el valor vigente total por operación y se publica mediante overwrite del valor anterior.
17. No se envían eventos individuales a NetSuite.
18. El destino operativo principal es `manufacturingoperationtask`.
19. El retorno correcto de Cronómetro hacia NetSuite incluye exactamente 3 datos: setup real, run real y cantidad terminada.
20. `completed_quantity` pertenece a Cronómetro y no debe venir del input NetSuite.
21. `area` se deriva desde `resource_code` y no desde una fórmula Workbook del dataset.
22. La sincronización completa queda orquestada por Cronómetro como pull + push.
23. La autenticación del canal de escritura es OAuth 2.0 M2M.
24. La intervención en NetSuite debe ser mínima, sin staging persistente ni logging técnico adicional en esta etapa.

---

# 20. Relación con otros documentos

## 20.1 SANDBOX_CONFIG.md

Bitácora técnica y operativa del sandbox.

## 20.2 cust.netsuite.md

Documento operativo de handoff para el rol Configurador NetSuite.  
Contiene el detalle fino del dataset `MCV_cronometro_out`, la configuración M2M, el RESTlet `MCV_Cronometro_In`, las columnas reales armadas en sandbox y las decisiones/pedientes de configuración.

---

# 21. Estado arquitectónico oficial al momento de esta versión

A la fecha de esta versión:

- la solución objetivo oficial es **Cronómetro**;
- el sistema ya se orienta a operar con datos reales y no solo seed;
- el sistema se centra en la captura y consolidación sobre **operaciones de OTs en proceso**;
- la conciliación de los datos reales vigentes pertenece a Cronómetro;
- la visibilidad operativa depende del área del operario y de la estación actual;
- la infraestructura técnica existente se conserva;
- la lógica estable queda separada de la presentación;
- la sincronización oficial con NetSuite ocurre al cierre de turno y al cierre manual administrativo;
- pueden existir también volcados manuales o programados intermedios, sin romper la arquitectura, siempre por overwrite del valor vigente;
- existen **3 cierres de turno** configurables con auto-stop obligatorio;
- el input oficial desde NetSuite quedó formalizado mediante el dataset `MCV_cronometro_out`;
- ese dataset se consume del lado Cronómetro como input estructural/planificado;
- el retorno oficial hacia NetSuite quedó formalizado mediante el RESTlet `MCV_Cronometro_In`;
- `completed_quantity` ya no pertenece al input NetSuite;
- `area` se deriva desde `resource_code` fuera del Workbook;
- la autenticación del canal de escritura quedó definida como OAuth 2.0 M2M;
- el destino operativo del retorno es `manufacturingoperationtask`;
- y la sincronización completa queda gobernada del lado de Cronómetro.

---
