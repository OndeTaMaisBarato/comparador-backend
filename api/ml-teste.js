// Teste temporário: verifica se o seu app do Mercado Livre consegue usar a busca de produtos.
// Não mostra nenhuma chave. Pode apagar este arquivo depois do teste.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  const saida = { variaveis: { ML_CLIENT_ID: !!id, ML_CLIENT_SECRET: !!secret } };
  if (!id || !secret) {
    saida.conclusao = 'Faltam variáveis na Vercel (ML_CLIENT_ID e/ou ML_CLIENT_SECRET).';
    return res.status(200).json(saida);
  }
  try {
    const t = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    });
    saida.token_status = t.status;
    const tj = await t.json();
    if (!tj.access_token) {
      saida.conclusao = 'Não consegui gerar o token. Confira ID e chave secreta.';
      saida.erro = tj.error || tj.message;
      return res.status(200).json(saida);
    }
    const b = await fetch('https://api.mercadolibre.com/sites/MLB/search?q=ssd&limit=3', {
      headers: { Authorization: 'Bearer ' + tj.access_token },
    });
    saida.busca_status = b.status;
    if (b.ok) {
      const bj = await b.json();
      saida.conclusao = 'A busca FUNCIONA com o seu app.';
      saida.exemplo = (bj.results || []).map((r) => ({ titulo: r.title, preco: r.price }));
    } else {
      saida.conclusao = 'A busca está BLOQUEADA para o seu app (status ' + b.status + ').';
    }
  } catch (e) {
    saida.conclusao = 'Erro ao testar: ' + e.message;
  }
  return res.status(200).json(saida);
};
