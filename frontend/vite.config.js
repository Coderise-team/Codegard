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
  // /api works unchanged and no CORS is needed. /media is uploaded files
  // (avatars): locally Django hands them out, in prod they live in R2 and the
  // urls point straight at the bucket, so nothing proxies them there.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET;
  const proxy = proxyTarget
    ? {
        '/api': { target: proxyTarget, changeOrigin: false },
        '/media': { target: proxyTarget, changeOrigin: false },
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
      watch: { usePolling: true }, // bind-mount on Windows needs polling for HMR
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      coverage: {
        provider: 'v8',
        // lcov is what a coverage service reads; text is for the terminal.
        reporter: ['text', 'lcov'],
        // Count everything shipped, not only the files a test happened to
        // import — otherwise an untested component simply goes unmentioned.
        include: ['src/**/*.{js,jsx}'],
        // The view layer is left out on purpose: files that only turn props
        // into markup have nothing to assert line by line, and their sheer
        // length would drown the number that matters. Behaviour still gets
        // tested through the components that own state.
        exclude: [
          'src/**/*.test.{js,jsx}',
          'src/test/**',
          'src/main.jsx',
          'src/router.jsx',
          'src/data/**',
          'src/components/dashboard/**',
          'src/components/problems/**',
          'src/components/contests/PastRow.jsx',
          'src/components/profile/ProfileRing.jsx',
          'src/components/problem/LangSelect.jsx',
          'src/components/problem/ActionBar.jsx',
          'src/components/problem/CodeEditor.jsx',
          'src/components/problem/ProblemPanel.jsx',
          'src/components/problem/ProblemWorkspace.jsx',
          'src/components/problem/SoloTopbar.jsx',
          'src/components/problem/VerdictToast.jsx',
          'src/components/problem/bits.jsx',
          'src/pages/ContestsPage.jsx',
          'src/pages/Dashboard.jsx',
          'src/pages/ProblemPage.jsx',
          'src/pages/ProblemsPage.jsx',
          'src/pages/ProfilePage.jsx',
        ],
      },
    },
  };
});
