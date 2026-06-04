# NetSuite RESTlet IN - Modo `import_ot` (vigente)

## Resumen

`MCV_cronometro_restlet.js` recibe un batch desde Cronometro y crea registros de staging en:

- `customrecord_3k_importacion_ot`

El procesamiento final en NetSuite lo realizan scripts internos sobre ese custom record.

Dato operativo confirmado: `import_ot` se procesa en NetSuite por batch cada 15 minutos. Por eso Cronometro puede enviar registros antes del procesamiento, pero el impacto real en OT aparece recien cuando NetSuite ejecuta ese batch.

## Por que este modo es el recomendado

Comparado con escritura directa en registros operativos:

- mejor rendimiento por lotes,
- menor friccion de permisos,
- menor acoplamiento entre captura y aplicacion final,
- permite mantener en NetSuite la logica core de aplicacion sobre OT.

## Entrada esperada por item

- `ot_number` (recomendado)
- `netsuite_work_order_id` (opcional)
- `operation_sequence` (recomendado)
- `netsuite_operation_id` (opcional si ya viene OT+secuencia)
- `actual_setup_time`
- `actual_run_time`
- `completed_quantity`

## Regla vigente: enviar deltas, no acumulados

Para `import_ot`, Cronometro debe enviar el delta pendiente desde el ultimo envio/pull, no el acumulado total ya enviado.

Regla obligatoria:

```text
delta_a_enviar = acumulado_actual_del_dia - acumulado_ya_enviado_desde_el_ultimo_pull
```

Esta regla aplica a:

- el envio parcial cada 15 minutos,
- el envio de cierre 16:59,
- reintentos manuales/admin.

No debe existir un camino que envie acumulados totales saltandose esta regla.

## Ejemplo para evitar duplicacion

Caso: OT1 / Operacion 4 / Requerido 100 min / Cantidad 0.

Primer envio parcial:

```text
10:00 reloj detenido
acumulado del dia = 25 min
ya enviado desde ultimo pull = 0 min
delta = 25 - 0 = 25
se envia a import_ot: 25
se registra ya enviado = 25
```

Segundo envio parcial:

```text
12:00 reloj detenido
acumulado del dia = 35 min
ya enviado desde ultimo pull = 25 min
delta = 35 - 25 = 10
se envia a import_ot: 10
se registra ya enviado = 35
```

Cierre de turno:

```text
16:59 sistema detiene todos los relojes
acumulado del dia = 49 min
ya enviado desde ultimo pull = 35 min
delta = 49 - 35 = 14
se envia a import_ot: 14
se registra ya enviado = 49
```

NetSuite debe terminar sumando:

```text
25 + 10 + 14 = 49 min
```

Error prohibido:

```text
enviar 25, luego 35, luego 49
```

Eso duplicaria, porque NetSuite sumaria todos los import_ot recibidos.

## Frecuencia operativa acordada

Durante el turno:

```text
cada 15 minutos:
  buscar relojes detenidos
  calcular delta pendiente
  enviar delta a import_ot
  registrar lo enviado
```

No enviar:

- relojes corriendo,
- relojes pausados,
- operaciones sin delta positivo.

Cierre:

```text
16:59:
  detener todos los relojes
  calcular ultimo delta pendiente
  enviar pendiente a import_ot

17:02:
  ejecutar pull + replace vigente
```

Si la ultima data no alcanzo a ser procesada por NetSuite antes del pull, se considera desfase temporal. NetSuite sigue siendo la verdad final disponible al momento del pull.

## Trazabilidad requerida

Cada envio debe quedar registrado con:

- OT / operacion / secuencia,
- acumulado actual usado,
- acumulado ya enviado,
- delta enviado,
- payload JSON exacto enviado,
- fecha/hora,
- resultado del RESTlet,
- id de `customrecord_3k_importacion_ot` si NetSuite lo devuelve,
- error si falla.

Esta trazabilidad es necesaria solo para evitar duplicados entre pulls y diagnosticar envios. No reemplaza la verdad final de NetSuite.

## Respuesta esperada

- `results`: validacion por item recibido
- `import_results`: registros de importacion creados por OT

## Variables clave

```env
NETSUITE_PUSH_MODE=restlet
NETSUITE_IMPORT_OT_RECORD_TYPE=customrecord_3k_importacion_ot
NETSUITE_IMPORT_OT_WORKORDER_FIELD=custrecord_3k_ot_principal
NETSUITE_IMPORT_OT_JSON_FIELD=custrecord_3k_imp_ot_json
NETSUITE_IMPORT_OT_DATE_FIELD=custrecord_3k_imp_ot_fecha
```

Nota: en este modo, `import_ot` es el destino funcional dentro de NetSuite, pero el canal de envio sigue siendo RESTlet.

## Lecciones aprendidas

1. No asumir que `completed_quantity` se aplica igual que tiempos en scripts de terceros.
2. Si tiempos actualizan y cantidad no, revisar:
   - formato JSON exacto,
   - mapeo de campos del custom record,
   - script de procesamiento que hace la aplicacion final.
3. El ciclo robusto de cierre sigue siendo: **Stop -> Push -> Pull(+replace)**.
4. El envio parcial cada 15 minutos reduce desfase, pero no reemplaza el pull final.
5. ZIM queda fuera de este cambio; primero se estabiliza `import_ot` con deltas.
