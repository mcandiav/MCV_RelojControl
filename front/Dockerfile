# EasyPanel: contexto = carpeta front/, Dockerfile = front/Dockerfile.
# EasyPanel inyecta build-arg GIT_SHA con el commit desplegado.

# ECR Public evita rate limit 429 de Docker Hub (sin credenciales).
FROM public.ecr.aws/docker/library/node:16-alpine AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_PATH=default
ARG VUE_APP_BUILD_VERSION=
ARG GIT_SHA=
ARG GIT_BRANCH=unknown

WORKDIR /app

RUN echo "========================================" && \
    echo " CRONOMETRO FRONT build" && \
    echo " Git: ${GIT_BRANCH}@${GIT_SHA}" && \
    echo "========================================"

COPY package*.json .npmrc ./
RUN npm install --no-fund --no-audit --loglevel=error

COPY . .

RUN set -e; \
    BUILD_VERSION="${VUE_APP_BUILD_VERSION:-}"; \
    if [ -z "$BUILD_VERSION" ] && [ -n "${GIT_SHA:-}" ]; then \
      BUILD_VERSION="${GIT_SHA}"; \
    fi; \
    if [ -z "$BUILD_VERSION" ]; then BUILD_VERSION="unknown"; fi; \
    if [ ${#BUILD_VERSION} -gt 12 ]; then \
      BUILD_VERSION="$(printf '%.7s' "$BUILD_VERSION")"; \
    fi; \
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

FROM public.ecr.aws/docker/library/nginx:alpine

ARG VUE_APP_API_URL
ARG VUE_APP_BUILD_PATH=default
ARG GIT_SHA=unknown
ARG GIT_BRANCH=unknown

LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.version="${GIT_BRANCH}"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/BUILD_VERSION.txt /usr/share/nginx/html/BUILD_VERSION.txt
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

RUN RAW="${VUE_APP_API_URL:-}" && \
    if [ -n "$RAW" ]; then case "$RAW" in */) ;; *) RAW="${RAW}/" ;; esac; fi && \
    printf '%s\n' "window.__CRONOMETRO_API_BASE__='${RAW}';" > /usr/share/nginx/html/api-config.js

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
