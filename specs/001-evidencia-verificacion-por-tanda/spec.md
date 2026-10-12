# SPEC 001 — Evidencia de verificación por tanda

**Proyecto implementador:** Cronómetro (Bignotti)  
**Proyecto de decisión:** Evidencia-trabajo  
**Fecha:** 2026-10-10  
**Estado:** CERRADA. Desplegada en SB como V6.2.0 (`8a9e6a4`) y validada el 2026-10-11. Pendiente solo el pase a PROD.  
**Prioridad:** modificación mínima del flujo existente

## Contrato NetSuite cerrado — Configurador

Crear estos objetos con los nombres exactos. El programador ya envía este contrato.

```text
Record type: customrecord_zim_data_reloj_control
Campo script id: custrecord_mcv_verif_producto
Etiqueta: Verificación de producto
Tipo: Lista/Registro
Lista script id: customlist_mcv_verif_producto
Nombre de la lista: Verificación de producto
Valor de lista, nombre exacto: Sí
Valor de lista, nombre exacto: No
Obligatorio: No
Valor por defecto: ninguno
Columna en saved search: customsearch400
Etiqueta de columna: Verificación de producto
Registros vacíos: vacío o Sin registro. Nunca No.
```

```text
Sí:  "custrecord_mcv_verif_producto": { "refName": "Sí" }
No:  "custrecord_mcv_verif_producto": { "refName": "No" }
Sin declaración: la clave no se envía
```

`refName` tiene que coincidir con el nombre visible del valor de la lista. Clave local del evento STOP, no crear este nombre en NetSuite: `product_verified` (`true` = Sí, `false` = No, ausente = sin declaración).

## 1. Objetivo y regla de negocio
En el registro de **cada tanda terminada**, el operario declara si verificó que el producto terminado corresponde al producto requerido para **su operación**. Se guarda como **un campo nuevo del mismo registro ZIM400** que recibe las cantidades. Ninguna respuesta implica un control de calidad certificado.

## 2. UX obligatoria — Programador
**Ubicación:** exactamente en la ventana/modal **ya existente de ingreso de cantidad producida por tanda**. No crear página, menú ni botón independientes.

**Pregunta exacta:** «¿Verificó que el producto terminado corresponde al producto requerido para esta operación?»

**Control:** dos opciones excluyentes (radio): `Sí` y `No`, ambas inicialmente sin seleccionar en cada nuevo ingreso de tanda. Se muestran antes de la acción existente que confirma/guarda cantidad. Mantener etiqueta de acción y navegación actuales.

**Interacción:** la pregunta se muestra debajo de la cantidad cuando el entero ingresado es mayor que 0. En ese caso, si no hay respuesta, se impide confirmar y se muestra `Seleccione Sí o No para registrar la verificación del producto.`; el cronómetro sigue. Con cantidad vacía o 0 se detiene como antes, sin guardar respuesta. `No` se registra sin mensaje adicional, sin motivo, alerta ni bloqueo. Cada apertura del popup nace sin selección. No existe pantalla para reabrir una tanda ya guardada.

**Quién responde:** usuario/operario autenticado ya asociado a ese registro; no se solicita una segunda firma o PIN.

## 3. Datos y reglas de persistencia — Programador
- Atributo `product_verified` en `timer_events.details_json` del evento STOP que ya origina la fila ZIM400.
- Valores: `true` = Sí; `false` = No; `null` = sin declaración / histórico. Debe mantenerse distinción entre `false` y `null` en todo el recorrido.
- Registrar la respuesta **en la misma transacción lógica** en que se guarda la cantidad; impedir que un error parcial cree cantidad sin declaración en nuevas tandas.
- Capturar sólo una vez al guardar; la cola de sincronización debe transportar la misma respuesta en reintentos, sin recalcularla ni exigir nueva intervención del usuario.
- Mantener relación actual con operario, OT, operación, cantidad, evento de detención y fecha/hora existentes; **no crear tabla nueva de evidencias**.
- No reescribir respuestas de tandas anteriores al registrar tandas posteriores. No autocompletar registros históricos con `No`.
- Si existen otros consumidores del mismo evento, mantener retrocompatibilidad. No alterar tiempos `setup`/`run`, cálculo de cantidades ni lógica de cierre de OT.

## 4. Configuración obligatoria — Configurador NetSuite
1. Verificar en ambiente autorizado el tipo de registro efectivamente usado por ZIM400; en código figura `customrecord_zim_data_reloj_control`, sujeto a configuración `NETSUITE_ZIM400_RECORD_TYPE`. Identificar formulario/listado/búsqueda usados por Bignotti.
2. Crear el campo y la lista con los nombres del contrato cerrado al inicio de esta spec: `custrecord_mcv_verif_producto` y `customlist_mcv_verif_producto`, valores `Sí` y `No`, sin valor por defecto y con vacío distinto de `No`.
3. Incorporar **la columna a ZIM400**, en el listado/formulario o saved search operativo que efectivamente utilizan. En registros antiguos vacíos mostrar `Sin registro` o vacío, jamás `No` por omisión.
4. Verificar que el rol/credencial de integración actual de Cronómetro pueda escribir y leer el campo mediante el mecanismo REST existente. No ampliar permisos innecesariamente.
5. Entregar al Programador contrato de integración comprobado: `recordType`, `fieldScriptId`, representación JSON para `Sí`, `No` y nulo, más evidencia de prueba en NetSuite.
6. Documentar configuración, fecha, entorno, capturas/IDs y reversión en documento `configuracion_Evidencia-trabajo.md` dentro del proyecto Evidencia-trabajo o registro de configuración vigente, según gobierno documental; no crear campos duplicados.

