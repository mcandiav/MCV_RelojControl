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
    /** Tras cierre de turno, intenta push a NetSuite (requiere credenciales M2M completas). */
    NETSUITE_PUSH_ON_SHIFT_CLOSE: process.env.NETSUITE_PUSH_ON_SHIFT_CLOSE === 'true',
    /** Espera entre PUSH y PULL en sync operativa (manual y cierre programado), segundos 0–120. */
    NS_OPERATIONAL_PULL_DELAY_SECONDS: (() => {
        const n = parseInt(process.env.NS_OPERATIONAL_PULL_DELAY_SECONDS, 10);
        if (!Number.isFinite(n)) return 60;
        return Math.max(0, Math.min(120, n));
    })()
}
