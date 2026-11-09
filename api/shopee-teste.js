// Teste temporário: verifica se a API de afiliados da Shopee responde com as suas credenciais.
// Não mostra nenhuma chave. Pode apagar este arquivo depois do teste.
const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  const saida = { variaveis: { SHOPEE_APP_ID: !!appId, SHOPEE_SECRET: !!secret }, testes: {} };
  if (!appId || !secret) return res.status(200).json(saida);

  const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';
  async function consulta(nome, query) {
    const payload = JSON.stringify({ query });
    const ts = Math.floor(Date.now() / 1000);
    const assinatura = crypto.createHash('sha256').update(appId + ts + payload + secret).digest('hex');
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'SHA256 Credential=' + appId + ', Timestamp=' + ts + ', Signature=' + assinatura,
        },
        body: payload,
      });
      const texto = await r.text();
      let j = null;
      try { j = JSON.parse(texto); } catch (e) {}
      const item = { http: r.status };
      if (j && j.errors) item.erros = j.errors.map((e) => e.message).slice(0, 3);
      const nodes = j && j.data && j.data.productOfferV2 && j.data.productOfferV2.nodes;
      if (nodes) { item.qtd = nodes.length; item.exemplo = nodes.slice(0, 2); }
      if (!j) item.resposta_nao_json = texto.slice(0, 200);
      saida.testes[nome] = item;
    } catch (e) {
      saida.testes[nome] = { erro: e.message };
    }
  }

  const termo = String(req.query.q || 'fone bluetooth').replace(/[^\w\sÀ-ÿ]/g, '').slice(0, 60);
  // 1) consulta mínima (campos mais seguros)
  await consulta('minima', '{ productOfferV2(keyword: "' + termo + '", limit: 3) { nodes { itemId productName offerLink } } }');
  // 2) com preço, imagem e loja (se algum campo não existir, o erro diz qual)
  await consulta('com_preco', '{ productOfferV2(keyword: "' + termo + '", limit: 3, sortType: 4) { nodes { itemId productName priceMin priceMax imageUrl shopName offerLink } } }');
  return res.status(200).json(saida);
};
