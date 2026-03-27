FROM node:16-alpine AS build

WORKDIR /app/front

ARG VUE_APP_API_URL=https://reloj-api.at-once.cl/
ARG VUE_APP_BUILD_PATH=test

COPY front/package*.json ./
RUN npm install

COPY front/ ./

RUN API_URL="${VUE_APP_API_URL:-https://reloj-api.at-once.cl/}" && \
    export VUE_APP_API_URL="$API_URL" && \
    BUILD_PATH="${VUE_APP_BUILD_PATH:-test}" && \
    export VUE_APP_BUILD_PATH="$BUILD_PATH" && \
    echo ">>> test build con VUE_APP_API_URL=$VUE_APP_API_URL, VUE_APP_BUILD_PATH=$VUE_APP_BUILD_PATH" && \
    npm run build

FROM nginx:alpine

ARG VUE_APP_API_URL=https://reloj-api.at-once.cl/
ARG VUE_APP_BUILD_PATH=test

COPY --from=build /app/front/dist /usr/share/nginx/html
COPY test/nginx.conf /etc/nginx/conf.d/default.conf

RUN RAW="${VUE_APP_API_URL:-https://reloj-api.at-once.cl/}" && \
    case "$RAW" in */) ;; *) RAW="${RAW}/" ;; esac && \
    printf '%s\n' "window.__CRONOMETRO_API_BASE__='${RAW}';" > /usr/share/nginx/html/api-config.js

RUN BUILD_PATH="${VUE_APP_BUILD_PATH:-test}" && \
    printf '%s\n' "window.__CRONOMETRO_BUILD_PATH__='${BUILD_PATH}';" > /usr/share/nginx/html/build-config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
