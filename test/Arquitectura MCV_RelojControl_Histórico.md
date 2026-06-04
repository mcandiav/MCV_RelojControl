# Arquitectura MCV_RelojControl
## Version 1.1

## Bitacora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Seccion afectada |
|------|-------------------|--------|---------|------------------|
| 2026-03-18 | Se agrega identificador de version del documento y se fija la version vigente en 1.1 | Faltaba control explicito de version debajo del titulo principal del documento | Mejora trazabilidad documental y control de cambios de arquitectura | Encabezado del documento |
| 2026-03-18 | Reemplazo completo del documento de arquitectura para alinearlo con el estado real vigente del sandbox y con la estrategia actual de integracion con NetSuite | El documento anterior describia una arquitectura desalineada respecto del repositorio sandbox, su bitacora tecnica y su despliegue real | Se establece una unica base arquitectonica vigente, se separa estado actual de objetivo futuro y se formalizan criterios de estandar/configuracion/desarrollo | Documento completo |
| 2026-03-18 | Formalizacion del flujo actual NetSuite - Excel - RelojControl - CSV - NetSuite como integracion vigente | Era necesario diferenciar claramente la integracion actual manual de la futura automatizacion | Se evita asumir integraciones no implementadas y se ordena el alcance del proyecto | Integracion con NetSuite, Alcance, Flujos |
| 2026-03-18 | Declaracion explicita de sandbox tecnico sobre MariaDB + Docker + EasyPanel y aclaracion de diferencia con produccion MSSQL | El sandbox vigente ya no coincide con la arquitectura tecnica historica | Se reduce riesgo de decisiones basadas en infraestructura obsoleta | Arquitectura tecnica, Despliegue, Ambientes |

---

# 1. Proposito del documento

Este documento define la **arquitectura vigente oficial** del proyecto **MCV_RelojControl** en su repositorio sandbox de GitHub.

Su objetivo es dejar trazabilidad sobre:

- el problema de negocio que resuelve la solucion,
- el alcance arquitectonico real actual,
- los componentes principales,
- los flujos de datos,
- la relacion con NetSuite,
- los criterios de seguridad e implementacion,
- y la frontera entre lo que debe resolverse con **NetSuite estandar**, **configuracion declarativa** o **desarrollo**.

Este documento es la **unica fuente oficial de arquitectura vigente** del proyecto.
No debe utilizarse como documento historico desordenado ni como bitacora operativa detallada.
La bitacora operativa y de infraestructura del sandbox se mantiene en SANDBOX_CONFIG.md.

---

# 2. Objetivo de la solucion

RelojControl es una solucion orientada a registrar y consolidar el tiempo real de ejecucion de operarios sobre Ordenes de Trabajo (OTs), comparando la ejecucion real contra la planificacion proveniente de NetSuite.

La solucion busca cubrir estas necesidades:

- recibir informacion operativa originada en NetSuite,
- permitir que operarios registren el trabajo real sobre OTs,
- consolidar tiempos, pausas e hitos de ejecucion,
- generar una salida estructurada para retorno a NetSuite,
- y preparar la base para futura automatizacion de integracion.

---

# 3. Alcance arquitectonico vigente

## 3.1 Incluido en la arquitectura vigente

La arquitectura vigente cubre:

- repositorio sandbox mcandiav/MCV_RelojControl,
- frontend web de operacion,
- backend API,
- base de datos del sandbox,
- flujo manual de entrada/salida con NetSuite,
- criterios de evolucion futura hacia integracion automatizada.

## 3.2 Fuera de alcance de este documento

Quedan fuera del alcance de este documento:

- pasos detallados de configuracion en NetSuite,
- instrucciones de despliegue operativas paso a paso,
- detalle de codigo fuente,
- implementacion de scripts, endpoints o automatizaciones especificas,
- procedimientos funcionales de usuarios finales.

Eso corresponde a otros hilos y roles:

- **Configurador NetSuite**
- **Programador**
- **Operacion / Infraestructura**

---

# 4. Principios arquitectonicos

La solucion se gobierna con los siguientes principios:

1. **Claridad y trazabilidad primero**
   Toda decision debe quedar reflejada en este documento cuando modifique la solucion vigente.

2. **NetSuite estandar primero**
   Si una necesidad puede resolverse con capacidades estandar de NetSuite sin aumentar complejidad ni costo de mantenimiento, esa es la opcion preferida.

