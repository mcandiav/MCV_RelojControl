# Frontend - Sistema de Gestion de Tiempos Bignotti

Este repositorio contiene el frontend (Vue + Vuetify) del sistema Cronometro.

## Decision arquitectonica (multiambiente)

- Existe una sola base de codigo para SB y PROD.
- La URL base del API se define solo por configuracion de despliegue.
- No se versionan defaults reales de SB/PROD dentro del repo.

## Configuracion de API

Orden de prioridad en runtime:

1. `window.__CRONOMETRO_API_BASE__` (archivo `public/api-config.js` generado en despliegue)
2. `VUE_APP_API_URL` (build-time)

Si no existe ninguna de las dos, el frontend muestra error de configuracion y bloquea requests HTTP para evitar consumir un backend por omision.

## Variables de entorno

Ejemplo Sandbox:

```env
VUE_APP_API_URL=https://api-sb.example.com/
```

Ejemplo Productivo:

```env
VUE_APP_API_URL=https://api-prod.example.com/
```

## Desarrollo local

1. Instalar dependencias:

```bash
npm install
```

2. Levantar frontend:

```bash
npm run serve
```

Notas:

- Si usas `vue.config.js` con `devServer.proxy`, puedes dejar `VUE_APP_API_URL` vacia en local.
- Para build de despliegue, el pipeline debe inyectar la URL del API correspondiente al ambiente.

## Build

```bash
npm run build
```

El mismo codigo funciona para SB/PROD cambiando solo la configuracion del despliegue.
