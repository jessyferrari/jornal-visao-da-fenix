/* Busca universal (20/11): quando a Jessyca busca qualquer palavra ou frase no jornal, além do Arquivo do Jornal (app.js),
   este script busca AO VIVO na internet, de graça, por rotas com CORS testadas: Google Notícias (pt-BR e en-US, inclusive só das últimas 24 h),
   Bing Notícias (pt-BR, en-US, es) e GDELT (índice mundial, 65 idiomas, sem proxy). Lista da mais recente para a mais antiga (20/11, t328).
  
   e mostra num bloco separado "Encontrado agora na internet". Fora do app (não mexe no app.js), como o nota.js.
   Regra de verdade: agrupa a mesma notícia por veículo REAL (nunca "news.google.com"); 2+ veículos distintos = Confirmado;
   1 veículo = Em apuração. Nunca marca exclusivo. Nada é inventado: só aparece o que as fontes devolveram agora. */
(function (raiz) {
  'use strict';
  var STOP = ' a o e de da do das dos em no na nos nas um uma para por com sem que se ao aos as os the of and to in on for is are diz apos sobre mais como foi ser sua seu suas seus pelo pela ja nao vai tem the '.split(' ');
  function norm(x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function toks(x) { return norm(x).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (t) { return t && STOP.indexOf(t) < 0; }); }
  function ent(s) {
    return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(+d); })
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }
  function tag(it, n) { var m = it.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); return m ? ent(m[1]).trim() : ''; }
  function semHtml(s) { return ent(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
  var NOMES = { 'g1.globo.com': 'g1', 'oglobo.globo.com': 'O Globo', 'ge.globo.com': 'ge', 'gshow.globo.com': 'Gshow', 'valor.globo.com': 'Valor Econômico', 'extra.globo.com': 'Extra',
    'revistamarieclaire.globo.com': 'Marie Claire', 'revistaquem.globo.com': 'Quem', 'glamour.globo.com': 'Glamour', 'redeglobo.globo.com': 'Rede Globo', 'epocanegocios.globo.com': 'Época Negócios', 'pipelinevalor.globo.com': 'Pipeline (Valor)',
    'uol.com.br': 'UOL', 'noticias.uol.com.br': 'UOL', 'economia.uol.com.br': 'UOL Economia', 'natelinha.uol.com.br': 'NaTelinha', 'folha.uol.com.br': 'Folha de S.Paulo', 'www1.folha.uol.com.br': 'Folha de S.Paulo', 'band.uol.com.br': 'Band',
    'estadao.com.br': 'Estadão', 'einvestidor.estadao.com.br': 'E-Investidor (Estadão)', 'cnnbrasil.com.br': 'CNN Brasil', 'terra.com.br': 'Terra', 'metropoles.com': 'Metrópoles', 'correiobraziliense.com.br': 'Correio Braziliense', 'exame.com': 'Exame',
    'infomoney.com.br': 'InfoMoney', 'poder360.com.br': 'Poder360', 'r7.com': 'R7', 'omelete.com.br': 'Omelete', 'olhardigital.com.br': 'Olhar Digital', 'bnews.com.br': 'BNews', 'brasildefato.com.br': 'Brasil de Fato',
    'bbc.com': 'BBC', 'adorocinema.com': 'AdoroCinema', 'istoe.com.br': 'IstoÉ', 'istoedinheiro.com.br': 'IstoÉ Dinheiro', 'veja.abril.com.br': 'Veja', 'otempo.com.br': 'O Tempo', 'correiodopovo.com.br': 'Correio do Povo', 'em.com.br': 'Estado de Minas',
    'gazetadopovo.com.br': 'Gazeta do Povo', 'agenciabrasil.ebc.com.br': 'Agência Brasil', 'moneytimes.com.br': 'Money Times', 'jovempan.com.br': 'Jovem Pan', 'lance.com.br': 'Lance!', 'sbt.com.br': 'SBT', 'cartacapital.com.br': 'CartaCapital',
    'msn.com': 'MSN', 'yahoo.com': 'Yahoo', 'br.investing.com': 'Investing.com', 'livecoins.com.br': 'Livecoins', 'portaldobitcoin.uol.com.br': 'Portal do Bitcoin', 'cointelegraph.com.br': 'Cointelegraph Brasil', 'forbes.com.br': 'Forbes Brasil' };
  // agregadores republicam matéria de outros: aparecem, mas não contam como veículo que confirma
  var AGREG = { 'msn.com': 1, 'yahoo.com': 1, 'news.google.com': 1, 'bing.com': 1, 'flipboard.com': 1 };
  function nomeDe(h) { h = String(h || '').replace(/^www\./, ''); return NOMES[h] || NOMES[base(h)] || h; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  // Google Notícias: veículo vem em <source> ou no fim do título " - Veículo"
  function lerGoogle(xml) {
    var out = [], its = String(xml || '').split(/<item>/i).slice(1);
    its.forEach(function (it) {
      var t = tag(it, 'title'), src = tag(it, 'source'), l = tag(it, 'link'), p = tag(it, 'pubDate');
      var su = (it.match(/<source[^>]*url="([^"]+)"/i) || [])[1] || '';
      if (src && t.slice(-(src.length + 3)) === ' - ' + src) t = t.slice(0, -(src.length + 3));
      else if (!src) { var k = t.lastIndexOf(' - '); if (k > 0) { src = t.slice(k + 3); t = t.slice(0, k); } }
      if (t && l && src) out.push({ t: t, v: src, l: l, p: p ? new Date(p).toISOString() : '', d: host(su) || '', r: 'Google Notícias' });
    });
    return out;
  }
  // Bing Notícias: link real vem no parâmetro url= do apiclick; veículo em <News:Source>
  function linkBing(l) { var m = String(l).match(/[?&]url=([^&]+)/); try { return m ? decodeURIComponent(m[1]) : l; } catch (e) { return l; } }
  function lerBing(xml) {
    var out = [], its = String(xml || '').split(/<item>/i).slice(1);
    its.forEach(function (it) {
      var t = tag(it, 'title'), l = linkBing(tag(it, 'link')), src = tag(it, 'News:Source') || nomeDe(host(l)), p = tag(it, 'pubDate');
      if (t && /^https?:/.test(l) && src) out.push({ t: t, s: semHtml(tag(it, 'description')), v: src, l: l, p: p ? new Date(p).toISOString() : '', d: host(l), r: 'Bing Notícias' });
    });
    return out;
  }
  // rss2json (plano B): JSON sem o <source>; veículo pelo fim do título (Google) ou pelo site do link (Bing)
  function lerRss2json(js, tipo) {
    var out = [];
    ((js && js.items) || []).forEach(function (i) {
      var t = ent(i.title || ''), l = i.link || '', v = '', p = i.pubDate ? new Date(i.pubDate.replace(' ', 'T') + 'Z').toISOString() : '';
      if (tipo === 'g') { var k = t.lastIndexOf(' - '); if (k > 0) { v = t.slice(k + 3); t = t.slice(0, k); } }
      else { l = linkBing(l); v = nomeDe(host(l)); }
      if (t && v && /^https?:/.test(l)) out.push({ t: t, s: tipo === 'b' ? semHtml(i.description) : '', v: v, l: l, p: p, d: tipo === 'b' ? host(l) : '', r: tipo === 'g' ? 'Google Notícias' : 'Bing Notícias' });
    });
    return out;
  }
  // GDELT (20/11, t328): índice mundial de notícias em 65 idiomas, atualizado a cada 15 min, com CORS aberto (sem proxy).
  // seendate = hora em que o GDELT viu a matéria (UTC); o veículo vem do domínio.
  function lerGdelt(js) {
    var out = [];
    ((js && js.articles) || []).forEach(function (a) {
      var m = String(a.seendate || '').match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/), p = m ? m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + '.000Z' : '';
      var d = host(a.url) || String(a.domain || '').replace(/^www\./, ''), t = ent(String(a.title || '')).replace(/\s+([,.:;!?])/g, '$1').replace(/\s+-\s+/g, '-').replace(/\s+/g, ' ').trim();
      if (t && /^https?:/.test(a.url || '') && d) out.push({ t: t, v: nomeDe(d), l: a.url, p: p, d: d, r: 'GDELT (mundo)', idioma: a.language || '' });
    });
    return out;
  }
  // só fica o que fala do assunto pesquisado (todas as palavras da busca no título/resumo/veículo)
  function relevante(q, x) { var qt = toks(q); if (!qt.length) return false; var h = ' ' + toks(x.t + ' ' + (x.s || '') + ' ' + x.v).join(' ') + ' '; return qt.every(function (t) { return t.length <= 2 ? h.indexOf(' ' + t + ' ') >= 0 : h.indexOf(t) >= 0; }); }
  // veículo = domínio base (uol.com.br, globo.com); conta para menos, nunca para mais (g1 e O Globo contam como 1)
  function base(d) { var p = String(d || '').toLowerCase().split('.').filter(Boolean); if (p.length < 2) return ''; var n = /^(com|org|net|gov|edu|co|jus|leg|art|blog)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2; return p.slice(-n).join('.'); }
  // pontuação vira barreira: "Lula ou Flávio, Augusto Cury" NÃO contém a frase "Flávio Augusto"
  function plano(x) { return ' ' + norm(x).replace(/[,.;:!?()\[\]"“”«»|\u2013\u2014]+|\s-\s/g, ' | ').replace(/[^a-z0-9|]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function temFrase(q, x) { var f = plano(q); return plano(x.t + ' ' + (x.s || '')).indexOf(f) >= 0; }
  // busca de 2+ palavras: se alguma matéria tem a frase exata, só ficam as que têm a frase (evita "Flávio Bolsonaro" + "Augusto Cury" para "Flávio Augusto")
  function filtrar(q, its) {
    its = its.filter(function (x) { return relevante(q, x); });
    if (plano(q).trim().split(' ').length < 2) return { itens: its, exata: true };
    var ex = its.filter(function (x) { return temFrase(q, x); });
    return ex.length ? { itens: ex, exata: true } : { itens: its, exata: false };
  }
  function chaveVeiculo(v, d) { var n = norm(v).replace(/\s+/g, ''); if (n === 'msn' || n === 'yahoo' || n.indexOf('yahoo') === 0) return n === 'msn' ? 'msn.com' : 'yahoo.com'; return base(d) || norm(v).replace(/^(www\.)/, '').replace(/[^a-z0-9]+/g, ''); }
  function chaveLink(l) { return String(l || '').split('#')[0].split('?')[0].replace(/\/$/, ''); }
  // agrupa a mesma notícia: palavras do título em comum (sem as palavras da busca)
  function agrupar(q, itens) {
    var qt = toks(q), vistos = {}, lista = [];
    itens.forEach(function (x) {
      var k = chaveLink(x.l), kt = chaveVeiculo(x.v, x.d) + '|' + norm(x.t).replace(/[^a-z0-9]+/g, '');
      if (vistos[k] || vistos[kt]) return; vistos[k] = vistos[kt] = 1;
      x.k = toks(x.t).filter(function (t) { return t.length > 2 && qt.indexOf(t) < 0; });
      lista.push(x);
    });
    lista.sort(function (a, b) { return a.p < b.p ? 1 : a.p > b.p ? -1 : 0; });
    var gs = [];
    lista.forEach(function (x) {
      var alvo = null;
      for (var i = 0; i < gs.length && !alvo; i++) {
        var g = gs[i], dt = Math.abs(new Date(g.itens[0].p) - new Date(x.p)) / 36e5;
        if (x.p && g.itens[0].p && dt > 72) continue;
        var a = g.k, comum = x.k.filter(function (t) { return a.indexOf(t) >= 0; }).length, uni = new Set(a.concat(x.k)).size || 1;
        if (comum >= 4 || (comum >= 2 && comum / uni >= 0.34)) alvo = g;
      }
      if (alvo) { alvo.itens.push(x); x.k.forEach(function (t) { if (alvo.k.indexOf(t) < 0) alvo.k.push(t); }); }
      else gs.push({ itens: [x], k: x.k.slice() });
    });
    gs.forEach(function (g) {
      var vs = {}; g.itens.forEach(function (x) { var c = chaveVeiculo(x.v, x.d); if (!AGREG[c] && !vs[c]) vs[c] = x.v; });
      g.veiculos = Object.keys(vs).map(function (c) { return vs[c]; });
      g.confirmado = g.veiculos.length >= 2;
      g.primeiro = g.itens.slice().sort(function (a, b) { return a.p < b.p ? -1 : 1; })[0];
      // a manchete do grupo vem de um veículo de origem (não de agregador), quando houver
      var orig = g.itens.filter(function (x) { return !AGREG[chaveVeiculo(x.v, x.d)]; });
      if (orig.length && orig[0] !== g.itens[0]) { g.itens.splice(g.itens.indexOf(orig[0]), 1); g.itens.unshift(orig[0]); }
    });
    // 20/11 (t328): mais recente primeiro (antes, as confirmadas iam na frente e a notícia de hoje ficava escondida embaixo)
    ordenar(gs);
    var todosV = {}; lista.forEach(function (x) { var c = chaveVeiculo(x.v, x.d); if (!AGREG[c] && !todosV[c]) todosV[c] = x.v; });
    return { grupos: gs, itens: lista, veiculos: Object.keys(todosV).map(function (c) { return todosV[c]; }) };
  }
  function recente(g) { return g.itens.reduce(function (m, x) { return x.p > m ? x.p : m; }, ''); }
  function ordenar(gs) { gs.sort(function (a, b) { var pa = recente(a), pb = recente(b); return pa < pb ? 1 : pa > pb ? -1 : (b.confirmado - a.confirmado); }); return gs; }
  // dia de hoje em Brasília (AAAA-MM-DD) de um ISO UTC
  function hojeBR(iso) { try { return new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10); } catch (e) { return ''; } }
  var api = { filtrar: filtrar, temFrase: temFrase, nomeDe: nomeDe, base: base, chaveVeiculo: chaveVeiculo, lerGoogle: lerGoogle, lerBing: lerBing, lerGdelt: lerGdelt, ordenar: ordenar, hojeBR: hojeBR, lerRss2json: lerRss2json, relevante: relevante, agrupar: agrupar, toks: toks, norm: norm };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  raiz.__jfBuscaWeb = api;

  /* ---------- navegador ---------- */
  var OURO = '#d4af37', FUNDO = '#0d0b08', TXT = '#efe6cf', SUAVE = '#bfa775', LINHA = '#3a3122';
  // 20/11 (t328): Brasil E mundo. Google Notícias em pt-BR e en-US; Bing em pt-BR, en-US e es; GDELT no mundo inteiro.
  // "_" muda a cada 5 min: obriga o rss2json a buscar o feed de novo (o cache dele devolvia lista de ontem).
  var EDG = { 'pt': 'hl=pt-BR&gl=BR&ceid=BR:pt-419', 'en': 'hl=en-US&gl=US&ceid=US:en' };
  var MKB = { 'pt': 'setlang=pt-BR&cc=BR', 'en': 'setlang=en-US&cc=US', 'es': 'setlang=es-ES&cc=ES' };
  function fresco() { return Math.floor(Date.now() / 300e3); }
  function urlG(q, ed, extra) { return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + (extra || '')) + '&' + EDG[ed || 'pt']; }
  function urlB(q, mk) { return 'https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&format=rss&' + MKB[mk || 'pt'] + '&_=' + fresco(); }
  function urlD(q) { return 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(/\s/.test(q) ? '"' + q + '"' : q) + '&mode=artlist&format=json&sort=datedesc&maxrecords=75&timespan=3d'; }
  function pega(u, ms, json) {
    var c = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(function () { if (c) c.abort(); }, ms);
    return fetch(u, { signal: c ? c.signal : undefined, cache: 'no-store', credentials: 'omit' }).then(function (r) {
      clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); return json ? r.json() : r.text();
    }, function (e) { clearTimeout(tm); throw e; });
  }
  function rss2json(u) { return pega('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(u), 6000, true).then(function (j) { if (!j || j.status !== 'ok') throw 0; return j; }); }
  function corslol(u) { return pega('https://api.cors.lol/?url=' + encodeURIComponent(u), 5000).then(function (x) { if (!/<rss/i.test(x)) throw 0; return x; }); }
  function allorigins(u) { return pega('https://api.allorigins.win/get?url=' + encodeURIComponent(u), 5000, true).then(function (j) { var x = j && j.contents; if (!/<rss/i.test(x || '')) throw 0; return x; }); }
  function primeiro(ps) { return new Promise(function (ok, nao) { var n = ps.length; ps.forEach(function (p) { p.then(ok, function () { if (--n === 0) nao(new Error('todas as rotas falharam')); }); }); }); }
  // Bing Notícias (motor principal, testado 20/11: rss2json responde 200 com CORS da origem do jornal em < 1,5 s);
  // 3 recortes em paralelo: relevância, mais recentes e últimos 7 dias. Plano B: api.cors.lol.
  function motorB(q, v, mk) {
    var u = urlB(q, mk) + (v || '');
    return rss2json(u).then(function (j) { return lerRss2json(j, 'b'); }).catch(function () { return corslol(u).then(lerBing); });
  }
  // Google Notícias pt-BR (bônus, quando as rotas gratuitas deixam): corrida entre api.cors.lol e allorigins; plano C rss2json
  function motorG(q, ed, extra) {
    var u = urlG(q, ed, extra);
    return primeiro([corslol(u), allorigins(u)]).then(lerGoogle).catch(function () { return rss2json(u).then(function (j) { return lerRss2json(j, 'g'); }); });
  }
  // GDELT: CORS aberto, sem proxy; pede 1 consulta a cada 5 s por aparelho (a busca faz 1 só)
  function motorD(q) { return pega(urlD(q), 15000, true).then(lerGdelt); }
  // Google Notícias depende de proxies gratuitos que às vezes bloqueiam: se falharem todas as rotas, pausa 10 min (não atrasa nem suja o console a cada busca)
  function googleLiberado() { try { return Date.now() > +(localStorage.getItem('jvf-google-pausa') || 0); } catch (e) { return true; } }
  function googlePausa() { try { localStorage.setItem('jvf-google-pausa', String(Date.now() + 10 * 60e3)); } catch (e) {} }
  function hora(p) {
    if (!p) return '';
    try { return new Date(p).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') + ' (Brasília)'; } catch (e) { return ''; }
  }
  function resumoHoje(res) {
    var hoje = hojeBR(new Date().toISOString()), n = res.grupos.filter(function (g) { return g.itens.some(function (x) { return x.p && hojeBR(x.p) === hoje; }); }).length;
    var mais = res.itens.reduce(function (m, x) { return x.p > m ? x.p : m; }, '');
    return n + (n === 1 ? ' notícia de hoje' : ' notícias de hoje') + (mais ? ' · mais recente: ' + hora(mais) : '');
  }
  function el(t, css, txt) { var e = document.createElement(t); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  var cache = {}, atual = '', seq = 0, box = null, ultimo = null;
  function caixa() {
    if (!box) { box = el('section', 'margin:10px 0 6px;padding:12px;border:1.5px solid ' + OURO + ';border-radius:6px;background:' + FUNDO + ';color:' + TXT + ';font:14px/1.4 system-ui,sans-serif'); box.setAttribute('data-qa', 'busca-web'); box.setAttribute('aria-live', 'polite'); }
    return box;
  }
  function encaixar() {
    var r = document.querySelector('[data-qa="results"]'); if (!r || !box) return;
    var ul = r.querySelector(':scope > ul'); var cab = r.firstElementChild;
    if (box.parentNode !== r) { if (cab && cab.nextSibling) r.insertBefore(box, cab.nextSibling); else r.appendChild(box); }
    if (ul && box.nextSibling !== ul && cab && box.previousSibling !== cab) r.insertBefore(box, cab.nextSibling);
    if (ul) {
      var marca = r.querySelector('[data-qa="rotulo-arquivo"]');
      if (!marca) { marca = el('h3', 'margin:14px 0 2px;font:700 13px/1.2 system-ui,sans-serif;letter-spacing:.06em;color:' + OURO + ';text-transform:uppercase', '📰 No Jornal (arquivo de 14 dias)'); marca.setAttribute('data-qa', 'rotulo-arquivo'); r.insertBefore(marca, ul); }
    }
  }
  function desenhar(q, estado) {
    var b = caixa(); b.textContent = ''; b.setAttribute('data-q', q); b.setAttribute('data-estado', estado.carregando ? 'carregando' : 'pronto');
    var h = el('h3', 'margin:0 0 6px;font:700 13px/1.2 system-ui,sans-serif;letter-spacing:.06em;color:' + OURO + ';text-transform:uppercase', '🌐 Encontrado agora na internet');
    b.appendChild(h);
    if (estado.carregando && !estado.res) { b.appendChild(el('div', 'color:' + SUAVE, 'Buscando “' + q + '” agora no Google Notícias, Bing Notícias e GDELT, no Brasil e no mundo…')); encaixar(); return; }
    var res = estado.res;
    if (!res || !res.itens.length) {
      b.appendChild(el('div', 'color:' + SUAVE, estado.carregando ? 'Buscando…' : (estado.falhou === estado.total ? 'As fontes da internet não responderam agora. Tente de novo em instantes (o arquivo do jornal abaixo continua valendo).' : 'Nenhuma notícia com “' + q + '” nas fontes da internet agora.')));
      encaixar(); return;
    }
    var nConf = res.grupos.filter(function (g) { return g.confirmado; }).length;
    var resumo = res.veiculos.length >= 2 ? '📡 ' + res.veiculos.length + ' veículos distintos citam “' + q + '” · ' + (nConf ? nConf + (nConf === 1 ? ' notícia confirmada' : ' notícias confirmadas') + ' por 2+ veículos' : 'nenhuma notícia confirmada por 2 veículos ainda')
      : res.veiculos.length === 1 ? '🔎 Só 1 veículo cita “' + q + '” (' + res.veiculos[0] + '): em apuração' : '🔎 Só agregadores (MSN/Yahoo) citam: em apuração';
    b.appendChild(el('div', 'font-weight:700;color:' + (nConf ? OURO : SUAVE) + ';margin-bottom:2px', resumo));
    b.appendChild(el('div', 'font-size:12px;color:' + SUAVE + ';margin-bottom:6px', res.itens.length + ' matérias · ' + resumoHoje(res) + ' · responderam: ' + estado.fontes.join(', ') + (!estado.carregando && estado.semResposta.length ? ' · sem resposta agora: ' + estado.semResposta.filter(function (n, i, a) { return a.indexOf(n) === i && estado.fontes.indexOf(n) < 0; }).join(', ') : '') + (estado.carregando ? ' · buscando mais…' : '') + ' · ' + (estado.ms / 1000).toFixed(1).replace('.', ',') + ' s'));
    if (!estado.exata) b.appendChild(el('div', 'font-size:12px;color:' + SUAVE + ';margin-bottom:6px', 'Nenhuma matéria com a frase exata “' + q + '”: mostrando as que têm todas as palavras.'));
    var ul = el('ul', 'list-style:none;margin:0;padding:0');
    res.grupos.slice(0, 40).forEach(function (g) {
      var x = g.itens[0], li = el('li', 'padding:9px 0;border-top:1px solid ' + LINHA + ';display:flex;flex-direction:column;gap:4px');
      li.setAttribute('data-qa', 'web-item');
      var selo = el('span', 'align-self:flex-start;font:700 12px/1.2 system-ui,sans-serif;padding:4px 9px;border-radius:999px;border:1.5px solid ' + OURO + ';' + (g.confirmado ? 'background:' + OURO + ';color:' + FUNDO : 'background:' + FUNDO + ';color:' + OURO),
        g.confirmado ? '✅ Confirmado em ' + g.veiculos.length + ' veículos' : '🔎 Em apuração · 1 fonte');
      li.appendChild(selo);
      var a = el('a', 'color:' + TXT + ';font-weight:600;text-decoration:none;font-size:15px'); a.href = x.l; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = x.t; a.setAttribute('data-qa', 'web-link');
      li.appendChild(a);
      li.appendChild(el('span', 'font-size:12px;color:' + SUAVE, x.v + (x.p ? ' · ' + hora(x.p) : '')));
      if (g.confirmado) {
        var tb = el('span', 'font-size:12px;color:' + SUAVE, 'Também em: ');
        g.itens.slice(1).forEach(function (y, i) {
          var cy = chaveVeiculo(y.v, y.d); if (cy === chaveVeiculo(x.v, x.d) || tb.__v && tb.__v[cy]) return; (tb.__v = tb.__v || {})[cy] = 1;
          var ya = el('a', 'color:' + OURO); ya.href = y.l; ya.target = '_blank'; ya.rel = 'noopener noreferrer'; ya.textContent = y.v;
          tb.appendChild(ya); tb.appendChild(document.createTextNode(' '));
        });
        li.appendChild(tb);
        if (g.primeiro && g.primeiro.p) li.appendChild(el('span', 'font-size:11px;color:' + SUAVE, 'Saiu primeiro em ' + g.primeiro.v + ' · ' + hora(g.primeiro.p)));
      }
      ul.appendChild(li);
    });
    b.appendChild(ul);
    encaixar();
  }
  function buscar(q) {
    var mine = ++seq, t0 = Date.now(), ck = norm(q);
    if (cache[ck] && Date.now() - cache[ck].em < 5 * 60e3) { ultimo = cache[ck].estado; desenhar(q, ultimo); return; }
    // 20/11 (t328): 5 fontes ao mesmo tempo, Brasil e mundo (antes: 3 recortes do Bing pt-BR, que só tinha até ontem, e o Google pt-BR quando o proxy deixava).
    // Poucas chamadas de propósito: os proxies grátis bloqueiam (429) quem pede demais. A lista sai da mais recente para a mais antiga.
    var MOT = [['Bing Notícias', function () { return motorB(q, '&qft=sortbydate%3d%221%22'); }],
      ['Bing Notícias (mundo)', function () { return motorB(q, '&qft=sortbydate%3d%221%22', 'en'); }],
      ['GDELT (mundo)', function () { return motorD(q); }]];
    if (googleLiberado()) {
      var gFalhas = 0, gErro = function (e) { if (++gFalhas === 2) googlePausa(); throw e; };
      MOT.unshift(['Google Notícias', function () { return motorG(q, 'pt', ' when:3d').catch(gErro); }], ['Google Notícias (mundo)', function () { return motorG(q, 'en', ' when:1d').catch(gErro); }]);
    }
    var estado = { q: q, carregando: true, res: null, fontes: [], semResposta: [], falhou: 0, total: MOT.length, ms: 0 }, todos = [], feitos = 0;
    ultimo = estado; desenhar(q, estado);
    MOT.forEach(function (m, i) {
      new Promise(function (ok) { setTimeout(ok, i * 200); }).then(m[1]).then(function (its) {
        if (mine !== seq) return;
        todos = todos.concat(its); if (its.some(function (x) { return relevante(q, x); }) && estado.fontes.indexOf(m[0]) < 0) estado.fontes.push(m[0]);
      }, function () { estado.falhou++; estado.semResposta.push(m[0]); }).then(function () {
        if (mine !== seq) return;
        feitos++; estado.carregando = feitos < MOT.length; estado.ms = Date.now() - t0; var f = filtrar(q, todos); estado.exata = f.exata; estado.res = f.itens.length ? agrupar(q, f.itens) : null;
        if (!estado.carregando) cache[ck] = { em: Date.now(), estado: estado };
        desenhar(q, estado);
      });
    });
  }
  var tmr = null;
  function aoDigitar() {
    var inp = document.querySelector('input[data-qa="search"]'); if (!inp) return;
    var q = inp.value.trim();
    if (q === atual) return; atual = q; clearTimeout(tmr);
    seq++;
    if (q.length < 2) { if (box && box.parentNode) box.parentNode.removeChild(box); return; }
    desenhar(q, { q: q, carregando: true, res: null, fontes: [], semResposta: [], falhou: 0, total: 3, ms: 0 });
    tmr = setTimeout(function () { buscar(q); }, 700);
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('input[data-qa="search"]')) aoDigitar(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('input[data-qa="search"]')) { atual = ''; clearTimeout(tmr); var q = e.target.value.trim(); if (q.length >= 2) { atual = q; buscar(q); } } }, true);
  // o React redesenha a área de resultados: recoloca o bloco se ele sair
  new MutationObserver(function () { if (box && atual.length >= 2 && document.querySelector('[data-qa="results"]') && !document.contains(box)) encaixar(); else if (box && document.contains(box)) encaixar(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})(this);
