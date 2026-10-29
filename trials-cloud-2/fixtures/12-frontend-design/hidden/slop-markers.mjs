// Automatic "AI design slop" marker counter (SECONDARY metric, not part of the score).
// Usage as CLI: node slop-markers.mjs <run-dir>   → JSON counts (renders at 1280 px)
// Usage as lib: collectSlopMarkers(page) with a playwright page already on the run page.

export async function collectSlopMarkers(page) {
  const raw = await page.evaluate(() => {
    const out = { gradientText: 0, glowStacks: 0, eyebrowLabels: 0, eyebrowPills: 0, iconTileGrids: 0, purpleBlueGradients: 0,
      fontFamilies: [], headingEmoji: 0, samples: {} };
    const sample = (k, el) => { (out.samples[k] ||= []); if (out.samples[k].length < 3) out.samples[k].push((el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')).slice(0, 60)); };
    const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE']);
    const all = [...document.querySelectorAll('body *')].filter((el) => !skip.has(el.tagName) && !(el instanceof SVGElement && el.tagName !== 'svg'));
    const fams = new Set();
    const hue = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn; if (d < 0.08 || mx < 0.12) return null;
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = Math.round(h * 60); return h < 0 ? h + 360 : h; };
    const colors = (s) => [...s.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat));
    const splitTop = (s) => { const parts = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch; } if (cur.trim()) parts.push(cur); return parts; };
    const blurOf = (sh) => { const L = (sh.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat); return L.length >= 3 ? L[2] : 0; };
    const emoji = /\p{Extended_Pictographic}/u;
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const isHeading = (n) => !!n && /^H[1-4]$/.test(n.tagName);
    const transparent = (c) => !c || c === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)/.test(c);

    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const fam = (cs.fontFamily.split(',')[0] || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (fam && el.textContent.trim()) fams.add(fam);

      const clip = cs.webkitBackgroundClip || cs.backgroundClip;
      if (clip === 'text' && cs.backgroundImage.includes('gradient') && (transparent(cs.webkitTextFillColor) || transparent(cs.color))) { out.gradientText++; sample('gradientText', el); }

      let glow = false;
      if (cs.boxShadow && cs.boxShadow !== 'none') { const parts = splitTop(cs.boxShadow); if (parts.length >= 3 || parts.some((p) => blurOf(p) > 20)) glow = true; }
      if (!glow && cs.textShadow && cs.textShadow !== 'none') { if (splitTop(cs.textShadow).some((p) => blurOf(p) > 20)) glow = true; }
      if (glow) { out.glowStacks++; sample('glowStacks', el); }

      for (const pseudo of [null, '::before', '::after']) {
        const s = pseudo ? getComputedStyle(el, pseudo) : cs;
        if (pseudo && (s.content === 'none' || s.display === 'none')) continue;
        const bg = s.backgroundImage;
        if (bg && bg.includes('gradient')) {
          const hs = colors(bg).filter((c) => c.length < 4 || c[3] > 0).map((c) => hue(c[0], c[1], c[2])).filter((h) => h !== null);
          if (hs.some((h) => h >= 255 && h <= 305) && hs.some((h) => h >= 195 && h < 255)) { out.purpleBlueGradients++; sample('purpleBlueGradients', el); }
        }
      }

      const fs = parseFloat(cs.fontSize), ls = parseFloat(cs.letterSpacing);
      const txt = el.textContent.trim();
      if (cs.textTransform === 'uppercase' && fs <= 14 && ls >= 0.04 * fs && txt.length >= 2 && txt.length <= 40 && !el.closest('button, a, select, label, option, th')
        && (isHeading(el.nextElementSibling) || (el.parentElement && el.parentElement.children.length === 1 && isHeading(el.parentElement.nextElementSibling)))) {
        out.eyebrowLabels++; sample('eyebrowLabels', el);
        const rounded = parseFloat(cs.borderTopLeftRadius) >= 8;
        const boxed = !transparent(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0;
        if (rounded && boxed) { out.eyebrowPills++; sample('eyebrowPills', el); }
      }

      const kids = [...el.children].filter((k) => visible(k) && !(k instanceof SVGElement));
      if (kids.length >= 3 && kids.length <= 12) {
        const rects = kids.map((k) => k.getBoundingClientRect());
        const same = rects.every((r) => Math.abs(r.width - rects[0].width) <= 2 && Math.abs(r.height - rects[0].height) <= 2);
        if (same && kids.every((k) => { const ks = getComputedStyle(k); const text = k.textContent.trim();
          const icon = k.querySelector(':scope > svg, :scope > * > svg, :scope > * > * > svg') || emoji.test(text.slice(0, 4));
          return parseFloat(ks.borderTopLeftRadius) >= 8 && !!icon && text.length > 0 && text.length <= 90 && !k.querySelector('img'); })) { out.iconTileGrids++; sample('iconTileGrids', el); }
      }
    }
    for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) if (/[✨\u{1F680}]/u.test(h.textContent)) { out.headingEmoji++; sample('headingEmoji', h); }
    out.fontFamilies = [...fams].filter((f) => f && !['inherit', 'initial'].includes(f));
    return out;
  });
  const fontCount = raw.fontFamilies.length;
  const total = raw.gradientText + raw.glowStacks + raw.eyebrowLabels + raw.iconTileGrids + raw.purpleBlueGradients + raw.headingEmoji + Math.max(0, fontCount - 3);
  return { ...raw, fontFamilyCount: fontCount, tooManyFonts: fontCount > 3, total };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const { serveDir, launchBrowser, openPage, VIEWPORTS } = await import('./harness.mjs');
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node slop-markers.mjs <run-dir>'); process.exit(2); }
  const server = await serveDir(new URL('file://' + (dir.startsWith('/') ? dir : process.cwd() + '/' + dir)).pathname.replace(/\/$/, ''));
  const browser = await launchBrowser();
  try {
    const { page } = await openPage(browser, VIEWPORTS.desktop, server.url);
    console.log(JSON.stringify(await collectSlopMarkers(page)));
  } finally { await browser.close(); await server.close(); }
}
