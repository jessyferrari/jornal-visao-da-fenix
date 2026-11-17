// 🎬 Séries e Filmes (streaming) do Jornal Visão da Fênix: notícias de séries, filmes, cinema e streaming de 18 fontes
// públicas (RSS e o sitemap público do Omelete), traduzidas quando em inglês, mesmo fato agrupado, regra das 2 fontes,
// selo "⭐ Possível exclusivo" só quando o PRÓPRIO site diz que é exclusivo (e só 1 dos veículos monitorados publicou),
// contagem do Google Notícias só para esses itens, e o aviso "Confirmado por N veículos, X saiu primeiro às HH:MM".
// Gera series.json (página series.html, busca e painel) e manda o canal ntfy "Fenix Séries e Filmes" (<canal Música>-series).
// Zero IA, zero login, zero API paga. Uso: node scripts/series.mjs [--agora 2026-11-17T09:05-03:00] [--sem-envio] [--sem-google]
import { toqueNoNtfy } from './ntfy-acoes.mjs';
import fs from 'node:fs';
import * as S from './series-regras.mjs';
import { rastrear, googleParaMarcados, textoConfirmado, hhmm } from './exclusivo.mjs';
import { subindo, podeSubindo, marcarSubindo, textoSubindo } from './subindo.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
import { notaPotencial, prioridadeNota, tituloComNota } from './potencial.mjs';
const AGORA = arg('--agora') ? Date.parse(arg('--agora')) : Date.now();
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)' };
const PAGINA = 'https://jessyferrari.github.io/jornal-visao-da-fenix/series.html';
const ICONE = 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png';
const lerJ = (a, p) => { try { return JSON.parse(fs.readFileSync(a, 'utf8')); } catch { return p; } };
const FONTES_URL = process.env.SERIES_FONTES_LOCAIS ? JSON.parse(process.env.SERIES_FONTES_LOCAIS) : null;   // só nos testes: { nome: arquivo }

