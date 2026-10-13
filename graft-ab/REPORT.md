# Does Graft save Claude Code tokens? A/B test on three.js r179

Date: 2026-10-13. Sandbox only, nothing published. `DO_NOT_TRACK=1` set before any Graft command.

## Setup

| Item | Value |
|---|---|
| Graft | `@nanonets/graft` 0.21.1 (npm; GitHub `trailhq/Graft`, MIT), installed with `npm install -g` |
| Test repo | `mrdoob/three.js` tag **r179** (commit `54ac263`), shallow clone, 1,521 indexable JS files |
| Agent | Claude Code CLI 2.1.296, model `claude-sonnet-5-5` (alias `sonnet`) in both arms |
| Session shape | One fresh headless session per task: `claude -p "<prompt>" --output-format stream-json --session-id <new uuid>`, cwd = repo root, same tool allowlist in both arms (`Bash,Read,Grep,Glob,Edit,Write,MultiEdit`; Run B additionally allowed the 6 `mcp__graft__*` tools), permission mode `acceptEdits` |
| Run A | pristine clone, `--strict-mcp-config` (no MCP servers) |
| Run B | identical clone + `graft init --agents claude --no-global` + `graft build` (structural graph). Graft's hooks, skill, statusline and MCP server loaded exactly as `init` wired them (verified in the session init event: MCP `graft` connected with 6 tools, skill `graft` listed, SessionStart / UserPromptSubmit / PostToolUse / Stop hooks firing) |
| Warm-up | one trivial "Reply OK" session before each arm so the system-prompt prefix is cached equally |
| Trials | 2 full trials per arm (A1, B1, A2, B2), 20 sessions in total |
| Tokens | `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens` as reported by the CLI `result` event. Cost is the CLI's `total_cost_usd` (list price, cache-aware) |
| Tool calls | `tool_use` blocks counted from the stream; "API calls" = distinct assistant messages |
| Time | wall clock around the `claude -p` process |
| Correctness | every answer checked by hand against the r179 source (ground truth in `results/truth-*.txt` and the notes below) |

The 5 fixed prompts (locked before any run, see `TASKS.md`):
(a) Where is the GLTFLoader's handling of KHR_materials_transmission, and which function applies it?
(b) List every file that imports BufferGeometryUtils.
(c) Explain how WebGLRenderer decides the shadow map type.
(d) Find the code path that disposes textures when a material is disposed.
(e) Add a one-line comment above the main export of src/core/Object3D.js (do not commit).

## Results (mean of 2 trials; per-trial numbers in the appendix)

| Task | A tokens | B tokens | Δ tokens | A tool calls | B tool calls | A time (s) | B time (s) | Δ time | A correct | B correct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|:---:|
| (a) GLTF transmission | 122,389 | 107,112 | **-12%** | 2.5 | 1.5 | 12.2 | 13.1 | +7% | yes | yes |
| (b) BufferGeometryUtils importers | 125,750 | 183,560 | **+46%** | 2.0 | 3.0 | 15.9 | 22.4 | +40% | yes¹ | yes¹ |
| (c) shadow map type | 125,344 | 162,742 | **+30%** | 3.0 | 2.5 | 15.5 | 19.6 | +26% | yes | yes |
| (d) material → texture dispose | 124,148 | 86,446 | **-30%** | 3.0 | 1.0 | 13.6 | 15.1 | +11% | yes | yes |
| (e) comment in Object3D.js | 141,206 | 126,280 | **-11%** | 2.5 | 2.0 | 10.1 | 22.2 | +121% | yes | yes |
| **Total** | **638,838** | **666,140** | **+4%** (B uses more) | **13** | **10** (-23%) | **67.3** | **92.3** | **+37%** (B slower) | 5/5 | 5/5 |
| Total, trial 1 only | 660,558 | 620,014 | -6% | 13 | 9 | 70.8 | 87.0 | +23% | 5/5 | 5/5 |
| Total, trial 2 only | 617,118 | 712,265 | +15% | 13 | 11 | 63.8 | 97.6 | +53% | 5/5 | 5/5 |
| Cost (USD, list price, mean of trials) | $0.322 | $0.378 | +17% | | | | | | | |
| Map build time | – | **133.7 s** (`graft build .`, 1,521 files, 18,256 nodes, 43,516 edges) | | | | | | | | |
| Map size | – | **80 MB** on disk: 1,521 markdown cards + `INDEX.md` (≈7 MB), `.graph/wiring.json` 18 MB, `.cache/` 55 MB (46 MB parse cache, 9.3 MB ask index) | | | | | | | | |
| Network calls | none from Claude Code besides the model API | install: `registry.npmjs.org` (npm), `nodejs.org`, `github.com`, `release-assets.githubusercontent.com` (tree-sitter native build/prebuilt download); `graft init`: 1 request to `registry.npmjs.org` (daily `npm view @nanonets/graft version` update check, cached in `~/.graft/update-check.json`); `graft build`, hooks, MCP server across all 11 Run B sessions: **none**; telemetry endpoint `events.nanonets.com` **never contacted** (`graft telemetry status` → "off — DO_NOT_TRACK is set") | | | | | | | | |
| **Verdict** | | **No.** Saving is not ≥ 25%: tokens +4% (trial 1: -6%, trial 2: +15%), time +37%, cost +17%, with equal correctness (5/5 both arms, both trials). Tool calls did drop 23% (13 → 10). | | | | | | | | |

