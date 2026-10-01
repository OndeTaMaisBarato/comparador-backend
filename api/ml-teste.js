// Teste temporário (3): descobre de onde vem o PREÇO no catálogo do Mercado Livre.
// Não mostra nenhuma chave. Pode apagar este arquivo depois do teste.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  const saida = { testes: {} };
  if (!id || !secret) return res.status(200).json({ erro: 'faltam variáveis' });
  try {
    const t = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    });
    const tj = await t.json();
    if (!tj.access_token) return res.status(200).json({ erro: 'sem token' });
    const h = { Authorization: 'Bearer ' + tj.access_token };
    const base = 'https://api.mercadolibre.com';
    const get = async (url) => {
      try {
        const r = await fetch(base + url, { headers: h });
        let j = null;
        try { j = await r.json(); } catch (e) {}
        return { status: r.status, j };
      } catch (e) { return { status: 0, j: null, erro: e.message }; }
    };

    const pid = req.query.id || 'MLB46401609';
    const p = await get('/products/' + pid);
    const pj = p.j || {};
    saida.testes.produto = {
      status: p.status,
      campos: Object.keys(pj),
      tem_buy_box: !!pj.buy_box_winner,
      buy_box: pj.buy_box_winner || null,
      faixa_preco: pj.buy_box_winner_price_range || null,
      imagem: pj.pictures && pj.pictures[0] ? pj.pictures[0].url : null,
      permalink: pj.permalink || null,
    };

    const it = await get('/products/' + pid + '/items');
    const lista = (it.j && (it.j.results || it.j)) || [];
    saida.testes.ofertas_do_produto = {
      status: it.status,
      qtd: Array.isArray(lista) ? lista.length : 0,
      primeira: Array.isArray(lista) ? lista[0] || null : it.j,
    };

    const itemId = Array.isArray(lista) && lista[0] ? lista[0].item_id || lista[0].id : (pj.buy_box_winner || {}).item_id;
    if (itemId) {
      const d = await get('/items/' + itemId);
      const dj = d.j || {};
      saida.testes.item = { status: d.status, id: itemId, titulo: dj.title, preco: dj.price, permalink: dj.permalink, thumbnail: dj.thumbnail, message: dj.message };
    }
  } catch (e) {
    saida.erro = e.message;
  }
  return res.status(200).json(saida);
};
