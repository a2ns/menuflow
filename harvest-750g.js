const { importFromUrl } = require('./importer');

const NUTRI_PER_100G = {
  'pâtes': { k: 350, p: 12, c: 70, f: 2 }, 'riz': { k: 350, p: 7, c: 76, f: 1 },
  'pomme de terre': { k: 80, p: 2, c: 17, f: 0 }, 'pain': { k: 270, p: 9, c: 50, f: 3 },
  'farine': { k: 350, p: 10, c: 72, f: 1 }, 'semoule': { k: 350, p: 12, c: 72, f: 1 },
  'lait': { k: 60, p: 3.2, c: 5, f: 3 }, 'crème': { k: 300, p: 2.5, c: 3, f: 30 },
  'beurre': { k: 750, p: 1, c: 1, f: 82 }, 'fromage': { k: 380, p: 25, c: 2, f: 30 },
  'mozzarella': { k: 280, p: 22, c: 2, f: 20 }, 'parmesan': { k: 400, p: 35, c: 2, f: 28 },
  'emmental': { k: 380, p: 28, c: 1, f: 29 }, 'comté': { k: 400, p: 30, c: 1, f: 32 },
  'cheddar': { k: 400, p: 25, c: 2, f: 33 }, 'yaourt': { k: 60, p: 4, c: 6, f: 2 },
  'œuf': { k: 140, p: 12, c: 1, f: 10 }, 'oeuf': { k: 140, p: 12, c: 1, f: 10 },
  'poulet': { k: 165, p: 31, c: 0, f: 4 }, 'boeuf': { k: 250, p: 26, c: 0, f: 15 },
  'veau': { k: 170, p: 30, c: 0, f: 6 }, 'porc': { k: 240, p: 27, c: 0, f: 14 },
  'agneau': { k: 260, p: 25, c: 0, f: 17 }, 'jambon': { k: 150, p: 22, c: 1, f: 6 },
  'lard': { k: 300, p: 12, c: 1, f: 28 }, 'saucisse': { k: 300, p: 15, c: 2, f: 25 },
  'merguez': { k: 300, p: 15, c: 2, f: 25 }, 'saumon': { k: 200, p: 20, c: 0, f: 13 },
  'thon': { k: 150, p: 25, c: 0, f: 5 }, 'cabillaud': { k: 90, p: 20, c: 0, f: 1 },
  'crevette': { k: 100, p: 21, c: 0, f: 1 }, 'moule': { k: 90, p: 12, c: 4, f: 2 },
  'huile': { k: 900, p: 0, c: 0, f: 100 }, 'olive': { k: 400, p: 1, c: 5, f: 40 },
  'sucre': { k: 400, p: 0, c: 100, f: 0 }, 'miel': { k: 300, p: 0, c: 80, f: 0 },
  'chocolat': { k: 550, p: 6, c: 60, f: 32 }, 'tomate': { k: 20, p: 1, c: 3, f: 0 },
  'oignon': { k: 40, p: 1, c: 8, f: 0 }, 'carotte': { k: 40, p: 1, c: 8, f: 0 },
  'courgette': { k: 20, p: 2, c: 3, f: 0 }, 'aubergine': { k: 25, p: 1, c: 5, f: 0 },
  'poivron': { k: 30, p: 1, c: 6, f: 0 }, 'champignon': { k: 25, p: 3, c: 3, f: 0 },
  'salade': { k: 20, p: 1, c: 3, f: 0 }, 'épinard': { k: 25, p: 3, c: 3, f: 0 },
  'haricot vert': { k: 30, p: 2, c: 5, f: 0 }, 'petit pois': { k: 80, p: 5, c: 13, f: 0 },
  'lentille': { k: 340, p: 24, c: 55, f: 1 }, 'pois chiche': { k: 360, p: 19, c: 60, f: 6 },
  'quinoa': { k: 370, p: 14, c: 64, f: 6 }, 'couscous': { k: 370, p: 12, c: 75, f: 2 },
  'avocat': { k: 160, p: 2, c: 8, f: 15 }, 'banane': { k: 90, p: 1, c: 22, f: 0 },
  'pomme': { k: 55, p: 0, c: 14, f: 0 }, 'citron': { k: 30, p: 1, c: 9, f: 0 },
  'ail': { k: 140, p: 6, c: 30, f: 0 }, 'échalote': { k: 70, p: 2, c: 16, f: 0 },
  'noix': { k: 650, p: 15, c: 15, f: 65 }, 'amande': { k: 600, p: 20, c: 20, f: 50 },
  'tortilla': { k: 300, p: 8, c: 50, f: 8 }, 'lasagne': { k: 350, p: 12, c: 70, f: 2 },
  'nouille': { k: 350, p: 12, c: 70, f: 2 }, 'tofu': { k: 120, p: 13, c: 2, f: 7 },
  'feta': { k: 260, p: 14, c: 4, f: 20 }, 'ricotta': { k: 170, p: 11, c: 3, f: 13 },
};

