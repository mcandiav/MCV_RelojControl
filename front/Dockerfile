FROM node:16-alpine AS build

WORKDIR /app

# .env.production suele no ir en el ZIP de GitHub (gitignore). Sin esto, el build usa localhost y el navegador queda roto en HTTPS.
ARG VUE_APP_API_URL=https://reloj-api.at-once.cl/
ENV VUE_APP_API_URL=$VUE_APP_API_URL

COPY package*.json ./
RUN npm install

COPY . .

ARG VUE_APP_STATION_ID=default-station
ENV VUE_APP_STATION_ID=$VUE_APP_STATION_ID

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
