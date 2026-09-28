module.exports = async (req, res) => {
  // Permite que qualquer site (incluindo o seu Blogger) consulte esta API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responde imediatamente a requisições de teste de segurança do navegador (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Nenhum produto digitado.' });

  try {
    let todosOsProdutos = [];

    // ==========================================
    // MÓDULO 1: MERCADO LIVRE (API OFICIAL)
    // ==========================================
    try {
      const resML = await fetch(`https://mercadolibre.com{encodeURIComponent(q)}&limit=3`);
      const dadosML = await resML.json();
      if (dadosML.results && dadosML.results.length > 0) {
        dadosML.results.forEach(item => {
          todosOsProdutos.push({
            loja: 'Mercado Livre',
            titulo: item.title,
            preco: item.price,
            link: item.permalink
          });
        });
      }
    } catch (e) { 
      console.error("Erro Mercado Livre:", e); 
    }

    // ==========================================
    // MÓDULO 2: AMAZON (LINK DIRETO DE AFILIADO)
    // ==========================================
    todosOsProdutos.push({
      loja: 'Amazon',
      titulo: `Buscar "${q}" na Amazon`,
      preco: null,
      link: `https://amazon.com.br{encodeURIComponent(q)}&tag=ondetamaisb02-20`
    });

    // ==========================================
    // MÓDULO 3: MAGAZINE LUIZA (LINK DIRETO DE AFILIADO)
    // ==========================================
    todosOsProdutos.push({
      loja: 'Magazine Luiza',
      titulo: `Buscar "${q}" no Magalu`,
      preco: null,
      link: `https://magazinevoce.com.br{encodeURIComponent(q)}/`
    });

    // Ordenação automática: menor preço primeiro
    todosOsProdutos.sort((a, b) => {
      if (a.preco === null) return 1;
      if (b.preco === null) return -1;
      return a.preco - b.preco;
    });

    return res.status(200).json(todosOsProdutos);

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno no servidor.', detalhes: error.message });
  }
};
