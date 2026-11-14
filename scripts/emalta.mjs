// "Em Alta" do Jornal Visão da Fênix: só o que está MAIS COMENTADO no Brasil e no mundo e o que está SUBINDO,
// cruzando fontes públicas (Google Trends Brasil e EUA, assuntos do X pelo trends24, Google Notícias, a própria
// imprensa que o robô já agrupa e as mais lidas da Wikipedia). Gera emalta.json (página emalta.html e painel do agente),
// atencao.json (curva de atenção por hora, Wikipedia pt) e manda o canal ntfy "Fenix Em Alta" (<canal Música>-alta).
// Zero IA, zero login, zero API paga. Uso: node scripts/emalta.mjs [--agora 2026-11-14T07:05-03:00] [--sem-envio]
import fs from 'node:fs';
import * as R from './emalta-regras.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const AGORA = arg('--agora') ? Date.parse(arg('--agora')) : Date.now();
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9' };
const UAW = { 'User-Agent': 'JornalVisaoDaFenix/1.0 (https://github.com/jessyferrari/jornal-visao-da-fenix)' };   // Wikimedia pede User-Agent que identifique
const baixa = async (u, h = UA, ms = 15000) => { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); };
const lerJ = (a, p) => { try { return JSON.parse(fs.readFileSync(a, 'utf8')); } catch { return p; } };
const ent = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const PAGINA = 'https://jessyferrari.github.io/jornal-visao-da-fenix/emalta.html';
const ICONE = 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png';
const ESTF = 'emalta-estado.json', seed = !fs.existsSync(ESTF);
const E = lerJ(ESTF, {}); E.topicos = E.topicos || {}; E.apelidos = E.apelidos || {};
const FONTES = {}; const sinais = [];
const ok = (k, n, extra) => { FONTES[k] = { ok: true, itens: n, ...(extra || {}) }; };
const erro = (k, e) => { FONTES[k] = { ok: false, erro: String(e.message || e).slice(0, 120) }; };

