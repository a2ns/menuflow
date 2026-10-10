const SPOON2ML = { 'c. à soupe': 15, 'c. à café': 5 };
const DENSITY = {
  huile: 0.92, "huile d'olive": 0.91, 'huile de sesame': 0.92, 'huile de tournesol': 0.92,
  miel: 1.42, sirop: 1.3, "sirop d'erable": 1.32,
  creme: 1.0, 'creme liquide': 1.0, 'creme fraiche': 1.0, yaourt: 1.03, lait: 1.03,
  'sauce soja': 1.2, vinaigre: 1.01, 'vinaigre balsamique': 1.2,
  farine: 0.55, sucre: 0.85, 'sucre en poudre': 0.85, 'sucre roux': 0.85, sel: 1.2, poivre: 0.5,
  cumin: 0.5, paprika: 0.55, curcuma: 0.5, 'quatre epices': 0.5, gingembre: 0.4, cannelle: 0.45,
  'beurre de cacahuete': 1.05, 'pate de curry': 1.1, moutarde: 1.05, mayonnaise: 0.95,
  'beurre': 0.96, 'concentre de tomates': 1.1, 'puree': 1.0,
};
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').trim();
}
function spoonToGrams(name, unit, qty) {
  const ml = SPOON2ML[unit];
  if (!ml) return null;
  const n = norm(name);
  let density = 1.0;
  for (const [k, v] of Object.entries(DENSITY)) {
    if (n.includes(norm(k))) { density = v; break; }
  }
  return Math.round(ml * qty * density);
}
const CATEGORIES = [
  { name: 'Fruits & Légumes', keys: ['tomate', 'tomates', 'oignon', 'oignons', 'carotte', 'carottes', 'courgette', 'courgettes', 'aubergine', 'poivron', 'salade', 'epinard', 'brocoli', 'champignon', 'pomme de terre', 'pommes de terre', 'patate douce', 'avocat', 'citron', 'orange', 'pomme', 'banane', 'fraise', 'framboise', 'poireau', 'navet', 'chou', 'celeri', 'concombre', 'radis', 'betterave', 'potiron', 'citrouille', 'haricot vert', 'haricots verts', 'petit pois', 'persil', 'coriandre', 'basilic', 'ciboulette', 'menthe', 'estragon', 'romarin', 'thym', 'sauge', 'laitue', 'endive', 'fenouil', 'artichaut', 'asperge', 'maïs', 'mais', 'échalote', 'echalote', 'ail', 'gingembre frais', 'ananas', 'mangue', 'peche', 'abricot', 'raisin', 'melon', 'pasteque', 'kiwi', 'lime', 'citron vert', 'bledina', 'erable'] },
  { name: 'Boucherie', keys: ['poulet', 'boeuf', 'veau', 'porc', 'agneau', 'dinde', 'canard', 'steak', 'escalope', 'hache', 'viande', 'cotelette', 'bavette', 'gigot', 'saucisse', 'merguez', 'lard', 'lardon', 'bacon', 'jambon', 'chair a saucisse', 'roti', 'chicken', 'beef', 'pork', 'lamb', 'turkey'] },
  { name: 'Poissonnerie', keys: ['saumon', 'cabillaud', 'thon', 'colin', 'dorade', 'bar', 'truite', 'sardine', 'maquereau', 'anchois', 'crevette', 'moule', 'huitre', 'crabe', 'homard', 'langoustine', 'calamar', 'encornet', 'saint jacques', 'st jacques', 'poisson', 'fish', 'surimi'] },
  { name: 'Crèmerie', keys: ['lait', 'beurre', 'creme', 'yaourt', 'fromage', 'mozzarella', 'parmesan', 'comte', 'emmental', 'gruyere', 'ricotta', 'feta', 'chevre', 'cheddar', 'roquefort', 'bleu', 'mascarpone', 'fromage blanc', 'margarine'] },
  { name: 'Boulangerie', keys: ['pain', 'baguette', 'burger', 'tortilla', 'pita', 'brioche', 'chapati', 'naan', 'toast', 'bun', 'brioche', 'croissant'] },
  { name: 'Épicerie salée', keys: ['riz', 'pates', 'pâtes', 'nouille', 'semoule', 'couscous', 'quinoa', 'boulgour', 'lentille', 'pois chiche', 'haricot blanc', 'haricot rouge', 'pois casses', 'fecule', 'maizena', 'farine', 'chapelure', 'panure', 'huile', 'vinaigre', 'bouillon', 'cube', 'fond de volaille', 'fond de boeuf', 'sauce', 'soja', 'teriyaki', 'satay', 'curry', 'moutarde', 'mayonnaise', 'ketchup', 'concentre de tomate', 'couli', 'pulpes', 'tomate', 'olive', 'olives noires', 'capre', 'cornichon', 'oeuf', 'oeufs', 'tahini', 'sirop', 'miel', 'sucre', 'cassonade', 'sachet', 'levure', 'levain'] },
  { name: 'Épices & Condiments', keys: ['sel', 'poivre', 'cumin', 'paprika', 'curcuma', 'quatre epices', 'cannelle', 'muscade', 'gingembre', 'piment', 'cayenne', 'ras el hanout', 'herbe', 'herbes', 'romarin', 'thym', 'laurier', 'safran', 'cardamome', 'anis', 'clove', 'clou de girofle', 'baie', 'mélange'] },
  { name: 'Surgelés', keys: ['surgele', 'surgelé', 'frit', 'frites', 'glace', 'petit pois surgele'] },
];
function categorize(name) {
  const n = norm(name);
  for (const c of CATEGORIES) {
    if (c.keys.some(k => n.includes(norm(k)))) return c.name;
  }
  return 'Autres';
}
module.exports = { spoonToGrams, categorize, norm };
