FROM node:16-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# NO declarar ARG/ENV de VUE_APP_API_URL vacío: si EasyPanel no pasa --build-arg,
# sobreescribe .env.production y el bundle queda con localhost:8000 (regresión ya vista en 417466d).
# La URL de producción sale de front/.env.production (reloj-api.at-once.cl).
ARG VUE_APP_STATION_ID=default-station
ENV VUE_APP_STATION_ID=$VUE_APP_STATION_ID

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
