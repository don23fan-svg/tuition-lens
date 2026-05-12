import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: When deploying to GitHub Pages at username.github.io/tuition-lens,
// the 'base' must match the repository name. If you rename the repo, update this.
export default defineConfig({
  plugins: [react()],
  base: '/tuition-lens/',
});
