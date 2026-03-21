# Arquitectura MCV_RelojControl

## Versión 3.0

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|------|-------------------|--------|---------|------------------|
| 2026-03-19 | Reemplazo integral del documento para redefinir la solución objetivo como **Cronómetro** | La solución vigente dejó de responder al modelo operativo real de planta y al nuevo alcance del proyecto | Se redefine el dominio, la experiencia operativa, la arquitectura física de captura y la integración con NetSuite | Documento completo |
| 2026-03-19 | Se reemplaza el enfoque centrado en RelojControl por una solución centrada en **operaciones de OTs en proceso** | El problema real del negocio no es registrar horas genéricas por OT, sino capturar tiempo operativo por operación del ruteo | Cambia la unidad principal de trabajo, la consolidación y la lógica funcional | Objetivo, modelo de dominio, flujos, integración |
| 2026-03-19 | Se formaliza el modelo de filtrado por área del operario: **ME / ES / Both** | Una misma OT puede contener operaciones ME y ES, por lo que el operario no debe ver operaciones fuera de su ámbito | Se agrega lógica de visibilidad y filtrado operativo | Modelo de datos, flujos, seguridad |
| 2026-03-19 | Se redefine el flujo principal del operario hacia login + ingreso manual de OT + selección de operación | En planta no es viable navegar listados extensos de OTs; el operario recibe la OT en hardcopy/plano de fabricación | Se simplifica el flujo operativo y se alinea con la realidad de planta | Flujos principales, experiencia operativa |
| 2026-03-19 | Se establece a la máquina como recurso exclusivo con una sola operación activa a la vez | La ejecución real ocurre por máquina y no deben coexistir dos operaciones activas en el mismo puesto | Cambia la lógica de control operativo | Reglas operativas, modelo de dominio |
| 2026-03-19 | Se define un tablero adaptativo de cronómetros activos como interfaz principal | La operación requiere visibilidad continua del estado de cronometraje y no una consola fija de un solo cronómetro | Cambia la arquitectura de interacción del usuario | Arquitectura lógica, flujos principales |
| 2026-03-19 | Se define detención automática de todos los cronómetros al fin de turno y consolidación batch hacia NetSuite | El cierre de turno debe ser controlado, trazable y consistente con la operación real | Cambia la lógica de sesión, cierre de turno e integración | Flujos, integración, decisiones vigentes |
| 2026-03-19 | Se define estrategia de reemplazo total de aplicación, manteniendo la infraestructura actual de EasyPanel, Docker, dominio e integración con NetSuite | El cambio funcional es estructural, pero no requiere reemplazar la plataforma técnica ya operativa | Se separa renovación de aplicación de continuidad de infraestructura | Arquitectura técnica, roadmap, decisiones vigentes |
| 2026-03-19 | Se incorpora el concepto de **station_id** para aislar cronómetros por estación/pantalla compartida | Una misma PC de planta puede ser usada por varios operarios y no deben mezclarse cronómetros entre pantallas | Cambia tablero, API, modelo de datos y despliegue | Modelo de dominio, arquitectura lógica, API, despliegue |
| 2026-03-19 | Se incorpora re-autenticación obligatoria para acciones que cambian estado del cronómetro | En una pantalla compartida, un toque/clic no identifica de forma segura al operario que ejecuta una acción crítica | Cambia política de sesión, trazabilidad y seguridad operativa | Seguridad, flujos, auditoría |
| 2026-03-19 | Se define **Cronómetro V3** como la especificación objetivo para implementación por Programador y preparación de integración por Configurador NetSuite | Ya existe suficiente definición funcional y operativa para programar la nueva aplicación y preparar la futura integración API con NetSuite | Se establece una versión ejecutable de arquitectura | Documento completo |

---

# 1. Propósito del documento

Este documento define la **arquitectura vigente oficial** del proyecto **MCV_RelojControl** y su evolución formal hacia la solución objetivo **Cronómetro V3**.

Su propósito es establecer de forma clara y trazable:

- el problema real de negocio que debe resolverse,
- la arquitectura funcional y operativa objetivo,
- las entidades principales del dominio,
- los flujos de interacción en planta,
- la arquitectura física de captura,
- la integración actual y futura con NetSuite,
- y la división de responsabilidades entre Programador y Configurador NetSuite.

Este documento es la **única fuente oficial de arquitectura vigente** del proyecto.  
No debe utilizarse como historial desordenado ni como bitácora operativa de infraestructura.

La bitácora técnica y operativa del sandbox se mantiene en `SANDBOX_CONFIG.md`.

