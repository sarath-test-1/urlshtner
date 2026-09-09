# ══════════════════════════════════════════════════════════════════════════════
# Dockerfile — url-shortener
# ══════════════════════════════════════════════════════════════════════════════
# Plain Node/Express app, no build step (no TypeScript/webpack).
# Single-stage is enough here — nothing to compile away.

FROM node:26-alpine

WORKDIR /app

# Install deps first so this layer is cached unless package*.json changes.
COPY package*.json ./
RUN npm ci --omit=dev

# Now bring in the rest of the source.
COPY . .

# Run as a non-root user — small security best practice, cheap to add.
# The app writes rotating logs to ./logs at runtime (winston-daily-rotate-
# file), so that directory needs to exist and be owned by appuser BEFORE
# we switch to it — otherwise mkdir('/app/logs') fails with EACCES.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && mkdir -p /app/logs \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

# Container-level health check, mirrors the app's own /health endpoint.
# (busybox wget ships with alpine — no need to install curl.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["npm", "start"]