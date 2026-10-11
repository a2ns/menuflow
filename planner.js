const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const SLOTS = ['lunch', 'dinner'];

function kcalOf(recipe) {
  const k = recipe.kcal_per_serving || 0;
  if (k > 0) return k;
  return (recipe.protein_g || 0) * 4 + (recipe.carbs_g || 0) * 4 + (recipe.fat_g || 0) * 9;
}

function totalMinutesOf(recipe) {
  return (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SYNONYMS = {
  poulet: ['poulet', 'chicken', 'volaille', 'escalope de poulet', 'poulet hache'],
  vegetarien: ['viande', 'poulet', 'dinde', 'canard', 'boeuf', 'veau', 'porc', 'cochon', 'agneau', 'mouton', 'gigot', 'lard', 'bacon', 'jambon', 'chorizo', 'saucisse', 'saucisses', 'merguez', 'steak', 'hache', 'escalope', 'cotelette', 'entrecote', 'filet mignon', 'roti', 'blanquette', 'carbonade', 'bourguignon', 'civet', 'kefta', 'viande hachee', 'paupiette', 'andouillette', 'coppa', 'pancetta', 'terrine', 'chicken', 'beef', 'pork', 'veal', 'lamb', 'meat', 'turkey', 'duck', 'wagyu', 'bavette', 'onglet', 'hampe', 'poitrine', 'jarret', 'paleron', 'macreuse', 'faux filet', 'faux-filet', 'tournedos', 'chateaubriand', 'minced', 'chair a saucisse', 'poisson', 'cabillaud', 'saumon', 'thon', 'dorade', 'colin', 'merlu', 'anchois', 'sardine', 'maquereau', 'truite', 'fish', 'crevette', 'fruits de mer', 'crabe', 'homard', 'langoustine', 'moule', 'huitre', 'calamar', 'encornet', 'st jacques', 'saint jacques'],
  vegetalien: ['viande', 'poulet', 'dinde', 'canard', 'boeuf', 'veau', 'porc', 'cochon', 'agneau', 'mouton', 'gigot', 'lard', 'bacon', 'jambon', 'chorizo', 'saucisse', 'saucisses', 'merguez', 'steak', 'hache', 'escalope', 'roti', 'blanquette', 'civet', 'kefta', 'paupiette', 'coppa', 'pancetta', 'chicken', 'beef', 'pork', 'veal', 'lamb', 'meat', 'turkey', 'duck', 'bavette', 'tournedos', 'minced', 'poisson', 'cabillaud', 'saumon', 'thon', 'dorade', 'colin', 'merlu', 'anchois', 'sardine', 'maquereau', 'truite', 'fish', 'crevette', 'fruits de mer', 'crabe', 'homard', 'langoustine', 'moule', 'huitre', 'calamar', 'encornet', 'st jacques', 'saint jacques', 'lait', 'creme', 'beurre', 'fromage', 'yaourt', 'mozzarella', 'parmesan', 'comte', 'emmental', 'gruyere', 'ricotta', 'feta', 'chevre', 'lactose', 'cheddar', 'oeuf', 'omelette', 'mayonnaise', 'meringue', 'miel'],
  vegan: ['viande', 'poulet', 'dinde', 'canard', 'boeuf', 'veau', 'porc', 'agneau', 'lard', 'bacon', 'jambon', 'chorizo', 'saucisse', 'merguez', 'steak', 'roti', 'chicken', 'beef', 'pork', 'meat', 'bavette', 'poisson', 'cabillaud', 'saumon', 'thon', 'colin', 'sardine', 'anchois', 'truite', 'fish', 'crevette', 'crabe', 'fruits de mer', 'lait', 'creme', 'beurre', 'fromage', 'yaourt', 'mozzarella', 'parmesan', 'feta', 'cheddar', 'comte', 'emmental', 'lactose', 'oeuf', 'mayonnaise', 'miel'],
  viande: ['viande', 'poulet', 'dinde', 'canard', 'boeuf', 'veau', 'porc', 'cochon', 'agneau', 'mouton', 'gigot', 'lard', 'bacon', 'jambon', 'chorizo', 'saucisse', 'saucisses', 'merguez', 'steak', 'hache', 'escalope', 'cotelette', 'entrecote', 'filet mignon', 'roti', 'blanquette', 'carbonade', 'bourguignon', 'civet', 'kefta', 'viande hachee', 'croupe', 'paupiette', 'andouillette', 'coppa', 'pancetta', 'terrine', 'chicken', 'beef', 'pork', 'veal', 'lamb', 'meat', 'turkey', 'duck', 'wagyu', 'bavette', 'onglet', 'hampe', 'poitrine', 'jarret', 'paleron', 'macreuse', 'faux filet', 'faux-filet', 'tournedos', 'chateaubriand', 'minced', 'chair a saucisse', 'chair saucisse'],
  volaille: ['poulet', 'dinde', 'canard', 'pintade', 'volaille', 'escalope'],
  'lait': ['lait', 'creme', 'beurre', 'fromage', 'yaourt', 'mozzarella', 'parmesan', 'comte', 'emmental', 'gruyere', 'ricotta', 'feta', 'chevre', 'lactose'],
  lactose: ['lait', 'creme', 'fromage', 'yaourt', 'lactose'],
  gluten: ['gluten', 'ble', 'farine', 'pate', 'pates', 'pain', 'semoule', 'couscous', 'orge', 'seigle', 'biscuit', 'chapelure'],
  oeuf: ['oeuf', 'omelette', 'mayonnaise', 'meringue'],
  poisson: ['poisson', 'cabillaud', 'saumon', 'thon', 'dorade', 'colin', 'merlu', 'anchois', 'sardine', 'maquereau', 'bar', 'truite'],
  crevette: ['crevette', 'fruits de mer', 'crabe', 'homard', 'langoustine', 'moule', 'huitre', 'calamar', 'encornet', 'st jacques', 'saint jacques'],
  arachide: ['arachide', 'cacahuete', 'beurre de cacahuete'],
  veau: ['veau', 'escalope de veau', 'blanquette'],
  boeuf: ['boeuf', 'steak', 'hache', 'burg', 'carbonade', 'pot au feu'],
};

function expandExcluded(excluded) {
  const out = new Set();
  const add = (k) => {
    out.add(k);
    (SYNONYMS[k] || []).forEach(s => out.add(s));
  };
  for (const f of excluded) {
    const n = norm(f);
    add(n);
    for (const [key, list] of Object.entries(SYNONYMS)) {
      if (list.some(s => norm(s) === n)) list.forEach(s => out.add(s));
    }
  }
  return [...out];
}

function containsExcluded(recipe, excluded) {
  if (!excluded || !excluded.length) return false;
  const haystack = norm([recipe.name, (recipe.ingredients || []).map(i => typeof i === 'string' ? i : i.name)].join(' '));
  return expandExcluded(excluded).some(f => haystack.includes(norm(f)));
}

function familyOf(recipe) {
  const words = ['poulet','boeuf','veau','porc','agneau','dinde','canard','saumon','thon','cabillaud','poisson','crevette','moule','legume','pates','riz','quinoa','oeuf','fromage','pizza','burger','soupe','salade','tartiflette','gratin','curry','lasagne'];
  const n = norm([recipe.name, ((recipe.ingredients || [])[0] || {}).name || ''].join(' '));
  for (const w of words) if (n.includes(w)) return w;
  return 'autre';
}

function buildPool(recipes, targets) {
  const { kcalTarget, proteinTarget, carbsTarget, fatTarget } = targets;
  const maxTotalMinutes = targets.maxTotalMinutes || 0;
  const perMealKcal = Math.max(200, (kcalTarget || 2000) * 0.4);
  const perMealP = (proteinTarget || 120) / 2;
  const perMealC = (carbsTarget || 220) / 2;
  const perMealF = (fatTarget || 70) / 2;
  let usable = recipes.filter((r) => (kcalOf(r) > 0) || (r.ingredients || []).length);
  const excluded = (targets.excludedFoods || []).map(String).filter(Boolean);
  if (excluded.length) {
    const allowed = usable.filter((r) => !containsExcluded(r, excluded));
    if (allowed.length >= 4) usable = allowed;
  }
  if (maxTotalMinutes > 0) {
    const prepOf = (r) => (r.prep_minutes > 0 ? r.prep_minutes : totalMinutesOf(r));
    const withinTime = usable.filter((r) => prepOf(r) > 0 && prepOf(r) <= maxTotalMinutes);
    if (withinTime.length >= 4) usable = withinTime;
  }
  if (!usable.length) return null;
  const scored = usable.map((r) => {
    const k = kcalOf(r);
    const kcalScore = Math.abs(k - perMealKcal) / perMealKcal;
    const macroScore =
      (Math.abs((r.protein_g || 0) - perMealP) / (perMealP || 1) +
        Math.abs((r.carbs_g || 0) - perMealC) / (perMealC || 1) +
        Math.abs((r.fat_g || 0) - perMealF) / (perMealF || 1)) / 3;
    return { recipe: r, k, score: 0.6 * kcalScore + 0.4 * macroScore };
  });
  scored.sort((a, b) => a.score - b.score);
  const poolSize = Math.max(60, Math.min(scored.length, 150));
  return scored.slice(0, poolSize);
}

function weightedPick(candidates, usedFamilies) {
  const weights = candidates.map((c) => {
    let w = Math.exp(-c.score * 3.5);
    if (usedFamilies.length && usedFamilies.includes(familyOf(c.recipe))) w *= 0.25;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    x -= weights[i];
    if (x <= 0) return i;
  }
  return candidates.length - 1;
}

function pickMeal(recipes, targets, excludeIds) {
  const pool = buildPool(recipes, targets);
  if (!pool) return null;
  const excl = new Set(excludeIds || []);
  let candidates = pool.filter(c => !excl.has(c.recipe.id));
  if (!candidates.length) candidates = pool;
  const idx = weightedPick(candidates, []);
  return candidates[idx].recipe || null;
}

function planWeek(recipes, targets) {
  const pool = buildPool(recipes, targets);
  if (!pool) return null;
  const kcalTarget = targets.kcalTarget || 2000;
  const pTarget = targets.proteinTarget || 120;
  const cTarget = targets.carbsTarget || 220;
  const fTarget = targets.fatTarget || 70;
  const dayKcal = kcalTarget;
  const dayP = pTarget;
  const dayC = cTarget;
  const dayF = fTarget;
  const week = {};
  const used = new Set();
  const usedFamilies = [];
  const pairScore = (a, b) => {
    const k = kcalOf(a.recipe) + kcalOf(b.recipe);
    const p = (a.recipe.protein_g || 0) + (b.recipe.protein_g || 0);
    const c = (a.recipe.carbs_g || 0) + (b.recipe.carbs_g || 0);
    const f = (a.recipe.fat_g || 0) + (b.recipe.fat_g || 0);
    let s = Math.abs(k - dayKcal) / dayKcal + Math.abs(p - dayP) / dayP + Math.abs(c - dayC) / dayC + Math.abs(f - dayF) / dayF;
    const famA = familyOf(a.recipe), famB = familyOf(b.recipe);
    if (usedFamilies.slice(-4).includes(famA)) s += 0.15;
    if (usedFamilies.slice(-4).includes(famB)) s += 0.15;
    if (famA === famB) s += 0.2;
    if (used.has(a.recipe.id) || used.has(b.recipe.id)) s += 1;
    return s;
  };
  for (const day of DAYS) {
    week[day] = {};
    let candidates = pool.filter((c) => !used.has(c.recipe.id));
    if (candidates.length < 2) { used.clear(); candidates = pool.slice(); }
    let best = null, bestScore = Infinity;
    const n = candidates.length;
    const maxPairs = Math.min(n * (n - 1) / 2, 4000);
    const seen = new Set();
    while (seen.size < maxPairs) {
      const i = Math.floor(Math.random() * n);
      let j = Math.floor(Math.random() * n);
      if (j === i) j = (j + 1) % n;
      const key = i < j ? i + '-' + j : j + '-' + i;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = candidates[i], b = candidates[j];
      const sc = pairScore(a, b);
      if (sc < bestScore) { bestScore = sc; best = [a, b]; }
    }
    if (!best) best = [candidates[0], candidates[1] || candidates[0]];
    for (const pick of best) {
      used.add(pick.recipe.id);
      usedFamilies.push(familyOf(pick.recipe));
    }
    week[day].lunch = best[0].recipe;
    week[day].dinner = best[1].recipe;
  }
  return week;
}
function weekTotals(week) {
  let kcal = 0, p = 0, c = 0, f = 0, count = 0;
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const r = week[day][slot];
      if (!r) continue;
      count++;
      kcal += kcalOf(r);
      p += r.protein_g || 0;
      c += r.carbs_g || 0;
      f += r.fat_g || 0;
    }
  }
  return {
    meals: count,
    avgKcalPerDay: count ? Math.round((kcal / count) * 2) : 0,
    avgProteinPerDay: count ? Math.round((p / count) * 2) : 0,
    avgCarbsPerDay: count ? Math.round((c / count) * 2) : 0,
    avgFatPerDay: count ? Math.round((f / count) * 2) : 0,
  };
}

module.exports = { DAYS, SLOTS, planWeek, pickMeal, buildPool, weekTotals, kcalOf };