// ----- 1) Google Trends (RSS público): termo, buscas aproximadas, quando começou, notícias ligadas
for (const [k, geo, escopo] of [['googleTrendsBrasil', 'BR', 'br'], ['googleTrendsEUA', 'US', 'mundo']]) {
  try { const x = await baixa('https://trends.google.com/trending/rss?geo=' + geo); let n = 0;
    for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const g = (re) => ent((b.match(re) || [])[1]);
      const vei = [...b.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>[\s\S]*?<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>[\s\S]*?<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/g)].map((m) => ({ nome: ent(m[3]), titulo: ent(m[1]), link: ent(m[2]) }));
      const termo = g(/<title>([\s\S]*?)<\/title>/); if (!termo) continue;
      sinais.push({ tipo: 'gt', termo, escopo, veiculos: vei, link: (vei[0] || {}).link, dados: { trafego: g(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/), inicio: Date.parse(g(/<pubDate>([\s\S]*?)<\/pubDate>/)) || null } }); n++; }
    ok(k, n); } catch (e) { erro(k, e); }
}
// ----- 2) assuntos do X por hora (trends24, página pública): posição agora, melhor posição e horas em alta (últimas 6 listas)
for (const [k, url, escopo, topo] of [['xBrasil', 'https://trends24.in/brazil/', 'br', 25], ['xMundo', 'https://trends24.in/', 'mundo', 15]]) {
  try { const x = await baixa(url); const ag = new Map(); const blocos = x.split('<div class=list-container>').slice(1, 7);
    blocos.forEach((bl, bi) => [...bl.matchAll(/class=trend-link>([^<]+)<\/a>(?:<span class=tweet-count data-count="?([^">]*))?/g)].slice(0, 30).forEach((m, n) => {
      const t = ent(m[1]); const a = ag.get(t) || { termo: t, horas: 0, melhor: 99, posicao: null, posts: '' }; a.horas++; a.melhor = Math.min(a.melhor, n + 1); if (bi === 0) a.posicao = n + 1; if (m[2] && !a.posts) a.posts = m[2]; ag.set(t, a); }));
    let n = 0; for (const a of ag.values()) if (((a.posicao && a.posicao <= topo) || a.melhor <= 10) && (escopo === 'br' || /^[#\p{Script=Latin}0-9 .,'’&!?:_-]+$/u.test(a.termo)))   // mundo: só alfabeto latino (ela lê português)
 { sinais.push({ tipo: 'x', termo: a.termo, escopo, dados: a, link: 'https://x.com/search?q=' + encodeURIComponent(a.termo) }); n++; }
    ok(k, n, { listas: blocos.length }); } catch (e) { erro(k, e); }
}
// ----- 3) Google Notícias: manchetes principais (Brasil e Mundo); a descrição traz outros veículos da mesma história
for (const [k, url, escopo] of [['googleNoticiasBrasil', 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419', 'br'], ['googleNoticiasMundo', 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuQjBHZ0pDVWlnQVAB?hl=pt-BR&gl=BR&ceid=BR:pt-419', 'mundo']]) {
  try { const x = await baixa(url); let n = 0;
    for (const b of (x.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 25)) { const g = (re) => ent((b.match(re) || [])[1]);
      const fonte = g(/<source[^>]*>([\s\S]*?)<\/source>/); const titulo = g(/<title>([\s\S]*?)<\/title>/).replace(new RegExp('\\s+-\\s+' + fonte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), ''); const link = g(/<link>([\s\S]*?)<\/link>/);
      const vei = [{ nome: fonte, titulo, link }]; const desc = ent(g(/<description>([\s\S]*?)<\/description>/));
      for (const m of desc.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>(?:&nbsp;|\s)*<font[^>]*>([^<]+)<\/font>/g)) vei.push({ nome: ent(m[3]), titulo: ent(m[2]), link: m[1] });
      if (titulo) { sinais.push({ tipo: 'gnews', termo: titulo, escopo, veiculos: vei, link }); n++; } }
    ok(k, n); } catch (e) { erro(k, e); }
}
// ----- 4) a própria imprensa do jornal (edicao.json): o mesmo fato em vários veículos = mais comentado na imprensa
try { const ed = lerJ('edicao.json', { stories: [] }); const grupos = new Map();
  for (const s of ed.stories || []) { const ts = Date.parse(s.pub + ':00-03:00'); if (!(AGORA - ts < 12 * 3600e3)) continue; const k = s.eid || s.id; (grupos.get(k) || grupos.set(k, []).get(k)).push(s); }
  let n = 0;
  for (const [eid, L] of grupos) { const vei = new Map(); const add = (nome, titulo, link) => { const kk = R.sem(nome).replace(/[^a-z0-9]/g, ''); if (kk && !vei.has(kk)) vei.set(kk, { nome, titulo, link }); };
    for (const s of L) { add(s.src, s.title, s.link); for (const x of s.ext || []) add(x.src, x.title, x.link); }
    if (vei.size < 2) continue; const best = [...L].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    sinais.push({ tipo: 'imprensa', termo: best.title, texto: L.map((s) => [s.title, ...(s.ext || []).map((x) => x.title)].join(' · ')).join(' · '), eid, escopo: best.sec === 'mundo' ? 'mundo' : 'br', veiculos: [...vei.values()], link: best.link }); n++; }
  ok('imprensa', n); } catch (e) { erro('imprensa', e); }