3. **Configuracion declarativa antes que desarrollo**
   Si el estandar no alcanza, se prioriza configuracion declarativa antes de construir codigo.

4. **Desarrollo solo cuando el estandar no alcance**
   El desarrollo se reserva para integraciones, logica especializada o restricciones no cubiertas de forma razonable por NetSuite.

5. **Separacion entre estado actual y estado objetivo**
   Este documento debe distinguir siempre entre arquitectura vigente real y evolucion futura deseada.

6. **No confundir sandbox con produccion**
   Las diferencias tecnicas entre ambos ambientes deben quedar explicitas.

---

# 5. Vision general de la solucion

## 5.1 Resumen funcional

La solucion opera hoy de la siguiente forma:

1. NetSuite entrega datos de trabajo mediante un archivo Excel.
2. RelojControl importa y procesa esa informacion.
3. Los operarios trabajan sobre las OTs dentro del sistema.
4. El sistema registra tiempos reales, pausas, estados e intervalos.
5. El sistema genera una salida CSV.
6. Ese CSV se carga manualmente nuevamente en NetSuite.

## 5.2 Resultado arquitectonico

Actualmente, **NetSuite es el sistema de origen y destino administrativo de datos**, mientras que **RelojControl es el sistema operativo intermedio de ejecucion y captura de tiempos reales**.

---

# 6. Arquitectura logica vigente

## 6.1 Componentes principales

La arquitectura logica vigente esta compuesta por:

- **Frontend Web**: interfaz de operacion para administradores y operarios, carga de datos, gestion de trabajo activo, visualizacion de OTs y acciones de trabajo.
- **Backend API**: logica de negocio, autenticacion, persistencia, consolidacion de registros, exportacion de resultados.
- **Base de datos relacional**: persistencia de OTs importadas, sesiones de trabajo, registros historicos, trazabilidad de intervalos y exportaciones.
- **NetSuite**: sistema fuente de planificacion, sistema destino para retorno de resultados operativos.

## 6.2 Diagrama logico textual

```
NetSuite
   |
Exportacion Excel
   |
RelojControl Frontend
   |
RelojControl Backend API
   |
Base de Datos
   |
Exportacion CSV
   |
Carga manual en NetSuite
```

---

# 7. Arquitectura tecnica vigente del sandbox

## 7.1 Stack tecnologico vigente

**Frontend**
- Vue.js 2
- Vuetify 2
- Vuex
- nginx (Alpine) como servidor del frontend compilado

**Backend**
- Node.js 16
- Express
- Sequelize ORM
- JWT para autenticacion

**Base de datos sandbox**
- MariaDB

**Despliegue sandbox**
- Docker
- EasyPanel
- Proxy administrado por la plataforma

## 7.2 Ambientes

**Sandbox vigente**
- Repositorio: mcandiav/MCV_RelojControl
- Base de datos: MariaDB
- Despliegue: Docker + EasyPanel
- Uso: desarrollo, pruebas, validacion y alineacion funcional

**Produccion referencial**
- La produccion historica utiliza SQL Server / MSSQL
- Este documento no define aqui el detalle operativo productivo
- Toda decision tecnica debe aclarar si aplica a sandbox, produccion o ambos

## 7.3 Regla arquitectonica de ambientes

Ninguna decision debe asumir automaticamente que:

- lo implementado en sandbox esta listo para produccion,
- ni que la arquitectura historica de produccion representa el estado actual del sandbox.

Ambos ambientes deben evaluarse explicitamente cuando una decision tenga impacto tecnico o funcional.

---

# 8. Integracion con NetSuite

## 8.1 Estado vigente actual

La integracion vigente con NetSuite es manual.

**Flujo actual**
- Entrada a RelojControl: archivo Excel exportado desde NetSuite
- Salida desde RelojControl: archivo CSV generado por el sistema
- Retorno a NetSuite: carga manual del CSV

## 8.2 Naturaleza de la integracion vigente

La integracion actual:

- no depende de sincronizacion online,
- no depende de APIs activas,
- no depende de credenciales de integracion en tiempo real,
- y no debe documentarse como integracion automatica.

## 8.3 Estado objetivo futuro

La automatizacion futura podra evaluarse mediante:

- NetSuite REST API
- autenticacion basada en OAuth 2.0
- intercambio estructurado de datos entre ambas plataformas

## 8.4 Regla arquitectonica para decisiones de integracion

