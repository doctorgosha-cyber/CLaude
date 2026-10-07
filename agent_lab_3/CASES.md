# AGENT-LAB-3 — чотири нові capability-кейси (cm-04..cm-07)

**Коротко українською.** Чотири кейси у форматі пакета (fixture/ + key/KEY.json з regex-детекторами, DECOYS.json, `example` на кожному
детекторі для `lintKey`). Перевірено грейдером пакета: синтетичний «добрий» звіт з прикладів дає повний recall і 100 % збігу severity;
звіт, що стверджує декої, ловиться; заперечене формулювання («asserted X: not present») не рахується хибною заявкою; у fixture/ нема
слів-підказок; ключі лежать тільки в key/. Моделі не запускалися, нічого не оцінювалося. **Автор — модель родини Claude, тобто та сама
родина, що й агенти, які оцінюють** (cm-01..03 писав Codex). Ризик: дефекти й формулювання детекторів можуть збігатися з тим, що Claude
природно шукає і як пише, тож recall може бути завищений проти кейсів іншої родини; порівнюйте дельти baseline→candidate у межах кейсу,
а не абсолютні recall між cm-01..03 і cm-04..07; за змоги дайте один кейс на перевірку автору іншої родини.

| Кейс | Що тестує | Дефекти (сев.) | Крос-файл | Декої | Ролі (прогноз) | Очікуваний baseline |
|---|---|---|---|---|---|---|
| cm-04 affiliate review (pet) | a11y, SEO/meta, affiliate-комплаєнс, layout drift, claims | 10 (10 major) | 1 (CTA margins: theme/style.css ↔ page.html) | 3 false + 1 unanswerable | solo (головна), corax (SEO/commercial), dorn | 6–8/10 |
| cm-05 YMYL дерматологія | claims vs references (окремий файл), FAQ vs body, reviewer/date, schema, sponsored під prescription | 10 (1 critical, 8 major, 1 minor) | 2 (references.html) | 3 false + 1 unanswerable | solo, corax (контент/довіра), dorn | 6–7/10 |
| cm-06 accordion build | builder: 3 видимі регресії + CSS-override + неекранований title; SPEC-контракт | 5 (2 critical, 3 major) + 7 прихованих тестів | 0 (JS ↔ CSS ↔ SPEC) | 1 false (ArrowDown) | vulcan (головна), solo; dorn як QA | 3–4/5 причин, 5–6/7 тестів |
| cm-07 release QA | реліз: 3 регресії проти 4 нешкідливих змін (false PASS / false alarm) | 3 (1 critical, 2 major) | 3 (live ↔ candidate ↔ api/README) | 4 harmless_change | dorn (головна), solo; corax для SEO | 2/3, 0–1 хибна тривога |

## Що саме всередині
- **cm-04** (page.html + theme/style.css, TASK з трьома хибними твердженнями): зірковий рейтинг лише aria-hidden; іконки так/ні в
  таблиці без alt; canonical з utm; reviewCount 128 проти «12 owner reviews»; dateModified раніше datePublished і проти байлайну;
  один з чотирьох партнерських лінків без rel=sponsored; дисклоужер лише в кінці після всіх лінків; три різні ціни ($79/$89/69.00);
  **CTA-блок втратив auto-margins** через `.entry-content .cta-box{margin:28px 0}` у темі (видно лише на 1280 px); «vet-recommended, −40 %
  hairballs» без джерела. Декої: hero без alt (є), noindex (нема), FAQ-схема відсутня (є); питання про комісії (даних нема).
- **cm-05** (article.html + references.html): «93 % за 2 тижні» проти джерела [1] «43 % за 12 тижнів»; FAQ про вагітність суперечить
  тілу; «Medically reviewed by» з порожнім span і без дати/reviewedBy; dateModified < datePublished; два canonical; **sponsored-картка під
  розділом про рецептурний крем з заявою «працює не гірше за рецептурний» — critical** (користувача штовхають до покупки обманом);
  colour-only тріаж-крапки; битий якір #causes (minor за рубрикою); посилання [3] на неіснуюче джерело; alt="image" на трьох фото.
  Усі препарати, дослідження й журнали вигадані; реальних медичних порад фікстура не дає. Декої: нема біо автора (є), нема FAQ-схеми
  (є), sponsored-лінк без rel (є); питання про відповідність «правилам нашої країни» (країну не названо).
