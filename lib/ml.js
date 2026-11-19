// Módulo Mercado Livre: busca no catálogo e vitrine de mais vendidos.
const BASE = 'https://api.mercadolibre.com';
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let tokenCache = { valor: null, expira: 0 };
const cacheBusca = new Map(); // termo -> { t, dados }
let cacheVitrine = { t: 0, dados: [] };
const DEZ_MIN = 10 * 60 * 1000;
const TRES_HORAS = 3 * 60 * 60 * 1000;
const META = 10; // produtos do ML por busca
const LOTE = 6; // consultas simultâneas
const MAX_CANDIDATOS = 24;
// Categorias do ML para a vitrine (informática, eletrônicos, celulares, casa, moda, beleza, esportes, brinquedos)
const CATEGORIAS_VITRINE = ['MLB1648', 'MLB1000', 'MLB1051', 'MLB1574', 'MLB1430', 'MLB1246', 'MLB1276', 'MLB1132'];

// Produtos digitais (vale-presente, recargas, assinaturas): ficam fora da vitrine
const DIGITAL = /gift ?card|cart[aã]o presente|cart[aã]o de presente|recarga|assinatura|\(digital\)|\bpsn\b|playstation store|xbox live|game pass|steam wallet|google play|app store|netflix|spotify/i;
const eDigital = (nome) => DIGITAL.test(String(nome || ''));

const temCredenciais = () => !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);

async function obterToken() {
  if (tokenCache.valor && Date.now() < tokenCache.expira) return tokenCache.valor;
  const r = await fetch(BASE + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('ML: sem token');
  tokenCache = { valor: j.access_token, expira: Date.now() + ((j.expires_in || 21600) - 300) * 1000 };
  return j.access_token;
}

// Devolve { status, json }. Tenta de novo uma vez se o ML pedir calma (429) ou falhar (5xx).
async function chamar(url, token, tentativa) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 5000);
  try {
    const r = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + token }, signal: c.signal });
    if ((r.status === 429 || r.status >= 500) && !tentativa) {
      await espera(500);
      return chamar(url, token, 1);
    }
    let json = null;
    if (r.ok) { try { json = await r.json(); } catch (e) {} }
    return { status: r.status, json };
  } catch (e) {
    return { status: 0, json: null }; // 0 = tempo esgotado ou falha de rede
  } finally {
    clearTimeout(timer);
  }
}

// Pega a melhor oferta (menor preço, produto novo) de um produto do catálogo
async function montarOferta(p, token, info) {
  const o = await chamar('/products/' + p.id + '/items', token);
  if (info) info.status_das_ofertas[o.status] = (info.status_das_ofertas[o.status] || 0) + 1;
  const lista = Array.isArray(o.json) ? o.json : (o.json && o.json.results) || [];
  const ofertas = lista.filter((x) => x && x.price > 0 && (!x.condition || x.condition === 'new'));
  if (!ofertas.length) return null;
  const melhor = ofertas.reduce((a, b) => (b.price < a.price ? b : a));
  let nome = p.name;
  let imagem = (p.pictures && p.pictures[0] && p.pictures[0].url) || '';
  if (!nome || !imagem) {
    const d = await chamar('/products/' + p.id, token);
    if (d.json) {
      nome = nome || d.json.name;
      imagem = imagem || (d.json.pictures && d.json.pictures[0] && d.json.pictures[0].url) || '';
    }
  }
  if (!nome || !imagem) return null;
  const params = (process.env.ML_AFFILIATE_PARAMS || '').replace(/^[?&]/, '');
  let link = 'https://www.mercadolivre.com.br/p/' + p.id + '?pdp_filters=item_id:' + melhor.item_id;
  if (params) link += '&' + params;
  return {
    nome,
    preco: melhor.price,
    imagem: imagem.replace(/^http:\/\//, 'https://'),
    link,
    loja: 'Mercado Livre',
    marca: '',
    categoria: '',
    frete: melhor.shipping && melhor.shipping.free_shipping ? 'Frete grátis' : '',
  };
}

async function emLotes(itens, fn, meta) {
  const dados = [];
  for (let i = 0; i < itens.length && dados.length < meta; i += LOTE) {
    const r = await Promise.all(itens.slice(i, i + LOTE).map(fn));
    r.forEach((x) => x && dados.push(x));
  }
  return dados;
}

async function buscarML(q, termos, info) {
  if (!temCredenciais()) return [];
  const chave = termos.join(' ');
  const guardado = cacheBusca.get(chave);
  if (!info && guardado && Date.now() - guardado.t < DEZ_MIN) return guardado.dados;

  const token = await obterToken();
  const s = await chamar('/products/search?status=active&site_id=MLB&limit=40&q=' + encodeURIComponent(q), token);
  const achadosML = (s.json && s.json.results) || [];
  const candidatos = achadosML
    .filter((p) => p && p.id && p.name && termos.every((t) => semAcento(p.name).includes(t)))
    .slice(0, MAX_CANDIDATOS);
  if (info) {
    info.busca_status = s.status;
    info.busca_retornou = achadosML.length;
    info.candidatos = candidatos.length;
    info.status_das_ofertas = {};
  }
  const dados = await emLotes(candidatos, (p) => montarOferta(p, token, info), META);
  if (info) info.com_oferta = dados.length;
  cacheBusca.set(chave, { t: Date.now(), dados });
  return dados;
}

// Vitrine: mais vendidos de algumas categorias (muda a cada dia)
async function vitrineML(info) {
  if (!temCredenciais()) return [];
  if (!info && cacheVitrine.dados.length && Date.now() - cacheVitrine.t < TRES_HORAS) return cacheVitrine.dados;

  const token = await obterToken();
  const dia = Math.floor(Date.now() / 86400000);
  const cats = [0, 1, 2, 3].map((i) => CATEGORIAS_VITRINE[(dia * 2 + i) % CATEGORIAS_VITRINE.length]);
  const listas = await Promise.all(cats.map((c) => chamar('/highlights/MLB/category/' + c, token)));
  if (info) {
    info.categorias = cats;
    info.status_mais_vendidos = listas.map((l) => l.status);
    info.status_das_ofertas = {};
  }
  const ids = [];
  listas.forEach((l) => {
    const conteudo = (l.json && l.json.content) || [];
    conteudo.filter((x) => x && x.type === 'PRODUCT').slice(0, 4).forEach((x) => ids.push({ id: x.id }));
  });
  if (info) info.produtos_encontrados = ids.length;
  const bruto = await emLotes(ids, (p) => montarOferta(p, token, info), 12);
  const dados = bruto.filter((x) => !eDigital(x.nome)).slice(0, 10);
  if (info) { info.com_oferta = bruto.length; info.digitais_removidos = bruto.length - dados.length; }
  if (dados.length) cacheVitrine = { t: Date.now(), dados };
  return dados;
}

module.exports = { buscarML, vitrineML };
