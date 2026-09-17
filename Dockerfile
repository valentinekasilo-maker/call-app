# ==============================================================================
# Multi-Stage Dockerfile for Call App (Production on Render / Cloud)
# ==============================================================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and server/web workspace package manifests
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install dependencies for shared, server, and web
RUN npm install --workspace=@callapp/shared --workspace=@callapp/server --workspace=@callapp/web

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build shared library, frontend web, and backend server
RUN npm run build:render

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy root manifests and server workspace package
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/

# Install only production dependencies
RUN npm install --omit=dev --workspace=@callapp/server --workspace=@callapp/shared

# Copy compiled artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Expose port (Render automatically routes incoming traffic to $PORT)
EXPOSE 10000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-10000}/api/health || exit 1

# Start the unified Node.js server (serves REST API, Socket.io, and static Web UI)
CMD ["node", "apps/server/dist/server.js"]
