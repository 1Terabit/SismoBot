# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Install dependencies first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data /app/logs

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
