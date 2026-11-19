const produtos = require('../data/produtos.json');
const { buscarML, vitrineML } = require('../lib/ml.js');

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

  const usarML = process.env.ML_ATIVO === 'sim' || (req.query && req.query.ml === '1');
  const infoDebug = req.query && req.query.debug === '1' ? {} : null;

  if (req.query && req.query.destaques) {
    // Sorteio fixo por dia: a vitrine muda diariamente, mas é igual para todos no mesmo dia
    let seed = Math.floor(Date.now() / 86400000);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const embaralhar = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    // um grupo por loja, para a vitrine ter variedade
    const porLoja = {};
    produtos
      .filter((x) => x.imagem && x.preco >= 30 && !eAcessorio(x))
      .forEach((x) => { (porLoja[x.loja] = porLoja[x.loja] || []).push(x); });
    const grupos = Object.keys(porLoja).map((k) => embaralhar(porLoja[k]));
    let mlStatus = 'desligado';
    if (usarML) {
      try {
        const doML = await Promise.race([
          vitrineML(infoDebug),
          new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (doML && doML.length) { grupos.push(embaralhar(doML.slice())); mlStatus = 'ok:' + doML.length; }
        else mlStatus = doML ? 'vazio' : 'demorou';
      } catch (e) {
        mlStatus = 'erro';
      }
    }
    // intercala as lojas: 1 de cada, em rodadas, até completar 12
    const vitrine = [];
    for (let i = 0; vitrine.length < 12 && grupos.some((g) => g[i]); i++) {
      grupos.forEach((g) => { if (g[i] && vitrine.length < 12) vitrine.push(g[i]); });
    }
    return res.status(200).json({ destaques: vitrine, ml: mlStatus, ml_debug: infoDebug || undefined, totalCatalogo: produtos.length });
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
  let mlStatus = 'desligado';
  const mlInfo = infoDebug;
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

  // Cada loja entra com até 20 produtos (os mais baratos dela), para uma loja não esconder as outras
  const porLojaBusca = {};
  juntos.forEach((x) => { (porLojaBusca[x.loja] = porLojaBusca[x.loja] || []).push(x); });
  let selecionados = [];
  Object.keys(porLojaBusca).forEach((k) => {
    selecionados = selecionados.concat(porLojaBusca[k].sort((a, b) => a.preco - b.preco).slice(0, 20));
  });
  const lista = selecionados.sort((a, b) => a.preco - b.preco).slice(0, 60);

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
