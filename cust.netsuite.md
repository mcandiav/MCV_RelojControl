# Configuración funcional NetSuite para vínculo con Cronómetro

## Bitácora de cambios

| Fecha | Cambio realizado | Motivo | Impacto | Sección afectada |
|---|---|---|---|---|
| 2026-04-05 | Se ordena y consolida el documento de handoff NetSuite con estado final del proyecto. | El proyecto ya está terminado y había mezcla entre decisiones históricas y vigentes. | Se aclara qué quedó operativo, qué quedó histórico y qué no debe reabrirse. | Estado, decisiones cerradas, integración OUT/IN, resumen ejecutivo |
| 2026-03-28 | Se consolida Saved Search como fuente OUT vigente. | Dataset no garantizaba la granularidad correcta. | Se corrige la fuente de extracción NetSuite -> Cronometro. | Fuente OUT |
| 2026-03-27 | Se invalida la raíz `Tiempo planificado de fabricación` para Dataset OUT. | Multiplicaba una misma operación lógica en varias filas. | Queda descartada como base válida. | Dataset OUT histórico |
| 2026-03-25 | Se corrige el contrato de retorno a 3 datos reales por operación. | Evitar pérdida de significado funcional. | Se fija el contrato correcto del push hacia NetSuite. | Contrato funcional |

## Estado

Documento de handoff operativo consolidado a partir de la documentación del proyecto, la inspección realizada en NetSuite y la configuración cerrada en sandbox.

> **Estado final (2026-04-05)**
>
> El proyecto Cronometro se considera terminado.
>
> La arquitectura vigente de integración NetSuite queda cerrada así:
>
> - **OUT** oficial por Saved Search: `customsearch_mcv_cronometro_out`
> - **IN** oficial por RESTlet: `MCV_Cronometro_Restlet_In`
> - **Push** en modo `import_ot`
> - **Flujo operativo**: `Stop -> Push -> Pull(+replace)`
> - **Granularidad de extracción**: `1 operación lógica = 1 fila`
>
> Toda referencia al dataset OUT como fuente oficial debe considerarse **histórica/deprecada**.

---

## Cómo usar este documento en un hilo nuevo

Tratar este archivo como fuente base de contexto para el estado final del vínculo con NetSuite.

### Rol a asumir
- **Configurador NetSuite**

### Decisiones ya cerradas
1. La fuente funcional histórica validada fue la **saved search `710`**.
2. La `710` no se toca y queda solo como referencia funcional humana.
3. La integración de salida NetSuite -> Cronómetro debe consumirse desde una **Saved Search técnica operativa**.
4. El `searchId` vigente es **`customsearch_mcv_cronometro_out`**.
5. El tipo base correcto es **`manufacturingoperationtask`**.
6. La separación por áreas `ME` / `ES` depende del prefijo oficial del recurso/centro de trabajo.
7. Desde NetSuite hacia Cronómetro deben venir los **tiempos planificados** y la **cantidad planificada** por operación.
8. El contrato real de retorno desde Cronómetro hacia NetSuite es por operación e incluye exactamente:
   - **tiempo real de configuración**
   - **tiempo real de trabajo / ejecución**
   - **cantidad terminada**
9. NetSuite es maestro estructural y destino publicado.
10. La publicación hacia NetSuite se hace por **batch**.
11. La publicación de los 3 datos se hace por **overwrite del valor vigente**, no por delta.
12. La Saved Search OUT es solo de **lectura desde NetSuite**.
13. La escritura de retorno no usa la Saved Search OUT.
14. La sincronización completa queda a cargo de **Cronometro**.
15. La sincronización completa tiene dos flujos separados pero coordinados por Cronometro:
   - **pull** de lectura desde NetSuite usando Saved Search OUT (`customsearch_mcv_cronometro_out`)
   - **push** de escritura hacia NetSuite usando el RESTlet `MCV_Cronometro_In`
16. El programador no debe asumir que el mismo endpoint que recibe el batch devuelve el dataset de operaciones.
17. La Saved Search oficial OUT debe consumirse **directamente**.
18. El RESTlet funcional de escritura quedó renombrado como **IN**.
19. La raíz histórica `Tiempo planificado de fabricación` quedó descartada para OUT.
20. El dataset `MCV_cronometro_out` queda como **referencia histórica/deprecada**, no como fuente oficial vigente.

### Temas abiertos que quedan solo como registro histórico
1. definición del root correcto del antiguo dataset OUT
2. incorporación de `netsuite_work_order_id` al antiguo dataset
3. discusión sobre usuario técnico dedicado para producción
4. pruebas end-to-end históricas asociadas al dataset OUT

Estos puntos no cambian la arquitectura final ya cerrada del proyecto.

---

## Objetivo

