# Image unique : construit la PWA puis la sert avec le serveur de synchronisation.
FROM node:22-alpine AS build
WORKDIR /src/app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data STATIC_DIR=/srv/app
WORKDIR /srv
COPY server/ ./server/
COPY --from=build /src/app/dist /srv/app
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://localhost:8080/health || exit 1
USER node
CMD ["node", "--no-warnings", "server/index.mjs"]
