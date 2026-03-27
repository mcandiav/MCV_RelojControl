/**
 * origin: true → refleja el header Origin (front en https://reloj… y API en https://reloj-api…).
 * allowedHeaders explícitos: `x-access-token` obliga preflight; sin esto algunos proxies/navegadores fallan.
 *
 * Solo si hace falta: CORS_ALLOW_ALL=true → Access-Control-Allow-Origin: * (no usar salvo diagnóstico).
 */
const allowStar = process.env.CORS_ALLOW_ALL === 'true' || process.env.CORS_ALLOW_ALL === '1';

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl/healthchecks sin Origin
  try {
    const u = new URL(origin);
    const host = (u.hostname || '').toLowerCase();
    // Permitir relojes del sandbox (front normal y front test) + orígenes locales.
    if (host === 'reloj.at-once.cl') return true;
    if (host === 'reloj-test.at-once.cl') return true;
    if (/^reloj[-a-z0-9]*\.at-once\.cl$/.test(host)) return true;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return false;
  } catch (_) {
    return false;
  }
}

module.exports = {
  origin: allowStar
    ? '*'
    : function corsOrigin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`), false);
      },
  credentials: false,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-access-token',
    'x-station-id',
    'x-terminal-id',
    'Accept'
  ],
  maxAge: 86400,
  optionsSuccessStatus: 204
};
