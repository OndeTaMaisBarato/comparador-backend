// Uso: node scripts/converter-feed.js
// Lê todos os arquivos .csv.gz da pasta /feeds (um por loja da Awin) e gera data/produtos.json
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function lerCSV(texto) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const limpar = (s) => String(s || '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const pasta = path.join(__dirname, '..', 'feeds');
const saida = [];

for (const arq of fs.readdirSync(pasta).filter((f) => f.endsWith('.gz'))) {
  const texto = zlib.gunzipSync(fs.readFileSync(path.join(pasta, arq))).toString('utf8');
  const [cab, ...linhas] = lerCSV(texto);
  const col = Object.fromEntries(cab.map((n, i) => [n.trim(), i]));
  const pega = (l, n) => (col[n] === undefined ? '' : limpar(l[col[n]]));
  let usados = 0;
  for (const l of linhas) {
    const preco = parseFloat(pega(l, 'search_price'));
    const link = pega(l, 'aw_deep_link');
    const nome = pega(l, 'product_name');
    if (!nome || !link || !(preco > 0)) continue;
    if (pega(l, 'in_stock') === '0' || pega(l, 'is_for_sale') === '0') continue;
    saida.push({
      nome,
      preco,
      imagem: pega(l, 'aw_image_url') || pega(l, 'aw_thumb_url'),
      link,
      loja: pega(l, 'merchant_name') || arq,
      marca: pega(l, 'brand_name'),
      categoria: pega(l, 'category_name'),
      ean: pega(l, 'ean'),
    });
    usados++;
  }
  console.log(arq + ': ' + usados + ' produtos');
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'produtos.json'), JSON.stringify(saida));
console.log('Total gravado em data/produtos.json: ' + saida.length);
