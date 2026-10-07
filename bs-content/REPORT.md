# BS-CONTENT — REPORT (2026-10-07, cloud Claude; drafts only, live site not touched)

## Стислий підсумок (UA)
Підготовано три нові статті для BowlScout у тих нішах, де є пошуковий попит, але на сайті немає жодної картки товару: (1) таймерні та кнопкові диспенсери ласощів для собак, (2) годівниці для вуличних і фермерських котів, (3) автогодівниці для малих собак і цуценят. Для кожної — title, meta (≤155), H1, план, повний чернетковий текст (1,6–1,8 тис. слів), 5 товарів із посиланнями на сторінки виробників і HTML-картки у точному форматі сайту. 15 карток: 8 з наявними ASIN, 7 з `ASIN_TBD` для NEXUS. Обмеження: прямий доступ до сайтів виробників був заблокований мережевою політикою середовища, тож характеристики взято з тексту сторінок виробників у результатах пошуку та з пакета AFF-4; усе неперевірене позначено. Нічого не опубліковано.

## Topics and why (gap + intent, no traffic numbers)
1. `/treat-dispensers/timed` — the hub's "Timed and Scheduled" and "Button-Press" sections have no products; AFF-4 found none. Shopping intent ("timed dog treat dispenser", "treat dispenser button"). Cards: Petcube Bites 2 Lite (in-app schedule), Furbo 360° (Alexa schedule, Nanny auto-toss), Instachew Purechew Snack (Low), TRIXIE Memory Trainer 3.0 (dog-pressed), PetSafe Teach & Treat (owner remote). eufy D605 is named as a documented non-scheduler.
2. `/cat-feeders/outdoor` — no page for porch/barn/feral cats; /dog-feeders/outdoor has the "no sourced Amazon product" problem, so this page uses products whose makers state outdoor use: K&H Thermo-Kitty Café, K&H Thermal-Bowl, Petmate Pet Cafe Feeder, Dog Mate 8 L cordless fountain, plus Cat Mate C3000 labelled "no outdoor rating, enclosed rooms only". SureFeed and PetSafe Water Station cited as documented indoor-only.
3. `/dog-feeders/small-dogs` — the site cites PetSafe's "cats and small to medium-sized dogs" only as an exclusion; no page serves those owners. All five cards reuse items-db ASINs (Simply Feed, Smart Feed 2nd Gen, 5 Meal Pet Feeder, Feeder-Robot, Granary WiFi), so it can go live first.

## Deliverables (zip: bs-content-results.zip; also unpacked in bs-content/)
- `articles/<slug>.md` ×3: front matter (title, meta, H1, hero alt), why, outline, full draft with cards, product table with sources.
- `articles/<slug>.html` ×3: wp:html body in the v2-guide markup (breadcrumbs, AI buttons, hero placeholder `HERO_IMAGE_URL_TBD`, disclosure, TOC, quick answer, cards, table, scout note, checklist, next-step, FAQ). Card template is the package's exact format with `[bs_amazon_img asin="…" alt="…"]`.
- `products.md`: every candidate with maker URL, specs used, amazon.com evidence, confidence, NEXUS lookup list.
- Word counts (body, excl. cards/front matter): treat 1,754 · outdoor cats 1,671 · small dogs 1,608. Meta: 154 / 148 / 152 chars. Internal links checked against pages.json; cross-links between the three new pages are not used (they do not exist yet).

## Method and limitation
- Rules applied: documented manufacturer specs only, no prices (0 "$" in output), no hands-on claims, "Best for:" only inside the site's card format, every spec labelled when not verified.
- **Network:** the environment's network policy denied CONNECT to petsafe.com, petcube.com, service.eufy.com and other maker hosts (403 from the egress proxy), and WebFetch returned EGRESS_BLOCKED. Specs were taken from manufacturer-domain text returned by domain-restricted search (2026-10-07) and from AFF-4's direct fetches (C01, C03, C04, C10, C14, C22). Amazon pages were not opened. To allow direct fetches next time, add the maker domains under Allowed domains in the environment's Network access settings.

## Risks / open items
- Instachew Purechew Snack: amazon.com listing unconfirmed (Low). Drop T05 if the plugin finds nothing; the article still has 4 cards.
- Dog Mate amazon listing (B0GPY5H2XW) reads "USB powered"; confirm it is the cordless 830 before inserting O04.
- Smart Feed ASIN B07NR47N2Q: confirm "2nd Generation" (first-gen B073WYP317 exists).
- Hero images: none supplied; placeholder in each HTML. Scout-note image reuses the existing site asset.
- Article 2 states that the live raccoon-proof page's "Cat Mate outdoor-rated models" wording "is being corrected" (AFF-4 finding 2); editor should either fix that page or soften the sentence before publishing.

## Requested review
- NEXUS: resolve the 7 `ASIN_TBD` items in products.md §D; check titles against model/variant notes; upload 3 hero images.
- Editor: tone pass; decide on T05 and O04; add the three new pages to hub link grids (/treat-dispensers types section, /cat-feeders, /dog-feeders) and to /dog-feeders/large-dogs and /cat-feeders/raccoon-proof context links.
- Owner: approve before anything is published.
