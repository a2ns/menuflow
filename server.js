const express = require('express');
const path = require('path');
const { db, getSetting, setSetting } = require('./db');
const { importFromUrl } = require('./importer');
const { DAYS, SLOTS, planWeek, weekTotals, kcalOf } = require('./planner');
const { parseIngredient, scaleQty, formatQty, normalizeName } = require('./ingredients');

function storeIngredients(recipeId, lines) {
  db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
  const ins = db.prepare('INSERT INTO ingredients (recipe_id, name, quantity, qty, unit) VALUES (?, ?, ?, ?, ?)');
  for (const line of lines) {
    const p = parseIngredient(line);
    ins.run(recipeId, p.name, line, p.qty, p.unit);
  }
}

function scaledIngredients(recipe, servingsWanted) {
  const factor = Math.max(1, servingsWanted || recipe.servings || 2) / (recipe.servings || 2);
  const rows = db.prepare('SELECT name, quantity, qty, unit FROM ingredients WHERE recipe_id = ?').all(recipe.id);
  return rows.map((i) => {
    const scaled = scaleQty(i.qty, factor);
    const label = i.qty != null && scaled != null
      ? `${formatQty(scaled)}${i.unit ? ' ' + i.unit : ''} ${i.name}`
      : i.quantity || i.name;
    return { name: i.name, qty: scaled, unit: i.unit, label, original: i.quantity };
  });
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const recipeWithIngredients = (r) => {
  const ingredients = db.prepare('SELECT name, quantity, qty, unit FROM ingredients WHERE recipe_id = ?').all(r.id);
  return { ...r, ingredients, kcal: Math.round(kcalOf(r)) };
};

app.get('/api/recipes', (req, res) => {
  const rows = db.prepare('SELECT * FROM recipes ORDER BY id DESC').all();
  res.json(rows.map(recipeWithIngredients));
});

app.post('/api/recipes/import', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL manquante' });
  try {
    const r = await importFromUrl(url);
    const exists = db.prepare('SELECT id FROM recipes WHERE url = ?').get(r.url);
    if (exists) return res.status(409).json({ error: 'Recette déjà importée', id: exists.id });
    const info = db.prepare(`INSERT INTO recipes
      (name, url, image, source, servings, prep_minutes, cook_minutes, kcal_per_serving, protein_g, carbs_g, fat_g, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      r.name, r.url, r.image || null, r.source || null, r.servings || 4,
      r.prep_minutes, r.cook_minutes, r.kcal_per_serving || 0, r.protein_g || 0,
      r.carbs_g || 0, r.fat_g || 0, r.instructions || ''
    );
    storeIngredients(info.lastInsertRowid, r.ingredients || []);
    const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(recipeWithIngredients(row));
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

app.post('/api/recipes', (req, res) => {
  const { name, kcal_per_serving, protein_g, carbs_g, fat_g, servings, ingredients, instructions } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom manquant' });
  const info = db.prepare(`INSERT INTO recipes
    (name, servings, kcal_per_serving, protein_g, carbs_g, fat_g, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    name, servings || 2, kcal_per_serving || 0, protein_g || 0, carbs_g || 0, fat_g || 0, instructions || ''
  );
  storeIngredients(info.lastInsertRowid, (ingredients || []).map(s => String(s).trim()).filter(Boolean));
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(recipeWithIngredients(row));
});

app.delete('/api/recipes/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM plan_meals WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  res.json({ ok: true });
});

const DEFAULT_TARGETS = { kcalTarget: 2000, proteinTarget: 120, carbsTarget: 220, fatTarget: 70, servings: 2, servingsLunch: 2, servingsDinner: 2, maxTotalMinutes: 0, excludedFoods: [] };

function currentSettings() {
  const s = { ...DEFAULT_TARGETS, ...getSetting('targets', {}) };
  if (s.servingsLunch == null) s.servingsLunch = s.servings;
  if (s.servingsDinner == null) s.servingsDinner = s.servings;
  return s;
}

function servingsForSlot(settings, slot) {
  return slot === 'dinner' ? settings.servingsDinner : settings.servingsLunch;
}

app.get('/api/settings', (req, res) => {
  res.json(currentSettings());
});

app.put('/api/settings', (req, res) => {
  const current = currentSettings();
  const { kcalTarget, proteinTarget, carbsTarget, fatTarget, servings, servingsLunch, servingsDinner, maxTotalMinutes, excludedFoods } = req.body || {};
  const next = {
    kcalTarget: kcalTarget ?? current.kcalTarget,
    proteinTarget: proteinTarget ?? current.proteinTarget,
    carbsTarget: carbsTarget ?? current.carbsTarget,
    fatTarget: fatTarget ?? current.fatTarget,
    servings: Math.max(1, servings ?? current.servings),
    servingsLunch: Math.max(1, servingsLunch ?? current.servingsLunch),
    servingsDinner: Math.max(1, servingsDinner ?? current.servingsDinner),
    maxTotalMinutes: Math.max(0, maxTotalMinutes ?? current.maxTotalMinutes ?? 0),
    excludedFoods: Array.isArray(excludedFoods) ? excludedFoods.map(s => String(s).trim().toLowerCase()).filter(Boolean) : (current.excludedFoods || []),
  };
  setSetting('targets', next);
  res.json(next);
});

app.get('/api/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM meal_plans ORDER BY id DESC').all();
  res.json(plans);
});

