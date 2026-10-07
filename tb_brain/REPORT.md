# TB-BRAIN — REPORT (2026-10-07, cloud Claude; папір, без ключів і ордерів)

## Коротко українською
**Що збудовано.** (1) `src/market-state.mjs` — чистий «мозок стану ринку» над денними закриттями: тренд BTC (EMA50/100/200, дистанція,
нахил), режими EMA200/EMA100 за правилом бота, просадка від 90-денного максимуму, волатильність + перцентиль, широта, tier-2 кошик проти
BTC (28/84 д), мітка режиму з точним правилом, що вимагають зараз M5-B100 / C8 / S3-M0 і вага TV-оверлею; кожне число з визначенням.
(2) `src/signals.mjs` + `node bot.mjs signals` → `out/signals.json`, `out/signals.md`, `out/market-state.json`: статус українською, «що
кажуть протестовані правила», рівень доказів з посиланням на TB-звіт, ризики, відповідь на питання власника, фіксований дисклеймер.
(3) `CURRENT-STATE.md` — чесне читання ринку на 2026-10-03. (4) Пропозиція **M5-B100-TV** у `variants.mjs` (`M5_B100_TV_PROPOSAL`,
`vol_target 0.6`, `vol_days 7`) з масштабуванням купівлі в `alt70.mjs`; OFF за замовчуванням, живі M5-B100/C8 байт-у-байт незмінні
(fingerprint перевірено тестом). (5) Офіс: панель Хана розділена на дві вкладки «Автоторгівля (папір)» і «Сигнали та стан ринку»
(`signals-view.js`, `trading-panel.js`), `server.mjs` передає `signalsReader`, `shared/signals.mjs` — read-only обробник `/api/signals`;
`shared/http.mjs` у пакеті не було, тож маршрут описано в `shared/http.mjs.PATCH.md` (6 рядків), не застосовано. Кнопок ордерів немає.
(6) Тести: 15 нових (`market-state`, `signals`, `alt70-tv`), усі зелені; наявні не зламані.

**Головний висновок по ринку (2026-10-03, марки 10-06 вищі):** BTC 84 754 — на +13 % вище EMA200 і +8 % вище EMA50, −2 % від
90-денного максимуму. Обидва режими бота УВІМКНЕНО, мітка risk-on, широта 90 %. Tier-2 кошик за 28 днів +46 % проти BTC +6 %.
Правила не бачать «падіння BTC»; альт-рукави й так у QNT, VET, DASH, POL, IOTA + 30 % BTC. Ідея «BTC падає → купити альти» даними
не підтримується: при вимкненому режимі EMA200 (115 тижнів з 298) медіана 28-денного результату кошика −2.9 % проти BTC +0.7 %;
коли BTC падав > 5 %, кошик −17 % проти −13 %. Жодна арма не має доведеної переваги. Деталі й таблиці — `CURRENT-STATE.md`.

**Як запустити.** У `projects/trading-bot`: `node bot.mjs signals` (офлайн, ~5 с; `--asof=YYYY-MM-DD` для минулої дати);
`node --test test/market-state.test.mjs test/signals.test.mjs test/alt70-tv.test.mjs`; `npm test`. Офіс: застосувати патч із
`patch/office`, `patch/shared`, додати маршрут за `shared/http.mjs.PATCH.md`, перезапустити `node server.mjs`; прев’ю без сервера —
`office/public/signals-preview.html?src=/api/signals`. Встановлення в живий бот — лише через tb-safe-install (NEXUS, :10–:55).

## Тести (вивід `npm test` у `test-output.txt`)
```
# tests 132  # pass 114  # fail 15  # skipped 3          (до змін: tests 117, pass 99, fail 15, skipped 3)
# нові: market-state 8/8, signals 4/4, alt70-tv 3/3; alt70.test + variants-add.test: 27/27 (2 skipped)
```
15 падінь ті самі, що й до змін: у пакеті немає `fixtures/assets.json`, `fixtures/exchangeInfo.json`, `data/guard-seed/`,
`fixtures/ml2-parity` (ENOENT у `bot`, `forward`, `guard`, `universe`); `gen-fixtures` відтворює лише klines. На повному чекауті
NEXUS вони мають проходити, як і раніше. Перелік падінь ідентичний baseline (`diff` порожній, лише нумерація).

## Що саме змінено (повні файли в `patch/` за шляхами пакета; `changes.diff` — unified diff)
- `projects/trading-bot/src/market-state.mjs` (новий), `src/signals.mjs` (новий), `src/alt70.mjs` (+`volScale`, масштаб купівлі
  лише при `params.vol_target`), `src/variants.mjs` (+`ALT70_TV_PARAMS`, `M5_B100_TV_PROPOSAL`; нові ключі лише коли задані).
- `trading-bot/bot.mjs` (+режим `signals`, USAGE), `trading-bot/README.md` (+розділ TB-BRAIN).
- `test/market-state.test.mjs`, `test/signals.test.mjs`, `test/alt70-tv.test.mjs` (нові).
- `office/public/js/signals-view.js` (новий), `office/public/js/trading-panel.js` (дві вкладки, `/api/signals` кожні 5 хв,
  вкладка запам’ятовується), `office/server.mjs` (+`signals: signalsReader(root)`), `office/public/signals-preview.html` (прев’ю),
  `shared/signals.mjs` (новий), `shared/http.mjs.PATCH.md`. Скриншоти 390 px: `screens/signals-390.png`, `screens/auto-tab-390.png`.
- `projects/trading-bot/out/signals.{json,md}`, `market-state.json` — результат на даних пакета (для огляду).

## Обмеження, чесно
- Хмара не бачить Binance: усе на знімку `data/daily` до 2026-10-03 (OHLC лише для 19 пар, тому ATR/high-low не використано;
  вол і просадка — від закриттів). Живі арми марковані 10-06 (BTC 85 550). `data/exchangeInfo.json` відсутній — пул виведено з
  файлів даних, статуси вважаються TRADING; придатних монет 21, tier-2 має 9 імен (у NEXUS з повними метаданими буде більше).
- TV-оверлей порт неточний: дослідження брало 168 годинних барів, бот має лише денні — взято 7 денних закриттів; масштаб лише при
  купівлі, без підрізання лотів. Це пропозиція без доведеної переваги; результат TB-PREDICT: нижчий MaxDD, Sharpe без змін, менша
  дохідність. Прев’ю офісу зроблено без `hud.js`/`charts.js` (їх нема в пакеті): вкладка «Автоторгівля» у прев’ю — заглушка,
  у реальній панелі — наявний вміст без змін. Маршрут `/api/signals` в `http.mjs` не застосовано (файлу немає в пакеті).
- Мітка режиму (risk-on / neutral / risk-off / capitulation-watch) — описова класифікація за задокументованими порогами,
  не протестована торгова стратегія; «докази» для питання власника — умовні медіани з 298 тижнів, не прогноз.
