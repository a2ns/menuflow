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
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SYNONYMS = {
  porc: ['porc', 'cochon', 'lard', 'bacon', 'jambon', 'chorizo', 'saucisse', 'merguez', 'ventreche', 'coppa', 'pancetta', 'terrine', 'pate'],
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
  for (const f of excluded) {
    const n = norm(f);
    out.add(n);
    if (SYNONYMS[n]) SYNONYMS[n].forEach(s => out.add(s));
  }
  return [...out];
}

function containsExcluded(recipe, excluded) {
  if (!excluded || !excluded.length) return false;
  const haystack = norm([recipe.name, (recipe.ingredients || []).map(i => typeof i === 'string' ? i : i.name)].join(' '));
  return expandExcluded(excluded).some(f => haystack.includes(norm(f)));
}

function planWeek(recipes, targets) {
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
    const withinTime = usable.filter((r) => totalMinutesOf(r) > 0 && totalMinutesOf(r) <= maxTotalMinutes);
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
  const poolSize = Math.max(14, Math.min(scored.length, 40));
  const top = scored.slice(0, poolSize);
  const pool = [];
  while (top.length) {
    const cutoff = Math.max(1, Math.ceil(top.length / 3));
    const pick = Math.floor(Math.random() * Math.min(cutoff, top.length));
    pool.push(top.splice(pick, 1)[0].recipe);
  }

  const week = {};
  const used = new Set();
  let poolIdx = 0;
  for (const day of DAYS) {
    week[day] = {};
    for (const slot of SLOTS) {
      let pick = null;
      for (let i = 0; i < pool.length; i++) {
        const cand = pool[(poolIdx + i) % pool.length];
        if (!used.has(cand.id)) {
          pick = cand;
          poolIdx = poolIdx + i + 1;
          break;
        }
      }
      if (!pick) {
        used.clear();
        pick = pool[poolIdx % pool.length];
        poolIdx++;
      }
      used.add(pick.id);
      week[day][slot] = pick;
    }
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

module.exports = { DAYS, SLOTS, planWeek, weekTotals, kcalOf };
