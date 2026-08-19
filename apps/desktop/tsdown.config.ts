import { defineConfig } from 'tsdown'

/** Build the Electron main process as an ESM Node entry. */
export default defineConfig({
  entry: ['lib/types/main.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  deps: { neverBundle: ['electron'] },
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})