const fs = require('fs');
const { importFromUrl } = require('./importer');

const LETTERS = 'abcdefghiklmnoprstvw'.split('');
const BASE = 'https://jow.com/fr/site-map/recipes/letter-';
const TARGET = 30 + 42;
const MIN_ING = 4;
const MIN_KCAL = 250;
const MAX_KCAL = 900;

function fetchText(url) {
  return fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' } })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const prev = fs.existsSync('/tmp/jow-harvest.json') ? JSON.parse(fs.readFileSync('/tmp/jow-harvest.json')) : [];
  const prevUrls = new Set(prev.map(r => r.url));
  console.log('Already harvested:', prev.length);
  const seen = new Set();
  const candidates = [];
  for (const L of LETTERS) {
    if (candidates.length >= TARGET * 3) break;
    try {
      const html = await fetchText(BASE + L);
      const links = [...html.matchAll(/href="(\/fr\/recipes\/[a-z0-9-]+)"/g)].map(m => 'https://jow.com' + m[1]);
      for (const l of links) {
        if (!seen.has(l)) { seen.add(l); candidates.push(l); }
      }
      console.log(`letter ${L}: +${links.length} (total ${candidates.length})`);
    } catch (e) { console.log(`letter ${L} failed: ${e.message}`); }
    await sleep(500);
  }

  const out = [...prev];
  const kept = prev.length;
  for (const url of candidates) {
    if (out.length >= kept + TARGET) break;
    if (prevUrls.has(url)) continue;
    try {
      const r = await importFromUrl(url);
      if (!r.name || r.ingredients.length < MIN_ING) { console.log('skip (few ing):', r.name); continue; }
      if (!r.kcal_per_serving || r.kcal_per_serving < MIN_KCAL || r.kcal_per_serving > MAX_KCAL) { console.log('skip (kcal):', r.name, r.kcal_per_serving); continue; }
      if (!r.protein_g || !r.carbs_g || !r.fat_g) { console.log('skip (macros):', r.name); continue; }
      out.push({
        name: r.name, url: r.url, image: r.image || null, source: 'jow.com',
        servings: r.servings || 2, prep_minutes: r.prep_minutes, cook_minutes: r.cook_minutes,
        kcal_per_serving: r.kcal_per_serving, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g,
        instructions: r.instructions, ingredients: r.ingredients
      });
      console.log(`OK (${out.length}/${TARGET}):`, r.name, r.kcal_per_serving, 'kcal');
    } catch (e) { console.log('fail:', url, e.message.slice(0, 80)); }
    await sleep(300);
  }

  fs.writeFileSync('/tmp/jow-harvest.json', JSON.stringify(out, null, 2));
  console.log('Harvested:', out.length, 'recipes -> /tmp/jow-harvest.json');
})();
