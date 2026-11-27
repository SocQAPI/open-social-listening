# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 OSL_DISABLE_SCHEDULER=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/osl.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# The libsql driver loads its native binding by computed name, which output tracing cannot follow.
COPY --from=build /app/node_modules/libsql ./node_modules/libsql
COPY --from=build /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=build /app/node_modules/@neon-rs ./node_modules/@neon-rs
COPY --from=build /app/node_modules/detect-libc ./node_modules/detect-libc
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]
EXPOSE 3000
# The container starts as root only to hand /app/data to the unprivileged `node` user: a bind mount such as
# ./data is created by Docker as root, and node could not write the database there. The server itself always
# runs as node. Started with --user, the container skips the hand-over.
CMD ["sh", "-c", "if [ \"$(id -u)\" = 0 ]; then chown -R node:node /app/data && exec setpriv --reuid=node --regid=node --init-groups node server.js; else exec node server.js; fi"]
