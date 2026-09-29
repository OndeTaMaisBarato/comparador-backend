module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Nenhum produto digitado.' });

  try {
    let todosOsProdutos = [];
    const termoProd = encodeURIComponent(q);

    // ==========================================
    // MÓDULO 1: MERCADO LIVRE
    // ==========================================
    todosOsProdutos.push({
      loja: 'Mercado Livre',
      titulo: `Buscar "${q}" no Mercado Livre`,
      preco: null,
      link: `https://mercadolivre.com.br{termoProd}`
    });

    // ==========================================
    // MÓDULO 2: AMAZON
    // ==========================================
    todosOsProdutos.push({
      loja: 'Amazon',
      titulo: `Buscar "${q}" na Amazon`,
      preco: null,
      link: `https://amazon.com.br{termoProd}&tag=ondetamaisb02-20`
    });

    // ==========================================
    // MÓDULO 3: MAGAZINE LUIZA
    // ==========================================
    todosOsProdutos.push({
      loja: 'Magazine Luiza',
      titulo: `Buscar "${q}" no Magalu`,
      preco: null,
      link: `https://magazinevoce.com.br{termoProd}/`
    });

    return res.status(200).json(todosOsProdutos);

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno.', detalhes: error.message });
  }
};