---

# 2. Objetivo de la solución

La solución objetivo del proyecto se define como:

## **Cronómetro V3**

Cronómetro V3 tiene como objetivo:

- capturar el tiempo real de ejecución sobre **operaciones de OTs en proceso**,
- hacerlo de forma consistente con la realidad operativa de planta,
- minimizar errores de imputación manual,
- consolidar el tiempo real por operación,
- y poblar correctamente NetSuite con los tiempos reales del ruteo de fabricación.

La lógica del sistema debe responder al hecho de que:

- una **OT** contiene múltiples operaciones,
- esas operaciones pueden pertenecer a distintas áreas de fabricación,
- cada operación está asociada a una máquina o recurso,
- y el tiempo real relevante para el negocio se entiende a nivel de **operación**, no solo a nivel de cabecera de OT.

---

# 3. Cambio de enfoque arquitectónico

## 3.1 Enfoque heredado

La solución heredada RelojControl surgió con un modelo centrado en:

- captura operativa general,
- pantallas administrativas amplias,
- lógica histórica de importación/exportación,
- y una experiencia de usuario no suficientemente alineada con el trabajo real en planta.

## 3.2 Enfoque arquitectónico vigente

La arquitectura vigente redefine el sistema en torno a:

- **operaciones de OTs en proceso**,
- filtrado operativo por área de trabajo del operario,
- ingreso manual del número de OT,
- control de exclusividad por máquina,
- tablero de cronómetros activos por estación,
- re-autenticación para acciones críticas,
- y consolidación formal de tiempos hacia NetSuite.

## 3.3 Decisión formal

La solución objetivo se llama **Cronómetro V3** y reemplaza funcionalmente a la aplicación actual.

---

# 4. Principios arquitectónicos

La solución se gobierna por los siguientes principios:

1. **La operación es la unidad real de trabajo**  
   El dato operativo principal no es la OT completa, sino la operación concreta de una OT en proceso.

2. **La interfaz debe seguir la realidad de planta**  
   El sistema debe adaptarse al flujo físico y mental del operario, no al revés.

3. **La máquina es un recurso exclusivo de ejecución**  
   Una máquina solo puede tener una operación activa a la vez.

4. **La visibilidad debe respetar el área del operario**  
   No se deben mostrar operaciones fuera del ámbito habilitado del usuario.

5. **La captura y la consolidación son niveles distintos**  
   El sistema registra eventos de cronometraje, pero el negocio consume tiempo real consolidado por operación.

6. **La infraestructura actual se conserva**  
   Se reemplaza la aplicación, no la plataforma técnica ya montada.

7. **La estación es un contexto operativo obligatorio**  
   Una pantalla compartida debe mostrar solo los cronómetros de esa estación.

8. **Toda acción crítica debe quedar asociada a un operario identificado**  
   En pantalla compartida, play/pause/stop y acciones equivalentes requieren autenticación válida.

9. **La solución debe ser extensible hacia asistencia operativa futura**  
   La captura inicial puede ser manual, pero la arquitectura debe permitir evolución posterior hacia mayor validación por contexto operativo.

---

# 5. Nombre y alcance de la solución objetivo

## 5.1 Nombre oficial

La solución objetivo se denomina:

## **Cronómetro V3**

## 5.2 Alcance funcional

Cronómetro V3 cubre:

- autenticación operativa del operario,
- búsqueda manual de OTs,
- despliegue de operaciones filtradas,
- selección de operación,
- inicio, pausa, reanudación y detención de cronometraje,
- visibilidad de cronómetros activos por estación,
- detención automática al fin de turno,
- y consolidación batch de tiempos reales hacia NetSuite.

---

# 6. Dominio funcional de Cronómetro V3

## 6.1 Entidades principales

La arquitectura funcional gira alrededor de estas entidades:

- **Operario**
- **Área del operario**
- **OT**
- **Operación de OT en proceso**
- **Máquina / recurso / puesto**
- **Estación**
- **Cronómetro activo**
- **Evento de cronometraje**
- **Tiempo real consolidado de operación**
- **Turno**

## 6.2 Definiciones principales

### Operario

Usuario de planta que ejecuta trabajo sobre operaciones productivas.

### Área del operario

Atributo funcional que define qué operaciones puede visualizar y ejecutar.

Valores permitidos:

- `ME`
- `ES`
- `Both`

### OT

Orden de trabajo que contiene múltiples operaciones en su ruteo.

### Operación de OT en proceso

