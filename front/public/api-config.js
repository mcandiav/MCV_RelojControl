/**
 * Sobrescribe la URL del API en runtime (sin rebuild del bundle).
 * En Docker se genera otra vez en la imagen con la URL pública HTTPS.
 * Dejar vacío ('') para usar solo VUE_APP_API_URL del build (dev local).
 */
window.__CRONOMETRO_API_BASE__ = '';
