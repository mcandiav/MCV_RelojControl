module.exports = {
    SECRET:         process.env.JWT_SECRET      || "api-secret-od",
    HOST:           process.env.DB_HOST         || "localhost",
    PORT:           parseInt(process.env.DB_PORT)  || 3306,
    USER:           process.env.DB_USER         || "root",
    PASSWORD:       process.env.DB_PASSWORD     || "Password1234!",
    DB:             process.env.DB_NAME         || "relojcontrol",
    dialect:        process.env.DB_DIALECT      || "mariadb",
    DELETE_SECRET:  process.env.DELETE_SECRET   || "b1234",
    NS_SHIFT_BATCH_ENABLED: process.env.NS_SHIFT_BATCH_ENABLED === 'false' ? false : true,
    NS_AUTO_STOP_AT_SHIFT_END: process.env.NS_AUTO_STOP_AT_SHIFT_END === 'false' ? false : true,
    NS_TIMEZONE: process.env.NS_TIMEZONE || 'America/Santiago',
    NS_SHIFT_BATCH_TIME: process.env.NS_SHIFT_BATCH_TIME || '17:00',
    /** Identificador por defecto si el cliente no envía x-station-id (una sola pantalla). */
    DEFAULT_STATION_ID: String(process.env.DEFAULT_STATION_ID || 'default-station').trim().slice(0, 64),
    /** Exige body.pin (4 dígitos) en start/pause/resume/stop del cronómetro. */
    REQUIRE_PIN_FOR_TIMER_ACTIONS: process.env.REQUIRE_PIN_FOR_TIMER_ACTIONS === 'false' ? false : true,
    /**
     * Timers con station_id NULL (datos previos a multi-estación) se tratan como
     * pertenecientes solo a DEFAULT_STATION_ID para visibilidad y acciones.
     */
    STATION_LEGACY_NULL_MATCH_DEFAULT: process.env.STATION_LEGACY_NULL_MATCH_DEFAULT === 'false' ? false : true,
    /**
     * Si no hay usuarios y no hay usuarios.txt: crea admin + operarios demo (PIN 1234).
     * Desactivar en producción real: AUTO_SEED_DEMO_USERS=false
     */
    AUTO_SEED_DEMO_USERS: process.env.AUTO_SEED_DEMO_USERS === 'false' ? false : true
}
