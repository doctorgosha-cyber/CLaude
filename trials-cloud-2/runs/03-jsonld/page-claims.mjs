// "Claims not on the page" check (no off-the-shelf validator does this):
//  - aggregateRating needs >=1 visible review: [itemprop=review], .review, or a Review node in the JSON-LD
//  - FAQPage: every acceptedAnswer.text (and question name) must appear in the page text after whitespace normalisation
import { norm } from './extract.mjs';
const hasReviewMarkup = (html) => /itemprop\s*=\s*["']?review\b/i.test(html) || /class\s*=\s*["'][^"']*\breview\b[^"']*["']/i.test(html);
export function pageClaims(nodes, text, html) {
  const findings = []; const t = norm(text);
  const walk = (n, fn) => { if (Array.isArray(n)) return n.forEach(x => walk(x, fn)); if (n && typeof n === 'object') { fn(n); Object.values(n).forEach(v => walk(v, fn)); } };
  let anyReviewNode = false; walk(nodes, n => { if (n['@type'] === 'Review') anyReviewNode = true; });
  walk(nodes, n => {
    if (n.aggregateRating && !anyReviewNode && !hasReviewMarkup(html))
      findings.push({ rule: 'page-claims/aggregateRating', msg: 'aggregateRating but no visible review ([itemprop=review], .review) and no Review in JSON-LD' });
    if (n['@type'] === 'FAQPage') for (const q of [].concat(n.mainEntity || [])) {
      const a = q.acceptedAnswer && q.acceptedAnswer.text;
      if (q.name && !t.includes(norm(q.name))) findings.push({ rule: 'page-claims/faq', msg: `question not in page text: "${q.name}"` });
      if (a && !t.includes(norm(a))) findings.push({ rule: 'page-claims/faq', msg: `answer not in page text: "${String(a).slice(0, 60)}"` });
    }
  });
  return findings;
}