// ----- 5) Wikipedia: mais lidas de ontem (pt e en) e quantas vezes a média da semana (1 vez por dia, guardado no estado)
// o ranking de um dia sai algumas horas depois do fim do dia (UTC): tenta ontem e, se ainda não saiu, anteontem
let ontemUTC = new Date(AGORA - 86400e3).toISOString().slice(0, 10);
if (!E.wiki || E.wiki.dia !== ontemUTC || !E.wiki.itens.length) {
  const itens = [];
  for (const [proj, escopo, lim] of [['pt.wikipedia', 'br', 12], ['en.wikipedia', 'mundo', 6]]) {
    try { let j; try { j = JSON.parse(await baixa('https://wikimedia.org/api/rest_v1/metrics/pageviews/top/' + proj + '/all-access/' + ontemUTC.replace(/-/g, '/'), UAW)); }
      catch (e) { if (!/404/.test(e.message)) throw e; const d2 = new Date(AGORA - 2 * 86400e3).toISOString().slice(0, 10); if (E.wiki && E.wiki.dia === d2 && E.wiki.itens.some((w) => w.proj === proj)) { itens.push(...E.wiki.itens.filter((w) => w.proj === proj)); ontemUTC = d2; continue; } ontemUTC = d2; j = JSON.parse(await baixa('https://wikimedia.org/api/rest_v1/metrics/pageviews/top/' + proj + '/all-access/' + d2.replace(/-/g, '/'), UAW)); }
      const arts = j.items[0].articles.filter((a) => !/:|^Main_Page$|^[-.]/.test(a.article)).slice(0, lim);
      for (const a of arts) { let vezes = null;
        try { const fim = ontemUTC.replace(/-/g, ''), ini = new Date(Date.parse(ontemUTC) - 7 * 86400e3).toISOString().slice(0, 10).replace(/-/g, '');   // os 7 dias antes do dia medido
          const p = JSON.parse(await baixa('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/' + proj + '/all-access/user/' + encodeURIComponent(a.article) + '/daily/' + ini + '00/' + fim + '00', UAW)).items.map((i) => i.views);
          const antes = p.slice(0, -1).sort((x, y) => x - y); const med = antes.length ? antes[Math.floor(antes.length / 2)] : 0; if (med > 0) { const v = p[p.length - 1] / med; if (v >= 2) vezes = +v.toFixed(1); } } catch {}
        itens.push({ artigo: a.article, views: a.views, escopo, vezesMedia: vezes, proj }); }
    } catch (e) { erro('wikipedia-' + escopo, e); }
  }
  if (itens.length) E.wiki = { dia: ontemUTC, itens };
}
if (E.wiki) { for (const w of E.wiki.itens) sinais.push({ tipo: 'wiki', termo: w.artigo.replace(/_/g, ' '), escopo: w.escopo, link: 'https://' + w.proj.replace('.wikipedia', '') + '.wikipedia.org/wiki/' + encodeURIComponent(w.artigo), dados: { views: w.views, artigo: w.artigo, vezesMedia: w.vezesMedia, dia: E.wiki.dia } }); ok('wikipedia', E.wiki.itens.length, { dia: E.wiki.dia }); }

// ----- junta, lembra e etiqueta
const todos = R.juntar(sinais); const itens = [];
for (const t of todos) {
  const rel = R.relevante(t); if (!rel && t.tipos.length < 2) continue;
  const [k, T] = R.lembrar(E, t, AGORA, seed); if (!rel) continue;
  const { etiqueta, motivo } = R.etiquetar(t, T, AGORA);
  itens.push({ id: R.idAlta(k), chave: k, ...t, etiqueta, rotulo: R.ROTULO[etiqueta], motivo, confianca: R.confianca(t), publicavel: R.publicavel(t), numerosTexto: R.numerosTexto(t), primeiroVisto: R.brIso(T.primeiro), tiposNomes: t.tipos.map((x) => R.TIPOS[x]) });
}
R.esquecer(E, AGORA);
itens.sort((a, b) => (R.ORDEM[a.etiqueta] - R.ORDEM[b.etiqueta]) || (b.tipos.length - a.tipos.length) || (b.veiculos.length - a.veiculos.length));

// ----- curva de atenção (Wikipedia pt, visitas por hora em todas as páginas), 1 vez por hora; acumula até 35 dias
const AT = lerJ('atencao.json', { horas: {} }); AT.horas = AT.horas || {};
if (!AT.lido || AGORA - Date.parse(AT.lido) > 55 * 60e3) {
  try { const dias = Object.keys(AT.horas).length ? 3 : 32; const fim = new Date(AGORA).toISOString().slice(0, 13).replace(/[-T]/g, ''), ini = new Date(AGORA - dias * 86400e3).toISOString().slice(0, 10).replace(/-/g, '') + '00';
    const j = JSON.parse(await baixa('https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/pt.wikipedia/all-access/user/hourly/' + ini + '/' + fim, UAW, 20000));
    for (const i of j.items) { const ms = Date.UTC(+i.timestamp.slice(0, 4), +i.timestamp.slice(4, 6) - 1, +i.timestamp.slice(6, 8), +i.timestamp.slice(8, 10)); const b = R.brIso(ms); AT.horas[b.slice(0, 10) + ' ' + b.slice(11, 13)] = i.views; }
    const lim = R.brDia(AGORA - 35 * 86400e3); for (const k of Object.keys(AT.horas)) if (k.slice(0, 10) < lim) delete AT.horas[k];
    AT.lido = new Date(AGORA).toISOString(); AT.fonte = 'Wikipedia em português: visitas por hora em todas as páginas (API pública da Wikimedia), horário de Brasília'; ok('atencao', Object.keys(AT.horas).length);
  } catch (e) { erro('atencao', e); }
}
const C = R.curva(AT.horas); const hoje = R.brDia(AGORA);
const slots = R.horarios(C, hoje); const plano = R.agenda(slots, itens, AGORA, hoje);
fs.writeFileSync('atencao.json', JSON.stringify(AT));

