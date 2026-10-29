# Bug report: comparison table shows wrong weights for US spec sheets

Module: `src/units.mjs` (ES module, Node 22, no dependencies).

Our table converts manufacturer spec sheets to grams. A reader pointed out that a thermos listed as "1 lb 4 oz" shows 565 g in our table, while the manufacturer's metric sheet says 567 g; and a keyboard listed as "2.2 lb" shows 996.6 g instead of 998 g. The differences are small but readers compare these numbers, and several products are now in the wrong order in the "lightest first" sort.

Please fix the conversion so that imperial masses match the metric sheets to within 0.1 g (international avoirdupois definitions). Keep the public functions and their signatures. You may add tests. Do not touch files outside this folder.