Unidad principal de trabajo del sistema.  
Es la operación concreta que el operario selecciona y sobre la cual se cronometra.

### Máquina / recurso

Puesto o recurso físico sobre el que se ejecuta una operación.  
Es un recurso exclusivo de ejecución.

### Estación

Pantalla, terminal o PC de planta identificada por un `station_id` único.  
Define el scope de visualización y operación de cronómetros en una pantalla compartida.

### Evento de cronometraje

Registro transaccional de:

- inicio,
- pausa,
- reanudación,
- detención,
- o detención automática por fin de turno.

### Tiempo real consolidado de operación

Valor acumulado final que representa el tiempo real de la operación y que se utiliza para poblar NetSuite.

---

# 7. Modelo de áreas de fabricación

## 7.1 Áreas oficiales

Los centros de fabricación se dividen en:

- **ME**
- **ES**

## 7.2 Regla de pertenencia del operario

Cada operario debe tener configurado un atributo de área:

- `ME`
- `ES`
- `Both`

## 7.3 Regla de visibilidad de operaciones

Las operaciones visibles para el operario deben filtrarse así:

- operario `ME` → ve solo operaciones `ME`
- operario `ES` → ve solo operaciones `ES`
- operario `Both` → ve operaciones `ME` y `ES`

## 7.4 Motivación arquitectónica

Una misma OT puede contener operaciones mixtas de ambas áreas.  
Por ello, el sistema no puede desplegar genéricamente todas las operaciones de una OT sin aplicar filtro por área del usuario.

---

# 8. Arquitectura lógica de Cronómetro V3

## 8.1 Componentes lógicos

La arquitectura lógica se compone de:

- **Puesto de captura en planta**
- **Aplicación Cronómetro**
- **Servicio de negocio**
- **Persistencia de eventos**
- **Motor de consolidación**
- **Integración con NetSuite**

## 8.2 Diagrama lógico textual

```text
Operario
   ↓
Estación de Cronómetro
   ↓
Login + OT + Selección de operación
   ↓
Eventos de cronometraje
   ↓
Persistencia operativa
   ↓
Consolidación por operación
   ↓
Batch de cierre de turno
   ↓
NetSuite
```

## 8.3 Regla de separación lógica

El sistema debe distinguir claramente entre:

- capa de captura operativa,
- capa de consolidación,
- capa de integración con NetSuite.

---

# 9. Arquitectura física de captura

## 9.1 Estrategia general

Cronómetro V3 se desplegará en puestos físicos de planta usando:

- mini PC industrial,
- monitor,
- teclado,
- mouse,
- Ethernet RJ45.

## 9.2 Regla de conectividad

La conectividad operativa principal será:

- RJ45 cableado.

No se define Wi-Fi como medio operativo base de la solución.

## 9.3 Regla de despliegue físico

Cuando sea posible, el puesto de Cronómetro debe estar asociado a una máquina o puesto operativo concreto.  
La arquitectura también debe soportar el escenario actual de pantalla compartida para múltiples recursos.

## 9.4 Pantalla

La arquitectura de UI debe soportar pantallas grandes, incluso de 52" o más, si así lo requiere la visualización simultánea de cronómetros activos.

---

# 10. Estaciones y aislamiento por pantalla

## 10.1 Concepto obligatorio de estación

Cada PC o pantalla operativa debe tener un identificador único:

- `station_id`

## 10.2 Propósito de station_id

`station_id` existe para:

- aislar cronómetros por pantalla,
- filtrar el tablero operativo,
- evitar mezcla entre pantallas distintas,
- y auditar desde qué estación se inició o operó un cronómetro.

## 10.3 Regla de visibilidad por estación

Una estación debe mostrar solo:

- los cronómetros iniciados en esa misma estación,
- o tomados explícitamente por esa estación si ese flujo se implementa a futuro.

Por ahora, los cronómetros no migran entre estaciones.

## 10.4 Regla de configuración

El `station_id` debe configurarse una sola vez por PC de planta.

Puede resolverse mediante:

- variable de entorno,
- archivo local,
- configuración de despliegue,
- o registro equivalente.

## 10.5 Regla de despliegue

El diseño debe evitar duplicados accidentales de `station_id`.

---

# 11. Autenticación y sesión operativa

## 11.1 Login del operario

El login se compone de:

- selección del operario desde una lista,
- ingreso de un PIN de 4 dígitos.

## 11.2 Propósito del login

El login no solo autentica. También contextualiza:

- el operario activo,
- su área habilitada,
- y la visibilidad de operaciones correspondientes.

