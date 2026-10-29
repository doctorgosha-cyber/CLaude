#!/usr/bin/env bash
# 01-catalogue: Ajv 8.20.0 vs Frictionless 5.21.0 on the pet-food catalogue. Every command run, in order.
set -x
F=/home/user/CLaude/trials-cloud-2/fixtures/01-catalogue
R=/home/user/CLaude/trials-cloud-2/runs/01-catalogue
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/01-catalogue
V=$T/frictionless/venv/bin
# --- installs (timed with date +%s.%N before/after; sizes with du -sh)
mkdir -p $T/ajv $T/frictionless
cd $T/ajv && echo '{"name":"ajv-trial","private":true,"type":"module"}' > package.json
npm i ajv@8.20.0 ajv-formats@3.0.1            # 3.15 s, node_modules 3.2M (6 packages)
cd $T/frictionless && python3 -m venv venv && venv/bin/pip install frictionless==5.21.0   # 18.0 s, venv 73M (41 packages)
# Windows evidence: wheels exist for win_amd64 / cp313 (frictionless is py3-none-any; only compiled dep is pydantic-core)
$V/pip download --only-binary=:all: --platform win_amd64 --python-version 3.13 --no-deps frictionless==5.21.0 pydantic-core==2.50.1 -d $T/winwheels
# --- fixtures (deterministic generator)
cd $F && node gen.mjs      # catalogue.json/.csv (40 rows, 10 faults), catalogue-clean.json/.csv (controls), KEY.json
# --- baseline (home-made presence + type checker, JSON)
cd $R && ln -sfn $T/ajv/node_modules node_modules && cp $T/ajv/package.json package.json
node baseline.mjs $F/catalogue.json            # exit 1, 1 finding (F5)
node baseline.mjs $F/catalogue-clean.json      # exit 0
# --- Ajv (JSON)
node ajv-run.mjs schema-default.json $F/catalogue.json       > ajv-default-catalogue.json         # exit 1
node ajv-run.mjs schema-default.json $F/catalogue-clean.json > ajv-default-catalogue-clean.json   # exit 0
node ajv-run.mjs schema-tuned.json   $F/catalogue.json       > ajv-tuned-catalogue.json           # exit 1 (first attempt failed: strict mode needs "type" inside then/else; fixed in schema)
node ajv-run.mjs schema-tuned.json   $F/catalogue-clean.json > ajv-tuned-catalogue-clean.json     # exit 0
# --- Frictionless (CSV). First attempts with relative and absolute paths failed with resource-error 'path ... is not safe'; --trusted needed.
$V/frictionless validate $F/catalogue.csv       --schema tableschema-default.json --trusted --json > fl-default-catalogue.json
$V/frictionless validate $F/catalogue-clean.csv --schema tableschema-default.json --trusted --json > fl-default-catalogue-clean.json
$V/frictionless validate $F/catalogue.csv       --schema tableschema-tuned.json --checklist checklist-tuned.json --trusted --json > fl-tuned-catalogue.json
$V/frictionless validate $F/catalogue-clean.csv --schema tableschema-tuned.json --checklist checklist-tuned.json --trusted --json > fl-tuned-catalogue-clean.json
$V/frictionless validate $F/catalogue.csv       --schema tableschema-tuned.json --checklist checklist-tuned.json --trusted > fl-tuned-catalogue.txt
# --- probe (not in KEY): wet row with kcal written in kJ but inside the wet range (188) -> both tuned configs pass it (exit 0)
node ajv-run.mjs schema-tuned.json probe/probe.json > probe/ajv-tuned-probe.json
$V/frictionless validate $R/probe/probe.csv --schema tableschema-tuned.json --checklist checklist-tuned.json --trusted --json > probe/fl-tuned-probe.json
# --- timings: 5 runs each (mean wall): baseline 0.035 s, ajv tuned 0.182 s, frictionless tuned 0.521 s
# --- wrapper
node wrapper-sketch.mjs $F/catalogue-clean.json schema-tuned.json > wrapper-clean.json   # exit 0
node wrapper-sketch.mjs $F/catalogue.json       schema-tuned.json > wrapper-seeded.json  # exit 1
node wrapper-sketch.mjs $F/nope.json            schema-tuned.json                         # exit 2
