const UNITS = [
  { re: /^(kg|kilogrammes?|kilos?)\b/i, unit: 'kg', g: 1000 },
  { re: /^(g|grammes?|gr)\b/i, unit: 'g', g: 1 },
  { re: /^(l|litres?|litre)\b/i, unit: 'L', ml: 1000 },
  { re: /^(cl|centilitres?)\b/i, unit: 'cl', ml: 10 },
  { re: /^(ml|millilitres?)\b/i, unit: 'ml', ml: 1 },
  { re: /^(c\.\s*à\s*[sc]\.\s*(?:de\s*)?|cuillères?\s*à\s*(?:soupe|café)\s*(?:d[e']\s*)?|c\.à\.s\.?|c\.à\.c\.?|cas|cac)\b/i, unit: 'c. à soupe' },
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
  const rest = m[2].trim();
  let unit = null;
  for (const u of UNITS) {
    const um = rest.match(u.re);
    if (um) {
      unit = u.countable ? um[1].toLowerCase() : u.unit;
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
  const rounded = Math.round(qty * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
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

module.exports = { parseIngredient, scaleQty, formatQty, normalizeName };
