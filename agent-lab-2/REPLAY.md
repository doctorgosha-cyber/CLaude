# AGENT-LAB-2: ретро-реплей AL-02 і AL-03 (0 викликів моделі)

Відтворити: `node scripts/replay-gates.mjs --out=learning/replay-al.json` (повний вивід: `replay-al.json`).

## AL-02 precheck (recall ≥ 0,95, severity ≥ 0,90; rep 1, де є per-rep)
| Baseline | Ціль | Середнє | Rep 1 | Precheck | Вердикт у ledger |
|---|---|---|---|---|---|
| RUN-014 | recall | 1,00 | – | **SKIP** | REJECT |
| RUN-023 | recall | 1,00 | – | **SKIP** | REJECT |
| corax-base/cm-02 | recall | 0,967 | 1,00 | **SKIP** | REJECT |
| RUN-013 · RUN-015 | recall | 0,929 · 0,68 | – | run | REJECT |
| cm-base/cm-02 · cm-03 | recall | 0,90 · 0,933 | 0,90 · 0,90 | run | ACCEPT |
| cm-base/cm-01 · corax/cm-01 · dorn/cm-01 | severity | 0,54 · 0,46 · 0,38 | – | run | ACCEPT · REJECT · ACCEPT |
| dorn-base/cm-03 | recall | 0,90 | 0,90 | run | REJECT |

Precheck позначає RUN-014 і RUN-023, як і вимагалося. Жоден ACCEPT не пропущено. Третій SKIP (corax cm-02) теж закінчився REJECT, бо recall упав на 0,10.

## AL-03 v3 по рядках ledger
Кожен рядок ledger містить лише 1 кейс, а v3 вимагає ≥ 2 кейси. Тому окремий рядок ніколи не дає ACCEPT.

| # | Пропозиція | Ціль | Ledger | v2 сьогодні | **v3** | +/− пари | p | Дані |
|---|---|---|---|---|---|---|---|---|
| 1 | R3-P3+P5 | sev | REJECT (prov) | REJECT (prov) | REJECT | 9/5 | 0,42 | GRADING.md |
| 2 | R5-severity-rubric | sev | ACCEPT | ACCEPT | PROVISIONAL | 24/7 | **0,003** | GRADING.md |
| 3 | R5-reviewer | sev | REJECT | REJECT | REJECT | 2/1 | 1 | GRADING.md |
| 4 | R7-domain-pass | recall | REJECT | REJECT | PROVISIONAL | 2/0 | 0,50 | GRADING.md |
| 5 | SEO-SENIOR-v1 | recall | REJECT | ACCEPT | PROVISIONAL | – | – | **немає** |
| 6–8 | SEO-v2 / v2-field / RUN-023 | recall | REJECT | REJECT | REJECT | – | – | **немає** |
| 9 | CM-SOLO cm-02 | recall | ACCEPT | ACCEPT | PROVISIONAL | 3/0 | 0,25 | REG + KEY |
| 10 | CM-SOLO cm-03 | recall | ACCEPT (prov) | ACCEPT (prov) | PROVISIONAL | 2/0 | 0,50 | REG + KEY |
| 11 | CM-SOLO cm-01 | sev | ACCEPT | ACCEPT | PROVISIONAL | 5/1 | 0,22 | REG + KEY |
| 12 | CM-CORAX cm-02 | recall | REJECT (prov) | REJECT (prov) | REJECT | 0/3 | 0,25 | REG + KEY |
| 13 | CM-CORAX cm-01 | sev | REJECT | REJECT | PROVISIONAL | 1/0 | 1 | REG + KEY |
| 14 | CM-DORN cm-03 | recall | REJECT (prov) | REJECT (prov) | REJECT | 2/2 | 1 | REG + KEY |
| 15 | CM-DORN cm-01 | sev | ACCEPT | ACCEPT | PROVISIONAL | 3/0 | 0,25 | REG + KEY |

**Разом по пропозиції** (та сама ціль, ≥ 2 кейси): у CM-SOLO-V1 recall на cm-02 + cm-03 дає 5/0 пар, p = 0,0625, отже **PROVISIONAL**. 5 пар з 5 у плюс — це межа: шоста пара в той самий бік дала б p = 0,031.

