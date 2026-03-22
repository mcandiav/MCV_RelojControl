FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8000

# Evita npm como PID 1 (mejor manejo de SIGTERM en Docker)
CMD ["node", "build/index.js"]
