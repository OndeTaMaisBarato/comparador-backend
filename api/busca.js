const produtos = require('../data/produtos.json');
const { buscarML } = require('../lib/ml.js');

const AMAZON_TAG = process.env.AMAZON_TAG || 'ondetamaisb02-20';
const MAGALU_SLUG = process.env.MAGALU_SLUG || 'magazineondetamaisbarato';

const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Acessórios: nome começa com a palavra de acessório (nas 3 primeiras palavras) e custa menos de R$ 200
const PALAVRA_ACESSORIO = /^(adaptador(es)?|cabos?|suportes?|parafusos?|capas?|capinhas?|peliculas?|protetor(es)?|organizador(es)?|extensor(es)?|rodinhas?|rodizios?)$/;
const palavras = (s) => semAcento(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const eAcessorio = (p) => p.preco < 200 && palavras(p.nome).slice(0, 3).some((w) => PALAVRA_ACESSORIO.test(w));

const indice = produtos.map((p) => ({ p, texto: semAcento([p.nome, p.marca, p.categoria].join(' ')) }));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query && req.query.destaques) {
    // Sorteio fixo por dia: a vitrine muda diariamente, mas é igual para todos no mesmo dia
    let seed = Math.floor(Date.now() / 86400000);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pool = produtos.filter((x) => x.imagem && x.preco >= 30 && !eAcessorio(x));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return res.status(200).json({ destaques: pool.slice(0, 12), totalCatalogo: produtos.length });
  }

  const q = String((req.query && req.query.q) || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ erro: 'Digite um produto para pesquisar.' });

  const termos = semAcento(q).split(/\s+/).filter(Boolean);
  let achados = indice.filter((i) => termos.every((t) => i.texto.includes(t)));
  let aproximado = false;
  if (!achados.length && termos.length > 1) {
    achados = indice.filter((i) => termos.some((t) => t.length > 2 && i.texto.includes(t)));
    aproximado = achados.length > 0;
  }

  let juntos = achados.map((i) => i.p);

  // Esconde acessórios, exceto se a pessoa pediu para ver ou se a própria busca é por acessório
  const mostrarAcessorios = !!(req.query && req.query.acessorios === '1') || termos.some((t) => PALAVRA_ACESSORIO.test(t));
  const filtrar = (lista) => (mostrarAcessorios ? lista : lista.filter((x) => !eAcessorio(x)));
  juntos = filtrar(juntos);

  // Mercado Livre entra na lista quando ML_ATIVO=sim (ou ?ml=1 para testar)
  const usarML = process.env.ML_ATIVO === 'sim' || (req.query && req.query.ml === '1');
  let mlStatus = 'desligado';
  const mlInfo = req.query && req.query.debug === '1' ? {} : null;
  if (usarML) {
    try {
      const doML = await Promise.race([
        buscarML(q, termos, mlInfo),
        new Promise((resolve) => setTimeout(() => resolve(null), 7000)),
      ]);
      if (doML) { juntos = juntos.concat(filtrar(doML)); mlStatus = 'ok:' + doML.length; }
      else mlStatus = 'demorou';
    } catch (e) {
      mlStatus = 'erro';
    }
  }

  const lista = juntos.sort((a, b) => a.preco - b.preco).slice(0, 48);

  const lojas = [
    {
      loja: 'Mercado Livre',
      link:
        'https://lista.mercadolivre.com.br/' +
        termos.map(encodeURIComponent).join('-') +
        (process.env.ML_AFFILIATE_PARAMS ? '?' + process.env.ML_AFFILIATE_PARAMS.replace(/^[?&]/, '') : ''),
    },
    {
      loja: 'Amazon',
      link: 'https://www.amazon.com.br/s?k=' + encodeURIComponent(q) + '&tag=' + AMAZON_TAG,
    },
    {
      loja: 'Shopee',
      link:
        'https://shopee.com.br/search?keyword=' +
        encodeURIComponent(q) +
        (process.env.SHOPEE_AFFILIATE_PARAMS ? '&' + process.env.SHOPEE_AFFILIATE_PARAMS.replace(/^[?&]/, '') : ''),
    },
    {
      loja: 'Magalu',
      link: 'https://www.magazinevoce.com.br/' + MAGALU_SLUG + '/busca/' + encodeURIComponent(q) + '/',
    },
  ];

  return res.status(200).json({ busca: q, total: lista.length, aproximado, ml: mlStatus, ml_debug: mlInfo || undefined, produtos: lista, lojas });
};
