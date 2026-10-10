const UNITS = [
  { re: /^(kg|kilogrammes?|kilos?)\b/i, unit: 'kg', g: 1000 },
  { re: /^(g|grammes?|gr)\b/i, unit: 'g', g: 1 },
  { re: /^(l|litres?|litre)\b/i, unit: 'L', ml: 1000 },
  { re: /^(cl|centilitres?)\b/i, unit: 'cl', ml: 10 },
  { re: /^(ml|millilitres?)\b/i, unit: 'ml', ml: 1 },
  { re: /^(c\.\s*à\s*c\.\s*(?:de\s*)?|cuillères?\s*à\s*café\s*(?:d[e']\s*)?|c\.à\.c\.?|càc|cac\b|cac\b|tsps?\b|teaspoons?\b)\b/i, unit: 'c. à café' },
  { re: /^(c\.\s*à\s*s\.\s*(?:de\s*)?|cuillères?\s*à\s*soupe\s*(?:d[e']\s*)?|c\.à\.s\.?|càs|cas\b|tbsp\b|tablespoons?\b)\b/i, unit: 'c. à soupe' },
  { re: /^(tasses?|cups?|liv\.?|livres?|lbs?\b|pounds?\b|oz\b|onces?|pintes?|pints?|gousses?|gou\.|tran\.|tranches?|tiges?|brins?|branches?|in\b|inch(?:es)?)(?=\s|$)/i, unit: null, countable: true },
  { re: /^(pincées?|poignées?|tranches?|gousses?|feuilles?|branches?|boîtes?|boules?|sachets?|barquettes?|pots?|briques?|bottes?|tablettes?|verres?|tasses?|paquets?|pieces?|pièces?)\b/i, unit: null, countable: true },
];

function parseQtyNumber(token) {
  token = token.trim().replace(',', '.');
  if (token.includes('/')) {
    const [a, b] = token.split('/').map(parseFloat);
    if (Number.isFinite(a) && Number.isFinite(b) && b) return a / b;
  }
  const n = parseFloat(token);
  return Number.isFinite(n) ? n : null;
}

function parseIngredient(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return { qty: null, unit: null, name: '' };
  const m = text.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*(?:à|–|-)\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/i);
  if (!m) return { qty: null, unit: null, name: text };
  let qty = parseQtyNumber(m[1].split(/\s*(?:à|–|-)\s*/i)[0]);
  let rest = m[2].trim();
  let unit = null;
  for (const u of UNITS) {
    const um = rest.match(u.re);
    if (um) {
      unit = u.countable ? um[1].replace(/\.$/, '').toLowerCase() : u.unit;
      rest = rest.slice(um[0].length).trim();
      break;
    }
  }
  return { qty, unit, name: rest.replace(/^(de\s+|d['’])\s*/i, '').trim() || text };
}

function scaleQty(qty, factor) {
  if (qty == null) return null;
  return qty * factor;
}

function formatQty(qty) {
  if (qty == null) return '';
  if (qty > 0 && qty < 4) {
    const whole = Math.floor(qty);
    const frac = qty - whole;
    const table = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [0.667, '⅔'], [0.75, '¾'], [0.875, '⅞'], [1, '']];
    for (const [val, glyph] of table) {
      if (Math.abs(frac - val) <= 0.04) {
        if (val === 1) return String(whole + 1);
        if (whole === 0) return glyph || '0';
        return glyph ? `${whole} ${glyph}` : String(whole);
      }
    }
  }
  const rounded = Math.round(qty * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
}

const CUP_ML = 240, OZ_G = 28.35, LB_G = 454, PINT_ML = 473;

function formatVolume(ml) {
  if (ml >= 1000) return `${formatQty(Math.round(ml / 10) / 100)} L`;
  const r = ml >= 100 ? Math.round(ml / 10) * 10 : Math.round(ml / 5) * 5;
  return `${formatQty(r)} ml`;
}

function formatMass(g) {
  if (g >= 1000) return `${formatQty(Math.round(g / 10) / 100)} kg`;
  const r = g >= 100 ? Math.round(g) : Math.round(g / 5) * 5;
  return `${formatQty(r)} g`;
}

function formatAmount(qty, unit) {
  if (qty == null) return '';
  const u = String(unit || '').toLowerCase();
  if (/^(cups?|tasses?)$/.test(u)) return formatVolume(qty * CUP_ML);
  if (/^(oz|onces?)$/.test(u)) return formatMass(qty * OZ_G);
  if (/^(liv\.?|livres?|lbs?|pounds?)$/.test(u)) return formatMass(qty * LB_G);
  if (/^(pints?|pintes?)$/.test(u)) return formatVolume(qty * PINT_ML);
  if (/^(g|grammes?|gr)$/.test(u)) return formatMass(qty);
  if (/^(kg|kilogrammes?|kilos?)$/.test(u)) return formatMass(qty * 1000);
  if (/^(ml|millilitres?)$/.test(u)) return formatVolume(qty);
  if (/^(cl|centilitres?)$/.test(u)) return formatVolume(qty * 10);
  if (/^(l|litres?)$/.test(u)) return formatVolume(qty * 1000);
  return `${formatQty(qty)}${unit ? ' ' + unit : ''}`;
}

const CANON = {
  'steak hache': 'boeuf hache', 'hache': 'haché',
  'beurre de cacahuetes': 'beurre de cacahuète',
  'chicken': 'poulet', 'beef': 'boeuf', 'ground beef': 'boeuf hache',
  'onion': 'oignon', 'white onion': 'oignon blanc', 'red onion': 'oignon rouge',
  'garlic': 'ail', 'carrot': 'carotte', 'tomato': 'tomate', 'potato': 'pomme de terre',
  'rice': 'riz', 'cooked rice': 'riz cuit', 'white rice short grain cooked': 'riz cuit',
  'gousse d\u2019ail': 'ail', 'gousse dail': 'ail', 'gousses dail': 'ail',
  'oeuf': 'oeuf', 'oeufs': 'oeuf',
  'graines de sesame': 'graines de sésame', 'graine de sesame': 'graines de sésame',
  'jasmine rice cooked': 'riz cuit', 'jasmine rice': 'riz', 'white rice': 'riz', 'rice': 'riz', 'peppers': 'poivron', 'bell pepper': 'poivron',
  'salad': 'salade', 'lettuce': 'salade', 'leaf lettuce': 'salade',
  'red cabbage shredded': 'chou rouge', 'white cabbage': 'chou blanc', 'red cabbage': 'chou rouge',
  'shallot': 'échalote', 'zucchini': 'courgette', 'cream': 'crème liquide',
  'yogurt': 'yaourt', 'greek yogurt': 'yaourt grec',
  'olive oil': 'huile d\u2019olive', 'sesame oil': 'huile de sésame',
  'waffle fries': 'frites', 'frozen waffle fries': 'frites',
  'emmental': 'emmental', 'swiss cheese': 'emmental',
  'spicy mayo': 'mayonnaise', 'mayo': 'mayonnaise',
  'parmigiano': 'parmesan', 'cheddar rape': 'cheddar',
  'fromage rape': 'fromage râpé',
  'sour cream': 'crème liquide',
  'tortilla wrap': 'tortilla', 'spinach tortilla wrap': 'tortilla',
  'hamburger buns': 'pain burger', 'pains pour hamburger': 'pain burger', 'bun': 'pain burger',
  'bacon': 'lard', 'lard tranches': 'lard',
  'corn': 'maïs', 'sweet corn': 'maïs',
  'green beans': 'haricot vert', 'haricots verts': 'haricot vert',
  'fresh basil': 'basilic', 'fresh coriander': 'coriandre', 'fresh parsley': 'persil',
  'italian dressing': 'vinaigrette', 'ranch dressing': 'vinaigrette',
  'leaf salade': 'salade', 'salade': 'salade',
  'creme': 'crème liquide', 'cream': 'crème liquide',
  'steak hache': 'boeuf haché', 'hache': 'haché',
  'pickled jalapeno peppers': 'jalapeño', 'pickled jalapeno pepper': 'jalapeño', 'pickled jalapeno': 'jalapeño',
  'farine de ble': 'farine', 'farine': 'farine',
  'riz carnaroli': 'riz', 'riz': 'riz',
  'oignon jaune': 'oignon', 'oignons jaunes': 'oignon',
  'cane sugar': 'sucre', 'sugar': 'sucre',
};

const DROP_QUALIFIERS = [
  /\((?:[^()]*)\)/g,
  /\b(?:frais|fraiche|fraîches?|frais|entier|entiere|entière|entières|épluché(?:e?s?)?|coupé(?:e?s?)?|râpé(?:e?s?)?|haché(?:e?s?)?|cru(?:e?s?)?|cuit(?:e?s?)?|nature|bio|frais émincé|mincé|dés|lamelles|détaillé(?:e?s?)?|en poudre|de préférence|des cèpes de préférence)\b/gi,
  /\b(?:primeur|yukon|gold|shredded|ground|grated|chopped|minced|cooked|crushed|smoked|fresh|frozen|liquid|liquide|sec|seche|sèche|rapes?|râpées?)\b/gi,
  /\b(?:de\s+)?(?:première|premier)\s+qualité\b/gi,
  /\b(?:noix|filet|gou|tran|pincée|poignée)\s+de\b/gi,
];

function canonicalName(name) {
  let s = String(name || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^a-zA-Zà-öø-ÿœŒ]+\s*/, '');
  s = s.replace(/^Œuf\b/i, 'oeuf');
  if (/^(gou|tran|bran|tig|brin|in|bou)\.?\s+/i.test(s)) s = s.replace(/^(gou|tran|bran|tig|brin|in|bou)\.?\s+/i, '');
  s = s.replace(/\((?:[^()]*)\)/g, ' ');
  for (const re of DROP_QUALIFIERS) s = s.replace(re, ' ');
  s = s.replace(/\b(?:noix|filet|pincée|poignée)\s+d['’]\s*/gi, '');
  s = s.replace(/^(?:de|d['’])\s+/, '');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  s = s.replace(/\b\S{4,}s\b(?!\s*(?:de|des|du))\b/g, w => /(us|ss|os|ais|is)$/i.test(w) ? w : w.slice(0, -1));
  s = s.replace(/œ/g, 'oe').replace(/\bb\u2019?oeuf\b/g, 'boeuf');
  const norm = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (CANON[norm]) return CANON[norm];
  return s || String(name || '').trim();
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bs*(frais|fraiche|fraîches?|fraîches|entier|entiere|entière|entières|épluché(?:e?s?)?|coupé(?:e?s?)?|râpé(?:e?s?)?|haché(?:e?s?)?|en poudre|en morceaux?|bio)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { parseIngredient, scaleQty, formatQty, formatAmount, formatVolume, formatMass, normalizeName, canonicalName };