const J = { atualizado: R.brIso(AGORA), fontes: FONTES,
  explica: 'Mais comentado agora no Brasil e no mundo. Etiquetas: 🚀 Subindo (apareceu há pouco ou está crescendo), 🔥 No pico (3 fontes ou mais, no topo), 🟢 Em alta (estável), 📉 Caindo (perdendo posição). Os números são os que cada fonte publica. Só assunto com 2 veículos diferentes pode virar post.',
  itens: itens.map(({ chaves, termo, ...i }) => i),
  agenda: { dia: hoje, slots: plano, curva: C, explica: C.dias ? 'Horários de maior atenção do público brasileiro na internet (Wikipedia em português, medido em ' + C.dias + ' dias completos, de ' + C.de + ' a ' + C.ate + '). Não são os horários dos seus seguidores: esses só as Estatísticas do Instagram mostram.' : 'Ainda sem dias completos medidos.' } };
fs.writeFileSync('emalta.json', JSON.stringify(J));
console.log('EM ALTA: itens', itens.length, '| subindo', itens.filter((i) => i.etiqueta === 'subindo').length, '| no pico', itens.filter((i) => i.etiqueta === 'pico').length, '| caindo', itens.filter((i) => i.etiqueta === 'caindo').length, '| publicáveis (2+ veículos)', itens.filter((i) => i.publicavel).length);
console.log('fontes:', Object.entries(FONTES).map(([k, v]) => k + (v.ok ? ' ok ' + v.itens : ' ERRO ' + v.erro)).join(' | '));
console.log('agenda', hoje, '(curva de ' + C.dias + ' dias):', plano.map((s) => s.hora + (s.passou ? ' (passou)' : ' ' + (s.item ? s.item.nome : '-'))).join(' | '));

