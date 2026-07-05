/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Single source of truth: load env from the repo root .env, not frontend/.
  const envDir = '..';
  const env = loadEnv(mode, envDir, 'VITE_');
  if (!env.VITE_API_URL) {
    throw new Error('VITE_API_URL is not set in .env');
  }

  // Dev only: serve API on the same origin as the app so prod's relative
  // /api works unchanged and no CORS is needed.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET;
  const proxy = proxyTarget
    ? {
        '/api': { target: proxyTarget, changeOrigin: false },
        '/ws': { target: proxyTarget, changeOrigin: false, ws: true },
      }
    : undefined;

  return {
    envDir,
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    server: {
      host: true,
      port: 5173,
      proxy,
      watch: { usePolling: true },  // bind-mount on Windows needs polling for HMR
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
    },
  };
});
