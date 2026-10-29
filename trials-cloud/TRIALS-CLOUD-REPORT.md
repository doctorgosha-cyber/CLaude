# TRIALS-CLOUD-REPORT: 10 tool and skill trials for NEXUS

**Session:** claude.ai cloud container, 2026-10-29. Linux x86_64, 4 vCPU, Node 22.22.0, Python 3.13.16, PHP 8.3.6, ffmpeg 6.1.1, Chromium (Playwright build 1194) pre-installed.
**Network in the sandbox:** package registries (npm, PyPI, crates, Go) and raw.githubusercontent.com were reachable. GitHub releases/API, every CDN, huggingface.co and every ordinary website were refused by the egress proxy (HTTP 403 on CONNECT). This affected three trials: 1 (no Whisper model), 5 (no online link check) and the installs of 3/5/9 (built from source or fetched from the repo tree instead of release assets). Nothing was mocked; where a measurement could not be made it says so.
**Method:** every trial = seeded fixtures with a KEY.json + clean controls, a baseline reproducing what NEXUS does today, the candidate with defaults and one tuned config, measured recall / false positives / runtime / install / Windows. Everything is in `fixtures.zip`, `results.json` and `runs/<nn>-*/` (logs, outputs, exact commands in `commands.sh` or `result.json`). Wrappers for the ADOPT verdicts are in `checks/`.

## Summary

| # | Tool | Version | Licence | Baseline → candidate (recall / false positives) | Runtime | Windows? | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | faster-whisper | 1.2.1 (ctranslate2 4.8.4) | MIT (model: MIT) | 0/8 → **not measured**: model download denied (huggingface.co) | — | yes (win_amd64 wheels) | **NOT RUN** (blocked) |
| 2 | axe-core via Playwright | 4.14.0 / 1.64.1 | MPL-2.0 / Apache-2.0 | 1/6, 0 FP → **5/6, 0 FP** (keyboard trap undetectable by design) | 3.8 s / 12 pages | yes (Node) | **ADOPT** |
| 3 | phpstan + PHPCS/WPCS + WP stubs | 2.3.4 / 3.13.6 / 3.4.1 / 6.9.1 | MIT / BSD-3 / MIT / MIT | 0/5 (php -l) → default 4/5, 0 FP; tuned **5/5, 1 FP** | 5–7 s + 0.6 s | yes (PHP) | **ADOPT** |
| 4 | glTF-Validator + glTF-Transform | 2.0.0-dev.3.10 / 4.5.1 | Apache-2.0 / MIT | 2/5 (three.js load) → **5/5, 0 FP**; optimise: default +46 % bytes, tuned −11 %, 0 px diff | 48 ms / 7 files | yes (Node; sharp prebuilt) | **ADOPT** validator, **WATCH** transform |
| 5 | lychee | 0.22.0 | Apache-2.0 OR MIT | 4/16 (own md check) → offline default 8/16, **+fragments 16/16, 0 FP**; online not measurable here | 0.1 s / 100 links | yes (binary) | **ADOPT** offline; online after a local run |
| 6 | svgo | 4.1.0 | MIT | as-is → default −44 % but **12 breakages**; tuned **−39 % (−31 % gz), 0 breakages, 0 px diff** | 0.5 s / 10 files | yes (Node) | **ADOPT** with tuned config + post-check |
| 7 | PySceneDetect | 0.7.2 (opencv 5.0.0.93) | BSD-3 / Apache-2.0 | 5/8, 0 FP (own OpenCV diff) → default 7/8; **adaptive 8/8, 0 FP**, hard cuts 0 ms | 3.6 s / 30 s clip | yes (wheels), untested | **ADOPT** (validate on real films first) |
| 8 | Lighthouse | 13.6.0 | Apache-2.0 | HTTP check ranks slow page *faster* → **3/3 runs rank correctly**, score sd < 1, LCP sd < 30 ms | 11–13 s / run | yes (Node + Chrome) | **ADOPT** |
| 9 | gitleaks | 8.30.0 | MIT | 0/10 → **10/10, 0 FP** on 10 look-alike files | 0.1 s (2 s whole repo) | yes (binary) | **ADOPT** |
| 10 | diagnosing-bugs skill (mattpocock/skills) | main @ 2026-10-29 | MIT | plain agent 6/6 runs, 20/20 hidden tests → with skill 6/6 runs, 20/20; **+10 % tokens, +39 % tool calls, +96 % time** | — | n/a | **REJECT** for small bugs (no gain, higher cost) |