function normTxt(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe'); }

function estimateMacros(recipe) {
  if (recipe.kcal_per_serving > 0) return recipe;
  let kcal = 0, p = 0, c = 0, f = 0;
  const DENS_G = { 'c. à soupe': 12, 'c. à café': 5, g: 1, kg: 1000, cl: 10, ml: 1, l: 1000, tasse: 240, cup: 240, tranche: 30, gousse: 5, poignée: 40, pincée: 2 };
  for (const ing of recipe.ingredients || []) {
    const m = ing.match(/^([\d.,\/]+)\s*(c\. à soupe|c\. à café|g|kg|cl|ml|l|tasse|cup|tranche|gousse|poignée|pincée)?\s*(.*)$/i);
    if (!m) continue;
    const qty = parseFloat(m[1].replace(',', '.'));
    if (!Number.isFinite(qty)) continue;
    const unit = (m[2] || '').toLowerCase();
    const name = normTxt(m[3]);
    let grams = (DENS_G[unit] || 60) * qty;
    let matched = null;
    for (const key of Object.keys(NUTRI_PER_100G)) {
      if (name.includes(normTxt(key))) { matched = NUTRI_PER_100G[key]; break; }
    }
    if (matched) {
      kcal += matched.k * grams / 100;
      p += matched.p * grams / 100;
      c += matched.c * grams / 100;
      f += matched.f * grams / 100;
    } else {
      kcal += 1.5 * grams;
    }
  }
  const servings = recipe.servings || 2;
  return {
    ...recipe,
    kcal_per_serving: Math.round(kcal / servings),
    protein_g: Math.round(p / servings),
    carbs_g: Math.round(c / servings),
    fat_g: Math.round(f / servings),
  };
}

(async () => {
  const entryUrls = [
    'https://www.750g.com/recettes-plats.htm',
    'https://www.750g.com/recettes_plats.htm',
  ];
  const seen = new Set();
  const all = [];
  for (const entry of entryUrls) {
    const res = await fetch(entry, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href="(https:\/\/www\.750g\.com\/[^\"]*?r\d+\.htm)"/g)].map(m => m[1]))];
    for (const url of links) {
      if (seen.has(url)) continue;
      seen.add(url);
      try {
        const r = estimateMacros(await importFromUrl(url));
        if (r.kcal_per_serving > 150 && (r.ingredients || []).length >= 3) {
          all.push({ ...r, url });
          console.log('OK', r.name.slice(0, 45), '|', r.kcal_per_serving, 'kcal | P', r.protein_g, 'C', r.carbs_g, 'F', r.fat_g, '|', (r.ingredients || []).length, 'ing');
        } else {
          console.log('skip', r.name.slice(0, 40), '| kcal:', r.kcal_per_serving);
        }
      } catch (e) {
        console.log('err', url.slice(25, 60), e.message.slice(0, 40));
      }
    }
  }
  require('fs').writeFileSync('/tmp/harvest-750g.json', JSON.stringify(all, null, 2));
  console.log('---TOTAL:', all.length, 'recettes 750g valides');
})();
