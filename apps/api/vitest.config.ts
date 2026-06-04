import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import path from 'node:path'

const coreRoot = fileURLToPath(new URL('../../packages/core/src', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'stub-service-role-key',
      ANTHROPIC_API_KEY: 'stub-anthropic-key',
      AUTH_SECRET: 'stub-auth-secret',
      COOKIE_SECRET: 'stub-cookie-secret-32-chars-long-yes',
    },
  },
  resolve: {
    alias: [
      {
        find: 'server-only',
        replacement: fileURLToPath(new URL('../../packages/core/test/server-only-stub.ts', import.meta.url)),
      },
      {
        // @health/core/container → packages/core/src/container.ts (etc.)
        find: /^@health\/core\/(.+)$/,
        replacement: path.join(coreRoot, '$1.ts'),
      },
      {
        find: '@health/core',
        replacement: path.join(coreRoot, 'index.ts'),
      },
    ],
  },
})
