// Módulo Mercado Livre: busca no catálogo e pega a melhor oferta (menor preço, novo) de cada produto.
const BASE = 'https://api.mercadolibre.com';
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let tokenCache = { valor: null, expira: 0 };
const cacheBusca = new Map(); // termo -> { t, dados }
const DEZ_MIN = 10 * 60 * 1000;
const META = 10; // quantos produtos do ML queremos mostrar
const LOTE = 6; // consultas simultâneas
const MAX_CANDIDATOS = 24;

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

async function buscarML(q, termos, info) {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) return [];
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

  const params = (process.env.ML_AFFILIATE_PARAMS || '').replace(/^[?&]/, '');

  async function processar(p) {
    const o = await chamar('/products/' + p.id + '/items', token);
    if (info) info.status_das_ofertas[o.status] = (info.status_das_ofertas[o.status] || 0) + 1;
    const lista = Array.isArray(o.json) ? o.json : (o.json && o.json.results) || [];
    const ofertas = lista.filter((x) => x && x.price > 0 && (!x.condition || x.condition === 'new'));
    if (!ofertas.length) return null;
    const melhor = ofertas.reduce((a, b) => (b.price < a.price ? b : a));
    let imagem = (p.pictures && p.pictures[0] && p.pictures[0].url) || '';
    if (!imagem) {
      const d = await chamar('/products/' + p.id, token);
      imagem = (d.json && d.json.pictures && d.json.pictures[0] && d.json.pictures[0].url) || '';
    }
    let link = 'https://www.mercadolivre.com.br/p/' + p.id + '?pdp_filters=item_id:' + melhor.item_id;
    if (params) link += '&' + params;
    return {
      nome: p.name,
      preco: melhor.price,
      imagem: imagem.replace(/^http:\/\//, 'https://'),
      link,
      loja: 'Mercado Livre',
      marca: '',
      categoria: '',
      frete: melhor.shipping && melhor.shipping.free_shipping ? 'Frete grátis' : '',
    };
  }

  // Em lotes pequenos, parando quando já temos produtos suficientes
  const dados = [];
  for (let i = 0; i < candidatos.length && dados.length < META; i += LOTE) {
    const resultados = await Promise.all(candidatos.slice(i, i + LOTE).map(processar));
    resultados.forEach((r) => r && dados.push(r));
  }
  if (info) info.com_oferta = dados.length;
  cacheBusca.set(chave, { t: Date.now(), dados });
  return dados;
}

module.exports = { buscarML };