Hasta que exista una implementacion aprobada y operativa, toda referencia a integracion automatica con NetSuite debe tratarse como objetivo futuro, no como capacidad vigente.

---

# 9. Criterio de particion de responsabilidades entre NetSuite y RelojControl

## 9.1 Responsabilidad de NetSuite

NetSuite debe considerarse responsable de:

- planeacion administrativa,
- estructura formal de ordenes,
- origen corporativo de datos maestros y operativos a importar,
- recepcion final de resultados consolidados.

## 9.2 Responsabilidad de RelojControl

RelojControl debe considerarse responsable de:

- operacion diaria de captura de ejecucion,
- play / pause / stop sobre OTs,
- registro real de trabajo,
- intervalos de actividad,
- consolidacion operativa,
- salida estructurada para retorno a NetSuite.

## 9.3 Decision arquitectonica vigente

La arquitectura vigente separa claramente:

- verdad administrativa / de planificacion: NetSuite
- verdad operativa / de ejecucion: RelojControl

Esta separacion es parte del diseno actual y debe preservarse salvo nueva decision arquitectonica explicita.

---

# 10. Modelo de datos logico de alto nivel

Los modelos principales identificados en el sandbox son:

| Modelo | Descripcion |
|--------|-------------|
| Data | OTs importadas desde la fuente externa |
| Record | OT activa trabajada por un operario |
| Finalized | Registro consolidado e inmutable al completar una OT |
| Registry | Log de inicio y fin por usuario |
| TaskIntervals | Intervalos precisos de trabajo y pausa |
| Discharged | Marca de registros ya exportados para evitar duplicidad |
| User | Usuarios del sistema |
| Role | Perfiles de acceso |
| Workplace | Puestos de trabajo o centros operativos |

## 10.1 Regla arquitectonica sobre el modelo de datos

El modelo de datos debe seguir estas reglas:

- separar estados temporales de estados consolidados,
- mantener trazabilidad de intervalos,
- evitar duplicidad de exportaciones,
- permitir auditoria operativa,
- y no depender de NetSuite para conservar la historia operativa interna.

---

# 11. Flujos principales

## 11.1 Flujo de carga inicial

1. NetSuite genera archivo Excel
2. El archivo se incorpora a RelojControl
3. El sistema registra y disponibiliza OTs para operacion

## 11.2 Flujo de ejecucion operativa

1. El operario inicia una OT
2. El sistema registra inicio
3. El operario pausa o reanuda segun corresponda
4. El sistema registra intervalos
5. El operario finaliza la OT
6. El sistema consolida el resultado

## 11.3 Flujo de salida

1. Se seleccionan registros listos para exportar
2. El sistema genera CSV
3. Se marca lo exportado para evitar reprocesamiento
4. El CSV se carga manualmente en NetSuite

---

# 12. Seguridad y control de acceso

## 12.1 Autenticacion

La autenticacion vigente se basa en JWT administrado por el backend.

## 12.2 Autorizacion

La autorizacion depende de perfiles y relaciones operativas del sistema. Como minimo, existen perfiles de:

- administrador
- operario

## 12.3 Principios de seguridad

La arquitectura debe asegurar:

- separacion de roles,
- acceso autenticado a la operacion,
- proteccion de credenciales fuera del codigo,
- trazabilidad de actividad,
- no exposicion innecesaria de secretos de integracion.

## 12.4 Secretos e integracion

Las credenciales de integracion con NetSuite no forman parte del diseno vigente operativo de intercambio online. Cuando exista integracion automatica, deberan administrarse como secretos externos y no embebidos en codigo ni documentacion publica del repositorio.

---

# 13. Criterio arquitectonico: estandar NetSuite vs configuracion vs desarrollo

## 13.1 Se resuelve con estandar NetSuite cuando

Aplica cuando la necesidad corresponde a:

- registros nativos,
- importaciones/exportaciones estandar,
- reportes basicos,
- controles administrativos cubiertos por la plataforma,
- estructuras existentes sin logica especializada.

## 13.2 Se resuelve con configuracion declarativa cuando

Aplica cuando la necesidad requiere:

- personalizacion sin codigo,
- ajustes de formularios,
- validaciones simples,
- parametrizacion funcional,
- mejoras de usabilidad o trazabilidad sin logica compleja.

## 13.3 Se resuelve con desarrollo cuando

Aplica cuando la necesidad requiere:

