/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the same build is served from GitHub Pages under /payproof/app/
// and later from DeWEB. Routes are hash routes, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
