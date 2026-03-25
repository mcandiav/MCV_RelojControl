FROM node:16-alpine AS build

WORKDIR /app

# Si EasyPanel deja el build-arg vacío, Docker pisa el default y Vue termina con localhost → desde HTTPS del front = mixed content = "Network Error" instantáneo.
ARG VUE_APP_API_URL=https://reloj-api.at-once.cl/

COPY package*.json ./
RUN npm install

COPY . .

RUN API_URL="${VUE_APP_API_URL:-https://reloj-api.at-once.cl/}" && \
    export VUE_APP_API_URL="$API_URL" && \
    echo ">>> npm run build con VUE_APP_API_URL=$VUE_APP_API_URL" && \
    npm run build

FROM nginx:alpine

ARG VUE_APP_API_URL=https://reloj-api.at-once.cl/

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Prioridad sobre el bundle: el navegador carga /api-config.js antes del JS (main.js lee window.__CRONOMETRO_API_BASE__).
RUN RAW="${VUE_APP_API_URL:-https://reloj-api.at-once.cl/}" && \
    case "$RAW" in */) ;; *) RAW="${RAW}/" ;; esac && \
    printf '%s\n' "window.__CRONOMETRO_API_BASE__='${RAW}';" > /usr/share/nginx/html/api-config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