## 11.3 Duración de sesión de turno

La sesión:

- inicia al comienzo del turno,
- no tiene timeout automático,
- y termina al final del turno cuando el operario cierra sesión.

## 11.4 Re-autenticación para acciones críticas

En pantalla compartida, toda acción que cambie estado del cronómetro debe requerir autenticación válida del operario que ejecuta esa acción.

Esto aplica a:

- inicio,
- pausa,
- reanudación,
- detención,
- y cualquier acción equivalente que altere estado operativo.

## 11.5 Regla de identidad

Un toque o clic en pantalla compartida no identifica automáticamente al operario.  
La identidad debe estar explícitamente confirmada antes de ejecutar una acción crítica.

---

# 12. Flujo principal del operario

## 12.1 Flujo operativo base

1. El operario inicia sesión.
2. El operario ingresa manualmente el número de OT.
3. El sistema busca la OT.
4. El sistema obtiene las operaciones de la OT.
5. El sistema filtra operaciones según área del operario.
6. El operario selecciona la operación correspondiente.
7. Se abre la consola del cronómetro seleccionado.
8. El operario inicia, pausa, reanuda o detiene.
9. Luego de la interacción, el sistema vuelve al tablero general de cronómetros activos de la estación.

## 12.2 Ingreso de OT

No se debe presentar un listado masivo de OTs para elegir.  
La OT debe ingresarse manualmente por número, ya que el operario recibe la instrucción en hardcopy o plano de fabricación.

## 12.3 Selección de operación

Una vez localizada la OT, se muestran solo las operaciones correspondientes al área habilitada del operario.

## 12.4 Re-autenticación operativa

Las acciones que cambian estado exigen autenticación del operario que las ejecuta, aun cuando exista una sesión de turno abierta en la estación.

---

# 13. Tablero de cronómetros activos

## 13.1 Pantalla principal

La pantalla principal del sistema no es una grilla administrativa, sino un **tablero adaptativo de cronómetros activos por estación**.

## 13.2 Regla de adaptación

El sistema debe mostrar todos los cronómetros activos de la estación.

No existe un máximo funcional fijo de cronómetros visibles.

Si existen muchos cronómetros activos, la interfaz debe:

- reorganizarse automáticamente,
- adaptar el tamaño visual de cada bloque,
- y mantener visibilidad de todos los cronómetros activos.

## 13.3 Datos destacados por cronómetro

Cada cronómetro visible debe destacar claramente al menos:

- OT,
- operación,
- máquina o recurso,
- operario,
- estado,
- tiempo acumulado.

## 13.4 Consola temporal

Al hacer clic sobre un cronómetro:

- se abre la consola de ese cronómetro,
- se ejecuta la interacción necesaria,
- y luego el sistema vuelve automáticamente al tablero general.

---

# 14. Reglas operativas núcleo

## 14.1 Regla de exclusividad por máquina

Una máquina solo puede tener **una operación activa a la vez**.

## 14.2 Regla de movilidad del operario

Un operario puede usar varias máquinas a lo largo del tiempo.

## 14.3 Regla de visibilidad

El operario solo puede visualizar operaciones correspondientes a su área habilitada.

## 14.4 Regla de contexto

El sistema debe operar sobre:

- operario autenticado,
- OT ingresada,
- operación seleccionada,
- máquina o recurso asociado,
- estación actual,
- estado actual del cronómetro.

---

# 15. Captura y consolidación del tiempo

## 15.1 Registros de captura

Cronómetro registra eventos operativos de:

- inicio,
- pausa,
- reanudación,
- detención,
- detención automática por fin de turno.

## 15.2 Regla de consolidación

Una operación del ruteo debe mantener **un único tiempo real consolidado**.  
Ese valor consolidado puede ser alimentado por múltiples eventos y múltiples tramos de trabajo.

## 15.3 Diferencia conceptual obligatoria

La arquitectura debe distinguir entre:

- **Evento de captura:** registro transaccional individual del cronómetro.
- **Tiempo real consolidado:** resultado acumulado que representa el tiempo real de la operación para fines de negocio y NetSuite.

---

# 16. Cierre de turno

## 16.1 Regla de cierre

Al final del turno, el sistema debe **paralizar automáticamente todos los cronómetros**.

## 16.2 Reanudación posterior

Quien necesite continuar una operación en el siguiente turno deberá **iniciar nuevamente** el cronómetro correspondiente.

## 16.3 Motivación

El cierre automático de turno asegura:

