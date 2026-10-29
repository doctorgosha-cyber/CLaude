#!/usr/bin/env bash
# Trial 05-stylelint: every command run, in order. T = tool install dir, F = fixtures, R = runs.
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/05-stylelint
F=/home/user/CLaude/trials-cloud-2/fixtures/05-stylelint
R=/home/user/CLaude/trials-cloud-2/runs/05-stylelint

# 1. install (timed; 13.7 s, 19 MB node_modules, 103 packages, 0 native/.node files, no optionalDependencies)
mkdir -p $T && cd $T && echo '{"name":"stylelint-trial","private":true,"type":"module"}' > package.json
S=$(date +%s.%N); npm i stylelint@17.16.0 stylelint-config-standard@40.0.0 > install.log 2>&1; E=$(date +%s.%N); echo "install_seconds $(echo "$E - $S" | bc)"; du -sh node_modules
node -e 'const p=require("./node_modules/stylelint/package.json");console.log(p.name,p.version,p.license,JSON.stringify(p.optionalDependencies||{}),JSON.stringify(p.engines))'
find $T/node_modules -name '*.node' -o -name 'binding.gyp' | wc -l

# 2. fixtures: hand-written, see $F/*.css and $F/KEY.json (4 seeded files, 4 controls)

# 3. baseline (NEXUS lints no CSS today)
$R/baseline.sh > $R/baseline.json

# 4. candidate default: stylelint-config-standard, no changes (stylelint 16+/17 prints the report to STDERR and exits 2 on lint problems)
cd $F
for i in 1 2 3; do S=$(date +%s.%N); $T/node_modules/.bin/stylelint "**/*.css" --config $R/stylelintrc-default.json --config-basedir $T --formatter json 2> $R/default-run$i.json; echo "exit $?"; E=$(date +%s.%N); echo "default run$i $(echo "$E-$S"|bc)"; done
node $R/summarize.mjs $R/default-run1.json

# 5. candidate tuned: $R/stylelintrc-tuned.json
for i in 1 2 3; do S=$(date +%s.%N); $T/node_modules/.bin/stylelint "**/*.css" --config $R/stylelintrc-tuned.json --config-basedir $T --formatter json 2> $R/tuned-run$i.json; echo "exit $?"; E=$(date +%s.%N); echo "tuned run$i $(echo "$E-$S"|bc)"; done
node $R/summarize.mjs $R/tuned-run1.json

# 6. side experiment (scratch, not a fixture): canonical prefers-reduced-motion !important reset under the tuned config -> 4x declaration-no-important
mkdir -p $T/side   # file content: see $R/side-reduced-motion.txt header
cd $T/side && $T/node_modules/.bin/stylelint "*.css" --config $R/stylelintrc-tuned.json --config-basedir $T > $R/side-reduced-motion.txt 2>&1

# 7. wrapper (Node API) tested as checks/css.mjs from the install dir; clean = the 4 controls copied to $T/clean
mkdir -p $T/checks $T/clean && cp $R/wrapper-sketch.mjs $T/checks/css.mjs && cp $F/base.css $F/components.css $F/motion.css $F/figures.css $T/clean/
cd $T/clean && node $T/checks/css.mjs "*.css" $R/stylelintrc-tuned.json > $R/wrapper-clean.json; echo "wrapper clean exit $?"     # -> 0
cd $F && node $T/checks/css.mjs "**/*.css" $R/stylelintrc-tuned.json > $R/wrapper-seeded.json; echo "wrapper seeded exit $?"    # -> 1
cd $F && node $T/checks/css.mjs "**/*.css" /nonexistent.json > /dev/null; echo "wrapper bad-config exit $?"                      # -> 2
