import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), cesium()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Keep default warning; we intentionally split heavy 3D vendors
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // React core — loaded on every route
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('react-router')) return 'vendor-router';
            // Three.js stack — only needed for Sky / Solar System
            if (
              id.includes('node_modules/three') ||
              id.includes('@react-three/fiber') ||
              id.includes('@react-three/drei') ||
              id.includes('three-mesh-bvh') ||
              id.includes('troika-') ||
              id.includes('meshoptimizer')
            ) {
              return 'vendor-three';
            }
            // Animation library
            if (id.includes('node_modules/motion') || id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // Satellite propagation
            if (id.includes('satellite.js') || id.includes('satellite/')) {
              return 'vendor-satellite';
            }
            // Firebase (currently light usage)
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'vendor-firebase';
            }
            // Markdown / icons are small but can group with remaining vendor
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
