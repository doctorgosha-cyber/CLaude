#!/usr/bin/env node
// Deterministically produce 5 corrupted GLBs from the clean Khronos samples.
// Usage: node make-corrupt.mjs  (run from fixtures/04-gltf or pass its path as argv[2])
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
const JSON_T = 0x4e4f534a, BIN_T = 0x004e4942;

function readGlb(p) {
  const b = readFileSync(p);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + p);
  const chunks = []; let o = 12;
  while (o < b.length) {
    const len = b.readUInt32LE(o), type = b.readUInt32LE(o + 4);
    chunks.push({ type, data: Buffer.from(b.subarray(o + 8, o + 8 + len)) }); o += 8 + len;
  }
  const json = JSON.parse(chunks.find(c => c.type === JSON_T).data.toString('utf8'));
  const bin = chunks.find(c => c.type === BIN_T).data;
  return { json, bin };
}
function writeGlb(p, json, bin, binType = BIN_T) {
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - js.length % 4, 0x20)]);
  if (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(4 - bin.length % 4, 0)]);
  const total = 12 + 8 + js.length + 8 + bin.length;
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(JSON_T, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(binType, 4);
  writeFileSync(p, Buffer.concat([h, c1, js, c2, bin]));
}
const out = join(root, 'seeded'); mkdirSync(out, { recursive: true });
const box = () => readGlb(join(root, 'clean', 'Box.glb'));
const tex = () => readGlb(join(root, 'clean', 'BoxTextured.glb'));

// C1: accessor count larger than its bufferView can hold (POSITION accessor 2: 24 -> 100)
{ const { json, bin } = box(); json.accessors[2].count = 100; writeGlb(join(out, 'C1-accessor-count.glb'), json, bin); }
// C2: indices accessor references a bufferView that does not exist (0 -> 7; only 2 exist)
{ const { json, bin } = box(); json.accessors[0].bufferView = 7; writeGlb(join(out, 'C2-missing-bufferview.glb'), json, bin); }
// C3: index out of range: 6th uint16 index in the BIN (bufferView 0 @576) set to 999 (24 vertices exist)
{ const { json, bin } = box(); const bv = json.bufferViews[json.accessors[0].bufferView]; bin.writeUInt16LE(999, bv.byteOffset + 5 * 2); writeGlb(join(out, 'C3-index-oob.glb'), json, bin); }
// C4: NaN in POSITION: x of vertex 3 (accessor 2 @ bufferView 1 offset 288, stride 12)
{ const { json, bin } = box(); const a = json.accessors[2], bv = json.bufferViews[a.bufferView]; bin.writeFloatLE(NaN, bv.byteOffset + a.byteOffset + 3 * bv.byteStride); writeGlb(join(out, 'C4-nan-position.glb'), json, bin); }
// C5: image declares image/jpeg but the embedded bytes are a PNG
{ const { json, bin } = tex(); json.images[0].mimeType = 'image/jpeg'; writeGlb(join(out, 'C5-wrong-mimetype.glb'), json, bin); }
console.log('wrote 5 seeded files to', out);