Dejar documentada la fuente oficial de extracción desde NetSuite hacia Cronometro, el mapeo funcional de campos, las reglas de transformación, la configuración M2M en sandbox y el receptor operativo ya configurado para actualizar NetSuite.

Este documento no define código del lado Cronometro. Define el contrato funcional y la configuración NetSuite que el proyecto terminó usando.

---

## Base funcional de referencia

La fuente funcional histórica validada en NetSuite fue la **saved search `710`**.

Se confirmó contra:
- link real de NetSuite con `searchid=710`
- archivo XLS exportado desde NetSuite
- ejecución directa vía herramienta NetSuite usando `searchId = "710"`

La `710` debe tratarse como **referencia funcional** y **no debe tocarse** para la integración ya cerrada.

---

## Decisión arquitectónica final de extracción

### Regla
La integración NetSuite -> Cronometro no usa Dataset como contrato técnico vigente.

### Decisión final
La extracción oficial se realiza desde una **Saved Search técnica operativa**.

### Fuente oficial OUT
- **Script ID:** `customsearch_mcv_cronometro_out`
- **Saved Search UI:** `823`
- **Título visible:** `BG - Control de HH por OT Detalle VF - CARGA`
- **Tipo:** `Tarea de operación de fabricación` / `manufacturingoperationtask`
- **Filtro operativo:** `Estado = En curso` (`PROGRESS`)

### Motivo
- respeta la regla `1 operación = 1 fila`
- alinea la extracción con el universo WIP real
- evita los problemas de multiplicación observados en Dataset

---

## Qué representa la extracción oficial

La Saved Search OUT representa la foto operativa de las **operaciones WIP activas** que Cronometro necesita consumir.

Columnas mínimas confirmadas:
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
| `CONFIGURACION RUTA` | Tiempo de montaje planificado |
| `EJECUCION RUTA` | Tiempo de operación planificado por unidad |
| `Cantidad de entrada` | Cantidad planificada de la operación |
| `Estado` | Estado origen de la tarea |
| `Nombre de la operación` | Nombre visible de la operación |

---

## Mapeo recomendado hacia el contrato interno de Cronometro

| Columna Saved Search | Campo interno recomendado |
|---|---|
| `Orden de trabajo` | `ot_number` |
| `Secuencia de operaciones` | `operation_sequence` |
| `Centro de trabajo de fabricación` | `resource_code` |
| `CONFIGURACION RUTA` | `planned_setup_minutes` |
| `EJECUCION RUTA` | `planned_run_minutes_per_unit` |
| `Cantidad de entrada` | `planned_quantity` |
| `Estado` | `source_status` |
| `Nombre de la operación` | `operation_name` |

---

## Regla vigente de granularidad y validez

La fuente OUT debe entregar **una sola fila por operación lógica**.

Regla práctica de validación:
- si una misma operación aparece repetida sin diferencia funcional real, la fuente debe considerarse inválida.

---

## Área operativa

La separación `ME` / `ES` depende del recurso o centro de trabajo.

La documentación histórica deja dos alternativas registradas:
- derivación desde el prefijo del recurso,
- columna `AREA` dentro de la Saved Search.

Como el proyecto ya está terminado, esta diferencia queda tratada como detalle de implementación histórica y no reabre la arquitectura.

---

## Contrato funcional recomendado para Cronometro (input desde NetSuite)

```json
{
  "ot_number": "OT16993",
  "operation_sequence": 8,
  "resource_code": "ME103 RECTIFICADORA CIL...",
  "planned_setup_minutes": 60,
  "operation_name": "RECTIFICADO B",
  "planned_quantity": 3,
  "planned_run_minutes_per_unit": 180,
  "source_status": "PROGRESS"
}
```

---

## Sincronización: responsabilidad y flujo completo

### Dueño de la sincronización
La **sincronización completa** queda a cargo de **Cronometro**.

NetSuite expone:
- una fuente de lectura (`customsearch_mcv_cronometro_out`)
- un receptor de escritura (`MCV_Cronometro_In`)

Cronometro decide cuándo leer, cuándo escribir y en qué orden operativo hacerlo.

### Modelo correcto de sincronización
La sincronización tiene **dos flujos separados**:

#### 1. Pull: NetSuite -> Cronometro
Cronometro debe hacer pull de la Saved Search oficial y refrescar el universo WIP local.

#### 2. Push: Cronometro -> NetSuite
Cronometro debe hacer push de los 3 datos reales por operación al RESTlet desplegado en NetSuite.

### Orden oficial final

- La sincronización oficial se ejecuta con cronómetros detenidos.
- Orden obligatorio:
  1. **Push** del valor vigente (setup real, run real, cantidad terminada).
  2. **Pull** del universo WIP vigente desde NetSuite.

---

## Integración de retorno: Cronometro -> NetSuite

