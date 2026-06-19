FROM node:16-alpine

ARG GIT_SHA=unknown
ARG GIT_BRANCH=unknown

WORKDIR /app

RUN echo "========================================" && \
    echo " CRONOMETRO API build" && \
    echo " Git: ${GIT_BRANCH}@${GIT_SHA}" && \
    echo "========================================"

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV APP_BUILD_VERSION=${GIT_SHA}
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.version="${GIT_BRANCH}"

EXPOSE 8000

# Evita npm como PID 1 (mejor manejo de SIGTERM en Docker)
CMD ["node", "build/index.js"]
