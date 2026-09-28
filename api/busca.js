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

    // ==========================================
    // MÓDULO 1: MERCADO LIVRE (COM IDENTIFICADOR)
    // ==========================================
    try {
      const urlML = 'https://mercadolibre.com' + encodeURIComponent(q) + '&limit=5';
      
      const resML = await fetch(urlML, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const dadosML = await resML.json();
      
      if (dadosML.results && dadosML.results.length > 0) {
        // Pega os 2 primeiros resultados mais relevantes trazidos pelo Mercado Livre
        const itensParaExibir = dadosML.results.slice(0, 2);
        
        itensParaExibir.forEach(item => {
          todosOsProdutos.push({
            loja: 'Mercado Livre',
            titulo: item.title,
            preco: item.price,
            link: item.permalink
          });
        });
      }
    } catch (e) {
      console.error("Erro no Mercado Livre:", e);
    }

    // ==========================================
    // MÓDULO 2: AMAZON
    // ==========================================
    todosOsProdutos.push({
      loja: 'Amazon',
      titulo: 'Buscar "' + q + '" na Amazon',
      preco: null,
      link: 'https://amazon.com.br' + encodeURIComponent(q) + '&tag=ondetamaisb02-20'
    });

    // ==========================================
    // MÓDULO 3: MAGAZINE LUIZA
    // ==========================================
    todosOsProdutos.push({
      loja: 'Magazine Luiza',
      titulo: 'Buscar "' + q + '" no Magalu',
      preco: null,
      link: 'https://magazinevoce.com.br' + encodeURIComponent(q) + '/'
    });

    // Ordenação automática: menor preço primeiro (quem tem preço real sempre sobe para o topo)
    todosOsProdutos.sort((a, b) => {
      if (a.preco === null) return 1;
      if (b.preco === null) return -1;
      return a.preco - b.preco;
    });

    return res.status(200).json(todosOsProdutos);

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno.', detalhes: error.message });
  }
};
