import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

await mkdir('dist',{recursive:true});
await build({
  entryPoints:['src/content/main.mjs'],outfile:'dist/content.js',
  bundle:true,format:'iife',platform:'browser',target:['chrome120'],
  minify:true,legalComments:'none',logLevel:'info'
});
const cssBin=resolve('node_modules','.bin',
  process.platform==='win32'?'tailwindcss.cmd':'tailwindcss');
const css=spawnSync(cssBin,
  ['-i','src/app/workspace.css','-o','dist/content.css','--minify'],
  {stdio:'inherit',shell:process.platform==='win32'});
if(css.status!==0) throw new Error('Tailwind CSS build failed.');
await copyFile('manifest.json','dist/manifest.json');
await build({
  entryPoints:['src/extension/background.mjs'],outfile:'dist/background.js',
  bundle:true,format:'iife',platform:'browser',target:['chrome120'],
  minify:true,legalComments:'none',logLevel:'info'
});
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
if(manifest.content_scripts[0].js[0]!=='content.js')throw new Error('Manifest build output mismatch');
console.log('dist/ ready for Chrome Load unpacked. No runtime Tailwind or remote JS.');
