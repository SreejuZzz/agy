import { defineConfig } from 'vite'

export default defineConfig({
    base: '/agy/',
    build: {
        minify: 'esbuild',
        cssMinify: true,
        cssCodeSplit: true,
        sourcemap: false,
        target: 'esnext',
    },
    esbuild: {
        drop: ['console', 'debugger'],
    }
})