¹ Task (b) has 43 importing files in r179 (12 `.js` + 31 `.html` with a live or sample `import`). Every run listed all 23 code files (12 `.js` + 11 `examples/*.html`) and all 18 `manual/` pages; A1, B1 and B2 left out the 2 `docs/examples/*/utils/BufferGeometryUtils.html` sample pages and said so; A2 listed all 43 but added `webgl_loader_ifc.html` (only an import-map entry) with a caveat. Graded "yes" for all four because the complete runtime import set was found and every omission was declared.

### Why the token count did not drop

- **The baseline was already cheap.** Cold Claude Code solved every task in 2 to 3 tool calls (Grep then one Read). three.js has descriptive file and class names, so there was little exploration for Graft to remove. Graft's own README benchmark reports a 4.2-call cold baseline; ours was 2.6.
- **Per-call context dominates, and Graft adds to it.** Each API call re-reads the ~40k-token cached system prompt of this cloud environment. Run B's prefix is larger: the `graft` skill (9.4 KB), 6 MCP tool schemas, a 3,011-character SessionStart orientation block and a 160–530-character UserPromptSubmit "starting points" block on every prompt. Summed over both trials, B wrote 134k cache tokens vs 102k for A (+31%) and read 1.19M vs 1.16M. On the uncached-equivalent view (fresh input + cache writes + output) B costs 144k vs A 114k (+26%).
- **Where Graft won (a, d, -30% in the best trials):** one `graft ask --source` returned the crux inline and the model answered without a Read. That is the README's mechanism working.
- **Where Graft lost (b, c):** `graft grep` only searches the 1,521 indexed JS files and reports that, so for task (b) the model ran `graft grep`, then re-ran `rg` over the HTML files it knew Graft had skipped, then a third pass: 3 calls and 4 API turns instead of 2 and 3. For (c) it chained `graft ask` → `graft grep` → `graft skeleton` or a Read; Graft's inlined cruxes (several hundred lines of GLSL/JS) cost more than the two targeted Greps of the baseline. Graft's `[graft] tokens saved ≈ N` footers claimed 47k–69k tokens saved per call; the CLI's real usage numbers do not show that saving, because the baseline never read those files whole.
- **Wall time:** B is slower on every task on average. Each UserPromptSubmit hook runs a `graft ask` (~2 s on this graph), the Stop hook spawns a background re-sync, and `graft` CLI calls through Bash take 1–2 s each versus sub-second Grep. Task (e) shows the fixed hook cost most clearly (+12 s).

### Caveats

- Only Graft's free structural tier was built. `graft build --deep` (LLM-written concept nodes and per-symbol summaries) needs a provider key, which this sandbox does not have, and the README's benchmark pushed `graft ask --source` bundles from a deep-built graph. The default `graft init` install, which is what was tested, does not run `--deep`.
- n = 2 trials per arm, 5 tasks. Per-task differences of ±10% are within run-to-run noise (A varied 1–5% between trials, B up to 50% on task (a) and (c) because it sometimes chained extra Graft calls).
- The ~40k-token system prompt of this cloud session (tool roster, skills) is identical in both arms and inflates both totals; a plain local Claude Code install has a smaller prefix, so Graft's added context would be a larger share there, not smaller.
- The session-level `permissions.allow` entries Graft wrote were ignored by Claude Code ("workspace has not been trusted"), but the explicit `--allowedTools Bash` made every `graft` command runnable, so this did not affect Run B.

## What Graft wrote into the project (`graft init --agents claude --no-global`, then `graft build`)

