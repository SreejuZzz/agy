import { defineConfig } from 'vite'

export default defineConfig({
    base: '/agy/',
    build: {
        minify: 'esbuild',
        cssMinify: true,
        cssCodeSplit: true,
        sourcemap: false,
        target: 'esnext',
        // The Three.js chunk is ~505 kB minified (127 kB gzipped): the WebGL renderer itself,
        // which can't be split further. Warn only above that.
        chunkSizeWarningLimit: 560,
        rollupOptions: {
            output: {
                // Three.js and the animation libraries change rarely: separate files, cached on their own
                manualChunks: id => {
                    if (id.includes('node_modules/three')) return 'three';
                    if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
                },
            },
        },
    },
    esbuild: {
        drop: ['console', 'debugger'],
    }
})
