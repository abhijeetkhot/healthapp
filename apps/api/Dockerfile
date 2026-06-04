FROM node:24-slim

# Enable corepack so pnpm is available
RUN corepack enable

WORKDIR /app

# Copy workspace manifest files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./

# Copy package manifests for all packages (for dependency hoisting)
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/

# Install dependencies (frozen — uses pnpm-lock.yaml if present)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/core/ ./packages/core/
COPY apps/api/ ./apps/api/

EXPOSE 3001

CMD ["pnpm", "--filter", "@health/api", "start"]