| Path | Size | Content |
|---|---:|---|
| `.claude/settings.json` | 1,870 B | `statusLine` and `subagentStatusLine` → `graft-statusline.cjs`; hooks: `PostToolUse` (matcher `Write\|Edit\|MultiEdit` → `post-edit`; matcher `Bash\|mcp__graft__\|Read\|Grep\|Glob` → `tool-savings`), `UserPromptSubmit` → `prompt` (15 s timeout), `SessionStart` → `session-start`, `Stop` → `stop`; `footerLinksRegexes`; `permissions.allow`: `Bash(graft:*)`, `Bash(npx graft:*)`, `Bash(graft-dev:*)`, `Bash(node dist/cli.js:*)` |
| `.claude/helpers/graft-hooks.cjs` | 2,736 B | shim that resolves the global Graft package (absolute path baked in) and runs `dist/claude/hooks.js` |
| `.claude/helpers/graft-statusline.cjs` | 2,726 B | statusline shim |
| `.claude/skills/graft/SKILL.md` | 9,448 B | the skill telling the agent to use `graft ask/grep/skeleton/callers/map` before grepping or reading source, and to report "🌱 graft saved ~N tokens" each turn |
| `.mcp.json` | 111 B | `mcpServers.graft = { command: "graft", args: ["mcp"] }` |
| `.gitignore` | +3 lines | `/graft/` added by `graft build` |
| `.ignore` | 180 B | ripgrep override: re-admits `graft/` cards to search, hides `graft/.cache` and `graft/.graph` |
| `graft/` | 80 MB, 1,527 files | `INDEX.md`, 1,521 per-file wiring cards mirroring the source tree, `.graph/wiring.json` (18 MB symbol graph), `.cache/` (parse cache, ask index, fingerprint, `stats.json`, `session/<uuid>.json` per Claude session written by the hooks) |
| `~/.graft/update-check.json` | 54 B | outside the repo: cached result of the daily npm version check |

Without `--no-global`, `graft init` would also have written **machine-wide** files (shown by `graft init --dry-run`, see `results/graft-init-dryrun.txt`): `~/.claude/helpers/graft-hooks.cjs`, hook blocks into `~/.claude/settings.json` (SessionStart / UserPromptSubmit / PostToolUse / Stop for every repo on the machine) and `mcpServers.graft` into `~/.claude.json`. `--no-global` was used here so Run A and this session stayed uncontaminated. Graft never touched `CLAUDE.md`. Nothing was committed to the test repo.

Installer notes (read before running): `scripts/postinstall.mjs` records an `install` telemetry event and spawns a detached `graft _telemetry-flush`; both are gated by `DO_NOT_TRACK` / CI / `graft telemetry disable` / a baked PostHog key. The published tarball carries the key (`dist/telemetry/key.js`, host `https://events.nanonets.com`). `npm install` also compiles or downloads tree-sitter native modules (hence the `nodejs.org` and GitHub release downloads above).

## Appendix: per-trial tables


### Trial 1

| Task | A tokens (in+out) | B tokens (in+out) | Δ tokens | A tool calls | B tool calls | A time s | B time s | Δ time | A API calls | B API calls | A cost $ | B cost $ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| (a) | 122,186 | 85,502 | -30% | 2 | 1 | 13.2 | 12.2 | -8% | 3 | 2 | 0.058 | 0.057 |
| (b) | 126,767 | 183,159 | +44% | 2 | 3 | 17.3 | 23.3 | +35% | 3 | 4 | 0.080 | 0.099 |
| (c) | 124,948 | 138,585 | +11% | 3 | 2 | 15.4 | 16.9 | +10% | 3 | 3 | 0.071 | 0.093 |
| (d) | 125,022 | 86,491 | -31% | 3 | 1 | 13.9 | 14.8 | +6% | 3 | 2 | 0.069 | 0.062 |
| (e) | 161,635 | 126,277 | -22% | 3 | 2 | 11.0 | 19.8 | +80% | 4 | 3 | 0.058 | 0.057 |
| **Total** | **660,558** | **620,014** | **-6%** | **13** | **9** | **70.8** | **87.0** | **+23%** | 16 | 14 | 0.336 | 0.369 |

Token breakdown (fresh input / cache write / cache read / output):

| Task | A fresh | A cache-write | A cache-read | A out | B fresh | B cache-write | B cache-read | B out |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| (a) | 6 | 9,813 | 111,607 | 760 | 4 | 11,126 | 73,858 | 514 |
| (b) | 6 | 12,524 | 112,420 | 1,817 | 8 | 16,530 | 165,000 | 1,621 |
| (c) | 6 | 10,865 | 112,427 | 1,650 | 6 | 16,619 | 120,481 | 1,479 |
| (d) | 6 | 11,566 | 112,291 | 1,159 | 4 | 11,922 | 73,835 | 730 |
| (e) | 8 | 9,191 | 151,815 | 621 | 6 | 10,315 | 115,525 | 431 |

