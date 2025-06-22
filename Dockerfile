# ──────────────────────────────────────────────────────────────────────────────
# Builder stage
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

# Copy LICENSE file.
COPY LICENSE ./

# Copy package manifests.
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/core/package*.json   ./packages/core/
COPY packages/frontend/package*.json ./packages/frontend/

# Install dependencies.
RUN npm install

# Copy source files.
COPY tsconfig.*json ./
COPY packages/server   ./packages/server
COPY packages/core     ./packages/core/
COPY packages/frontend ./packages/frontend
COPY scripts           ./scripts

# Install git temporarily to generate commit hash.
RUN apk add --no-cache git

# Generate metadata.json
RUN npm run metadata

# ─── Ensure metadata.json is bundled into the server build ────────────────────
RUN mkdir -p packages/server/resources \
 && cp resources/metadata.json packages/server/resources/metadata.json

# Remove git to reduce image size.
RUN apk del git

# Build the project.
RUN npm run build

# Remove development dependencies.
RUN npm --workspaces prune --omit=dev


# ──────────────────────────────────────────────────────────────────────────────
# Final stage
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS final

WORKDIR /app

# Copy the built files from builder.
COPY --from=builder /build/package*.json /build/LICENSE ./

COPY --from=builder /build/packages/core/package.*json     ./packages/core/
COPY --from=builder /build/packages/frontend/package.*json ./packages/frontend/
COPY --from=builder /build/packages/server/package.*json   ./packages/server/

COPY --from=builder /build/packages/core/dist    ./packages/core/dist
COPY --from=builder /build/packages/frontend/out ./packages/frontend/out
COPY --from=builder /build/packages/server/dist ./packages/server/dist

# Grab the generated resources folder (including metadata.json)
COPY --from=builder /build/resources ./resources

# Copy node_modules from builder.
COPY --from=builder /build/node_modules ./node_modules

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/v1/status || exit 1

EXPOSE ${PORT:-3000}

ENTRYPOINT ["npm", "run", "start"]
