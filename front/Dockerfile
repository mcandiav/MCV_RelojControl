FROM node:16-alpine AS build

WORKDIR /app

# La URL del API debe inyectarse por despliegue. Sin valor por defecto en el repo.
ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_VERSION
ARG VUE_APP_BUILD_PATH=default

COPY package*.json ./
RUN npm install

COPY . .

RUN API_URL="${VUE_APP_API_URL:-}" && \
    export VUE_APP_API_URL="$API_URL" && \
    if [ -n "${VUE_APP_BUILD_VERSION:-}" ]; then export VUE_APP_BUILD_VERSION="$VUE_APP_BUILD_VERSION"; fi && \
    BUILD_PATH="${VUE_APP_BUILD_PATH:-default}" && \
    export VUE_APP_BUILD_PATH="$BUILD_PATH" && \
    echo ">>> npm run build con VUE_APP_API_URL=$VUE_APP_API_URL" && \
    npm run build

FROM nginx:alpine

ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_VERSION
ARG VUE_APP_BUILD_PATH=default

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Prioridad sobre el bundle: el navegador carga /api-config.js antes del JS.
RUN RAW="${VUE_APP_API_URL:-}" && \
    if [ -n "$RAW" ]; then case "$RAW" in */) ;; *) RAW="${RAW}/" ;; esac; fi && \
    printf '%s\n' "window.__CRONOMETRO_API_BASE__='${RAW}';" > /usr/share/nginx/html/api-config.js

RUN BUILD_PATH="${VUE_APP_BUILD_PATH:-default}" && \
    BUILD_VERSION="${VUE_APP_BUILD_VERSION:-}" && \
    printf '%s\n' "window.__CRONOMETRO_BUILD_PATH__='${BUILD_PATH}';" "window.__CRONOMETRO_BUILD_VERSION__='${BUILD_VERSION}';" > /usr/share/nginx/html/build-config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
