#!/usr/bin/env bash
# Trial 04 (glTF): every command run, in order. T=scratchpad tools dir, F=fixtures, R=runs.
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools/gltf
F=/home/user/CLaude/trials-cloud/fixtures/04-gltf
R=/home/user/CLaude/trials-cloud/runs/04-gltf
GT=$T/node_modules/.bin/gltf-transform
# -- install (gltf-validator + @gltf-transform/cli were pre-installed: 16.1 s, 68 MB) --
cd $T && npm i --no-audit --no-fund three@0.186.1 pngjs@7.0.0 pixelmatch@8.0.0      # 1.6 s, node_modules 68 -> 109 MB
# -- fixtures (Khronos glTF-Sample-Assets, CC-BY-4.0 Cesium) --
B=https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main
curl -sSfL -o $F/clean/Box.glb $B/Models/Box/glTF-Binary/Box.glb
curl -sSfL -o $F/clean/BoxTextured.glb $B/Models/BoxTextured/glTF-Binary/BoxTextured.glb
for m in Box BoxTextured; do curl -sSfL -o $F/licences/$m.README.md $B/Models/$m/README.md; curl -sSfL -o $F/licences/$m.metadata.json $B/Models/$m/metadata.json; done
# (Duck.glb + README also fetched, then deleted: SCEA Shared Source licence, not CC)
node $F/make-corrupt.mjs                                                            # -> $F/seeded/C1..C5
# -- candidate: gltf-validator (npm lib via validateBytes; no CLI binary in the npm package) --
cd $R
node validate.mjs default validator-default.json $F/clean/Box.glb $F/clean/BoxTextured.glb $F/seeded/*.glb   # default options
node validate.mjs tuned   validator-tuned.json   $F/clean/Box.glb $F/clean/BoxTextured.glb $F/seeded/*.glb   # maxIssues 0 + severityOverrides
# -- baseline: three.js 0.186.1 GLTFLoader in headless Chromium 1194 (playwright-core 1.64.1, SwiftShader WebGL2) --
node render.mjs baseline-png $F/clean/Box.glb $F/clean/BoxTextured.glb $F/seeded/*.glb
# -- gltf-transform optimize: default (meshopt + auto texture recompress) and tuned (quantize + webp, no simplify) --
for m in Box BoxTextured; do
  $GT optimize $F/clean/$m.glb $R/optimized/$m.default.glb
  $GT optimize $F/clean/$m.glb $R/optimized/$m.tuned.glb --compress quantize --texture-compress webp --simplify false
done
$GT inspect $F/clean/BoxTextured.glb   # (and the 5 other files) -> inspect.log
node render.mjs optimized-png $R/optimized/Box.default.glb $R/optimized/Box.tuned.glb $R/optimized/BoxTextured.default.glb $R/optimized/BoxTextured.tuned.glb
for m in Box BoxTextured; do for v in default tuned; do node diff.mjs baseline-png/$m.png optimized-png/$m.$v.png diff-png/$m.$v.diff.png; done; done
node diff.mjs baseline-png/Box.png baseline-png/C3-index-oob.png diff-png/C3-vs-Box.diff.png
node diff.mjs baseline-png/Box.png baseline-png/C4-nan-position.png diff-png/C4-vs-Box.diff.png
node diff.mjs baseline-png/BoxTextured.png baseline-png/C5-wrong-mimetype.png diff-png/C5-vs-BoxTextured.diff.png
node validate.mjs default validator-optimized.json $R/optimized/*.glb              # optimised outputs still valid?
# -- wrapper sketch test (copied next to node_modules so `gltf-validator` resolves) --
cp wrapper-sketch.mjs $T/gltf-check-test.mjs && node $T/gltf-check-test.mjs $F/clean; echo exit=$?    # 0
node $T/gltf-check-test.mjs $F/seeded > wrapper-seeded.json; echo exit=$?                              # 1, failed=5
