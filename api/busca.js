module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Nenhum produto digitado.' });

  try {
    let todosOsProdutos = [];
    
    // Links construídos com aspas simples tradicionais e sem caracteres especiais complexos
    const linkMercadoLivre = 'https://mercadolivre.com.br' + encodeURIComponent(q);
    const linkAmazon = 'https://amazon.com.br' + encodeURIComponent(q) + '&tag=ondetamaisb02-20';
    const linkMagalu = 'https://magazinevoce.com.br' + encodeURIComponent(q) + '/';

    todosOsProdutos.push({
      loja: 'Mercado Livre',
      titulo: 'Ver ofertas de ' + q + ' no Mercado Livre',
      preco: null,
      link: linkMercadoLivre
    });

    todosOsProdutos.push({
      loja: 'Amazon',
      titulo: 'Ver ofertas de ' + q + ' na Amazon',
      preco: null,
      link: linkAmazon
    });

    todosOsProdutos.push({
      loja: 'Magazine Luiza',
      titulo: 'Ver ofertas de ' + q + ' no Magalu',
      preco: null,
      link: linkMagalu
    });

    return res.status(200).json(todosOsProdutos);

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno.', detalhes: error.message });
  }
};
