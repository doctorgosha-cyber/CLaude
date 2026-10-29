#!/usr/bin/env bash
# Every command run for trial 02-patterns (ast-grep vs Semgrep CE), in order. Paths are absolute to this environment.
set -x
TOOLS=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/02-patterns
F=/home/user/CLaude/trials-cloud-2/fixtures/02-patterns
R=/home/user/CLaude/trials-cloud-2/runs/02-patterns
SG=$TOOLS/astgrep/node_modules/.bin/ast-grep
SEM=$TOOLS/semgrep/venv/bin/semgrep

# --- installs (timed with date +%s.%N before/after; sizes with du -sh) ---
mkdir -p $TOOLS/astgrep $TOOLS/semgrep $F $R
cd $TOOLS/astgrep && echo '{"name":"astgrep-trial","private":true}' > package.json && npm i @ast-grep/cli@0.51.0 --no-audit --no-fund   # 3.99 s, node_modules 106M
cd $TOOLS/semgrep && python3 -m venv venv && venv/bin/pip install -q semgrep==1.182.1                                        # 219.7 s (venv + download), venv 369M
# Windows wheel check (result: win_amd64 wheel EXISTS, 59 MB, contains semgrep-core.exe + DLLs)
$TOOLS/semgrep/venv/bin/pip download --only-binary=:all: --platform win_amd64 --no-deps semgrep==1.182.1 -d $TOOLS/winwheel
python3 -I -c "import zipfile;z=zipfile.ZipFile('$TOOLS/winwheel/semgrep-1.182.1-cp310.cp311.cp312.cp313.cp314.py310.py311.py312.py313.py314-none-win_amd64.whl');print([n for n in z.namelist() if '/bin/' in n])"

# --- fixtures ---
$F/gen.sh            # writes 12 files under $F/theme (8 seeded S1..S8, 4 controls C1..C4); KEY.json written by hand

# --- baseline (grep for literal forms) ---
cd $F/theme && $R/baseline.sh . | tee $R/baseline.out     # exit 1, 0.03 s

# --- ast-grep defaults (ad-hoc patterns, no config) ---
cd $F/theme && SG=$SG $R/astgrep-default.sh . > $R/astgrep-default.json          # 0.10 s (8 spawns)
# AST dumps used while writing constraints:
$SG run -p '$wpdb->query( "DELETE FROM $t WHERE id = $id" );' -l php --debug-query=ast $F/theme/inc/cleanup.php
$SG run -p 'el.innerHTML = `<b>${user}</b> rated`' -l js --debug-query=ast $F/theme
$SG run -p "window['ev' + 'al'](code)" -l js --debug-query=ast $F/theme
$SG run -p '$wpdb->query($SQL)' -l php --debug-query=cst $F/theme/inc/cleanup.php

# --- ast-grep tuned (sgconfig.yml + rules/*.yml in $R/astgrep) ---
cd $F/theme && $SG scan -c $R/astgrep/sgconfig.yml --json=compact . > $R/astgrep-tuned.json   # exit 1, 0.013-0.02 s

# --- semgrep: registry blocked (recorded once) ---
cd $F/theme && $SEM --config p/javascript --metrics=off . > $R/semgrep-registry.err 2>&1       # exit 2, ProxyError 403
cd $F/theme && $SEM --config auto --metrics=off --quiet .                                       # exit 2: "Cannot create auto config when metrics are off"

# --- semgrep defaults (plain local rules) ---
cd $F/theme && $SEM --config $R/semgrep/rules-default.yml --metrics=off --json -o $R/semgrep-default.json .   # 98.8 s (!) version check hangs on blocked proxy
cd $F/theme && SEMGREP_ENABLE_VERSION_CHECK=0 $SEM --config $R/semgrep/rules-default.yml --metrics=off --disable-version-check --json -o $R/semgrep-default.json .   # 1.8 s

# --- semgrep tuned (pattern-not / metavariable-regex / taint) ---
cd $F/theme && SEMGREP_ENABLE_VERSION_CHECK=0 $SEM --config $R/semgrep/rules-tuned.yml --metrics=off --disable-version-check --json -o $R/semgrep-tuned.json .   # 1.9 s
# (two iterations: '(int) ...' and '"..." . ...' are invalid PHP patterns -> removed; metavariable-regex on an
#  interpolated PHP string never matched -> SQL rule rewritten as taint from function parameters)

# --- wrapper tests ---
cd $F/theme && AST_GREP=$SG PATTERNS_RULES=$R/astgrep node $R/wrapper-sketch.mjs .                                                                   # exit 1 (10 findings)
cd $F/theme && AST_GREP=$SG PATTERNS_RULES=$R/astgrep node $R/wrapper-sketch.mjs search-safe.php assets/js/figure-safe.js inc/queries-safe.php assets/js/timers-safe.js   # exit 0
cd $F/theme && AST_GREP=/nonexistent PATTERNS_RULES=$R/astgrep node $R/wrapper-sketch.mjs .                                                           # exit 2