app.get('/api/plans/current', (req, res) => {
  const plan = db.prepare('SELECT * FROM meal_plans ORDER BY id DESC LIMIT 1').get();
  if (!plan) return res.json(null);
  const settings = currentSettings();
  const meals = db.prepare(`
    SELECT pm.day, pm.slot, r.* FROM plan_meals pm
    JOIN recipes r ON r.id = pm.recipe_id WHERE pm.plan_id = ?`).all(plan.id);
  const week = {};
  for (const day of DAYS) week[day] = {};
  for (const m of meals) {
    const s = servingsForSlot(settings, m.slot);
    week[m.day][m.slot] = { ...recipeWithIngredients(m), ingredients: scaledIngredients(m, s), servingsWanted: s };
  }
  res.json({ plan, week, servings: settings.servings, servingsLunch: settings.servingsLunch, servingsDinner: settings.servingsDinner });
});

app.post('/api/plans/generate', (req, res) => {
  const targets = currentSettings();
  const recipes = db.prepare('SELECT * FROM recipes').all().map(recipeWithIngredients);
  const week = planWeek(recipes, targets);
  if (!week) return res.status(400).json({ error: 'Aucune recette disponible. Importe des recettes d’abord.' });
  const info = db.prepare('INSERT INTO meal_plans (name, week_start, kcal_target, protein_target, carbs_target, fat_target) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Semaine auto', new Date().toISOString().slice(0, 10), targets.kcalTarget, targets.proteinTarget, targets.carbsTarget, targets.fatTarget);
  const ins = db.prepare('INSERT INTO plan_meals (plan_id, day, slot, recipe_id) VALUES (?, ?, ?, ?)');
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      ins.run(info.lastInsertRowid, day, slot, week[day][slot].id);
    }
  }
  res.json({ id: info.lastInsertRowid, totals: weekTotals(week) });
});

app.put('/api/plans/current/meal', (req, res) => {
  const { day, slot, recipe_id } = req.body || {};
  const plan = db.prepare('SELECT * FROM meal_plans ORDER BY id DESC LIMIT 1').get();
  if (!plan) return res.status(404).json({ error: 'Aucun plan' });
  db.prepare('INSERT INTO plan_meals (plan_id, day, slot, recipe_id) VALUES (?, ?, ?, ?) ON CONFLICT(plan_id, day, slot) DO UPDATE SET recipe_id = excluded.recipe_id')
    .run(plan.id, day, slot, recipe_id);
  res.json({ ok: true });
});

const MASS_UNITS = { g: 1, kg: 1000 };
const VOL_UNITS = { ml: 1, cl: 10, l: 1000 };

