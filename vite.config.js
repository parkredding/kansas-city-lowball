import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Plugin to generate version.json on build for cache busting
function versionPlugin() {
  return {
    name: 'version-plugin',
    buildStart() {
      const version = {
        version: Date.now().toString(),
        buildTime: new Date().toISOString()
      }
      writeFileSync(
        resolve(__dirname, 'public/version.json'),
        JSON.stringify(version, null, 2)
      )
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  base: '/kansas-city-lowball/',
  build: {
    // Ensure unique filenames with content hash
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