**Do not adopt (as tried):** svgo default config (breaks ids/aria on 4 of 10 files); gltf-transform `optimize` defaults (made both test assets larger and requires a meshopt decoder); the diagnosing-bugs skill for small bugs (same result, more tokens and time); Lighthouse `--budget-path` (the budget audits no longer exist in Lighthouse 12+; enforce thresholds in the wrapper instead); lychee online mode until measured locally (every external host was blocked here, so its false-positive rate is unknown).

## 1. faster-whisper — NOT RUN (model host blocked)

**What ran.** Install of faster-whisper 1.2.1 (37 s, 470 MB venv; ctranslate2 4.8.4, onnxruntime 1.31.1, all MIT/BSD/Apache; Windows wheels verified on PyPI). Fixtures: 3 espeak-ng narrations (keyboard 38.9 s, thermos 30.2 s, kettle 30.3 s; 16 kHz mono; sentences synthesised separately and joined with 0.4 s gaps, so the reference SRT times are exact), a clean SRT and a seeded SRT per file. KEY.json: 5 text defects (45→54, dropped word, Polar→Arctic Flask, added word, temperature→pressure) and 3 timing drifts (+450, −600, +900 ms). `check_srt.py` (word_timestamps → cue alignment → per-cue WER, missing number/name tokens, start/end error) and `score.py` are written and self-tested on synthetic word timings (8/8, 0 FP, explicitly not an ASR result).
**What was blocked.** `WhisperModel("base.en")` → `httpx2.ProxyError: 403 Forbidden` from the sandbox proxy on `huggingface.co:443` (0.9 s, both base.en and small.en; `runs/01-whisper/model-download.err`). No other model host was reachable (hf-mirror, azureedge, ggml). Nothing was mocked.
**Numbers.** Baseline 0/8 (no check exists). Candidate: recall, false positives and runtime **null**.
**Limits.** English-only models in the script; the real job is 10 languages (multilingual `small`/`medium`, worse word timestamps). Per-cue WER threshold 0.05 is tight; the number/name rule is the robust part.
**Verdict: NOT RUN.** To finish locally: `bash runs/01-whisper/commands.sh` with internet once (or a model folder via `WHISPER_MODEL_DIR`). The wrapper sketch is `checks/subtitles.mjs`.

## 2. axe-core — ADOPT

**What ran.** 12 pages (6 seeded: missing alt, 2.5:1 contrast, icon button without name, input without label, aria misuse, script keyboard trap; 6 clean: review, sign-up form, interactive figure with canvas, table, video page, FAQ). Baseline = our three checks (unlabelled inputs, tap targets < 24 px, `outline:none`) as a Playwright script. Candidate = axe 4.14.0 injected via playwright-core 1.64.1 into headless Chromium, default rules and a tuned run limited to WCAG 2.x A/AA tags.
**Commands.** `node runs/02-axe/baseline.mjs clean seeded`; `node runs/02-axe/axe-run.mjs default|tuned clean seeded`.
**Numbers.** Baseline 1/6, 0 FP, 0.8 s (with inline links counted as tap targets it flags all 6 clean pages). axe default **5/6, 0 FP, 3.8 s**; tuned 5/6, 0 FP, 3.7 s. Rules hit: image-alt, color-contrast, button-name, label, aria-allowed-attr, aria-roles. A6 (keyboard trap by script) is not detectable by axe; keep our own keyboard test for it.
**Limits.** Rendered DOM only (open dialogs in the test first). Contrast over images is "incomplete", not a violation. MPL-2.0: `axe.min.js` is loaded unmodified from node_modules.
**Verdict: ADOPT.** `npm i axe-core@4.14.0 playwright-core@1.64.1` (+ a Chromium), run `node checks/axe.mjs <files or urls> [--chrome=…]`; exit 1 on violations. Keep tap-target and keyboard checks in our script.

