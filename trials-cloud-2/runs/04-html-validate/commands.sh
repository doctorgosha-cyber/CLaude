#!/bin/sh
# Trial 04-html-validate — every command run, in order. Paths are absolute to this environment.
set -x
# --- install (scratchpad only) ---
mkdir -p /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate && cd /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate
echo '{"name":"t04","private":true,"type":"module"}' > package.json
date +%s.%N; npm i html-validate@11.17.0; date +%s.%N        # 14.25 s, node_modules 13 MB, 12 packages
du -sm node_modules
# list of presets' enabled rules (for the report)
html-validate --preset recommended --print-config x.html
html-validate --preset standard --print-config x.html
# --- fixtures: hand-written, see /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/KEY.json (6 seeded + 4 clean) ---
# --- baseline (nothing is run today) ---
/home/user/CLaude/trials-cloud-2/runs/04-html-validate/baseline.sh /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded/*.html /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean/*.html > /home/user/CLaude/trials-cloud-2/runs/04-html-validate/baseline.json
# --- candidate: defaults (recommended preset) ---
date +%s.%N; /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate --preset recommended -f json /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean > /home/user/CLaude/trials-cloud-2/runs/04-html-validate/default-recommended.json; date +%s.%N   # exit 1, 0.77 s (re-runs 0.86-0.88 s)
# --- also measured: standard preset (fewer rules) ---
/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate --preset standard -f json /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean > /home/user/CLaude/trials-cloud-2/runs/04-html-validate/preset-standard.json   # exit 1, 0.63 s
# --- probes used to design the tuned config (not counted in metrics) ---
# (a) custom element metadata making alt required on <img> regardless of accessibility tree -> catches H3
/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate -c /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/probe-A.json -f json /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded/H3-figure-hidden-img-noalt.html /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean
# (b) WordPress-style output probe to observe which stylistic rules fire on typical WP/theme markup
/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate --preset recommended -f json /home/user/CLaude/trials-cloud-2/runs/04-html-validate/probe-wp-style.html
# --- candidate: tuned (/home/user/CLaude/trials-cloud-2/runs/04-html-validate/htmlvalidate.tuned.json + elements-img-alt.json) ---
date +%s.%N; /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate -c /home/user/CLaude/trials-cloud-2/runs/04-html-validate/htmlvalidate.tuned.json -f json /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean > /home/user/CLaude/trials-cloud-2/runs/04-html-validate/tuned.json; date +%s.%N   # exit 1, 0.54-1.7 s (shared CPU, load avg 10 on 4 vCPU)
/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate -c /home/user/CLaude/trials-cloud-2/runs/04-html-validate/htmlvalidate.tuned.json -f json /home/user/CLaude/trials-cloud-2/runs/04-html-validate/probe-wp-style.html
# --- wrapper test ---
cp /home/user/CLaude/trials-cloud-2/runs/04-html-validate/wrapper-sketch.mjs /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/html.mjs; cp /home/user/CLaude/trials-cloud-2/runs/04-html-validate/htmlvalidate.tuned.json /home/user/CLaude/trials-cloud-2/runs/04-html-validate/elements-img-alt.json /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/
node /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/html.mjs /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean      # exit 0
node /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/html.mjs /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded     # exit 1, 6 findings
node /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/html.mjs /nonexistent  # exit 2
# --- optional overlap column: axe-core via playwright-core on the same 10 pages ---
date +%s.%N; npm i playwright-core@1.64.1 axe-core@4.14.0; date +%s.%N   # 1.7 s (npm cache warm), node_modules 30 MB total
date +%s.%N; node /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/axe-run.mjs /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean > /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/axe-out.txt; date +%s.%N   # 6.1 s incl. Chromium launch; output -> /home/user/CLaude/trials-cloud-2/runs/04-html-validate/axe-overlap.json
# --- repeat timings (3x each) ---
for i in 1 2 3; do /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate --preset recommended -f json /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean >/dev/null; /tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/04-html-validate/node_modules/.bin/html-validate -c /home/user/CLaude/trials-cloud-2/runs/04-html-validate/htmlvalidate.tuned.json -f json /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/seeded /home/user/CLaude/trials-cloud-2/fixtures/04-html-validate/clean >/dev/null; done