- **cm-06** (accordion.mjs/css, index.html, SPEC.md, tests/): single-mode toggle не закриває попередню панель; End дає індекс n
  (критично для клавіатури); aria-controls через індекс замість id; `.acc .acc-panel{display:block}` перебиває `[hidden]` (critично:
  акордеон не згортається); title не екранується (тільки SPEC + прихований тест). Публічні тести на зламаній версії 2/5, приховані 2/7;
  еталон key/reference проходить 12/12. Декой: «ArrowDown теж зламаний» (ні).
- **cm-07** (live/, candidate/, CHANGELOG.md, api/README.md): r2 шле `{emailAddress}` замість `{email}` і показує «Thanks!» без перевірки
  статусу → жодна підписка не проходить (critical, крос-файл з контрактом API); видалені брейкпоінти .grid → 3 колонки на 390 px;
  canonical на staging-хост. Нешкідливе: Blog→Journal, перейменування CSS-змінних (усі 7 використань оновлені), PNG→WebP, перенесений
  аналітичний тег + прибраний console.log. Звіт SHIP з 0 регресій = false PASS (recall 0/3); кожна «тривога» по H01–H04 = хибна заявка.

## Precheck на папері (стеля і ролі)
- Стеля = baseline recall ≥ 0.95 (AL-02). cm-01 був на стелі (8/8), cm-02 9/10, cm-03 9.33/10, тож нові кейси зроблено жорсткішими:
  у кожному є дефекти, видимі лише при зіставленні двох файлів або двох віддалених фрагментів (cm-04 D04/D05/D08/D09, cm-05 D01/D02/D09,
  cm-07 D01/D02), «присутнє, але неправильне» замість «відсутнє» (D03 canonical з utm, D07 дисклоужер є, але не там, alt="image",
  порожній reviewer-span), і калібрувальні пастки (cm-05 D08 minor, cm-04 D08 major, cm-06 D02/D04 critical за названим критерієм).
  Очікування: компетентний baseline 60–80 % recall, не 95 %. Якщо локальний precheck покаже стелю, найімовірніший винуватець —
  надто широкі детектори (перевірте `detail.hits` на збіг через нецільовий рядок), а не занадто легкі дефекти.
- cm-06 для вузьких ролей: vulcan вирішує за тестами (3 видимі регресії), але D04 (CSS) і D05 (SPEC) поза тестами — там і різниця.
- cm-07 перевіряє саме те, чого бракувало PROVISIONAL-рішенням: не recall, а хибні тривоги (4 пастки) і false PASS.

## Як підключити
1. Скопіювати `fixtures/cm-04..07` у `learning/fixtures/`, додати записи з `eval-set.patch.json` у `learning/eval-set.json` (поля
   `tier`, `uses`, `deliverables` нові — скрипти їх ігнорують, читач — ні). Нічого в наявних фікстурах не змінено.
2. cm-04, cm-05, cm-07 — звичайний `regress prepare/collect/grade` (type workspace, key + decoys).
3. cm-06 — `regress.mjs` жорстко прописує `billing.mjs` у prepare (writes) і grade-build; потрібна мінімальна правка: копіювати `dir` у
   workspace, `writes` = `deliverables`, у grade-build копіювати всі `deliverables` + `tests` у temp і запускати `node --test`.
   Звіт гейтиться як звичайно через key/decoys. Еталон `key/reference/` — тільки для перевірки прихованих тестів, агенту не давати.
4. Перед candidate-прогонами заморозити ключі (KEY_LOCK). Рекомендація: цей самий файл `CASES.md` не показувати агентам.