## 3. phpstan + WPCS — ADOPT

**What ran.** 3 clean theme files (functions, template part, form handler) and 3 seeded files with D1 null dereference (`get_post()->post_parent`), D2 undefined variable, D3 wrong argument type (`wp_trim_words(…, 'twenty')`), D4 `echo $_GET['q']`, D5 `$_POST` handled without a nonce. Baseline `php -l`. phpstan 2.3.4 (phar) with `php-stubs/wordpress-stubs` 6.9.1 via `scanFiles`; phpcs 3.13.6 with WPCS 3.4.1.
**Commands.** `php phpstan.phar analyse -c phpstan-{default,tuned}.neon --no-progress --error-format=json`; `vendor/bin/phpcs --standard=WordPress --report=json clean seeded`; tuned ruleset `runs/03-php/phpcs-tuned.xml` (WordPress-Extra, errors only, FileName/LineLength excluded).
**Numbers.** Baseline 0/5. Default (phpstan level 5 + phpcs WordPress): **4/5, 0 FP** (D1 missed), 6.9 s + 0.7 s. Tuned (phpstan level 7 + phpcs tuned): **5/5, 1 FP** (`get_the_ID()` may return false → `expects int, int|false given` on a clean file; correct by the stubs, noise for a theme), 4.7 s + 0.6 s. Level 6 = level 5; level 8 = level 7.
**Install.** composer packages 32 MB + phpstan.phar 30 MB, 72 s. In this sandbox composer's GitHub zip downloads were refused and it fell back to git sources; the phar was fetched from the repository tree. Plain `composer require` works elsewhere. Pure PHP, runs on Windows.
**Limits.** Level ≥ 7 is needed for null-dereference checks and starts to flag `int|false` returns of core functions. WPCS reports the missing nonce once per `$_POST` access (the wrapper de-duplicates).
**Verdict: ADOPT.** `node checks/php-static.mjs <theme-dir> [--level=7]` with `PHP_TOOLS` pointing at the folder that holds `phpstan.phar` and `vendor/`.

## 4. glTF-Validator + glTF-Transform — ADOPT validator, WATCH transform

