// Seeded-defect fixture for the SSIM gate: a 400x400 fine random-noise image (deterministic LCG) that no lossy encoder
// can reproduce at site qualities (SSIM collapses), plus two controls copied from src/. Run: node gen_seeded.mjs
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const F = '/home/user/CLaude/trials-cloud-2/fixtures/06-images'; const W = 400, H = 400; const px = Buffer.alloc(W * H * 3); let s = 12345;
for (let i = 0; i < px.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; px[i] = s >> 23; }
fs.mkdirSync(path.join(F, 'seeded'), { recursive: true }); fs.mkdirSync(path.join(F, 'control'), { recursive: true });
await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(F, 'seeded', 'noise_fine.png'));
for (const f of ['flat_product_box.png', 'photo_chelsea.png']) { fs.copyFileSync(path.join(F, 'src', f), path.join(F, 'seeded', f)); fs.copyFileSync(path.join(F, 'src', f), path.join(F, 'control', f)); }
console.log('seeded + control written');
