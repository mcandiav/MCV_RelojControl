FROM node:16-alpine AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# La URL del API debe inyectarse por despliegue. Sin valor por defecto en el repo.
ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_PATH=default
# Hash de commit Git (ej. abcb66c). EasyPanel: pasar como build arg al desplegar desde GitHub.
ARG VUE_APP_BUILD_VERSION=

COPY package*.json .npmrc ./
RUN npm install --no-fund --no-audit --loglevel=error

COPY . .

RUN API_URL="${VUE_APP_API_URL:-}" && \
    export VUE_APP_API_URL="$API_URL" && \
    BUILD_PATH="${VUE_APP_BUILD_PATH:-default}" && \
    export VUE_APP_BUILD_PATH="$BUILD_PATH" && \
    BUILD_VERSION="${VUE_APP_BUILD_VERSION:-}" && \
    export VUE_APP_BUILD_VERSION="$BUILD_VERSION" && \
    echo ">>> npm run build con VUE_APP_API_URL=$VUE_APP_API_URL VUE_APP_BUILD_VERSION=$VUE_APP_BUILD_VERSION" && \
    npm run build

FROM nginx:alpine

ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_PATH=default
ARG VUE_APP_BUILD_VERSION=

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Prioridad sobre el bundle: el navegador carga /api-config.js antes del JS.
RUN RAW="${VUE_APP_API_URL:-}" && \
    if [ -n "$RAW" ]; then case "$RAW" in */) ;; *) RAW="${RAW}/" ;; esac; fi && \
    printf '%s\n' "window.__CRONOMETRO_API_BASE__='${RAW}';" > /usr/share/nginx/html/api-config.js

RUN BUILD_PATH="${VUE_APP_BUILD_PATH:-default}" && \
    BUILD_VERSION="${VUE_APP_BUILD_VERSION:-}" && \
    printf '%s\n' \
      "window.__CRONOMETRO_BUILD_PATH__='${BUILD_PATH}';" \
      "window.__CRONOMETRO_BUILD_VERSION__='${BUILD_VERSION}';" \
      > /usr/share/nginx/html/build-config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
