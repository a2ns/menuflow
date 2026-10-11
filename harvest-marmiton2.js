const { importFromUrl } = require('./importer');
const path = require('path');
eval(require('fs').readFileSync(path.join(__dirname, '../tmp/estimation.js'), 'utf8'));

(async () => {
  const cats = ['dessert', 'entree', 'soupe'];
  const seen = new Set();
  const all = [];
  for (const cat of cats) {
    const res = await fetch('https://www.marmiton.org/recettes/index/categorie/' + cat + '/', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href="(\/recettes\/recette_[^"]+\.aspx)"/g)].map(m => m[1]))];
    for (const l of links) {
      if (seen.has(l)) continue;
      seen.add(l);
      const url = 'https://www.marmiton.org' + l;
      try {
        const r = estimateMacros(await importFromUrl(url));
        if (r.kcal_per_serving > 150 && (r.ingredients || []).length >= 3) {
          all.push({ ...r, url });
          console.log('OK', r.name.slice(0, 45), '|', r.kcal_per_serving, 'kcal | P', r.protein_g, 'C', r.carbs_g, 'F', r.fat_g, '|', (r.ingredients || []).length, 'ing');
        } else {
          console.log('skip', r.name.slice(0, 40), '| kcal:', r.kcal_per_serving);
        }
      } catch (e) {
        console.log('err', l.slice(11, 60), e.message.slice(0, 40));
      }
    }
  }
  require('fs').writeFileSync('/tmp/harvest-marmiton2.json', JSON.stringify(all, null, 2));
  console.log('---TOTAL:', all.length, 'recettes Marmiton valides');
})();
