import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → dist/ (index.html + assets) for S3 / CloudFront or any web host
// `npm run build:mobile` → dist-mobile/ (opens straight into the mobile app; packaged by ../mobile with Capacitor)
// `npm run build:single` → dist-single/index.html (one self-contained file, used for the test web link)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  define: mode === 'mobile' ? { 'import.meta.env.VITE_TARGET': JSON.stringify('mobile') } : {},
  build: { outDir: mode === 'single' ? 'dist-single' : mode === 'mobile' ? 'dist-mobile' : 'dist', chunkSizeWarningLimit: 2000 }
}));
