-- V5: varios cronómetros por operación (unicidad: operación + usuario + terminal).
-- Se aplica automáticamente al arrancar reloj-api (backend/src/libs/runSchemaMigrations.js).
-- Referencia manual opcional si hiciera falta ejecutar fuera del contenedor.

UPDATE operation_timers SET station_id = '' WHERE station_id IS NULL;

ALTER TABLE operation_timers DROP INDEX operation_timers_work_order_operation_id;

CREATE UNIQUE INDEX uk_op_timer_user_station
  ON operation_timers (work_order_operation_id, current_user_id, station_id);
