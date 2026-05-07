import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname);

export default defineConfig({
    root: rootDir,
    server: {
        port: 5173,
        strictPort: true,
        open: '/pages/index.html',
    },
    build: {
        outDir: path.resolve(rootDir, 'dist'),
        emptyOutDir: true,
        sourcemap: false,
        rollupOptions: {
            input: {
                index: path.resolve(rootDir, 'pages/index.html'),
                dashboard: path.resolve(rootDir, 'pages/dashboard.html'),
                bauhof: path.resolve(rootDir, 'pages/bauhof.html'),
                militaer: path.resolve(rootDir, 'pages/militaer.html'),
                missionen: path.resolve(rootDir, 'pages/missionen.html'),
                karte: path.resolve(rootDir, 'pages/karte.html'),
                forschungen: path.resolve(rootDir, 'pages/forschungen.html'),
                spionage: path.resolve(rootDir, 'pages/spionage.html'),
                geheimdienstzentrum: path.resolve(rootDir, 'pages/geheimdienstzentrum.html'),
            },
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
});
