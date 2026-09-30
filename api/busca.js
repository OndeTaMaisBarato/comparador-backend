const produtos = require('../data/produtos.json');

const AMAZON_TAG = process.env.AMAZON_TAG || 'ondetamaisb02-20';
const MAGALU_SLUG = process.env.MAGALU_SLUG || 'magazineondetamaisbarato';

const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const indice = produtos.map((p) => ({ p, texto: semAcento([p.nome, p.marca, p.categoria].join(' ')) }));

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String((req.query && req.query.q) || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ erro: 'Digite um produto para pesquisar.' });

  const termos = semAcento(q).split(/\s+/).filter(Boolean);
  let achados = indice.filter((i) => termos.every((t) => i.texto.includes(t)));
  let aproximado = false;
  if (!achados.length && termos.length > 1) {
    achados = indice.filter((i) => termos.some((t) => t.length > 2 && i.texto.includes(t)));
    aproximado = achados.length > 0;
  }

  const lista = achados
    .map((i) => i.p)
    .sort((a, b) => a.preco - b.preco)
    .slice(0, 48);

  const lojas = [
    {
      loja: 'Mercado Livre',
      link: 'https://lista.mercadolivre.com.br/' + termos.map(encodeURIComponent).join('-'),
    },
    {
      loja: 'Amazon',
      link: 'https://www.amazon.com.br/s?k=' + encodeURIComponent(q) + '&tag=' + AMAZON_TAG,
    },
    {
      loja: 'Magalu',
      link: 'https://www.magazinevoce.com.br/' + MAGALU_SLUG + '/busca/' + encodeURIComponent(q) + '/',
    },
  ];

  return res.status(200).json({ busca: q, total: lista.length, aproximado, produtos: lista, lojas });
};