**What ran.** Khronos samples Box.glb (1.7 KB) and BoxTextured.glb (6 KB), CC-BY-4.0 (c) 2017 Cesium (no CC0 asset exists in the core sample set; READMEs kept in `fixtures/04-gltf/licences/`; Duck discarded, SCEA licence). `make-corrupt.mjs` produces 5 deterministic corruptions: C1 accessor count too long, C2 missing bufferView, C3 index out of range, C4 NaN position, C5 wrong image MIME type. Baseline = our runtime gate: three.js 0.186.1 GLTFLoader renders one frame in headless Chromium (SwiftShader), pass = no exception.
**Numbers.** Baseline **2/5** (C1, C2 throw; C3/C4 render visibly broken but "load fine"; C5 is pixel-identical because the browser sniffs the PNG bytes), 0 FP, 4.8 s. gltf-validator 2.0.0-dev.3.10 default **5/5 by error code** (ACCESSOR_TOO_LONG, UNRESOLVED_REFERENCE, ACCESSOR_INDEX_OOB, ACCESSOR_INVALID_FLOAT, IMAGE_MIME_TYPE_INVALID), 0 errors/warnings/infos on both clean files, **48 ms for 7 files**. Tuned (maxIssues 0, severity overrides) identical. Transform (gltf-transform 4.5.1): `optimize` default made both files **larger** (1664→1924 B, 5956→9172 B; meshopt JSON overhead + re-encoded PNG) and requires a MeshoptDecoder in the loader; tuned `--compress quantize --texture-compress webp --simplify false` gave 1664→1532 B and 5956→5224 B, **0 % pixel diff** (256 px, pixelmatch 0.1) for all four outputs, which all re-validate clean. 0.55–0.9 s per file.
**Install.** 16 s, 68 MB (the validator itself is a 308 KB pure-JS file; the rest is gltf-transform's sharp/libvips + wasm). Windows: validator Node-only; gltf-transform ships prebuilt sharp for win32.
**Limits.** KB-sized samples, so optimisation numbers say nothing about real figure assets. The npm validator has no CLI; use the wrapper or `gltf-transform validate`. Parity checked from one camera under SwiftShader.
**Verdict.** Validator **ADOPT**: `npm i gltf-validator@2.0.0-dev.3.10`, `node checks/gltf.mjs <dir> [--warn]`. Transform **WATCH**: do not use `optimize` defaults; measure the tuned pipeline on one real model before adopting.

## 5. lychee — ADOPT offline; online after a local measurement

**What ran.** `site/index.html` and `docs/README.md`, 50 links each: 12 valid internal (6 with #fragments), 4 missing files, 4 missing fragments, 3 dead external on `.invalid` (RFC 2606, no real host contacted), 27 valid external. Baseline = our offline Markdown check (file exists; no fragments, no HTML, no external). lychee 0.22.0.
**Numbers.** Baseline 4/16 internal defects (Markdown only), 0.05 s. Offline default (no fragments) 8/16; offline **`--include-fragments` 16/16, 0 FP on 24 valid internal links, 0.1 s**. Online: **not measurable** here, every external host is refused by the sandbox proxy ("Network error: Connection failed" on all 54 valid external links, github.com 400/403); the `.invalid` links were counted as "excludes" without being listed. Both online configs (default; tuned `--max-retries 1 --timeout 15 --accept 200..=399,403,429` + browser-like user agent) are in `runs/05-lychee/` for a local re-run.
**Install.** Single binary (~15 MB release asset, Windows build available). Here it had to be built with `cargo install` (241 s) because release downloads were blocked.
**Limits.** Offline never checks external links. Expect bot-blocking 403/429 online; set `--accept` and the user agent. Raw-URL arguments printed a Rust panic in this build; use file/dir inputs.
**Verdict: ADOPT** the offline check now (`node checks/links.mjs <files or dirs>`); run `--online` on the real site once locally to measure its false-positive rate before adding it as a weekly job.

## 6. svgo — ADOPT with the tuned config + post-check

**What ran.** 10 synthetic SVGs written like the site's assets (24 px icons, a logo with `<title>/<desc>/aria-labelledby/role=img`, ids used by `<style>` and `<use>`, gradient `url(#id)`, clipPath/mask, SMIL and CSS animation, text with font-family, Inkscape/Illustrator cruft). KEY.json lists 58 things that must survive. Parity = rasterise original and output at 512 px in headless Chromium and pixelmatch; animated file compared at t = 0 and t = 400 ms (seek verified: 20 % diff between frames of the original). svgo 4.1.0.
**Numbers.** Baseline 9,408 B (4,910 B gzip). Default preset: 5,253 B (**−44.2 %**, −35.9 % gzip), 0 % pixel diff, but **12 of 58 requirements broken in 4 files**: logo loses `role="img"` and its `aria-labelledby` dangles after `cleanupIds` renames title/desc ids (a real accessibility break); `#accent`, `#brandGradient`, `#pulse` minified/removed; `<style>` inlined (CSS/JS hooks lost). Tuned (`fixtures/06-svgo/svgo.config.mjs`: cleanupIds, inlineStyles, minifyStyles, removeDesc, removeHiddenElems off; keepRoleAttr + keepAriaAttrs): 5,721 B (**−39.2 %**, −31.3 % gzip), **0 breakages, 0.000 % pixel diff** on every file and both animation frames, 0.47 s. Per-file savings 11 % (a11y logo) to 74 % (editor cruft). Note: svgo 4 `preset-default` no longer contains removeViewBox/removeTitle.
**Install.** 4.8 s, 12 MB, pure JS, Windows fine.
**Limits.** Chromium-only parity at one size; synthetic files; the wrapper's structural check is regex-based.
**Verdict: ADOPT** `npm i svgo@4.1.0` with `node checks/svgo.mjs <inDir> <outDir> checks/svgo.config.mjs`; exit 1 if a viewBox, title, referenced id or role/aria attribute disappears. Never run svgo defaults on the logos.

## 7. PySceneDetect — ADOPT (validate on real films first)

**What ran.** `make-clip.sh`: a deterministic 1080×1920, 30 fps, 30 s clip of 9 shots (flat colours, test patterns, panning overlays) with 8 known cuts: 6 hard, 2 × 0.5 s crossfades (xfade). Control: 10 s single shot with motion. Baseline = a 25-line OpenCV mean-absolute-difference detector (threshold 20, chosen a priori). scenedetect 0.7.2 CLI.
**Numbers.** Baseline **5/8**, 0 FP, frame-exact on hard cuts, 5.8 s; never sees a crossfade (6/8 at threshold 15). `detect-content` default (threshold 27): **7/8**, 0 FP on both clips, 0 ms error on hard cuts, 3.6 s. `detect-adaptive` with pure defaults: **8/8, 0 FP**, hard cuts 0 ms, crossfades mean 42 ms / max 250 ms from the fade midpoint, 3.7 s (~8× realtime on 4 vCPU). Also 8/8: content −t 15, detect-hist. detect-threshold (fade-to-black) 0/8 as expected. Caveat: one crossfade is caught through a single-frame hue-wrap spike, not genuine fade detection; detect-hist catches both fades genuinely.
**Install.** 23 s, 354 MB (scenedetect 0.7.2 hard-depends on `opencv-python`, so the headless wheel was redundant; headless-only ≈ 230 MB via `scenedetect-headless`, not verified). BSD-3 / Apache-2.0; Python + prebuilt wheels on Windows, untested here.
**Limits.** Synthetic footage only; the false-positive rate on real films with flashes, fast pans and animated text is unmeasured. Min scene length 0.6 s merges faster cuts.
**Verdict: ADOPT** with `detect-adaptive`; `node checks/scenecuts.mjs film.mp4 beats.json [--tol 0.25]` compares detected cuts to the script beats. Run it on 2–3 real films before using it as a gate.

## 8. Lighthouse — ADOPT

**What ran.** Two static pages on 127.0.0.1:8765: "fast" (1.8 KB sized hero, deferred JS) and "slow" (3.0 MB unsized noise PNG, render-blocking script that busy-waits 900 ms, two banners inserted above the content after 1.2 s). Baseline = our live HTTP check (`curl` status + time). Lighthouse 13.6.0 CLI, performance category, mobile emulation, 3 runs per page; then 3 more runs per page with `--budget-path`.
**Numbers.** Baseline: both 200; fast 5 ms, slow 1 ms, i.e. it ranks the slow page as the faster one. Lighthouse: fast **100 / 100 / 100**, LCP 638–658 ms, CLS 0, TBT 0–36 ms; slow **67 / 69 / 69**, LCP 4,354–4,413 ms, CLS 0.143, TBT 0–100 ms. Ranks correctly in 3/3 runs on score, LCP and CLS; score sd 0.9, LCP sd 28 ms. TBT does not separate the pages: the blocking script runs before first paint, so it lands in FCP/LCP, not TBT. 11–13 s per run. Budget run: identical numbers, but **Lighthouse 13 has no `performance-budget`/`timing-budget` audits any more**, so `--budget-path` produces nothing; thresholds must be enforced by the wrapper.
**Install.** 22 s, 187 MB; Node + an installed Chrome/Edge (`CHROME_PATH`) on Windows.
**Verdict: ADOPT.** `CHROME_PATH=… node checks/perf-budget.mjs <url> --runs=3 --lcp=2500 --cls=0.1 --tbt=300 --fcp=1800 --score=90`; median of N runs, exit 1 over budget.

## 9. gitleaks — ADOPT

**What ran.** 10 FAKE tokens in realistic formats and places (AWS key in `.env`; Stripe live key, Google API key and SendGrid key in `config.json`; GitHub PAT and a Google OAuth token in a pasted CI log inside `REPORT.md`; Slack bot token and Twilio key in `notify.js`; a JWT in `deploy.log`; an RSA private key block in a `.pem`) and 10 clean files with look-alikes (sha256/sha1 lists, UUIDs, a base64 blob, an SRI integrity hash, a Stripe *publishable* key in a README). Baseline: none. gitleaks 8.30.0, `dir` mode, `--redact`. The seeded files are generated by `node fixtures/09-gitleaks/make-seeded.mjs` (ROT13-stored) because GitHub push protection rejects a commit that contains even a fake Slack token; `fixtures.zip` ships the generator, not the files.
**Numbers.** Default rules **10/10, 0 FP** on the clean files, 0.12 s (2.1 s for the whole repository). One extra finding on the seeded side: the publishable `pk_test_` key next to the secret key is reported by `generic-api-key`. Tuned config (`fixtures/09-gitleaks/gitleaks-tuned.toml`: extend default + a rule for `AWS_SECRET_ACCESS_KEY=` assignments + an allowlist for `pk_test_/pk_live_`): **10/10 + the AWS secret, 0 FP**, 0.08 s. Lesson from building the fixture: two hand-made fakes with the wrong length (Google 36 instead of 35 chars, SendGrid 20 instead of 22) were missed or only caught by the generic rule; real tokens have the right length.
**Install.** Single Go binary, Windows build in the release; here built with `go install` (75 s) because release downloads were blocked. MIT.
**Verdict: ADOPT.** `node checks/secrets.mjs <folder> [--config=gitleaks.toml]`, exit 1 on leaks; use `gitleaks git` additionally for history.

## 10. diagnosing-bugs skill — REJECT for small bugs

**What ran.** 3 seeded Node bugs with README bug reports and 20 hidden tests (t1 off-by-one in `datesBetween`, 7 tests; t2 async race in `PriceFeed.refresh`, 5 tests; t3 truncated oz/lb constants, 8 tests). Hidden tests fail 6/3/4 on the buggy code, pass 20/20 on reference fixes. Arm A = plain subagent; arm B = same prompt with the full SKILL.md inline and "follow it exactly"; 2 reps each, 12 concurrent runs in fresh copies, same model. Graded by `grade.mjs` only. Tokens, tool calls and time from the harness usage report (`runs/10-skill/usage.jsonl`).
**Numbers.**

| | runs fixed | hidden tests | mean tokens | mean tool calls | mean wall time |
|---|---|---|---|---|---|
| A plain | 6/6 | 40/40 | 58,240 | 4.3 | 27.9 s |
| B skill | 6/6 | 40/40 | 64,159 (+10 %) | 6.0 (+39 %) | 54.7 s (+96 %) |

Per task (mean of 2 reps): t1 18 → 45 s, t2 32 → 61 s, t3 33 → 58 s; tokens +6.2 K / +5.8 K / +5.8 K. Arm B did follow the skill (red test before the fix in 6/6, rejected hypotheses listed, one 1000-iteration stress loop); arm A wrote tests after the fix and still passed everything.
**Limits.** n = 2 per cell; ceiling effect (plain agent already at 100 %); token counts include each subagent's fixed context, so only the difference is meaningful; the skill is aimed at hard, badly described bugs, which this set does not contain.
**Verdict: REJECT** for small, well-described bugs: no gain, +10 % tokens, +96 % time. WATCH for hard bugs; re-test only on a set where the plain agent fails.

## Do-not-adopt list
- **faster-whisper in this sandbox:** could not run (huggingface.co denied). Not a verdict on the tool; finish locally.
- **svgo default preset** on logos/icons: 12 breakages in 4 of 10 files (role/aria, ids, `<style>`).
- **gltf-transform `optimize` defaults:** made both test assets larger and adds a meshopt decoder dependency.
- **Lighthouse `--budget-path`:** silently does nothing in Lighthouse 12+.
- **lychee online mode** as a gate: false-positive rate unknown until measured outside the sandbox.
- **diagnosing-bugs skill for small bugs:** same result, roughly double the wall time.
- **Our own tap-target check with inline links counted:** flags every clean page; count controls only (kept, narrowed).

## Reproduce
`fixtures.zip` holds every fixture with its KEY.json and generators (`make-corrupt.mjs`, `make-clip.sh`, `make-fixtures.sh`, `svgo.config.mjs`, `gitleaks-tuned.toml`, `budget.json`, the three bug tasks and hidden tests). Exact commands per trial: `runs/<nn>-*/commands.sh` or the `commands` fields in `results.json`. Tool install lines are in the summary table rows of `results.json` (`install.command`).
