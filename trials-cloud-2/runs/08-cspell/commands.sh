#!/usr/bin/env bash
# 08-cspell — every command run, in order. T = tool install dir, R = runs dir, F = fixtures dir.
set -x
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/08-cspell
R=/home/user/CLaude/trials-cloud-2/runs/08-cspell
F=/home/user/CLaude/trials-cloud-2/fixtures/08-cspell
mkdir -p $F $R $T

# 1. package discovery (versions, licences, sizes)
for p in cspell @cspell/dict-es-es @cspell/dict-pt-br @cspell/dict-pt-pt @cspell/dict-fr-fr @cspell/dict-de-de @cspell/dict-ru-ru @cspell/dict-uk-ua @cspell/dict-id-id @cspell/dict-en_us; do npm view "$p" version license dist.unpackedSize; done
npm search --json "cspell dict ru"     # -> Russian package is @cspell/dict-ru_ru (underscore), not dict-ru-ru
npm view @cspell/dict-ru_ru version license description

# 2. install (timed)
cd $T && echo '{"name":"tools2-08-cspell","private":true}' > package.json
T0=$(date +%s.%N); npm i --no-audit --no-fund cspell@10.4.0 @cspell/dict-es-es@3.0.9 @cspell/dict-pt-br@2.4.4 @cspell/dict-fr-fr@2.3.2 @cspell/dict-de-de@4.1.3 @cspell/dict-ru_ru@2.3.4 @cspell/dict-uk-ua@4.0.7 @cspell/dict-id-id@1.0.9; T1=$(date +%s.%N); echo "$T1 - $T0" | bc   # 5.82 s
du -sm node_modules   # 29 MB
npx cspell --version  # 10.4.0
for d in node_modules/@cspell/dict-*; do printf "%s %s %s\n" "$(basename $d)" "$(node -p "require('./$d/package.json').version")" "$(node -p "require('./$d/package.json').license")"; done
for d in dict-es-es dict-pt-br dict-fr-fr dict-de-de dict-ru_ru dict-uk-ua dict-id-id; do cat node_modules/@cspell/$d/cspell-ext.json; grep -i -E "licen|hunspell|GPL" node_modules/@cspell/$d/README.md; done

# 3. fixtures (generator writes 10 files + KEY.json)
cd $F && node gen.mjs

# 4. baseline (nothing automated today)
$R/baseline.sh > $R/baseline-output.txt

# 5. candidate default / tuned, 3 timed runs each (output saved from the last run)
cd $F
for cfg in default tuned; do for i in 1 2 3; do a=$(date +%s.%N); $T/node_modules/.bin/cspell --no-progress --no-color --config $R/config-$cfg/cspell.json "**/*.{srt,html}" > $R/cspell-$cfg.txt 2>&1; echo "exit=$? $(echo "$(date +%s.%N) - $a" | bc) s"; done; done
node $R/measure.mjs $R/cspell-default.txt $F/KEY.json > $R/score-default.json
node $R/measure.mjs $R/cspell-tuned.txt $F/KEY.json > $R/score-tuned.json

# 6. variant probe: minWordLength 5 (not adopted, see result.json)
sed 's/"minWordLength": 4/"minWordLength": 5/' $R/config-tuned/cspell.json > $T/cspell-mwl5.json; cp $R/config-tuned/cspell-words.txt $T/
$T/node_modules/.bin/cspell --no-progress --no-color --config $T/cspell-mwl5.json "**/*.{srt,html}"

# 7. startup / per-file timing probes, Windows evidence
a=$(date +%s.%N); $T/node_modules/.bin/cspell --version >/dev/null; echo "$(date +%s.%N) - $a" | bc
a=$(date +%s.%N); $T/node_modules/.bin/cspell --no-progress --no-color --config $R/config-tuned/cspell.json thermos-en.srt >/dev/null; echo "$(date +%s.%N) - $a" | bc
a=$(date +%s.%N); $T/node_modules/.bin/cspell --no-progress --no-color --config $R/config-tuned/cspell.json thermos-uk.srt >/dev/null; echo "$(date +%s.%N) - $a" | bc
find $T/node_modules -name "*.node"   # none -> pure JS
node -e "const p=require('$T/node_modules/cspell/package.json');console.log(p.os,p.cpu,p.optionalDependencies,JSON.stringify(p.engines))"
$T/node_modules/.bin/cspell lint --help | grep -i -A1 -E "report|quiet|json"
$T/node_modules/.bin/cspell lint --no-progress --no-color --quiet --config /nonexistent.json "**/*.srt"; echo "exit=$?"   # exit 1 + "Configuration Error" on stderr

# 8. wrapper tests (run from a dir whose node_modules has cspell; --root points at the fixtures)
cd $T
node $R/wrapper-sketch.mjs --root $F --config $R/config-tuned/cspell.json "switch-fr.srt" "site-de.html" "site-es.html" > $R/wrapper-clean.json; echo "exit=$?"   # 0
node $R/wrapper-sketch.mjs --root $F --config $R/config-tuned/cspell.json > $R/wrapper-seeded.json; echo "exit=$?"   # 1
node $R/wrapper-sketch.mjs --root $F --config /nonexistent.json; echo "exit=$?"   # 2
node $R/wrapper-sketch.mjs --root $F --config $R/config-tuned/cspell.json "**/*.nothing"; echo "exit=$?"   # 2
cd $F && node $R/wrapper-sketch.mjs --root $F --config $R/config-tuned/cspell.json; echo "exit=$?"   # 2 (no cspell in this dir's node_modules)

# 9. probe: dual-locale masking ("es,en" in tuned config hides a Spanish typo that happens to be an English word)
P=$T/probe-dual; mkdir -p $P; sed 's/capa de cobre/capa de cover/' $F/thermos-es.srt > $P/thermos-es.srt; cd $P
$T/node_modules/.bin/cspell --no-progress --no-color --config $R/config-default/cspell.json thermos-es.srt   # flags "cover"
$T/node_modules/.bin/cspell --no-progress --no-color --config $R/config-tuned/cspell.json thermos-es.srt     # does NOT flag "cover"
