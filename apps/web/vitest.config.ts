import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Stub Supabase modules that depend on Next.js runtime (cookies, headers)
      // These MUST come before the general '@' alias to take precedence
      '@/lib/supabase/client': path.resolve(__dirname, './src/lib/supabase/__mocks__/client.ts'),
      '@/lib/supabase/server': path.resolve(__dirname, './src/lib/supabase/__mocks__/server.ts'),
      // General path alias (matches tsconfig paths)
      '@': path.resolve(__dirname, './src'),
      // Monorepo package aliases
      '@readyboard/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@readyboard/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
