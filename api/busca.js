// Central Modular de Buscas - Preparada para 10+ Lojas
module.exports = async (req, res) => {
  // Configuração para permitir que o Blogger acesse o servidor
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query; // Captura o termo digitado no Blogger
  if (!q) return res.status(400).json({ error: 'Nenhum produto digitado.' });

  try {
    // Lista onde todas as lojas vão jogar seus resultados
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
    } catch (e) { console.error("Erro Mercado Livre:", e); }

    // ==========================================
    // MÓDULO 2: AMAZON (LINK DIRETO DE AFILIADO)
    // ==========================================
    todosOsProdutos.push({
      loja: 'Amazon',
      titulo: `Buscar "${q}" na Amazon`,
      preco: null, // Deixamos sem preço fixo por enquanto para não gerar erro
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

    // ESPAÇO RESERVADO: Aqui dentro adicionaremos as próximas 7+ lojas 
    // (Shopee, AliExpress, Casas Bahia, Kabum, etc.) sem quebrar o site atual.

    // ORDENAÇÃO INTELIGENTE: Organiza do menor para o maior preço
    todosOsProdutos.sort((a, b) => {
      if (a.preco === null) return 1;
      if (b.preco === null) return -1;
      return a.preco - b.preco;
    });

    // Envia a lista organizada de volta para o Blogger
    return res.status(200).json(todosOsProdutos);

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno no servidor.', detalhes: error.message });
  }
};
