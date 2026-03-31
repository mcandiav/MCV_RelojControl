# MCV Cronometro SS + MR (Propios)

Este paquete deja dos scripts propios para desacoplarse de la lógica de terceros en cantidad:

- `MCV_cronometro_ss.js` (User Event)
- `MCV_cronometro_mr.js` (Map/Reduce)

## Objetivo

Usar el custom record existente `customrecord_3k_importacion_ot` como staging, pero con lógica MCV:

1. SS valida/normaliza JSON.
2. MR procesa pendientes y genera `workordercompletion` con:
   - `machinesetuptime`
   - `machineruntime`
   - `completedquantity`

## Campos usados del custom record

- `custrecord_3k_ot_principal`
- `custrecord_3k_imp_ot_json`
- `custrecord_3k_imp_ot_estado`
- `custrecord_3k_imp_ot_det_proc`
- `custrecord_3k_imp_ot_transaccion`
- `custrecord_3k_imp_ot_fecha` (opcional en flujo)

## Formato JSON esperado

```json
[
  {
    "secuencia": 1,
    "horasConfiguracion": 0,
    "horasEjecucion": 1108,
    "cantidadCompletada": 1
  }
]
```

## Deploy recomendado

1. Subir ambos `.js` al File Cabinet.
2. Crear script record UE para `MCV_cronometro_ss.js` aplicado a `Importación OT`.
3. Crear script record MR para `MCV_cronometro_mr.js`.
4. Deployment del MR en modo programado o on-demand.
5. Desactivar el MR de terceros sobre el mismo pending queue para evitar doble proceso.

## Estados usados

- `1` = Pendiente
- `2` = OK
- `3` = Error

## Nota operativa

Si se mantiene `NETSUITE_PUSH_MODE=restlet`, el RESTlet debe crear registros de `Importación OT` con este JSON y estado pendiente.

