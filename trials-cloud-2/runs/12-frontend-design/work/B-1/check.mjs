// Static sanity checks only (QA runs a fuller browser suite). `npm test`
import { readFileSync, existsSync } from 'node:fs';
const problems = [];
for (const f of ['index.html', 'styles.css', 'app.js', 'data/products.json']) if (!existsSync(f)) problems.push(`missing ${f}`);
const html = existsSync('index.html') ? readFileSync('index.html', 'utf8') : '';
if (/\son[a-z]+\s*=/i.test(html)) problems.push('inline event handler attribute in index.html');
if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html)) problems.push('inline <script> block in index.html');
if (/<style[\s>]/i.test(html)) problems.push('<style> block in index.html');
if (/\sstyle\s*=/i.test(html)) problems.push('inline style= attribute in index.html');
if (/(src|href)\s*=\s*["']?(https?:)?\/\//i.test(html)) problems.push('external resource in index.html');
if (!/<script[^>]*src=["']app\.js["']/i.test(html)) problems.push('index.html does not load app.js');
if (!/<link[^>]*href=["']styles\.css["']/i.test(html)) problems.push('index.html does not load styles.css');
const css = existsSync('styles.css') ? readFileSync('styles.css', 'utf8') : '';
if (/@import\s+(url\()?["']?https?:/i.test(css)) problems.push('external @import in styles.css');
for (const id of ['comparison-section','filter-species','filter-price-min','filter-price-max','sort-select','product-card','product-price','product-rating','compare-toggle','compare-bar','compare-count','compare-clear','empty-results']) {
  const src = html + (existsSync('app.js') ? readFileSync('app.js', 'utf8') : '');
  if (!src.includes(id)) problems.push(`data-testid "${id}" not found in index.html/app.js`);
}
if (problems.length) { console.log(problems.map(p => ' - ' + p).join('\n')); process.exit(1); }
console.log('static checks passed');
