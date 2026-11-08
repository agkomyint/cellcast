import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

// Pinned exports, with upstream provenance and licenses attached to the release.
const base = 'https://api.github.com/repos/agkomyint/cellcast/releases/assets';
const models = [
  { name: 'scplant.onnx', assetId: 723589554, sha256: 'da47b9fb7414e9701049882e7fa19fe2bb720b0519100c2227b9f5eeb4578f7a' },
  { name: 'scgpt.onnx', assetId: 723589551, sha256: 'ee54dd68c67dd0a543794b816a2c6fa509f05f0625ce128e051f4732a7db3fea' },
];
await mkdir('public/models', { recursive: true });
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
for (const model of models) {
  const destination = `public/models/${model.name}`;
  const existing = await readFile(destination).catch(() => undefined);
  if (existing && hash(existing) === model.sha256) {
    console.log(`${model.name}: verified local export`);
    continue;
  }
  console.log(`Downloading pinned ${model.name} export`);
  let bytes: Uint8Array | undefined;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(`${base}/${model.assetId}`, {
        headers: { Accept: 'application/octet-stream' },
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok) throw new Error(`download returned ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      console.log(`${model.name}: retrying download (${attempt}/4)`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  if (!bytes) throw new Error(`${model.name}: download failed`);
  if (hash(bytes) !== model.sha256) throw new Error(`${model.name}: SHA-256 mismatch; refusing to deploy`);
  const temporary = `${destination}.download`;
  await writeFile(temporary, bytes);
  await rm(destination, { force: true });
  await rename(temporary, destination);
  console.log(`${model.name}: SHA-256 verified`);
}
