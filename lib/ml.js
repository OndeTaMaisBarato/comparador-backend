// Módulo Mercado Livre: busca no catálogo, pega a melhor oferta (menor preço, novo) de cada produto.
const BASE = 'https://api.mercadolibre.com';
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

let tokenCache = { valor: null, expira: 0 };
const cacheBusca = new Map(); // termo -> { t, dados }
const DEZ_MIN = 10 * 60 * 1000;

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

async function get(url, token, ms) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms || 5000);
  try {
    const r = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + token }, signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buscarML(q, termos) {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) return [];
  const chave = termos.join(' ');
  const guardado = cacheBusca.get(chave);
  if (guardado && Date.now() - guardado.t < DEZ_MIN) return guardado.dados;

  const token = await obterToken();
  const s = await get('/products/search?status=active&site_id=MLB&limit=12&q=' + encodeURIComponent(q), token);
  const prods = ((s && s.results) || [])
    .filter((p) => p && p.id && p.name && termos.every((t) => semAcento(p.name).includes(t)))
    .slice(0, 10);

  const params = (process.env.ML_AFFILIATE_PARAMS || '').replace(/^[?&]/, '');
  const itens = await Promise.all(
    prods.map(async (p) => {
      const o = await get('/products/' + p.id + '/items', token);
      const ofertas = (Array.isArray(o) ? o : (o && o.results) || []).filter(
        (x) => x && x.price > 0 && (!x.condition || x.condition === 'new')
      );
      if (!ofertas.length) return null;
      const melhor = ofertas.reduce((a, b) => (b.price < a.price ? b : a));
      let imagem = (p.pictures && p.pictures[0] && p.pictures[0].url) || '';
      if (!imagem) {
        const d = await get('/products/' + p.id, token);
        imagem = (d && d.pictures && d.pictures[0] && d.pictures[0].url) || '';
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
    })
  );
  const dados = itens.filter(Boolean);
  cacheBusca.set(chave, { t: Date.now(), dados });
  return dados;
}

module.exports = { buscarML };