app.get('/api/shopping-list', (req, res) => {
  const plan = db.prepare('SELECT * FROM meal_plans ORDER BY id DESC LIMIT 1').get();
  if (!plan) return res.json({ items: [] });
  const settings = currentSettings();
  const rows = db.prepare(`
    SELECT i.name, i.quantity, i.qty, i.unit, r.servings as recipe_servings, pm.slot
    FROM plan_meals pm
    JOIN ingredients i ON i.recipe_id = pm.recipe_id
    JOIN recipes r ON r.id = i.recipe_id
    WHERE pm.plan_id = ?`).all(plan.id);
  const map = new Map();
  for (const i of rows) {
    const key = normalizeName(i.name) || i.name;
    const factor = Math.max(1, servingsForSlot(settings, i.slot)) / (i.recipe_servings || 2);
    const scaled = scaleQty(i.qty, factor);
    const entry = map.get(key) || { name: i.name, mealCount: 0, mass: 0, vol: 0, count: 0, unit: null, loose: [] };
    entry.mealCount++;
    if (scaled == null) {
      entry.loose.push(i.quantity || i.name);
    } else if (i.unit && MASS_UNITS[i.unit]) {
      entry.mass += scaled * MASS_UNITS[i.unit];
    } else if (i.unit && VOL_UNITS[i.unit]) {
      entry.vol += scaled * VOL_UNITS[i.unit];
    } else if (i.unit) {
      entry.unit = i.unit;
      entry.count += scaled;
    } else {
      entry.count += scaled;
    }
    map.set(key, entry);
  }
  const stock = db.prepare('SELECT * FROM stock').all();
  const stockBykey = new Map();
  for (const s of stock) stockBykey.set(normalizeName(s.name), s);
  const items = [...map.values()].map((e) => {
    let mass = e.mass, vol = e.vol, count = e.count;
    const s = stockBykey.get(normalizeName(e.name));
    let coveredByStock = false;
    if (s && s.qty != null) {
      if (mass > 0 && MASS_UNITS[s.unit]) {
        mass -= s.qty * MASS_UNITS[s.unit];
      } else if (vol > 0 && VOL_UNITS[s.unit]) {
        vol -= s.qty * VOL_UNITS[s.unit];
      } else if (count > 0) {
        count -= s.qty;
      }
    }
    mass = Math.max(0, mass);
    vol = Math.max(0, vol);
    count = Math.max(0, count);
    if (s && s.qty != null && mass === 0 && vol === 0 && count === 0 && (e.mass > 0 || e.vol > 0 || e.count > 0)) coveredByStock = true;
    let qtyLabel = '';
    if (e.mass > 0) {
      qtyLabel = e.mass >= 1000 ? `${formatQty(e.mass / 1000)} kg` : `${formatQty(e.mass)} g`;
    } else if (e.vol > 0) {
      qtyLabel = e.vol >= 1000 ? `${formatQty(e.vol / 1000)} L` : `${formatQty(e.vol)} ml`;
    } else if (e.count > 0) {
      qtyLabel = `${formatQty(e.count)}${e.unit ? ' ' + e.unit : ''}`;
    }
    let missingLabel = '';
    if (!coveredByStock && (mass > 0 || vol > 0 || count > 0)) {
      if (mass > 0) missingLabel = mass >= 1000 ? `${formatQty(mass / 1000)} kg` : `${formatQty(mass)} g`;
      else if (vol > 0) missingLabel = vol >= 1000 ? `${formatQty(vol / 1000)} L` : `${formatQty(vol)} ml`;
      else missingLabel = `${formatQty(count)}${e.unit ? ' ' + e.unit : ''}`;
    }
    return {
      name: e.name,
      mealCount: e.mealCount,
      qtyLabel,
      missingLabel,
      coveredByStock,
      loose: [...new Set(e.loose)].slice(0, 3),
    };
  }).filter(i => !i.coveredByStock).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  res.json({ items, servings: settings.servings, servingsLunch: settings.servingsLunch, servingsDinner: settings.servingsDinner });
});

app.get('/api/stock', (req, res) => {
  res.json(db.prepare('SELECT * FROM stock ORDER BY name').all());
});