### Principio arquitectónico vigente
- **Cronometro es dueño de los datos reales por operación**.
- Cronometro devuelve a NetSuite los **3 datos reales operativos**.
- **NetSuite es maestro estructural** de OTs, operaciones, recursos, tiempos planificados y cantidades planificadas.
- **NetSuite es destino publicado** de los resultados reales del cronometraje.

### Los 3 datos reales que Cronometro devuelve por operación
1. **Tiempo real de configuración**
2. **Tiempo real de trabajo / ejecución**
3. **Cantidad terminada**

### Regla de interpretación
- El retorno es **por operación**.
- No se devuelven eventos individuales ni deltas.
- La publicación se hace por **overwrite del valor vigente**.

---

## Destino funcional confirmado en NetSuite

Se confirmó que `manufacturingoperationtask` expone campos estándar que calzan con el retorno de los 3 datos por operación:

- `actualSetupTime`
- `actualRunTime`
- `completedQuantity`

### Conclusión
- `manufacturingoperationtask` es el destino operativo correcto.
- No hace falta inventar un custom record como destino principal.
- No conviene usar `workorder` como destino principal de estos 3 datos.

---

## Configuración M2M realizada en sandbox

### Funciones habilitadas verificadas
- Servicios web REST
- Autenticación basada en token
- OAuth 2.0

### Decisión de autenticación
- **OAuth 2.0 M2M / Client Credentials**

### Aplicación creada
- `MCV_Cronometro_M2M`

### Rol creado
- `MCV_Cronometro_Rol`

### Mapping M2M
- Entidad: `MIGUEL CANDIA`
- Rol: `MCV_Cronometro_Rol`
- Aplicación: `MCV_Cronometro_M2M`
- Certificado: cargado correctamente

### Estado del mapping
- activo en sandbox
- algoritmo: RSA

---

## RESTlet mínimo implementado en sandbox

### Canal de recepción
- **RESTlet SuiteScript 2.1**

### Naming funcional correcto
- **OUT** = Saved Search `customsearch_mcv_cronometro_out`
- **IN** = RESTlet `MCV_Cronometro_In`

### Script record
- **Nombre**: `MCV_Cronometro_Restlet_In`
- **Script ID**: `customscriptmcv_cronometro_restlet_in`

### Deployment
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
Recibir un payload por batch y actualizar, por `netsuite_operation_id`, estos campos de `manufacturingoperationtask`:
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

---

## Qué no debe reabrirse sin evidencia nueva

- no volver a Dataset como fuente oficial OUT
- no reutilizar la raíz `Tiempo planificado de fabricación`
- no usar la `710` como contrato técnico de integración
- no reducir el retorno a un solo número ambiguo
- no mover la lógica de consolidación a NetSuite
- no mezclar lectura OUT y escritura IN en un mismo canal

---

## Resumen ejecutivo final

### Confirmado
- fuente OUT oficial: `customsearch_mcv_cronometro_out`
- tipo base: `manufacturingoperationtask`
- granularidad: `1 operación lógica = 1 fila`
- flujo oficial: `Stop -> Push -> Pull(+replace)`
- salida desde Cronometro: 3 datos reales por operación
- destino operativo confirmado: `manufacturingoperationtask`
- autenticación configurada en sandbox: **OAuth 2.0 M2M**
- integración creada: `MCV_Cronometro_M2M`
- rol creado: `MCV_Cronometro_Rol`
- mapping M2M activo
- RESTlet IN creado y desplegado
- la sincronización completa queda del lado de Cronometro
- lectura y escritura quedan como flujos separados

### Histórico/deprecado
- dataset `MCV_cronometro_out`
- raíz `Tiempo planificado de fabricación`
- cualquier lectura del OUT basada en Dataset como contrato vigente

---

## Conclusiones operativas

1. La `710` queda como referencia funcional histórica, no como contrato técnico final.
2. El contrato técnico de extracción vigente es la Saved Search **`customsearch_mcv_cronometro_out`**.
3. La carga de entrada se basa en operaciones de OT con recurso, tiempos planificados, cantidad planificada y estado, con **una sola fila por operación lógica**.
4. Los datos planificados requeridos por operación son:
   - montaje,
   - ejecución por unidad,
   - cantidad.
5. El retorno correcto de Cronometro hacia NetSuite son 3 datos reales por operación:
   - tiempo real de configuración,
   - tiempo real de trabajo,
   - cantidad terminada.
6. El canal mínimo implementado para recepción en NetSuite es un **RESTlet SuiteScript 2.1** autenticado con **OAuth 2.0 M2M**.
7. La sincronización completa se entiende como:
   - **pull** desde Saved Search OUT,
   - **push** por RESTlet IN.
8. El proyecto queda documentalmente cerrado con Saved Search OUT + RESTlet IN como arquitectura final.
