# Cambio de fuente OUT NetSuite -> Cronómetro (2026-03-28)

## Estado
Decisión cerrada en sandbox después de validar directamente la search funcional `710`, probar raíces alternativas de Dataset y contrastar resultados reales.

## Resumen ejecutivo
La fuente OUT para Cronómetro **ya no debe implementarse como Dataset**.

La fuente OUT correcta debe implementarse como **Saved Search técnica** basada en:

- **Tipo de búsqueda:** `Tarea de operación de fabricación`
- **Record técnico equivalente:** `manufacturingoperationtask`

### Resultado de la validación
Se confirmó lo siguiente:

1. La search funcional de referencia (`710`) es una **Búsqueda de Tarea de operación de fabricación**.
2. La `710` devuelve **1 fila por operación real**, que es la granularidad correcta para Cronómetro.
3. La prueba funcional correcta para la carga real a RelojControl es **Estado = En curso**.
4. Con ese filtro, la nueva búsqueda técnica devolvió **271 registros**, alineándose con el proceso real de exportación/carga.
5. Los intentos de reemplazar la fuente OUT con Dataset no reprodujeron correctamente la `710`.

## Qué se probó y por qué se descartó

### 1. Dataset con root `Tiempo planificado de fabricación`
**Descartado.**

Motivo:
- multiplica una misma operación lógica en varias filas físicas;
- rompe la regla `1 operación = 1 fila`;
- no es equivalente a `manufacturingoperationtask`.

### 2. Dataset con root `Ruta de fabricación`
**Descartado.**

Motivo:
- representa la plantilla/ruta;
- no expone el `Estado` operativo requerido para el universo WIP real.

### 3. Dataset con root `Transacción de fabricación`
**Descartado como fuente oficial OUT.**

Motivo:
- expone campos parcialmente útiles, pero obliga a mezclar ramas `Operación`, `Operación de inicio` y `Operación de finalización`;
- con filtro operativo cercano al esperado no reprodujo el universo real de la `710`;
- en validación entregó aproximadamente **921** filas contra las **271** esperadas para `En curso`.

## Nueva decisión de arquitectura para OUT

### Fuente oficial OUT
La fuente oficial OUT de NetSuite hacia Cronómetro debe ser una **Saved Search técnica nueva**, no un Dataset.

### Búsqueda de referencia humana que no se toca
- **Search funcional existente:** `710`
- **Script ID operativo nuevo:** `customsearch_mcv_cronometro_out`
- **Tipo:** `Tarea de operación de fabricación`

### Búsqueda técnica nueva para integración
- **Título recomendado:** `MCV_Cronometro_Out_Search`
- **Tipo:** `Tarea de operación de fabricación`
- **Objetivo:** servir como fuente técnica estable para la extracción OUT hacia Cronómetro

> Nota actualizada por validación funcional: el `searchId` operativo vigente es `customsearch_mcv_cronometro_out` (Saved Search 823).
> El detalle de `field_id` y mapeo quedó documentado en `NETSUITE_OUT_SAVEDSEARCH_FIELDS_2026-03-28.md`.

## Regla funcional cerrada para la exportación a Cronómetro
La fuente que consume Cronómetro debe incluir **solo operaciones en curso**.

### Filtro operativo válido
- **Estado = En curso**

### Diferencia con la búsqueda anterior
- `customsearch_mcv_cronometro_out` (Saved Search 823): solo `En curso`.
- `customsearch_zim_tarea_operacion_2_2_3_2`: mezcla `En curso` + `Sin empezar`.
- Regla de integración: usar únicamente la primera para evitar inconsistencias del universo WIP.

### Aclaración importante
Aunque la `710` como búsqueda funcional puede manejar otros usos humanos, la referencia correcta para la carga real a RelojControl es el subconjunto:

- **`Estado = En curso`**
- **271 filas** en la validación hecha en sandbox

## Columnas mínimas requeridas para Cronómetro
La nueva Saved Search técnica debe exponer, como mínimo, estas columnas equivalentes a la `710`:

1. `Orden de trabajo`
2. `Secuencia de operaciones`
3. `Centro de trabajo de fabricación`
4. `CONFIGURACION RUTA`
5. `EJECUCION RUTA`
6. `Cantidad de entrada`
7. `Estado`
8. `Nombre de la operación`

## Mapeo recomendado hacia el contrato interno de Cronómetro

| Columna Saved Search | Campo interno recomendado |
|---|---|
| `Orden de trabajo` | `OT_NUMBER` |
| `Secuencia de operaciones` | `OPERATION_SEQUENCE` |
| `Centro de trabajo de fabricación` | `RESOURCE_CODE` |
| `CONFIGURACION RUTA` | `TIEMPO_MONTAJE_MIN` |
| `EJECUCION RUTA` | `TIEMPO_OPERACION_MIN_UNIT` |
| `Cantidad de entrada` | `PLANNED_QUANTITY` |
| `Estado` | `SOURCE_STATUS` |
| `Nombre de la operación` | `OPERATION_NAME` |

## Implicancia para el programador
El programador **no debe seguir implementando el pull OUT contra Dataset**.

Debe tratar la fuente OUT como:

- una **Saved Search técnica** de NetSuite;
- basada en **`Tarea de operación de fabricación`**;
- filtrada por **`Estado = En curso`**;
- alineada con un universo de **271 operaciones** en sandbox al momento de la validación.

## Qué cambia en el programa
No se debe cambiar todo Cronómetro.

Solo cambia la **capa de extracción** NetSuite -> Cronómetro:

- antes: intento de lectura desde Dataset
- ahora: lectura desde **Saved Search técnica**

El **contrato interno** esperado por Cronómetro puede mantenerse, mapeando las columnas de la Saved Search a los campos internos ya definidos.

## Qué no reabrir sin evidencia nueva
- no volver a `Tiempo planificado de fabricación`;
- no seguir forzando `Transacción de fabricación` como root oficial;
- no usar `Ruta de fabricación` como fuente WIP;
- no asumir que Dataset y Saved Search exponen el mismo catálogo de roots;
- no tocar la `710` funcional existente.

## Recomendación operativa final
1. Mantener la `710` como referencia funcional humana.
2. Usar la Saved Search técnica operativa `customsearch_mcv_cronometro_out` como fuente OUT para integración.
3. Si se crea una nueva search dedicada (`MCV_Cronometro_Out_Search`), validar y documentar su `searchId` antes de cambiar el consumo.
4. Actualizar el adapter del backend para leer Saved Search en vez de Dataset, manteniendo el mismo contrato interno de Cronómetro.