- integracion automatizada con sistemas externos,
- transformacion compleja de datos,
- logica operativa no soportada razonablemente por estandar,
- orquestacion de procesos entre plataformas,
- automatizacion robusta de sincronizacion,
- reglas no declarativas.

## 13.4 Regla de decision

Toda decision funcional o tecnica debera clasificar explicitamente el requerimiento en una de estas tres categorias:

1. Estandar NetSuite
2. Configuracion declarativa
3. Desarrollo

Si un cambio requiere desarrollo, debe quedar documentado el motivo por el cual el estandar o la configuracion no alcanzan.

---

# 14. Restricciones y consideraciones vigentes

## 14.1 Restricciones actuales

- La integracion con NetSuite es manual
- El sandbox usa MariaDB, no MSSQL
- El repositorio activo de trabajo es el sandbox
- La produccion no debe asumirse equivalente al sandbox
- No existe aun automatizacion aprobada de integracion online

## 14.2 Riesgos arquitectonicos actuales

- documentar como vigente una integracion futura no implementada,
- mezclar decisiones del sandbox con supuestos de produccion,
- tomar decisiones sobre base de datos o despliegue usando una arquitectura obsoleta,
- implementar desarrollo donde NetSuite estandar seria suficiente,
- o intentar forzar configuracion donde ya se requiere integracion especializada.

---

# 15. Decisiones arquitectonicas vigentes

1. El repositorio sandbox MCV_RelojControl es la referencia tecnica vigente de trabajo.
2. La integracion actual con NetSuite es manual, no automatica.
3. RelojControl es el sistema operativo de ejecucion y captura de tiempos.
4. NetSuite es el sistema administrativo de origen y destino.
5. El sandbox vigente utiliza MariaDB, Docker y EasyPanel.
6. Las diferencias entre sandbox y produccion deben declararse explicitamente en toda decision relevante.
7. La automatizacion futura con NetSuite REST API + OAuth 2.0 es una linea de evolucion, no una capacidad vigente.
8. Toda iniciativa debe clasificarse en estandar, configuracion o desarrollo antes de ejecutarse.

---

# 16. Arquitectura objetivo futura

La arquitectura objetivo futura, sujeta a validacion posterior, considera:

- reduccion de pasos manuales de intercambio,
- integracion controlada con NetSuite mediante API,
- trazabilidad extremo a extremo,
- minimizacion de reprocesos,
- y mayor consistencia entre planificacion y ejecucion operativa.

## 16.1 Condiciones para avanzar a esa arquitectura objetivo

Antes de aprobar automatizacion futura, debe validarse:

- disponibilidad real de objetos y endpoints de NetSuite requeridos,
- estrategia de autenticacion,
- identificadores consistentes entre ambos sistemas,
- reglas de negocio de sincronizacion,
- control de errores,
- reintentos,
- auditoria,
- y criterio de operacion ante fallos.

---

# 17. Gobierno documental

## 17.1 Regla de actualizacion

Cada vez que una decision cambie la solucion, este documento debe actualizarse.

## 17.2 Reglas minimas de mantenimiento

Toda actualizacion debe:

- reflejar el estado real actual,
- evitar mezclar historia con vigencia,
- agregar entrada en la bitacora inicial,
- indicar motivo, impacto y seccion afectada,
- y mantener consistencia con el repositorio y la solucion real.

## 17.3 Regla ante desalineacion

Si la conversacion arquitectonica, el codigo, la infraestructura o la operacion real se desalinean con este documento, debe senalarse explicitamente y proponerse correccion.

---

# 18. Relacion con otros documentos

## 18.1 SANDBOX_CONFIG.md

Contiene la bitacora tecnica y operativa del sandbox, incluyendo:

- infraestructura,
- dominios,
- servicios,
- variables,
- decisiones tecnicas aplicadas,
- y observaciones operativas.

## 18.2 README.md

Debe servir como entrada general al repositorio, pero no reemplaza este documento como fuente oficial de arquitectura.

---

# 19. Estado arquitectonico oficial al momento de esta version

A la fecha de esta version:

- la arquitectura vigente oficial del sandbox esta alineada con MCV_RelojControl,
- el stack vigente del sandbox es Vue 2 + Vuetify + Node.js + Express + Sequelize + MariaDB + Docker + EasyPanel,
- la integracion vigente con NetSuite es manual por archivos,
- y la automatizacion futura con API permanece como evolucion planificada, no como estado actual.
