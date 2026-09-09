# ══════════════════════════════════════════════════════════════════════════════
# Dockerfile — url-shortener
# ══════════════════════════════════════════════════════════════════════════════
# Plain Node/Express app, no build step (no TypeScript/webpack).
# Single-stage is enough here — nothing to compile away.

FROM node:20-alpine

WORKDIR /app

# Patch Alpine OS packages — resolves known CVEs with fixes already
# published in this Alpine branch (caught by Trivy's OS-package scan).
RUN apk update && apk upgrade --no-cache

# Install deps first so this layer is cached unless package*.json changes.
COPY package*.json ./
RUN npm ci --omit=dev \
  # The npm CLI itself ships bundled inside the node:20-alpine base image,
  # with its OWN vulnerable sub-dependencies (tar, minimatch, glob,
  # brace-expansion, cross-spawn, etc. — this is what Trivy was actually
  # flagging, not your app's dependencies). It's only needed to run `npm
  # ci` above — the running container never needs to invoke `npm` itself
  # (see CMD below), so remove it now and those CVEs go with it.
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

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

# Invoking node directly rather than `npm start` — npm's been removed
# from this image (see above), and it was never needed at runtime anyway.
# ⚠️ Assumes package.json's start script is just `node server.js` — this
# app has no build step, so that should hold; adjust if it's different.
CMD ["node", "server.js"]