## Що це означає для минулих рішень
- **Жоден із 5 ACCEPT не проходить v3 як ACCEPT.** Усі 5 стають PROVISIONAL, жоден не стає REJECT. Напрям у всіх позитивний (24/7, 3/0, 2/0, 5/1, 3/0), але доказ слабкий.
- **R5-severity-rubric — найсильніший результат у пакеті:** 24 пари в плюс проти 7, p = 0,003. Йому бракує лише другого кейсу. Найдешевше підтвердження — 1 прогін на cm-02 або cm-03 (обидва нижче стелі за severity).
- **CM-SOLO-V1 і CM-DORN-V1 (P15)** уже застосовано. За v3 їх слід позначити PROVISIONAL і додати по 1 кейсу. Відкочувати не потрібно: напрям позитивний, false claims 0.
- **Рядки 4 і 13 змінюються з REJECT на PROVISIONAL.** v3 не застосовує поріг v2 («+0,02») і вимагає sign test, а PROVISIONAL **не застосовується** (exit 1). Рекомендую правило: PROVISIONAL = «зібрати ще кейс», а не «застосувати».
- **Рядок 5:** розбіжність між ledger і «v2 сьогодні» — ефект зміни версії гейта (v1 → v2, правило false-claim ratio), а не v3.

## Чесні застереження
1. **Рядки 5–8 (RUN-013/014/015/023): даних по дефектах у пакеті немає**, є лише агрегати before/after.json. Звітів чи таблиці GRADING.md немає, тому v3 не може їх перерахувати. Для рядків 6–8 вердикт REJECT тримається на вето v2, а не на v3.
2. **Повтори спаровано за індексом.** Пари rep i ↔ rep i (RUN-003: B1↔C1, B2↔C2) умовні: повтори незалежні, а не спаровані за задумом. Для sign test це припустимо, але інше спарування дасть трохи інші числа.
3. **Рядки 1–4 узято з таблиць сліпого грейдера (0/0,5/1).** Рядки 9–15 перераховано з `scoreReport` за KEY із теки оцінювання. Перерахунок збігся зі збереженими eval-файлами в усіх 14 файлах (drift 0). Але ключ CM-SOLO правили ще до збереження (RESULT.md:19-21), тож реплей цю правку не бачить. KEY_LOCK закриває цей ризик лише на майбутнє.
4. **p не скориговано на множинні порівняння.** Ledger має 15 рядків, а пул робиться по кейсах однієї пропозиції.
5. **Severity-пари рахуються лише там, де обидва плечі знайшли дефект**, тож зміна recall впливає на кількість severity-пар.

## Що змінено в коді (деталі в `changes.diff`)
- **`regress precheck`**: два виклики.
  - 1-й готує baseline з 1 повтору через звичайний `prepare --reps=1`.
  - 2-й оцінює кожен кейс. Якщо кейс на стелі, пише в ledger `SKIPPED_CEILING` з полями role і threshold. Поріг задається параметром `--threshold`.
  - Після цього `prepare --variant` пропускає такий кейс для тієї ж ролі; обійти можна через `--force-ceiling`.
- **Key lock**: `prepare` пише в ledger рядок `KEY_LOCK` з хешем sha256 файлів KEY/DECOYS або GROUND-TRUTH ще до першого повтору.
  - Повторний `prepare` того самого label зі зміненим ключем відмовляє.
  - `grade` додає хеші в eval-файл, а `gate --gate=v3` відмовляє (exit 2), якщо хеш не збігається з KEY_LOCK або ключі before/after різні.
  - Для старих файлів є прапорець `--allow-unlocked`, і в рядку ledger тоді пишеться `key_lock: "unchecked"`.
- **`grade` aggregate**: додано поле `per_defect` (матриця дефект × повтор). Решта полів без змін.
- **`learn gate`**: v2 лишається за замовчуванням і поводиться як раніше.
  - `--gate=v3` приймає файли через кому, які спаровуються за позицією, а також `--alpha` і `--min-cases`.
  - Цілі tokens/noise/cost/false_claims рахуються за логікою v2 для кожного кейсу.
- **Тести**: 12 нових, усі проходять. `npm test` дає 52 з 57. 5 падінь ті самі й без патча: у пакеті немає config/, agents/, checks/. Деталі в `TESTS.txt`.