app.post('/api/stock', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom manquant' });
  const p = parseIngredient(String(name));
  const info = db.prepare('INSERT INTO stock (name, qty, unit) VALUES (?, ?, ?)').run(p.name, p.qty, p.unit);
  res.status(201).json(db.prepare('SELECT * FROM stock WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/stock/:id', (req, res) => {
  db.prepare('DELETE FROM stock WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/shopping-list/export', (req, res) => {
  const plan = db.prepare('SELECT * FROM meal_plans ORDER BY id DESC LIMIT 1').get();
  if (!plan) return res.type('text/plain; charset=utf-8').send('Aucun plan de repas. Génère d’abord une semaine.');
  const settings = currentSettings();
  const rows = db.prepare(`
    SELECT i.name, i.quantity, i.qty, i.unit, r.servings as recipe_servings, pm.slot
    FROM plan_meals pm
    JOIN ingredients i ON i.recipe_id = pm.recipe_id
    JOIN recipes r ON r.id = i.recipe_id
    WHERE pm.plan_id = ?`).all(plan.id);
  const map = new Map();
  for (const i of rows) {
    const key = normalizeName(i.name) || i.name;
    const factor = Math.max(1, servingsForSlot(settings, i.slot)) / (i.recipe_servings || 2);
    const scaled = scaleQty(i.qty, factor);
    const entry = map.get(key) || { name: i.name, mass: 0, vol: 0, count: 0, unit: null, loose: [] };
    if (scaled == null) entry.loose.push(i.quantity || i.name);
    else if (i.unit && MASS_UNITS[i.unit]) entry.mass += scaled * MASS_UNITS[i.unit];
    else if (i.unit && VOL_UNITS[i.unit]) entry.vol += scaled * VOL_UNITS[i.unit];
    else { entry.unit = i.unit; entry.count += scaled; }
    map.set(key, entry);
  }
  const stock = db.prepare('SELECT * FROM stock').all();
  const stockBykey = new Map(stock.map(s => [normalizeName(s.name), s]));
  const lines = [];
  const sl = settings.servingsLunch, sd = settings.servingsDinner;
  lines.push('🛒 Liste de courses — MenuFlow');
  lines.push(sl === sd ? `Pour ${sl} personne${sl > 1 ? 's' : ''} par repas` : `Midi : ${sl} pers. · Soir : ${sd} pers.`);
  lines.push('');
  let hasItems = false;
  for (const e of [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
    let mass = e.mass, vol = e.vol, count = e.count;
    const s = stockBykey.get(normalizeName(e.name));
    if (s && s.qty != null) {
      if (mass > 0 && MASS_UNITS[s.unit]) mass -= s.qty * MASS_UNITS[s.unit];
      else if (vol > 0 && VOL_UNITS[s.unit]) vol -= s.qty * VOL_UNITS[s.unit];
      else if (count > 0) count -= s.qty;
    }
    mass = Math.max(0, mass); vol = Math.max(0, vol); count = Math.max(0, count);
    const needsQty = mass > 0 || vol > 0 || count > 0;
    const hasQty = e.mass > 0 || e.vol > 0 || e.count > 0;
    if (hasQty && !needsQty) continue;
    hasItems = true;
    if (!hasQty) {
      lines.push(`☐ ${e.name}${e.loose.length ? ' (' + [...new Set(e.loose)].join(' ; ') + ')' : ''}`);
    } else {
      let label;
      if (mass > 0) label = mass >= 1000 ? `${formatQty(mass / 1000)} kg` : `${formatQty(mass)} g`;
      else if (vol > 0) label = vol >= 1000 ? `${formatQty(vol / 1000)} L` : `${formatQty(vol)} ml`;
      else label = `${formatQty(count)}${e.unit ? ' ' + e.unit : ''}`;
      lines.push(`☐ ${e.name} — ${label}`);
    }
  }
  if (!hasItems) lines.push('Rien à acheter : le frigo couvre tout ! 🎉');
  res.type('text/plain; charset=utf-8').send(lines.join('\n'));
});

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM recipes').get().c;
  if (count > 0) return;
  try {
    const fs = require('fs');
    const seedFiles = fs.readdirSync(__dirname)
      .filter(f => /^seed-recipes.*\.json$/.test(f))
      .sort();
    const seeds = seedFiles.flatMap(f => require('./' + f));
    const ins = db.prepare(`INSERT INTO recipes
      (name, url, image, source, servings, prep_minutes, cook_minutes, kcal_per_serving, protein_g, carbs_g, fat_g, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const s of seeds) {
      const info = ins.run(
        s.name, s.url || null, s.image || null, s.source || null, s.servings || 4,
        s.prep_minutes || null, s.cook_minutes || null, s.kcal_per_serving || 0,
        s.protein_g || 0, s.carbs_g || 0, s.fat_g || 0, s.instructions || ''
      );
      storeIngredients(info.lastInsertRowid, (s.ingredients || []).map(String));
    }
    console.log(`Seeded ${seeds.length} recipes`);
  } catch (e) {
    console.error('Seed failed:', e.message);
  }
}
seedIfEmpty();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MenuFlow listening on port ${PORT}`);
});

app.get('/api/data/export', (req, res) => {
  const data = {
    recipes: db.prepare('SELECT * FROM recipes').all(),
    ingredients: db.prepare('SELECT * FROM ingredients').all(),
    stock: db.prepare('SELECT * FROM stock').all(),
    settings: db.prepare('SELECT * FROM settings').all(),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="menuflow-export.json"');
  res.json({ exported_at: new Date().toISOString(), ...data });
});

app.post('/api/data/import', (req, res) => {
  const { recipes, ingredients, stock, settings } = req.body || {};
  if (!Array.isArray(recipes)) return res.status(400).json({ error: 'Fichier invalide : recettes manquantes' });
  db.exec('BEGIN');
  try {
    const cols = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name).filter(c => c !== 'id');
    const insert = (table, row) => {
      const c = cols(table);
      const vals = c.map(k => row[k] ?? null);
      const info = db.prepare(`INSERT INTO ${table} (${c.join(',')}) VALUES (${c.map(() => '?').join(',')})`).run(...vals);
      return info.lastInsertRowid;
    };
    const idMap = new Map();
    for (const r of recipes) {
      const oldId = r.id;
      delete r.id;
      const newId = insert('recipes', r);
      if (oldId != null) idMap.set(oldId, newId);
    }
    for (const i of (ingredients || [])) {
      const newId = idMap.get(i.recipe_id);
      if (newId == null) continue;
      const row = { ...i, recipe_id: newId };
      delete row.id;
      insert('ingredients', row);
    }
    for (const s of (stock || [])) {
      delete s.id;
      insert('stock', s);
    }
    for (const s of (settings || [])) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(s.key, s.value);
    }
    db.exec('COMMIT');
    res.json({ ok: true, recipes: recipes.length });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});
