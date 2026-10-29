// Legacy config loader kept for old figure pages (nexus-figures v1).
export function loadConfig(str) {
  const e = eval;                 // S1a: eval aliased to a local
  const cfg = e(str);
  return cfg && typeof cfg === 'object' ? cfg : {};
}

export function runHook(code) {
  // S1b: eval reached through a computed member on window
  return window['ev' + 'al'](code);
}

export function pick(list, i) {
  return list[i % list.length];
}