// ===== notificações: canal Fenix Em Alta =====
const MUS = process.env.NTFY_TOPIC_MUSICA || '', ALTA = R.topicoAlta(MUS);
const CMD = process.env.NTFY_TOPIC_COMANDO || '', ASS = process.env.NTFY_ASSINATURA || '';
const SRV = (process.env.NTFY_SERVIDOR || 'https://ntfy.sh').replace(/\/$/, '');
const salvar = () => fs.writeFileSync(ESTF, JSON.stringify(E));
if (!ALTA || process.argv.includes('--sem-envio')) { console.log(ALTA ? 'sem envio (--sem-envio)' : 'sem NTFY_TOPIC_MUSICA, sem envio'); salvar(); process.exit(0); }
const espera = (ms) => new Promise((z) => setTimeout(z, ms)); const FALHAS = []; let enviados = 0;
const post = async (topic, m) => {   // sem perder aviso: 5 tentativas, respeita Retry-After; o que não sai volta na próxima rodada
  const corpo = JSON.stringify({ topic, icon: ICONE, ...m });
  for (let t = 0; t < 5; t++) {
    try { const r = await fetch(SRV + '/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, signal: AbortSignal.timeout(20000) });
      if (r.ok) { enviados++; await espera(+(process.env.NTFY_PAUSA_MS || 1500)); return true; }
      if (r.status !== 429 && r.status < 500) { FALHAS.push(r.status + ' ' + m.title); return false; }
      const ra = +(r.headers.get('retry-after') || 0); await espera(ra ? Math.min(ra, 60) * 1000 : (+(process.env.NTFY_RETRY_MS || 5000)) * (t + 1));
    } catch { await espera((+(process.env.NTFY_RETRY_MS || 5000)) * (t + 1)); }
  }
  FALHAS.push('5 tentativas: ' + m.title); return false;
};
// aviso único para assinar (vai no canal Música, que ela já assina)
if (!E.avisoAlta) { const a = R.avisoAlta(SRV, MUS); if (a && await post(MUS, a)) E.avisoAlta = R.brIso(AGORA); }
const N = E.envios && E.envios.dia === hoje ? E.envios : (E.envios = { dia: hoje, resumos: {}, instantaneos: 0, planos: {} });
const min = R.brMin(AGORA); const prox = R.proximoHorario(slots, AGORA, hoje);
const DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']; const diaTxt = DS[new Date(hoje + 'T12:00:00-03:00').getUTCDay()] + ' ' + hoje.slice(8, 10) + '/' + hoje.slice(5, 7);
const linhaItem = (i) => '• ' + i.rotulo.split(' ')[0] + ' ' + i.nome + (i.motivo.length ? ': ' + i.motivo.slice(0, 2).join(', ') : '') + ' (' + i.numerosTexto + ')' + (i.publicavel ? ' ✅ pode postar' : ' 🔎 em apuração');
const agendaTexto = (pl) => pl.filter((s) => !s.passou).map((s) => s.hora + ' · ' + (s.item ? R.ROTULO[s.item.etiqueta].split(' ')[0] + ' ' + s.item.nome + (s.item.publicavel ? ' ✅' : ' 🔎') : 'livre')).join('\n');
const partes = (linhas, lim = 3300) => { const P = []; let a = [], t = 0; for (const l of linhas) { const b = Buffer.byteLength(l) + 1; if (a.length && t + b > lim) { P.push(a); a = []; t = 0; } a.push(l); t += b; } if (a.length) P.push(a); return P; };   // em bytes: o ntfy aceita até 4.096 bytes de texto
const botoesAgenda = (pl) => { const b = []; for (const s of pl.filter((x) => !x.passou && x.item && x.item.publicavel && R.deBR(hoje, x.hora) - AGORA >= 75 * 60e3)) { if (b.length >= 2 || !CMD || !ASS) break; const it = itens.find((i) => i.id === s.item.id);
  b.push({ action: 'http', label: '⏰ Agendar ' + s.hora, url: SRV + '/' + CMD, method: 'POST', body: R.corpoComando('agendar', it, { CMD, ASS, dia: hoje, hora: s.hora }), clear: false }); } return [...b, { action: 'view', label: 'Abrir Em Alta', url: PAGINA + '#agenda', clear: false }]; };
// resumos: 07:00 (com a Agenda de postagens), 11:30, 17:00 (com a agenda replanejada se mudou) e 20:00; janela de 90 min
const RESUMOS = ['07:00', '11:30', '17:00', '20:00'];
for (const r of RESUMOS) {
  const [h, m] = r.split(':').map(Number), ini = h * 60 + m; if (N.resumos[r] || min < ini || min > ini + 90) continue;
  if (!itens.length) { N.resumos[r] = 'vazio'; continue; }
  const comAgenda = r === '07:00' || (r === '17:00' && JSON.stringify(plano.filter((s) => !s.passou).map((s) => s.item && s.item.id)) !== JSON.stringify((N.planos.ultimo || []).filter((x) => x.h >= '17:00').map((x) => x.id)));
  const cab = comAgenda && plano.some((s) => !s.passou) ? ['🗓️ ' + (r === '07:00' ? 'AGENDA DE POSTAGENS DE HOJE' : 'AGENDA REPLANEJADA') + ' (' + diaTxt + ')', agendaTexto(plano), '⏰ = toque em "Agendar" e o agente produz o vídeo antes; na hora chega "Hora de postar".', 'Horários = picos de atenção do público brasileiro (Wikipedia, ' + C.dias + ' dias medidos), não dos seus seguidores.', ''] : [];
  // lista principal: o que está em 2+ fontes ou já pode virar post; o que só aparece numa fonte vai numa linha curta por fonte
  const fortes = itens.filter((i) => i.tipos.length >= 2 || i.publicavel), soUma = itens.filter((i) => !fortes.includes(i));
  const porFonte = {}; for (const i of soUma) (porFonte[R.TIPOS[i.tipos[0]]] = porFonte[R.TIPOS[i.tipos[0]]] || []).push(i.nome);
  const L = [...cab, ...fortes.map(linhaItem), ...(soUma.length ? ['', 'Só em 1 fonte (ainda sem confirmação):', ...Object.entries(porFonte).map(([f, l]) => '• ' + f + ': ' + l.join(', '))] : [])]; const P = partes(L); let tudo = true;
  for (const [n, p] of P.entries()) { const ok1 = await post(ALTA, { title: (r === '07:00' ? '☀️ Bom dia · ' : '🚀 ') + 'Em Alta ' + r.replace(':', 'h') + ' · ' + itens.length + (itens.length > 1 ? ' assuntos' : ' assunto') + (P.length > 1 ? ' (' + (n + 1) + '/' + P.length + ')' : ''), message: p.join('\n'), click: PAGINA, priority: r === '07:00' ? 4 : 3, tags: ['rocket'], actions: n === 0 ? botoesAgenda(plano) : [{ action: 'view', label: 'Abrir Em Alta', url: PAGINA, clear: false }] }); if (!ok1) tudo = false; }
  if (tudo) { N.resumos[r] = R.brIso(AGORA); if (comAgenda) N.planos.ultimo = plano.filter((s) => !s.passou).map((s) => ({ h: s.hora, id: s.item && s.item.id })); }
}
// replanejamento das 13h: só chega se a agenda das próximas horas mudou (algo novo estourou)
if (!N.planos.r13 && min >= 13 * 60 && min <= 14 * 60 + 40 && N.resumos['07:00']) {
  const agoraIds = plano.filter((s) => !s.passou).map((s) => ({ h: s.hora, id: s.item && s.item.id })); const antes = (N.planos.ultimo || []).filter((x) => x.h >= R.hm(min));
  if (agoraIds.length && JSON.stringify(agoraIds.map((x) => x.id)) !== JSON.stringify(antes.map((x) => x.id))) {
    if (await post(ALTA, { title: '🗓️ Agenda replanejada · ' + diaTxt, message: 'Algo novo subiu. Horários que ainda faltam hoje:\n' + agendaTexto(plano), click: PAGINA + '#agenda', priority: 3, tags: ['spiral_calendar'], actions: botoesAgenda(plano) })) { N.planos.r13 = R.brIso(AGORA); N.planos.ultimo = agoraIds; }
  } else N.planos.r13 = 'sem mudança';
}
// aviso na hora: só quando dispara forte (Subindo, 2+ fontes, visto pela 1ª vez há menos de 60 min), no máximo 6 por dia
E.avisados = (E.avisados || []).filter((x) => AGORA - x.t < 48 * 3600e3);
if (!seed) for (const i of itens) {
  if (N.instantaneos >= 6) break;
  const T = E.topicos[i.chave]; if (i.etiqueta !== 'subindo' || i.tipos.length < 2 || !T || T.seed || AGORA - T.primeiro > 60 * 60e3 || E.avisados.some((x) => x.id === i.id)) continue;
  const noite = R.brHora(AGORA) < 7;
  if (await post(ALTA, { title: '🚀 Subindo agora: ' + i.nome.slice(0, 110), message: (i.motivo.join(', ') || 'apareceu agora') + '\n' + i.numerosTexto + '\n' + (i.publicavel ? '✅ ' + i.veiculos.length + ' veículos: pode postar' + (prox ? ' (ou agende para ' + prox.hora + ', próximo horário forte)' : '') : '🔎 Em apuração: menos de 2 veículos, sem botão de post até a 2ª fonte'), click: i.link || PAGINA, priority: noite ? 2 : 4, tags: ['rocket'], actions: R.botoesItem(i, { SRV, CMD, ASS, slot: prox, dia: hoje, pagina: PAGINA }) })) { N.instantaneos++; E.avisados.push({ id: i.id, t: AGORA }); }
}
salvar();
console.log('PUSH Em Alta: enviados', enviados, '| resumos hoje', JSON.stringify(N.resumos), '| na hora hoje', N.instantaneos, FALHAS.length ? '| NÃO SAÍRAM (voltam na próxima rodada): ' + FALHAS.join(' / ') : '');
