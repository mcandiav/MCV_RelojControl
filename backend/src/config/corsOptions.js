/**
 * origin: true → refleja el header Origin (front en https://reloj… y API en https://reloj-api…).
 * allowedHeaders explícitos: `x-access-token` obliga preflight; sin esto algunos proxies/navegadores fallan.
 *
 * Solo si hace falta: CORS_ALLOW_ALL=true → Access-Control-Allow-Origin: * (no usar salvo diagnóstico).
 */
const allowStar = process.env.CORS_ALLOW_ALL === 'true' || process.env.CORS_ALLOW_ALL === '1';

module.exports = {
  origin: allowStar ? '*' : true,
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