- orden operativo,
- corte formal de jornada,
- consistencia de captura,
- y consolidación coherente por turno.

---

# 17. API y modelo de datos propuestos

## 17.1 Cambios mínimos de modelo de datos

La solución debe incorporar al menos:

- operario,
- `operario_area` (o equivalente en modelo actual),
- `station_id`,
- `operation_timer`,
- `operation_timer_events`,
- `shift_session`,
- `batch_status` o equivalente de consolidación.

## 17.2 Campo obligatorio de estación

Las entidades de cronometraje deben persistir `station_id` como parte del contexto operativo del timer.

## 17.3 API mínima requerida

La API debe soportar al menos:

- login de operario,
- búsqueda de OT por número,
- lectura de operaciones de una OT,
- inicio de cronómetro,
- pausa de cronómetro,
- reanudación de cronómetro,
- detención de cronómetro,
- listado de cronómetros activos por estación,
- batch de cierre de turno,
- auditoría de acciones críticas.

## 17.4 Reglas de envío de station_id

`station_id` debe viajar en las llamadas relevantes para:

- iniciar cronómetro,
- reanudar cronómetro,
- listar tablero de estación,
- cualquier acción que requiera scope por pantalla.

## 17.5 Alcance de station_id

`station_id` es un concepto interno de planta.  
No forma parte del payload funcional hacia NetSuite en esta versión.

---

# 18. Integración con NetSuite

## 18.1 Rol de NetSuite

NetSuite sigue siendo:

- fuente formal de OTs y ruteo de operaciones,
- y destino de los tiempos reales consolidados.

## 18.2 Regla de integración funcional

Cronómetro debe consumir desde NetSuite:

- OT,
- operaciones de la OT,
- recurso o centro asociado,
- y contexto funcional necesario para despliegue y validación.

## 18.3 Regla de escritura

La actualización de tiempos reales hacia NetSuite se podrá realizar mediante **batch al término del turno**.  
No se fija como requisito obligatorio una actualización online inmediata por cada evento.

## 18.4 Nivel del dato destino

La integración debe respetar el nivel de negocio correcto:

- el tiempo real se consolida por **operación**,
- no solo por cabecera de OT.

## 18.5 Alcance actual del Configurador NetSuite

La integración automática por API, token y endpoints de NetSuite no forma parte de la implementación inmediata del Programador en esta etapa.

Debe mantenerse un apartado específico para el Configurador NetSuite, quien más adelante deberá definir y preparar:

- APIs a utilizar,
- tokens,
- autenticación,
- permisos,
- objetos origen y destino,
- estrategia de batch,
- validaciones y errores de integración.

---

# 19. Relación con la solución heredada

## 19.1 Estado del sistema actual

La aplicación actual RelojControl se considera una solución heredada.

## 19.2 Estrategia de reemplazo

Cronómetro V3 no convivirá como producto paralelo visible bajo otro dominio.  
La estrategia definida es:

- reemplazo total de aplicación,
- manteniendo la infraestructura técnica existente.

## 19.3 Qué se reutiliza

Se conserva:

- infraestructura de EasyPanel,
- Docker,
- dominio actual,
- conectividad con NetSuite,
- entorno técnico ya montado.

## 19.4 Qué se reemplaza

Se reemplaza:

- modelo funcional actual,
- frontend actual,
- flujo actual de usuario,
- lógica heredada de cronometraje,
- experiencia operativa actual.

---

# 20. Arquitectura técnica vigente y estrategia de implementación

## 20.1 Plataforma técnica

La plataforma técnica existente de despliegue se mantiene como base:

- EasyPanel,
- Docker,
- dominio actual,
- integración con NetSuite.

## 20.2 Decisión técnica de renovación

La renovación se hace sobre la aplicación, no sobre la plataforma.

## 20.3 Implicancia

El sistema nuevo Cronómetro V3 reemplazará a la aplicación actual utilizando el mismo entorno técnico general.

---

# 21. Seguridad y control operativo

## 21.1 Autenticación

La autenticación del operario debe ser simple, operativa y coherente con planta:

- selección de usuario,
- PIN de 4 dígitos.

## 21.2 Control de visibilidad

La visibilidad de operaciones se controla por:

- área del operario,
- contexto de OT,
- operación seleccionada,
- estación actual.

## 21.3 Control operativo

La máquina no puede sostener más de una operación activa simultáneamente.

## 21.4 Trazabilidad

El sistema debe conservar trazabilidad de:

