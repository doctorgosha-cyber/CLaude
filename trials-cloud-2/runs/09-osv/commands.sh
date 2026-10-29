#!/bin/sh
# 09-osv: osv-scanner (offline) vs npm audit. Every command run, in order. Paths relative to repo /home/user/CLaude.
TOOLS=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/09-osv
OSV=$TOOLS/osv-scanner
OUT=trials-cloud-2/runs/09-osv/out
F=trials-cloud-2/fixtures/09-osv

# --- install (GitHub releases blocked -> go install; 151.2 s wall, 79 MB binary)
curl -s https://proxy.golang.org/github.com/google/osv-scanner/v2/@v/list | sort -V | tail -3   # v2.5.1 v2.6.0 v2.7.0
mkdir -p $TOOLS && cd $TOOLS && GOBIN=$PWD go install github.com/google/osv-scanner/v2/cmd/osv-scanner@v2.7.0 && cd -
$OSV --version      # osv-scanner 2.7.0 / osv-scalibr 0.5.3

# --- fixtures (lockfiles are real, generated with npm 10.9.4; 1.6 s)
sh $F/gen-lockfiles.sh      # runs: npm install --package-lock-only --ignore-scripts --no-audit --no-fund in node-vuln/ and node-clean/

# --- baseline today: none. Free alternative: npm audit (default, then tuned --audit-level=high)
(cd $F/node-vuln  && npm audit --json > ../../../$OUT/npm-audit-vuln-default.json)   # exit 1, 0.65 s
(cd $F/node-clean && npm audit --json > ../../../$OUT/npm-audit-clean-default.json)  # exit 0, 0.53 s
(cd $F/node-vuln  && npm audit --audit-level=high --json > ../../../$OUT/npm-audit-vuln-high.json)   # exit 1, 0.50 s
(cd $F/node-clean && npm audit --audit-level=high --json > ../../../$OUT/npm-audit-clean-high.json)  # exit 0, 0.46 s
(cd $F/py-vuln && npm audit --json)   # ENOLOCK: npm audit cannot read requirements.txt

# --- osv-scanner online mode (api.osv.dev is blocked by egress proxy)
$OSV scan source -r $F/node-vuln > $OUT/osv-online-vuln.txt 2> $OUT/osv-online-vuln.err   # exit 127 after 20.9 s
# stderr: Error during extraction: (extracting as vulnmatch/osvdev) max retries exceeded: attempt 4: request failed: Post "https://api.osv.dev/v1/querybatch": Forbidden

# --- osv-scanner offline mode, defaults (first run downloads npm DB 219 MB from osv-vulnerabilities.storage.googleapis.com into ~/.cache/osv-scalibr)
$OSV scan source --offline --download-offline-databases --format json -r $F/node-vuln  > $OUT/osv-offline-vuln.json        2> $OUT/osv-offline-vuln.err        # exit 1, 20.2 s incl. download
$OSV scan source --offline                              --format json -r $F/node-vuln  > $OUT/osv-offline-vuln-cached.json 2> $OUT/osv-offline-vuln-cached.err # exit 1, 12.0 s
$OSV scan source --offline --download-offline-databases --format json -r $F/node-clean > $OUT/osv-offline-node-clean.json  2> $OUT/osv-offline-node-clean.err  # exit 0, 10.6 s
$OSV scan source --offline --download-offline-databases --format json -r $F/py-vuln    > $OUT/osv-offline-py-vuln.json     2> $OUT/osv-offline-py-vuln.err     # exit 1, 4.3 s (PyPI DB 35 MB)
$OSV scan source --offline --download-offline-databases --format json -r $F/py-clean   > $OUT/osv-offline-py-clean.json    2> $OUT/osv-offline-py-clean.err    # exit 0, 2.5 s
du -sh /root/.cache/osv-scalibr/   # 245M (npm all.zip 219 MB + PyPI all.zip)

# --- osv-scanner tuned: osv-scanner.toml ignoring GHSA-c2qf-rxjj-qqgw with reason + ignoreUntil, --format json
$OSV scan source --offline --format json --config $F/tuned/osv-scanner.toml -r $F/node-vuln  > $OUT/osv-tuned-vuln.json  2> $OUT/osv-tuned-vuln.err   # exit 1, 21.1 s (CPU contention)
$OSV scan source --offline --format json --config $F/tuned/osv-scanner.toml -r $F/node-clean > $OUT/osv-tuned-clean.json 2> $OUT/osv-tuned-clean.err  # exit 0, 17.7 s
# whole fixture tree in one run (Node + Python, 4 manifests)
$OSV scan source --offline --format json -r $F > $OUT/osv-all-fixtures.json 2> $OUT/osv-all-fixtures.err   # exit 1, 18.1 s
# runtime repeats (cached DB, node-vuln): 11.4 s, 12.9 s, 14.2 s

# --- wrapper (checks/vulns.mjs sketch): exit 0 clean / 1 findings / 2 tool error
OSV_SCANNER=$OSV node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/node-vuln  > $OUT/wrapper-osv-node-vuln.json   # exit 1
OSV_SCANNER=$OSV node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/node-clean > $OUT/wrapper-osv-node-clean.json  # exit 0
OSV_SCANNER=$OSV node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/py-vuln    > $OUT/wrapper-osv-py-vuln.json     # exit 1
OSV_SCANNER=$OSV node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/py-clean   > $OUT/wrapper-osv-py-clean.json    # exit 0
OSV_SCANNER=/nonexistent/osv-scanner node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/node-vuln  > $OUT/wrapper-npm-node-vuln.json   # exit 1 (npm audit fallback)
OSV_SCANNER=/nonexistent/osv-scanner node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/node-clean > $OUT/wrapper-npm-node-clean.json  # exit 0
OSV_SCANNER=/nonexistent/osv-scanner node trials-cloud-2/runs/09-osv/wrapper-sketch.mjs $F/py-vuln    > $OUT/wrapper-npm-py-vuln.json     # exit 2 (no lockfile for npm audit)
