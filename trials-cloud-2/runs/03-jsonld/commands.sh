#!/usr/bin/env bash
# Trial 03-jsonld — every command run, in order. T = tool install root (scratchpad), R = runs dir, F = fixtures dir.
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/03-jsonld
R=/home/user/CLaude/trials-cloud-2/runs/03-jsonld
F=/home/user/CLaude/trials-cloud-2/fixtures/03-jsonld
# --- versions / licences looked up
npm view schema-dts version                       # -> 2.1.0 (brief said 1.x; latest is 2.1.0, used that)
npm view structured-data-testing-tool version license dependencies   # -> 4.5.0, ISC
npm view ajv@8.20.0 version license               # MIT
npm view ajv-formats version license              # 3.0.1 MIT
# --- installs (timed with date +%s.%N before/after; sizes with du -sm)
mkdir -p $T/ajv $T/sdtt && cd $T/ajv && echo '{"name":"t-ajv","private":true,"type":"module"}' > package.json
npm i --no-audit --no-fund ajv@8.20.0 ajv-formats@3.0.1 schema-dts@2.1.0      # 1.09 s, node_modules 4.2 MB (8 pkgs)
cd $T/sdtt && echo '{"name":"t-sdtt","private":true}' > package.json
npm i --no-audit --no-fund structured-data-testing-tool@4.5.0                  # 4.04 s, node_modules 15 MB (87 pkgs, core-js@2 deprecated warning)
# --- fixtures
cd $F && node gen.mjs                              # 12 HTML pages + KEY.json
# --- runs (ESM: node_modules symlinked next to the scripts)
ln -sfn $T/ajv/node_modules $R/node_modules
cd $R
node baseline.mjs $F/*.html > baseline.out.json                 # exit 0, 0 findings
node ajv-check.mjs $F/*.html > ajv-default.out.json             # exit 1, J2 J3 J4 J6
node ajv-check.mjs --claims $F/*.html > ajv-tuned.out.json      # exit 1, J1..J6
node sdtt-check.mjs $F/*.html > sdtt-default.out.json           # exit 0, nothing failed (auto mode)
node sdtt-check.mjs --google $F/*.html > sdtt-google.out.json   # exit 0, nothing failed (Google preset)
$T/sdtt/node_modules/.bin/sdtt --file $F/j3-price-symbol.html --presets Google -o sdtt-cli-j3.json   # prints PASS then "Unable to open file" exit 1 (CLI bug: -o references undefined `err.res`)
$T/sdtt/node_modules/.bin/sdtt --file $F/j3-price-symbol.html --presets Google                       # exit 0, 1 test passed, runs offline
$T/sdtt/node_modules/.bin/sdtt --url https://example.com/ --presets Google                           # "Unable to fetch content" exit 1
cd $T/sdtt && node -e "require('structured-data-testing-tool').structuredDataTest('https://example.com/').catch(e=>console.log(e.message))"  # request to https://example.com/ failed, reason: getaddrinfo ENOTFOUND example.com
# --- wrapper
cd $R && node wrapper-sketch.mjs $F/c*.html   # exit 0
node wrapper-sketch.mjs $F/j*.html            # exit 1
node wrapper-sketch.mjs /nonexistent.html     # exit 2
# --- evidence / timing
find $T/ajv/node_modules $T/sdtt/node_modules -name binding.gyp -o -name '*.node' | wc -l   # 0 -> pure JS
for s in baseline.mjs ajv-check.mjs "ajv-check.mjs --claims" sdtt-check.mjs "sdtt-check.mjs --google" wrapper-sketch.mjs; do for i in 1 2 3 4 5; do node $s $F/*.html >/dev/null 2>&1; done; done   # 5-run averages
# --- copy of the wrapper for the team (needs ajv@8.20.0 + ajv-formats@3.0.1 installed at repo root)
sed 's#./schema.json#./jsonld.schema.json#' $R/wrapper-sketch.mjs > /home/user/CLaude/trials-cloud-2/checks/jsonld.mjs; cp $R/schema.json /home/user/CLaude/trials-cloud-2/checks/jsonld.schema.json
