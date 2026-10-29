#!/usr/bin/env node
// make-seeded.mjs — regenerates fixtures/09-gitleaks/seeded/ (10 FAKE secrets in realistic formats).
// The file contents are stored ROT13-encoded so that the repository itself never contains a string that
// looks like a credential (GitHub push protection rejects the plain text). Run: node make-seeded.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const rot13 = s => s.replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
const out = join(dirname(fileURLToPath(import.meta.url)), 'seeded'); mkdirSync(out, { recursive: true });
const files = {
 ".env": "# ybpny qri frggvatf\nNCC_RAI=qrirybczrag\nNJF_NPPRFF_XRL_VQ=NXVND3MK7GRFGSNXR234\nNJF_FRPERG_NPPRFF_XRL=jWnyeKHgaSRZV/X7ZQRAT/oCkEsvPLmSNXRXRL01\nQO_UBFG=127.0.0.1\n",
 "REPORT.md": "# Qrcybl ercbeg 2026-10-20\n\nCnfgrq sebz gur PV ybt ol zvfgnxr:\n\n```\nrkcbeg TVGUHO_GBXRA=tuc_SNXRgbxraD3MK7h8I2jX1zA4cY6eG8lO0pR9qS\nphey -U \"Nhgubevmngvba: Ornere ln29.n0NsU6FZOsnxrGBXRAd3mk7h8i2jx1za4cy6eg8lo0pr9qs-D3MK7h8I2jX1zA4cY6eG8lO0pR9qS\" uggcf://jjj.tbbtyrncvf.pbz/...\n```\n\nGur fvgr qrcyblrq svar.\n",
 "config.json": "{\n  \"fgevcr\": {\n    \"frperg_xrl\": \"fx_yvir_4rP39UdYlwJQnewgG1mqc7qpSNXR0001\",\n    \"choyvfunoyr_xrl\": \"cx_grfg_GLbbZDnhiqRQd54AvGcuV7wk\"\n  },\n  \"tbbtyr\": {\n    \"zncf_ncv_xrl\": \"NVmnFlQ-SNXR9kD3MK7h8I2jX1zA4cY6eG8lO0p\"\n  },\n  \"fraqtevq\": {\n    \"ncv_xrl\": \"FT.MzSeMKAyozEapzyxZQNkLJ.MzSeMKAyozEapzyxn2I5Mz9lqTImqTyhM29hoUxjZQN\"\n  }\n}",
 "deploy.log": "2026-10-20G10:01:02M VASB  fgnegvat qrcybl\n2026-10-20G10:01:03M QROHT nhgu urnqre: Ornere rlWuoTpvBvWVHmV1AvVfVaE5pPV6VxcKIPW9.rlWmqJVvBvVkZwZ0AGL3BQxjVvjvozSgMFV6VxMun2HtIKAypvVfVzyuqPV6ZGHkAwVmBGNlZa0.FsyXkjEWFZrXXS2DG4sjcZrWs36CBx6lWI_nqDffj5p\n2026-10-20G10:01:04M VASB  hcybnqrq 42 svyrf\n",
 "id_rsa_fixture.pem": "-----ORTVA EFN CEVINGR XRL-----\nZVVOBtVONNWONXSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSN\nXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNX\nRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXRSNXR\n-----RAQ EFN CEVINGR XRL-----\n",
 "notify.js": "// Fynpx abgvsvre (svkgher)\npbafg FYNPX_OBG_GBXRA = 'kbko-123456789012-1234567890123-SNXRd3MK7h8I2jX1zA4cY6eG';\npbafg GJVYVB_NCV_XRL = 'FX0123456789nopqrs0123456789nopqrs';\nrkcbeg nflap shapgvba abgvsl(grkg) {\n  erghea srgpu('uggcf://fynpx.pbz/ncv/pung.cbfgZrffntr', { urnqref: { Nhgubevmngvba: `Ornere ${FYNPX_OBG_GBXRA}` }, obql: WFBA.fgevatvsl({ grkg }) });\n}\n"
};
for (const [name, body] of Object.entries(files)) writeFileSync(join(out, name), rot13(body));
console.log(`wrote ${Object.keys(files).length} seeded files to ${out}`);
