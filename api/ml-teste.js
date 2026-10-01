// Teste temporário: verifica quais partes da API do Mercado Livre funcionam com o seu app.
// Não mostra nenhuma chave. Pode apagar este arquivo depois do teste.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  const saida = { variaveis: { ML_CLIENT_ID: !!id, ML_CLIENT_SECRET: !!secret }, testes: {} };
  if (!id || !secret) return res.status(200).json(saida);
  try {
    const t = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    });
    saida.token_status = t.status;
    const tj = await t.json();
    if (!tj.access_token) return res.status(200).json(saida);
    const h = { Authorization: 'Bearer ' + tj.access_token };
    const base = 'https://api.mercadolibre.com';

    async function testar(nome, url) {
      try {
        const r = await fetch(base + url, { headers: h });
        const item = { status: r.status };
        if (r.ok) item.json = await r.json();
        saida.testes[nome] = item;
        return item;
      } catch (e) {
        saida.testes[nome] = { erro: e.message };
      }
    }

    await testar('busca_publica', '/sites/MLB/search?q=ssd&limit=3');
    const prod = await testar('busca_catalogo', '/products/search?status=active&site_id=MLB&q=ssd&limit=3');
    const top = await testar('mais_vendidos', '/highlights/MLB/category/MLB432825');

    // Resumos curtos (sem despejar o JSON inteiro)
    if (prod && prod.json) {
      const lista = prod.json.results || [];
      saida.testes.busca_catalogo = { status: prod.status, qtd: lista.length, exemplo: lista.slice(0, 3).map((p) => ({ id: p.id, nome: p.name })) };
      if (lista[0]) await testar('produto_detalhe', '/products/' + lista[0].id);
      const d = saida.testes.produto_detalhe;
      if (d && d.json) {
        const bb = d.json.buy_box_winner || {};
        saida.testes.produto_detalhe = { status: d.status, nome: d.json.name, preco_buybox: bb.price, item_id: bb.item_id, permalink: d.json.permalink };
      }
    }
    if (top && top.json) {
      const c = top.json.content || [];
      saida.testes.mais_vendidos = { status: top.status, qtd: c.length, exemplo: c.slice(0, 3) };
      const primeiro = c.find((x) => x.type === 'ITEM' || x.type === 'PRODUCT');
      if (primeiro) {
        await testar('detalhe_do_mais_vendido', primeiro.type === 'ITEM' ? '/items/' + primeiro.id : '/products/' + primeiro.id);
        const d2 = saida.testes.detalhe_do_mais_vendido;
        if (d2 && d2.json) saida.testes.detalhe_do_mais_vendido = { status: d2.status, nome: d2.json.title || d2.json.name, preco: d2.json.price };
      }
    }
    if (saida.testes.busca_publica && saida.testes.busca_publica.json) {
      saida.testes.busca_publica = { status: saida.testes.busca_publica.status, qtd: (saida.testes.busca_publica.json.results || []).length };
    }
  } catch (e) {
    saida.erro = e.message;
  }
  return res.status(200).json(saida);
};
