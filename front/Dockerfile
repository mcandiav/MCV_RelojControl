# Build desde la RAÍZ del repositorio (EasyPanel: directorio de build = . o vacío, Dockerfile = front/Dockerfile).
# Alternativa legacy: contexto front/ + build arg VUE_APP_BUILD_VERSION=<hash>.

FROM node:16-alpine AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apk add --no-cache git

ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_PATH=default
ARG VUE_APP_BUILD_VERSION=

WORKDIR /app/front

COPY front/package*.json front/.npmrc ./
RUN npm install --no-fund --no-audit --loglevel=error

COPY front/ ./

# Metadatos Git (disponible si el contexto de build es la raíz del repo).
COPY .git /app/.git

RUN set -e; \
    BUILD_VERSION="${VUE_APP_BUILD_VERSION:-}"; \
    if [ -z "$BUILD_VERSION" ] && [ -d /app/.git ]; then \
      BUILD_VERSION="$(git -C /app rev-parse --short HEAD 2>/dev/null || true)"; \
    fi; \
    if [ -z "$BUILD_VERSION" ]; then BUILD_VERSION="unknown"; fi; \
    echo "$BUILD_VERSION" > BUILD_VERSION.txt; \
    export VUE_APP_BUILD_VERSION="$BUILD_VERSION"; \
    export VUE_APP_API_URL="${VUE_APP_API_URL:-}"; \
    export VUE_APP_BUILD_PATH="${VUE_APP_BUILD_PATH:-default}"; \
    printf '%s\n' \
      "window.__CRONOMETRO_BUILD_PATH__='${VUE_APP_BUILD_PATH}';" \
      "window.__CRONOMETRO_BUILD_VERSION__='${BUILD_VERSION}';" \
      > public/build-config.js; \
    echo ">>> npm run build VUE_APP_BUILD_VERSION=${BUILD_VERSION}"; \
    npm run build

FROM nginx:alpine

ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_PATH=default

COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/front/dist /usr/share/nginx/html
COPY --from=build /app/front/BUILD_VERSION.txt /usr/share/nginx/html/BUILD_VERSION.txt
COPY front/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

RUN RAW="${VUE_APP_API_URL:-}" && \
    if [ -n "$RAW" ]; then case "$RAW" in */) ;; *) RAW="${RAW}/" ;; esac; fi && \
    printf '%s\n' "window.__CRONOMETRO_API_BASE__='${RAW}';" > /usr/share/nginx/html/api-config.js

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
