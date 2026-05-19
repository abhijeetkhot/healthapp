import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    alias: {
      // `server-only` throws on import outside a server context — fine in
      // prod (catches client-bundle leaks) but breaks vitest's node env.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/infrastructure/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
