import { mkdir, readdir, copyFile } from 'node:fs/promises';
await mkdir('public/ort',{recursive:true});
for (const name of await readdir('node_modules/onnxruntime-web/dist')) {
  if (name.endsWith('.wasm') || name.startsWith('ort-wasm') && name.endsWith('.mjs') || name==='ort.webgpu.min.mjs') await copyFile(`node_modules/onnxruntime-web/dist/${name}`,`public/ort/${name}`);
}
console.log('Local ONNX Runtime WASM assets ready');