- operario,
- OT,
- operación,
- máquina o recurso,
- estación,
- estado del cronómetro,
- eventos de captura,
- cierre de turno,
- consolidación enviada a NetSuite.

## 21.5 Alcance del administrador

El administrador debe poder ver el listado operativo según su contexto administrativo, pero no es requisito que utilice la misma vista de cuadrantes/tablero de operario.

---

# 22. Arquitectura objetivo futura

## 22.1 Evolución funcional

La arquitectura futura podrá evolucionar hacia mecanismos que ayuden a prevenir olvidos del operario.

## 22.2 Línea evolutiva

Cronómetro debe poder evolucionar desde una captura predominantemente manual hacia una captura:

- manual asistida,
- validada por contexto operativo,
- y eventualmente conectada con señales del puesto o de la máquina.

## 22.3 Restricción actual

En esta versión del documento no se define control directo de energía o marcha de máquina como capacidad vigente.  
Eso queda como línea de evolución futura sujeta a diseño específico de automatización industrial.

---

# 23. Roles y responsabilidades de ejecución

## 23.1 Rol Programador

El Programador debe implementar:

- la nueva aplicación Cronómetro V3,
- su frontend,
- su backend,
- su modelo de datos,
- el tablero por estación,
- la autenticación de operario,
- la búsqueda manual de OT,
- el filtro por área,
- la lógica de cronómetros,
- la re-autenticación para acciones críticas,
- el cierre automático de turno,
- y la consolidación batch interna lista para futura integración.

## 23.2 Rol Configurador NetSuite

El Configurador NetSuite debe preparar, cuando corresponda:

- conexión API con NetSuite,
- autenticación y tokens,
- endpoints de lectura y escritura,
- permisos,
- mapeo de OT y operaciones,
- batch de integración,
- y validaciones de datos.

## 23.3 Separación de responsabilidades

- El **Programador** implementa la aplicación y la lógica del sistema.
- El **Configurador NetSuite** define y deja lista la conectividad formal con NetSuite.

---

# 24. Decisiones arquitectónicas vigentes

- La solución objetivo del proyecto se denomina **Cronómetro V3**.
- La unidad principal de trabajo es la **operación** de una OT en proceso.
- La OT se ingresa **manualmente** por número y no mediante listado masivo.
- Las operaciones visibles se filtran por área del operario: **ME**, **ES** o **Both**.
- Una máquina solo puede tener **una operación activa** a la vez.
- Un operario puede utilizar **varias máquinas**.
- La interfaz principal es un **tablero adaptativo de cronómetros activos por estación**.
- La consola de interacción es **temporal** y retorna al tablero general.
- **No** existe timeout de sesión durante el turno.
- Todos los cronómetros se detienen **automáticamente** al final del turno.
- El tiempo real de negocio se **consolida por operación**.
- La actualización hacia NetSuite puede hacerse por **batch** al cierre de turno.
- La infraestructura actual de EasyPanel, Docker, dominio e integración con NetSuite se **mantiene**.
- La aplicación actual será **reemplazada** funcionalmente por Cronómetro V3.
- Cada estación debe tener un **`station_id` único**.
- Los cronómetros visibles en una pantalla son solo los **pertenecientes a esa estación**.
- Las acciones que cambian estado del cronómetro requieren **autenticación válida** del operario.
- Los cronómetros **no migran** de estación en esta versión.
- **`station_id` no viaja a NetSuite** en esta versión.
- El administrador puede ver listados operativos, pero **no** requiere la misma experiencia de cuadrantes del operario.

---

# 25. Relación con otros documentos

## 25.1 SANDBOX_CONFIG.md

Se mantiene como bitácora técnica y operativa del sandbox y debe reflejar la configuración real requerida por Cronómetro V3.

## 25.2 README.md

Sigue siendo el punto de entrada general del repositorio, pero no reemplaza este documento como fuente oficial de arquitectura.

---

# 26. Estado arquitectónico oficial al momento de esta versión

A la fecha de esta versión:

- el proyecto deja formalmente de orientarse a extender RelojControl como solución principal;
- la solución objetivo oficial pasa a ser **Cronómetro V3**;
- el sistema se centra en la captura de tiempo sobre **operaciones de OTs en proceso**;
- la visibilidad operativa depende del **área del operario** y de la **estación actual**;
- la infraestructura técnica existente se **conserva**;
- la aplicación será **reemplazada** funcionalmente dentro del mismo entorno técnico y mismo dominio;
- y la futura integración API con NetSuite queda **separada** como responsabilidad del rol Configurador NetSuite.