// ----- 1) leitura das fontes (6 ao mesmo tempo)
const STATUS = []; let lidos = [];
async function baixa(f) {
  if (FONTES_URL) { if (!FONTES_URL[f[0]]) throw new Error('sem arquivo de teste'); return fs.readFileSync(FONTES_URL[f[0]], 'utf8'); }
  const r = await fetch(f[1], { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer()); const cs = (/encoding=["']([^"']+)/i.exec(buf.subarray(0, 300).toString('latin1')) || (r.headers.get('content-type') || '').match(/charset=([^;]+)/i) || [])[1] || 'utf-8';   // Folha vem em ISO-8859-1
  try { return new TextDecoder(cs.trim().toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
}
for (let x = 0; x < S.FONTES.length; x += 6) await Promise.all(S.FONTES.slice(x, x + 6).map(async (f) => {
  try { const its = S.lerFeed(await baixa(f), f); lidos.push(...its); STATUS.push({ nome: f[0], ok: its.length > 0, itens: its.length, erro: its.length ? undefined : 'sem itens' }); }
  catch (e) { STATUS.push({ nome: f[0], ok: false, itens: 0, erro: String(e.message || e).slice(0, 80) }); }
}));
const N = STATUS.filter((s) => s.ok).length;   // "só 1 de N veículos monitorados": N = sites lidos com sucesso nesta rodada
const tudo48 = lidos.filter((i) => AGORA - i.ts < 48 * 3600e3 && i.ts <= AGORA + 5 * 60e3);
const porLink = new Map(); for (const i of tudo48) { const o = porLink.get(i.key); if (!o || i.ts < o.ts) porLink.set(i.key, i); }
let itens = [...porLink.values()].filter(S.ehSeriesFilmes);
console.log('SÉRIES: fontes ok', N, 'de', S.FONTES.length, '| lidos 48h', tudo48.length, '| de séries/filmes', itens.length, '| falharam:', STATUS.filter((s) => !s.ok).map((s) => s.nome + ' (' + s.erro + ')').join('; ') || 'nenhuma');

// ----- 2) tradução (inglês -> português), com cache: gtx do Google e depois MyMemory, gratuitos
const TF = 'series-traducoes.json'; const cache = lerJ(TF, {}); let okT = 0, falhaT = 0;
async function gtx(q) { const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('gtx ' + r.status); const j = await r.json(); return j[0].map((x) => x[0]).join(''); }
async function mym(q) { const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=en|pt-BR', { signal: AbortSignal.timeout(12000) }); const j = await r.json(); if (j.responseStatus != 200 || j.quotaFinished) throw new Error('mymemory'); return String(j.responseData.translatedText || ''); }
async function traduz(q) { if (cache[q]) return cache[q]; if (process.argv.includes('--sem-traducao')) return ''; for (const f of [gtx, mym]) { try { const o = (await f(q)).trim(); if (o && o.toLowerCase() !== q.toLowerCase() && !/MYMEMORY WARNING|QUERY LENGTH/i.test(o)) { cache[q] = o; return o; } } catch {} } return ''; }
const ing = itens.filter((i) => i.lang).sort((a, b) => b.ts - a.ts).slice(0, 70);
for (let x = 0; x < ing.length; x += 4) await Promise.all(ing.slice(x, x + 4).map(async (i) => { const t = await traduz(i.title); if (t) { i.orig = i.title; i.title = t; okT++; } else falhaT++; if (i.sum) { const s = await traduz(i.sum); i.osum = i.sum; i.sum = s || ''; } }));
itens = itens.filter((i) => !i.lang || i.orig);   // inglês sem tradução não entra (ela lê em português)
const usadas = new Set(ing.flatMap((i) => [i.orig || i.title, i.osum || ''])); fs.writeFileSync(TF, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([k]) => usadas.has(k)))));
console.log('tradução ok', okT, 'falhou', falhaT);

// ----- 3) mesmo fato, regra das 2 fontes, exclusivos e Google Notícias
const grupos = S.agrupar(itens).sort((a, b) => b.ts - a.ts);
const ESTF = 'series-estado.json', seed = !fs.existsSync(ESTF); const E = lerJ(ESTF, {}); E.vistos = E.vistos || {};
const { novos: novosExcl, confirmados } = rastrear(E, grupos, { agora: AGORA });
const marcadosAgora = grupos.filter((g) => g.n === 1 && E.excl[g.key] && !E.excl[g.key].confirmado).map((g) => g.key);
const G = process.argv.includes('--sem-google') ? { feitas: 0, desligado: true } : await googleParaMarcados(E, marcadosAgora, { agora: AGORA, max: 2 });
const googleDe = (g) => (E.excl[g.key] && E.excl[g.key].google) || null;
const V = new Map(grupos.map((g) => [g, S.vista(g, { N, agora: AGORA, google: googleDe(g) })]));
const vis = (l) => l.map((g) => V.get(g));
const confirmadosL = grupos.filter((g) => g.n >= 2).sort((a, b) => (b.n - a.n) || (b.ts - a.ts));
const J = { atualizado: S.brIso(AGORA), monitorados: N, fontes: STATUS,
  explica: 'Séries, filmes, cinema e streaming de ' + S.FONTES.length + ' sites públicos (' + N + ' lidos nesta rodada). ✅ = 2 ou mais veículos deram o mesmo fato (pode virar post). 🔎 = só 1 fonte até agora (em apuração, sem post). ⭐ Possível exclusivo = o próprio site diz que é exclusivo e, até a hora indicada, só ele publicou entre os veículos monitorados; isso é a palavra do site, não uma prova. Contagem de posts do Instagram e do TikTok não existe de forma gratuita e legítima, por isso não aparece.',
  exclusivos: vis(grupos.filter((g) => V.get(g).selo)).slice(0, 20),
  confirmadosExclusivos: vis(grupos.filter((g) => V.get(g).exclusivoConfirmado)).slice(0, 10),
  destaques: vis(confirmadosL).slice(0, 30),
  brasil: vis(grupos.filter((g) => !g.lang)).slice(0, 50),
  mundo: vis(grupos.filter((g) => g.lang)).slice(0, 30),
  google: G };
fs.writeFileSync('series.json', JSON.stringify(J));
console.log('SÉRIES: fatos', grupos.length, '| confirmados (2+)', confirmadosL.length, '| possíveis exclusivos', J.exclusivos.length, '| confirmados depois de exclusivo', confirmados.length, '| Google', JSON.stringify(G));

// ----- 4) notificações: canal Fenix Séries e Filmes, sem perder aviso (o que não sai volta na próxima rodada)
const MUS = process.env.NTFY_TOPIC_MUSICA || '', SER = S.topicoSeries(MUS);
const CMD = process.env.NTFY_TOPIC_COMANDO || '', ASS = process.env.NTFY_ASSINATURA || '';
const SRV = (process.env.NTFY_SERVIDOR || 'https://ntfy.sh').replace(/\/$/, '');
const salvar = () => fs.writeFileSync(ESTF, JSON.stringify(E));
const chaves = (g) => [g.key, ...g.grp.map((x) => x.key)];
const visto = (g) => { const v = chaves(g).map((k) => E.vistos[k]).filter((x) => x != null); if (!v.length) return false; return g.n >= 2 ? v.some((n) => n >= 2) : true; };   // 1 fonte vista e depois confirmada = novo (vai com Sim, publicar)
const marcar = (g) => { for (const k of chaves(g)) E.vistos[k] = Math.max(E.vistos[k] || 0, g.n); };
for (const [k, t] of Object.entries(E.vistos)) if (typeof t !== 'number') delete E.vistos[k];
const limpar = () => { const vivos = new Set(lidos.map((i) => i.key)); const l = Object.entries(E.vistos); if (l.length > 4000) E.vistos = Object.fromEntries(l.filter(([k]) => vivos.has(k)).slice(-4000)); };
if (seed) { for (const g of grupos) marcar(g); for (const c of confirmados) c.t.confirmado = S.brIso(AGORA); for (const i of novosExcl) E.excl[i.key].avisado = 'semente'; for (const x of subindo(grupos, E, { agora: AGORA })) for (const k of x.chaves) E.subindo[k] = 'semente-' + S.brIso(AGORA); limpar(); salvar(); console.log('primeira rodada: estado criado, sem avisos antigos (só o convite para assinar)'); }
if (!SER || process.argv.includes('--sem-envio')) { console.log(SER ? 'sem envio (--sem-envio)' : 'sem NTFY_TOPIC_MUSICA, sem envio'); salvar(); process.exit(0); }
const espera = (ms) => new Promise((z) => setTimeout(z, ms)); const FALHAS = []; let enviados = 0;
const post = async (topic, m) => {
  const corpo = JSON.stringify(toqueNoNtfy({ topic, icon: ICONE, ...m }));   // 17/11: aviso de uma notícia abre o ntfy com os botões
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
if (!E.avisoSeries && lerJ('esportes-estado.json', {}).avisoEsportes) E.avisoSeries = 'no convite combinado com Esportes';   // o convite de Esportes já leva o botão de Séries: não manda outro
if (!E.avisoSeries) { const a = S.avisoSeries(SRV, MUS); if (a && await post(MUS, a)) E.avisoSeries = S.brIso(AGORA); }
if (seed) { salvar(); console.log('PUSH Séries: primeira rodada, aviso de assinatura', E.avisoSeries || 'não saiu', FALHAS.join(' / ')); process.exit(0); }
const hoje = S.brIso(AGORA).slice(0, 10), minBR = +S.brIso(AGORA).slice(11, 13) * 60 + +S.brIso(AGORA).slice(14, 16);
const D = E.envios && E.envios.dia === hoje ? E.envios : (E.envios = { dia: hoje, instantaneos: 0, exclusivos: 0, resumos: {} });
const LIM = { instPorRodada: 3, instDia: 10, exclDia: 4, confPorRodada: 3 };   // cabe na cota grátis do ntfy (250/dia) junto com os outros canais
const madrugada = minBR < 7 * 60;
// 4a) confirmação de um "possível exclusivo": agora com 2+ veículos, chega com Sim, publicar
let nConf = 0;
for (const c of confirmados) {
  if (nConf >= LIM.confPorRodada) break; const g = c.i;
  const ok = await post(SER, { title: '✅ Confirmado: ' + g.title.slice(0, 150), message: textoConfirmado(c.p, g.n) + '\nO ' + c.t.veiculo + ' tinha dito que era exclusivo.\nTambém em: ' + g.grp.map((x) => x.src).slice(0, 4).join(', '), click: g.link, priority: 2, tags: ['white_check_mark', 'clapper'], actions: S.botoes(g, { CMD, ASS, SRV, pagina: PAGINA }) });
  if (ok) { c.t.confirmado = S.brIso(AGORA); marcar(g); nConf++; }
}
// 4a2) 📈 Subindo agora: o mesmo fato em 3+ veículos em até 30 min (até 6 por dia, nunca de madrugada); já tem 2+ fontes, então vai com Sim, publicar
for (const x of subindo(grupos, E, { agora: AGORA })) {
  if (!podeSubindo(E, { agora: AGORA })) break; const g = x.i;
  const ok = await post(SER, { title: '📈 Subindo agora: ' + g.title.slice(0, 150), message: textoSubindo(x), click: g.link, priority: 4, tags: ['chart_with_upwards_trend', 'clapper'], actions: S.botoes(g, { CMD, ASS, SRV, pagina: PAGINA }) });
  if (ok) { marcarSubindo(E, x, AGORA); marcar(g); }
}
// 4b) possível exclusivo (1 fonte, o site diz que é exclusivo): aviso na hora, sem botão de post (em apuração)
for (const g of grupos.filter((x) => x.n === 1 && E.excl[x.key] && !E.excl[x.key].avisado && !E.excl[x.key].confirmado && AGORA - x.ts < 12 * 3600e3)) {
  if (D.exclusivos >= LIM.exclDia || madrugada) break; const v = V.get(g); if (!v.selo) continue;
  const ok = await post(SER, { title: '⭐ ' + (v.selo.tipo === 'possivel' ? 'Possível exclusivo' : 'Diz que é exclusivo') + ': ' + g.title.slice(0, 140), message: v.selo.texto + '\n🔎 Em apuração: sem botão de post até um 2º veículo publicar. Quando isso acontecer, chega o aviso "Confirmado" com Sim, publicar.', click: g.link, priority: 2, tags: ['star', 'clapper'], actions: S.botoes(g, { CMD, ASS, SRV, pagina: PAGINA }) });
  if (ok) { E.excl[g.key].avisado = S.brIso(AGORA); D.exclusivos++; marcar(g); }
}
// 4c) confirmados novos (2+ veículos): na hora até 3 por rodada e 10 por dia; o resto vai no resumo
const novosConf = confirmadosL.filter((g) => !visto(g) && AGORA - g.ts < 24 * 3600e3);
for (const g of novosConf.slice(0, LIM.instPorRodada)) {
  if (D.instantaneos >= LIM.instDia || madrugada) break; const p = S.primeiro([g, ...g.grp]);
  const pg = notaPotencial({ titulo: g.title, resumo: g.sum, veiculos: [g.src, ...g.grp.map((x) => x.src)], ts: Math.min(g.ts, ...g.grp.map((x) => x.ts).filter(Boolean)), agora: AGORA });
  const ok = await post(SER, { title: tituloComNota(pg, '🎬 ' + g.title.slice(0, 140)), message: '📊 ' + pg.motivo + '\n' + g.src + ' · ' + hhmm(g.ts) + (g.orig ? ' · traduzido do inglês' : '') + '\n✅ ' + g.n + ' veículos: ' + [g.src, ...g.grp.map((x) => x.src)].slice(0, 5).join(', ') + '\n' + p.veiculo + ' saiu primeiro às ' + p.hora + (V.get(g).plataformas.length ? '\n📺 ' + V.get(g).plataformas.join(', ') : ''), click: g.link, priority: prioridadeNota(pg, 2), tags: ['clapper'], actions: S.botoes(g, { CMD, ASS, SRV, pagina: PAGINA }) });
  if (ok) { D.instantaneos++; marcar(g); }
}
// 4d) resumos 09:00, 14:00 e 20:00 (janela de 2 h): tudo o que ainda não foi avisado nas últimas 24 h, inteiro, em partes
for (const r of ['09:00', '14:00', '20:00']) {
  const [h, m] = r.split(':').map(Number), ini = h * 60 + m; if (D.resumos[r] || minBR < ini || minBR > ini + 120) continue;
  const pend = grupos.filter((g) => !visto(g) && AGORA - g.ts < 24 * 3600e3);
  if (!pend.length) { D.resumos[r] = 'vazio'; continue; }
  const conf = pend.filter((g) => g.n >= 2), um = pend.filter((g) => g.n < 2);
  const L = [...(conf.length ? ['✅ Confirmados (2+ veículos, podem virar post):', ...conf.map(S.linha)] : []), ...(um.length ? [(conf.length ? '' : '') + '🔎 Só 1 fonte até agora (em apuração):', ...um.map(S.linha)] : [])];
  const P = S.partes(L); let tudoOk = true;
  for (const [n, pt] of P.entries()) { const ok = await post(SER, { title: '🎬 Séries e Filmes ' + r.replace(':', 'h') + ' · ' + pend.length + (pend.length > 1 ? ' notícias' : ' notícia') + (P.length > 1 ? ' (' + (n + 1) + '/' + P.length + ')' : ''), message: pt.join('\n'), click: PAGINA, priority: 2, tags: ['clapper'], actions: [{ action: 'view', label: 'Abrir Séries e Filmes', url: PAGINA, clear: false }] }); if (!ok) tudoOk = false; }
  if (tudoOk) { for (const g of pend) marcar(g); D.resumos[r] = S.brIso(AGORA); }
}
// fora da janela de 24 h e nunca avisado: sai da fila em silêncio (notícia velha não vira aviso)
for (const g of grupos) if (!visto(g) && AGORA - g.ts >= 24 * 3600e3) marcar(g);
limpar(); salvar();
console.log('PUSH Séries: enviados', enviados, '| confirmações', nConf, '| exclusivos hoje', D.exclusivos, '| subindo hoje', (E.subindoDia || {}).n || 0, '| na hora hoje', D.instantaneos, '| resumos', JSON.stringify(D.resumos), '| aviso de assinatura', E.avisoSeries || 'ainda não', FALHAS.length ? '| NÃO SAÍRAM (voltam na próxima rodada): ' + FALHAS.join(' / ') : '');