Tools used per task:

- (a) A: {'Grep': 1, 'Read': 1} | B: {'Bash': 1}
- (b) A: {'Grep': 2} | B: {'Bash': 3}
- (c) A: {'Grep': 2, 'Read': 1} | B: {'Bash': 2}
- (d) A: {'Grep': 2, 'Read': 1} | B: {'Bash': 1}
- (e) A: {'Grep': 1, 'Read': 1, 'Edit': 1} | B: {'Grep': 1, 'Edit': 1}

### Trial 2

| Task | A tokens (in+out) | B tokens (in+out) | Δ tokens | A tool calls | B tool calls | A time s | B time s | Δ time | A API calls | B API calls | A cost $ | B cost $ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| (a) | 122,592 | 128,722 | +5% | 3 | 2 | 11.2 | 13.9 | +24% | 3 | 3 | 0.058 | 0.065 |
| (b) | 124,734 | 183,961 | +47% | 2 | 3 | 14.6 | 21.4 | +47% | 3 | 4 | 0.067 | 0.103 |
| (c) | 125,741 | 186,898 | +49% | 3 | 3 | 15.6 | 22.3 | +43% | 3 | 4 | 0.071 | 0.100 |
| (d) | 123,275 | 86,401 | -30% | 3 | 1 | 13.3 | 15.3 | +15% | 3 | 2 | 0.062 | 0.062 |
| (e) | 120,776 | 126,283 | +5% | 2 | 2 | 9.1 | 24.7 | +171% | 3 | 3 | 0.049 | 0.057 |
| **Total** | **617,118** | **712,265** | **+15%** | **13** | **11** | **63.8** | **97.6** | **+53%** | 15 | 16 | 0.308 | 0.387 |

Token breakdown (fresh input / cache write / cache read / output):

| Task | A fresh | A cache-write | A cache-read | A out | B fresh | B cache-write | B cache-read | B out |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| (a) | 6 | 9,534 | 112,175 | 877 | 6 | 11,533 | 116,422 | 761 |
| (b) | 6 | 10,233 | 112,972 | 1,523 | 8 | 17,074 | 165,028 | 1,851 |
| (c) | 6 | 10,685 | 113,320 | 1,730 | 8 | 16,929 | 168,451 | 1,510 |
| (d) | 6 | 9,541 | 112,511 | 1,217 | 4 | 11,846 | 73,836 | 715 |
| (e) | 6 | 8,329 | 111,991 | 450 | 6 | 10,317 | 115,529 | 431 |

Tools used per task:

- (a) A: {'Grep': 2, 'Read': 1} | B: {'Bash': 1, 'Read': 1}
- (b) A: {'Grep': 2} | B: {'Bash': 3}
- (c) A: {'Grep': 3} | B: {'Bash': 3}
- (d) A: {'Grep': 2, 'Read': 1} | B: {'Bash': 1}
- (e) A: {'Grep': 1, 'Edit': 1} | B: {'Grep': 1, 'Edit': 1}

## Appendix: bundle contents

- `REPORT.md`, `TASKS.md` — this report and the locked prompts.
- `results/<arm>-t<trial>/<task>.jsonl` — full `stream-json` transcript of each session; `<task>.json` — parsed metrics; `<task>.answer.md` — the agent's final answer; `e.diff` — the edit made for task (e) (reverted after each run); `netlog.txt` — outbound hosts contacted by any Node child process (hooks, MCP server, graft CLI) during the arm, empty = none.
- `results/graft-*.txt`, `results/netlog-*.txt` — `graft init --dry-run`, `graft init`, `graft build` output and the network log of install / init / build.
- `results/truth-b.txt` — grep-derived ground truth for task (b).
- `graft-wiring/` — exact copies of what `graft init` wrote (`.claude/`, `.mcp.json`, `.ignore`, `.gitignore` diff).
- `graft-map/` — Graft's generated map: `INDEX.md`, all 1,521 cards, `.graph/wiring.json`, `.cache/` minus the 46 MB `extract.*.json` parse cache (regenerable by `graft build`).
- `harness/` — `run_arm.py` (runner + parser), `tables.py`, `netlog.cjs` (the `NODE_OPTIONS --require` preload used to log network calls).
