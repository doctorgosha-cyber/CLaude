// Generates 12 HTML fixtures with embedded JSON-LD (6 seeded J1..J6, 6 clean C1..C6) + KEY.json
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));

const page = (title, body, ld) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head><body>
<header><nav><a href="/">Home</a> &rsaquo; <a href="/dog-food/">Dog food</a></nav></header>
<main>
<h1>${title}</h1>
${body}
</main>
<footer>&copy; 2026 Example Pet Reviews</footer>
</body></html>
`;

const org = { '@type': 'Organization', name: 'Example Pet Reviews', logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' } };
const okOffer = { '@type': 'Offer', price: '29.99', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: 'https://example.com/buy/acme-kibble' };
const product = (extra = {}) => ({ '@context': 'https://schema.org', '@type': 'Product', name: 'Acme Salmon Kibble 12 kg', image: 'https://example.com/kibble.jpg', description: 'Grain-free salmon kibble for adult dogs.', brand: { '@type': 'Brand', name: 'Acme' }, sku: 'ACME-12', ...extra });
const productBody = `<p>Grain-free salmon kibble for adult dogs. Price: 29.99 EUR, in stock.</p>`;

const reviewList = `
<section class="reviews">
<h2>Reader reviews</h2>
<article class="review" itemprop="review"><strong>Anna K.</strong> <span class="stars">5/5</span><p>My lab loves it and his coat improved in three weeks.</p></article>
<article class="review" itemprop="review"><strong>Ben O.</strong> <span class="stars">4/5</span><p>Good value; the kibble is a bit large for small dogs.</p></article>
</section>`;

const faqQA = [
  ['How much should I feed a 20 kg adult dog?', 'Feed about 250 g per day split into two meals, and adjust by body condition.'],
  ['Is the kibble suitable for puppies?', 'No, this recipe is formulated for adult dogs; use the puppy formula under 12 months.'],
  ['Does it contain grain?', 'The salmon recipe is grain-free; the chicken recipe contains rice.'],
];
const faqLd = (qa) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const faqBody = (qa) => `<dl class="faq">${qa.map(([q, a]) => `\n<dt>${q}</dt>\n<dd>${a}</dd>`).join('')}\n</dl>`;

const reviewLd = (extra = {}, omit = []) => { const r = { '@context': 'https://schema.org', '@type': 'Review', name: 'Acme Salmon Kibble review', author: { '@type': 'Person', name: 'Maria Lind' }, datePublished: '2026-09-02', reviewBody: 'We fed Acme Salmon Kibble to three dogs for six weeks. Coats improved, stools firm.', reviewRating: { '@type': 'Rating', ratingValue: 4, bestRating: 5 }, itemReviewed: { '@type': 'Product', name: 'Acme Salmon Kibble 12 kg', image: 'https://example.com/kibble.jpg' }, publisher: org, ...extra }; for (const k of omit) delete r[k]; return r; };
const reviewBody = `<p class="byline">By Maria Lind, 2 Sep 2026. Rating: 4/5</p><p>We fed Acme Salmon Kibble to three dogs for six weeks. Coats improved, stools firm.</p>`;

const files = {
  // ---- seeded ----
  'j1-rating-no-reviews.html': page('Acme Salmon Kibble 12 kg', productBody,
    product({ offers: okOffer, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.6, reviewCount: 38 } })),
  'j2-product-no-name.html': page('Acme Salmon Kibble 12 kg', productBody,
    (() => { const p = product({ offers: okOffer }); delete p.name; return p; })()),
  'j3-price-symbol.html': page('Acme Salmon Kibble 12 kg', productBody.replace('29.99 EUR', '$29.99'),
    product({ offers: { ...okOffer, price: '$29.99', priceCurrency: 'USD' } })),
  'j4-availability-text.html': page('Acme Salmon Kibble 12 kg', productBody,
    product({ offers: { ...okOffer, availability: 'in stock' } })),
  'j5-faq-answer-missing.html': page('Feeding FAQ', faqBody(faqQA.slice(0, 2)),
    faqLd([...faqQA.slice(0, 2), ['Can I mix it with wet food?', 'Yes, replace up to a third of the daily kibble with wet food of the same brand.']])),
  'j6-review-no-itemreviewed.html': page('Acme Salmon Kibble review', reviewBody, reviewLd({}, ['itemReviewed'])),
  // ---- clean controls ----
  'c1-product-offers.html': page('Acme Salmon Kibble 12 kg', productBody, product({ offers: okOffer })),
  'c2-product-rating-reviews.html': page('Acme Salmon Kibble 12 kg', productBody + reviewList,
    product({ offers: okOffer, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 2 },
      review: [
        { '@type': 'Review', author: { '@type': 'Person', name: 'Anna K.' }, reviewRating: { '@type': 'Rating', ratingValue: 5 }, reviewBody: 'My lab loves it and his coat improved in three weeks.' },
        { '@type': 'Review', author: { '@type': 'Person', name: 'Ben O.' }, reviewRating: { '@type': 'Rating', ratingValue: 4 }, reviewBody: 'Good value; the kibble is a bit large for small dogs.' },
      ] })),
  'c3-faq.html': page('Feeding FAQ', faqBody(faqQA), faqLd(faqQA)),
  'c4-review.html': page('Acme Salmon Kibble review', reviewBody, reviewLd()),
  'c5-article.html': page('How to switch your dog to a new kibble', `<p class="byline">By Maria Lind, 12 Oct 2026</p><p>Switch over seven days: mix 25 % new food on days 1-2, 50 % on days 3-4, 75 % on days 5-6.</p>`,
    { '@context': 'https://schema.org', '@type': 'Article', headline: 'How to switch your dog to a new kibble', image: ['https://example.com/switch.jpg'], author: { '@type': 'Person', name: 'Maria Lind', url: 'https://example.com/about/maria' }, datePublished: '2026-10-12T08:00:00+01:00', dateModified: '2026-10-14T09:30:00+01:00', publisher: org, mainEntityOfPage: 'https://example.com/guides/switch-kibble' }),
  'c6-breadcrumb.html': page('Dog food', `<p>All dog food reviews.</p>`,
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
      { '@type': 'ListItem', position: 2, name: 'Dog food', item: 'https://example.com/dog-food/' },
      { '@type': 'ListItem', position: 3, name: 'Acme Salmon Kibble 12 kg' } ] }),
};
for (const [f, html] of Object.entries(files)) writeFileSync(join(here, f), html);

const key = {
  description: '12 HTML pages with one <script type="application/ld+json"> each. J1..J6 seeded defects, c1..c6 clean controls. Generated by gen.mjs.',
  seeded: [
    { id: 'J1', file: 'j1-rating-no-reviews.html', location: 'Product.aggregateRating', what: 'aggregateRating (38 reviews) but no visible review on the page and no Review in the JSON-LD (Google: ratings must be backed by reviews shown on the page)', check: 'page-claims: aggregateRating without [itemprop=review]/.review/JSON-LD review' },
    { id: 'J2', file: 'j2-product-no-name.html', location: 'Product', what: 'Product has no required "name"', check: 'JSON Schema: Product.required name' },
    { id: 'J3', file: 'j3-price-symbol.html', location: 'Product.offers.price', what: 'price is "$29.99" (currency symbol inside the price string)', check: 'JSON Schema: Offer.price number or numeric string pattern' },
    { id: 'J4', file: 'j4-availability-text.html', location: 'Product.offers.availability', what: 'availability is the free text "in stock" instead of https://schema.org/InStock', check: 'JSON Schema: Offer.availability enum of schema.org ItemAvailability URLs' },
    { id: 'J5', file: 'j5-faq-answer-missing.html', location: 'FAQPage.mainEntity[2].acceptedAnswer.text', what: 'third Q/A ("Can I mix it with wet food?") exists only in JSON-LD, not in the HTML body', check: 'page-claims: each acceptedAnswer.text must appear in the normalised page text' },
    { id: 'J6', file: 'j6-review-no-itemreviewed.html', location: 'Review', what: 'Review has no itemReviewed', check: 'JSON Schema: Review.required itemReviewed' },
  ],
  controls: ['c1-product-offers.html', 'c2-product-rating-reviews.html', 'c3-faq.html', 'c4-review.html', 'c5-article.html', 'c6-breadcrumb.html'],
};
writeFileSync(join(here, 'KEY.json'), JSON.stringify(key, null, 2) + '\n');
console.log('wrote', Object.keys(files).length, 'fixtures + KEY.json');
