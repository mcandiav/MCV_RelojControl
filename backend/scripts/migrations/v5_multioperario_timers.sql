-- V5: varios cronómetros por operación (unicidad: operación + usuario + terminal).
-- Ejecutar con servicios detenidos y backup previo.
-- MariaDB / relojcontrol

UPDATE operation_timers SET station_id = '' WHERE station_id IS NULL;

-- Quitar índice único legacy (nombre puede variar según entorno).
ALTER TABLE operation_timers DROP INDEX operation_timers_work_order_operation_id;

CREATE UNIQUE INDEX uk_op_timer_user_station
  ON operation_timers (work_order_operation_id, current_user_id, station_id);
