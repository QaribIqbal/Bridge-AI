import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  external: ['electron'],
};

await build({
  ...shared,
  entryPoints: ['src/main/index.ts'],
  outfile: 'dist/main.js',
});

await build({
  ...shared,
  entryPoints: ['src/main/gemini.ts'],
  outfile: 'dist/gemini.js',
});

await build({
  ...shared,
  entryPoints: ['src/main/openai-stt.ts'],
  outfile: 'dist/openai-stt.js',
});

await build({
  ...shared,
  entryPoints: ['src/preload/preload.ts'],
  outfile: 'dist/preload.js',
});

await build({
  entryPoints: ['src/renderer/renderer.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'dist/renderer.js',
  sourcemap: true,
});

await cp('src/renderer/index.html', 'dist/index.html');
await cp('src/renderer/styles.css', 'dist/styles.css');
