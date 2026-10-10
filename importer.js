function parseNumber(txt) {
  if (txt == null) return null;
  const m = String(txt).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function normalizeIngredientLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function sanitizeJsonLd(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += ch === '\n' ? '\\n' : ch === '\t' ? '\\t' : ch === '\r' ? '\\r' : ' ';
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

function extractFromSchemaOrg(html) {
  let recipes = [];
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const block of blocks) {
    const raw = block.replace(/<script[^>]*>/, '').replace(/<\/script>\s*$/, '');
    let data;
    try {
      data = JSON.parse(sanitizeJsonLd(raw));
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    const graph = items.flatMap((d) => (d && d['@graph']) || [d]);
    for (const item of graph) {
      if (item && (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')))) {
        recipes.push(item);
      }
    }
  }
  if (!recipes.length) return [];
  return recipes.map((r) => {
    const nutrition = r.nutrition || {};
    const ingredients = (r.recipeIngredient || r.ingredients || []).map(normalizeIngredientLine).filter(Boolean);
    let instructions = r.recipeInstructions || r.instructions || [];
    if (!Array.isArray(instructions)) instructions = [instructions];
    const steps = instructions
      .map((s) => (typeof s === 'string' ? s : s && s.text) || '')
      .filter(Boolean);
    const splitQty = (q) => (Array.isArray(q) ? q[0] : q);

    const kcal = parseNumber(
      nutrition.calories || nutrition.caloriesContent || nutrition.energyContent
    );
    const protein = parseNumber(nutrition.proteinContent || nutrition.protein);
    const carbs = parseNumber(nutrition.carbohydrateContent || nutrition.carbohydrates);
    const fat = parseNumber(nutrition.fatContent || nutrition.fat);

    return {
      name: r.name,
      image: Array.isArray(r.image) ? (typeof r.image[0] === 'string' ? r.image[0] : r.image[0] && r.image[0].url) : r.image && r.image.url,
      servings: parseNumber(splitQty(r.recipeYield)) || 4,
      prep_minutes: parseNumber(splitQty(r.prepTime) != null ? splitQty(r.prepTime) : null),
      cook_minutes: parseNumber(splitQty(r.cookTime) != null ? splitQty(r.cookTime) : null),
      kcal_per_serving: kcal != null ? kcal : 0,
      protein_g: protein != null ? protein : 0,
      carbs_g: carbs != null ? carbs : 0,
      fat_g: fat != null ? fat : 0,
      instructions: steps.join('\n\n'),
      ingredients,
    };
  });
}

async function importFromUrl(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const recipes = extractFromSchemaOrg(html);
  if (!recipes.length) throw new Error('Aucune recette structurée (JSON-LD schema.org) trouvée sur cette page');
  return { ...recipes[0], url, source: new URL(url).hostname.replace(/^www\./, '') };
}

module.exports = { importFromUrl };
