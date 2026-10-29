// Generator for the 08-cspell fixtures. Run: node gen.mjs  (writes 10 fixture files + KEY.json next to itself)
// Clean texts are written by hand; seeded typos are applied by exact single-occurrence replacement so KEY.json is exact.
import { writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

const srt = (cues) => cues.map((t, i) => {
  const s = i * 5, e = s + 4;
  const ts = (x) => `00:00:${String(x).padStart(2, '0')},000`;
  return `${i + 1}\n${ts(s)} --> ${ts(e)}\n${t}\n`;
}).join('\n');

const SRT = {
  'thermos-en.srt': [
    'Meet the Thermoflask, a vacuum bottle that keeps coffee hot for twelve hours.',
    'It starts with two walls of stainless steel, one nested inside the other.',
    'Between them is almost nothing at all: a vacuum.',
    'Heat travels three ways: conduction, convection and radiation.',
    'With no air in the gap, conduction and convection have no path to follow.',
    'That leaves radiation, which a thin copper coating reflects back inside.',
    'The only bridge between the walls is the narrow neck at the top.',
    'Engineers make it as thin as possible to slow the leak of heat.',
    'The lid adds a final layer of insulation with a silicone gasket.',
    'Fill it with boiling water and the outside stays cool to the touch.',
    'Twelve hours later, your coffee is still above sixty degrees.',
    'This film is part of the Anatomy of Things series.',
  ],
  'thermos-es.srt': [
    'Este es el Thermoflask, una botella que mantiene el café caliente durante doce horas.',
    'Todo empieza con dos paredes de acero inoxidable, una dentro de la otra.',
    'Entre ellas no hay casi nada: un vacío.',
    'El calor viaja de tres maneras: conducción, convección y radiación.',
    'Sin aire en el hueco, la conducción y la convección no tienen camino.',
    'Queda la radiación, que una fina capa de cobre refleja hacia dentro.',
    'El único puente entre las paredes es el cuello estrecho de arriba.',
    'La técnica consiste en hacerlo lo más fino posible para frenar la fuga de calor.',
    'La tapa añade una última capa de aislamiento con una junta de silicona.',
    'Llénala con agua hirviendo y el exterior sigue frío al tacto.',
    'Doce horas después, el café sigue por encima de los sesenta grados.',
    'Esta película forma parte de la serie Anatomy of Things.',
  ],
  'thermos-pt.srt': [
    'Este é o Thermoflask, uma garrafa térmica que mantém o café quente por doze horas.',
    'Tudo começa com duas paredes de aço inoxidável, uma dentro da outra.',
    'Entre elas não há quase nada: um vácuo.',
    'O calor viaja de três formas: condução, convecção e radiação.',
    'Sem ar no espaço, a condução e a convecção não têm caminho.',
    'Resta a radiação, que uma fina camada de cobre reflete para dentro.',
    'A única ponte entre as paredes é o gargalo estreito no topo.',
    'Os engenheiros o fazem o mais fino possível para reduzir a perda de calor.',
    'A tampa acrescenta uma última camada de isolamento com uma vedação de silicone.',
    'Encha com água fervente e o exterior continua frio ao toque.',
    'Doze horas depois, a temperatura do café ainda passa dos sessenta graus.',
    'Este filme faz parte da série Anatomy of Things.',
  ],
  'switch-fr.srt': [
    "Voici l'interrupteur Kailh Box, le cœur d'un clavier mécanique.",
    'Chaque touche repose sur une tige qui glisse dans un boîtier en plastique.',
    'Un ressort pousse la tige vers le haut à chaque frappe.',
    'Quand la tige descend, deux lames de métal se touchent et ferment le circuit.',
    "La force d'actionnement se mesure en grammes-force, souvent entre 45 et 60 gf.",
    'Un interrupteur linéaire glisse sans à-coups du haut vers le bas.',
    "Un interrupteur tactile ajoute une petite bosse au point d'activation.",
    'Un interrupteur à clic ajoute un son net grâce à une barre de clic.',
    'Les Cherry MX utilisent une tige en croix que la plupart des touches acceptent.',
    'Le boîtier est souvent en polycarbonate pour laisser passer la lumière.',
    'Un bon interrupteur survit à plus de cinquante millions de frappes.',
    "Ce film fait partie de la série Anatomy of Things.",
  ],
  'switch-de.srt': [
    'Das ist der Kailh Box Schalter, das Herz einer mechanischen Tastatur.',
    'Jede Taste sitzt auf einem Stößel, der in einem Kunststoffgehäuse gleitet.',
    'Eine Feder drückt den Stößel nach jedem Anschlag wieder nach oben.',
    'Beim Herunterdrücken berühren sich zwei Metallblättchen und schließen den Stromkreis.',
    'Die Betätigungskraft wird in Grammkraft gemessen, meist zwischen 45 und 60 gf.',
    'Ein linearer Schalter gleitet ohne Widerstand von oben nach unten.',
    'Ein taktiler Schalter fügt am Auslösepunkt eine kleine Stufe hinzu.',
    'Ein klickender Schalter erzeugt mit einer Klickleiste ein deutliches Geräusch.',
    'Cherry MX Schalter nutzen einen Kreuzstößel, den fast jede Tastenkappe akzeptiert.',
    'Das Gehäuse besteht oft aus Polycarbonat, damit Licht hindurch scheint.',
    'Ein guter Schalter übersteht mehr als fünfzig Millionen Anschläge.',
    'Dieser Film gehört zur Reihe Anatomy of Things.',
  ],
  'thermos-uk.srt': [
    'Це Thermoflask, термос, який зберігає каву гарячою дванадцять годин.',
    'Усе починається з двох стінок із нержавіючої сталі, одна всередині іншої.',
    'Між ними майже нічого немає: вакуум.',
    'Тепло передається трьома шляхами: теплопровідністю, конвекцією та випромінюванням.',
    'Без повітря в проміжку теплопровідність і конвекція не мають шляху.',
    'Залишається випромінювання, яке тонкий шар міді відбиває назад.',
    'Єдиний місток між стінками — вузька шийка вгорі.',
    'Інженери роблять її якомога тоншою, щоб сповільнити витік тепла.',
    'Кришка додає останній шар ізоляції з силіконовою прокладкою.',
    'Налийте окріп, і зовні пляшка залишається прохолодною на дотик.',
    'Через дванадцять годин кава все ще гарячіша за шістдесят градусів.',
    'Цей фільм є частиною серії Anatomy of Things.',
  ],
};

const page = (lang, title, body) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  :root { --accent: oklch(62% 0.19 25); --ink: oklch(22% 0.02 260); }
  .hero { background: var(--accent); color: white; padding: 2rem; }
  .sku-badge { font-family: ui-monospace, monospace; }
</style>
</head>
<body>
${body}
<footer><small>Anatomy of Things &middot; WebGL demo requires a recent browser.</small></footer>
</body>
</html>
`;

const HTML = {
  'site-en.html': page('en', 'Kailh Box Red switch review', `<header class="hero">
<h1>Kailh Box Red: a linear switch for quiet typing</h1>
<p>We tested the Kailh Box Red against the Cherry MX Red for three weeks on a 65% keyboard.</p>
</header>
<main>
<p>The Box Red is a linear switch with an actuation force of 45 gf and a total travel of 3.6 mm.</p>
<p>Unlike a tactile switch, there is no bump at the actuation point, so the keystroke feels smooth from top to bottom.</p>
<p>The housing is a boxed stem design that keeps dust and spills away from the contact leaves.</p>
<p>Our sample came from batch <span class="sku-badge">KBOX-RED-0065-A2</span>; the Cherry MX reference was <span class="sku-badge">CMXR-0045-TYPE1</span>.</p>
<p>Colours in the chart below use oklch so that the red and blue series stay evenly bright; the 3D exploded view uses WebGL.</p>
<p>Verdict: a good keyboard switch for offices where a click would annoy your neighbours.</p>
</main>`),
  'site-de.html': page('de', 'Thermoflask 500 im Test', `<header class="hero">
<h1>Thermoflask 500: zwölf Stunden heißer Kaffee</h1>
<p>Wir haben die Thermoflask 500 drei Wochen lang im Alltag getestet.</p>
</header>
<main>
<p>Die Flasche besteht aus zwei Wänden aus Edelstahl, zwischen denen ein Vakuum liegt.</p>
<p>Ohne Luft im Zwischenraum kann Wärme weder durch Leitung noch durch Konvektion entweichen.</p>
<p>Eine dünne Kupferschicht reflektiert die Wärmestrahlung zurück in die Flasche.</p>
<p>Unser Testmuster trug die Artikelnummer <span class="sku-badge">TFLK-0500-SCHW</span>.</p>
<p>Nach zwölf Stunden hatte der Kaffee noch über sechzig Grad.</p>
<p>Fazit: eine robuste Flasche für Pendler, die ihren Kaffee wirklich heiß mögen.</p>
</main>`),
  'site-es.html': page('es', 'Interruptor Kailh Box Red: análisis', `<header class="hero">
<h1>Kailh Box Red: un interruptor lineal para escribir en silencio</h1>
<p>Probamos el Kailh Box Red frente al Cherry MX Red durante tres semanas en un teclado del 65%.</p>
</header>
<main>
<p>El Box Red es un interruptor lineal con una fuerza de activación de 45 gf y un recorrido total de 3,6 mm.</p>
<p>A diferencia de un interruptor táctil, no hay ningún escalón en el punto de activación, así que la pulsación se siente suave de arriba abajo.</p>
<p>La carcasa cerrada mantiene el polvo y los líquidos lejos de las láminas de contacto.</p>
<p>Nuestra muestra venía del lote <span class="sku-badge">KBOX-RED-0065-A2</span>.</p>
<p>Los colores del gráfico usan oklch para que las series roja y azul tengan el mismo brillo; la vista despiezada en 3D usa WebGL.</p>
<p>Veredicto: un buen interruptor para oficinas donde un clic molestaría a los vecinos.</p>
</main>`),
  'site-ru.html': page('ru', 'Переключатель Kailh Box Red: обзор', `<header class="hero">
<h1>Kailh Box Red: линейный переключатель для тихой печати</h1>
<p>Мы три недели сравнивали Kailh Box Red с Cherry MX Red на клавиатуре формата 65%.</p>
</header>
<main>
<p>Box Red — это линейный переключатель с усилием срабатывания 45 gf и полным ходом 3,6 мм.</p>
<p>В отличие от тактильного переключателя, здесь нет ступеньки в точке срабатывания, поэтому нажатие ощущается плавным от начала до конца.</p>
<p>Закрытый корпус защищает контактные пластины от пыли и пролитой жидкости.</p>
<p>Наш образец был из партии <span class="sku-badge">KBOX-RED-0065-A2</span>.</p>
<p>Цвета на графике заданы через oklch, чтобы красная и синяя серии были одинаково яркими; трёхмерный вид в разрезе сделан на WebGL.</p>
<p>Вывод: хороший переключатель для офиса, где щелчки мешали бы соседям по столу.</p>
</main>`),
};

// Seeded typos: [id, file, correct, typo, kind]
const TYPOS = [
  ['T1', 'thermos-en.srt', 'a vacuum bottle', 'a vaccum bottle', 'letter substitution (vacuum -> vaccum)'],
  ['T2', 'thermos-en.srt', 'insulation', 'insullation', 'doubled letter'],
  ['T3', 'thermos-es.srt', 'técnica', 'tecnica', 'missing accent'],
  ['T4', 'thermos-es.srt', 'aislamiento', 'aislami ento', 'split word (both halves non-words)'],
  ['T5', 'thermos-pt.srt', 'temperatura', 'temperatrua', 'transposed letters'],
  ['T6', 'switch-de.srt', 'Das Gehäuse', 'Das Gehäusse', 'doubled letter'],
  ['T7', 'thermos-uk.srt', 'ізоляції', 'ізоляцыї', 'wrong Cyrillic letter (Russian ы in a Ukrainian word)'],
  ['T8', 'site-en.html', 'a linear switch with', 'a linear swtich with', 'transposed letters'],
  ['T9', 'site-en.html', 'at the actuation point', 'at the actu ation point', 'split word (both halves non-words)'],
  ['T10', 'site-ru.html', 'на клавиатуре', 'на клавеатуре', 'wrong Cyrillic vowel (и -> е)'],
  ['T11', 'site-ru.html', 'тактильного переключателя', 'тактильного переклюючателя', 'doubled letter'],
  ['T12', 'site-en.html', 'a good keyboard switch', 'a good key board switch', 'split word into two REAL words (not detectable by a dictionary spellchecker)'],
];

const files = {};
for (const [name, cues] of Object.entries(SRT)) files[name] = srt(cues);
for (const [name, html] of Object.entries(HTML)) files[name] = html;

const key = { tool: 'cspell', note: 'Seeded typos applied by gen.mjs; line numbers are 1-based in the written file. SRT cue = cue index.', seeded: [], controls: [] };
for (const [id, file, correct, typo, kind] of TYPOS) {
  const txt = files[file];
  const n = txt.split(correct).length - 1;
  if (n !== 1) throw new Error(`${id}: '${correct}' occurs ${n} times in ${file}`);
  files[file] = txt.replace(correct, typo);
  const line = files[file].slice(0, files[file].indexOf(typo)).split('\n').length;
  const cue = file.endsWith('.srt') ? Math.floor((line - 1) / 4) + 1 : null;
  const typoWord = typo.split(' ').filter(w => !correct.split(' ').includes(w));
  const correctWord = correct.split(' ').filter(w => !typo.split(' ').includes(w));
  key.seeded.push({ id, file, line, cue, typo: typoWord.join(' '), correct: correctWord.join(' '), kind, expected_flag: 'cspell: Unknown word', detectable_by_dictionary: id !== 'T12' });
}
for (const [name, txt] of Object.entries(files)) {
  writeFileSync(join(here, name), txt);
  if (!TYPOS.some(t => t[1] === name)) key.controls.push(name);
}
key.jargon_in_clean_text = ['Thermoflask', 'Kailh', 'Cherry MX', 'gf', 'oklch', 'WebGL', 'Anatomy of Things', 'SKU codes KBOX-RED-0065-A2 / CMXR-0045-TYPE1 / TFLK-0500-SCHW'];
writeFileSync(join(here, 'KEY.json'), JSON.stringify(key, null, 2) + '\n');
console.log('wrote', Object.keys(files).length, 'files; controls:', key.controls.join(', '));