**Orden de dependencias:** el código ya envía el contrato de arriba. El Configurador crea el campo y la lista con esos nombres. La integración no espera IDs internos: `Sí` y `No` viajan por `refName`.

## 5. Integración Cronómetro → NetSuite — Programador
- Reutilizar cola y endpoint ZIM400 existentes; no introducir nuevos endpoints ni jobs.
- Inspeccionar `backend/src/services/netsuite/zim400Client.js`, `backend/src/models/netsuite_sync_zim400.js`, `backend/src/controllers/netsuiteSync.js` y el flujo real que genera el evento de tanda y construye `payload_json`. Estas son **pistas confirmadas**, no una lista cerrada de archivos a modificar.
- Añadir al payload enviado el campo técnico proporcionado por Configurador, representando `Sí`/`No` tal como requiera NetSuite.
- Eliminar cualquier lógica que transforme `false` en campo omitido. Verificar serialización y reintentos: un `No` debe llegar como `No`, no como vacío.
- Mantener la idempotencia existente por `stop_event_id` y el vínculo del registro NetSuite, sin generar una segunda fila para la evidencia.
- Si falla envío a NetSuite, mantener la tanda y evidencia localmente y aplicar el tratamiento de reintentos/errores existente; no perder evidencia ni duplicar filas remotas.
- Definir comportamiento de ajustes/reprocesos de tanda con base en el flujo real, preservando trazabilidad. Si la arquitectura vigente no permite modificación segura, documentar el caso y no inventar un segundo circuito.

## 6. Pruebas mínimas de aceptación conjunta
| ID | Escenario | Resultado exigido |
|---|---|---|
| T01 | Registrar tanda de 10 con Sí | Una tanda, una fila ZIM400 y columna Sí con OT/operario/operación correctos |
| T02 | Registrar otra tanda de 15 con No en misma OT/operación | Segunda fila ZIM400 con No; primera conserva Sí; producción continúa |
| T03 | Confirmar nueva tanda sin elegir | Mensaje de selección; no se guarda tanda incompleta |
| T04 | Registrar nueva tanda tras responder Sí en otra | Radio vuelve a vacío, nunca hereda Sí |
| T05 | Revisar registro histórico anterior a cambio | Vacío/Sin registro; no aparece como No |
| T06 | Reintentar envío de una tanda con No | No conserva significado, no se duplica ZIM400 |
| T07 | Forzar error de API y recuperar | Evidencia persiste localmente y se reenvía con la misma tanda |
| T08 | Probar usuario operativo y rol integración | UI accesible en flujo existente; permiso de escritura REST comprobado |
| T09 | Registrar cantidades normales y tiempos setup/run | Resultados iguales al flujo anterior fuera del nuevo dato |
| T10 | Consultar vista ZIM400 | Columna visible, Sí/No correctos y contexto de tanda/OT/operario |

## 7. Entregables y cierre
**Configurador:** campo y columna efectivos, valores API/IDs comprobados, pruebas y registro de configuración; plan de reversión del campo y de la vista.

**Programador:** ajuste de UI, modelo del evento, captura atómica, payload, reintentos, pruebas unitarias/integración y nota de despliegue; commit/push según política de Cronómetro.

**Arquitecto:** actualiza README Evidencia-trabajo según resultado y registra cualquier cambio de alcance. **No autorizar despliegue sin evidencia T01, T02, T05, T06 y T10.**

## 8. Exclusiones explícitas
No control de calidad ni inspección por unidad, no justificaciones, ni alertas, ni bloquear producción cuando se responde No, ni aprobaciones, ni firma adicional, ni segunda tabla de evidencias, ni un segundo registro NetSuite.

## 9. Decisiones cerradas en revisión técnica
- La pregunta vive en el popup de cantidad al detener EJECUCIÓN. Es obligatoria solo si la cantidad es un entero mayor que 0. Cantidad vacía o 0 detiene el cronómetro sin respuesta.
- Montaje, stop masivo y cierre de turno cierran sin el campo.
- No hay pantalla para reabrir una tanda. La respuesta solo se captura en ese popup.
- Persistencia local: `product_verified` en `timer_events.details_json` del evento STOP.
- ZIM400 sigue siendo un registro por STOP. La verificación se adjunta a ese mismo registro cuando hubo cantidad mayor que 0. Las demás filas omiten el campo. No se fuerza otra asociación.
- Nombres NetSuite: ver el contrato cerrado al inicio. Campo y lista creados en SB por el Configurador.

## 10. Cierre y evidencia (SB, 2026-10-11)
Versión desplegada: `UI V6.2.0 · API V6.2.0`. El campo `custrecord_mcv_verif_producto` existe en `customrecord_zim_data_reloj_control` y la columna «Verificación de producto» aparece en `customsearch400`.

| ID ZIM400 | OT | Cantidad terminada | Verificación de producto | Prueba |
|---|---|---|---|---|
| 1494449 | OT16662 | 1 | Sí | T01 |
| 1494450 | OT16561 | 2 | No | T02, T06 |
| 1494349 | OT16275 | 0 | vacío | sin cantidad no se pregunta |
| anteriores a 1494349 | varias | 0 o 1 | vacío, nunca No | T05 |

`PUSH_ZIM400` y `PUSH_IMPORT_OT` terminan sin error. El reporte ZIM400 muestra la columna con «Sí» y «No» (T10).

Una primera entrega de esta función se retiró porque arrastraba un commit ajeno: borraba `resolveStopSegmentTiming`, con lo que ZIM400 fallaba, y revertía el delta por STOP de `import_ot`. `V5` se volvió a V6.1.0 y la función se reprogramó encima.
