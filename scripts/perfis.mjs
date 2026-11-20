// ⚡ Urgência dos perfis do agente (20/11, Jessyca t320/t322): a cada rodada do robô (~5 min no GitHub Actions) confere as rotas
// PÚBLICAS de cada perfil que o agente estuda (Hugo Gloss, Forbes Brasil, Fórmula 1, CazéTV...): RSS oficial do site, RSS oficial do
// YouTube e o Google Notícias. Nenhuma conta, nenhum login, nenhuma API paga; Instagram/X/TikTok de terceiros ficam como "sem rota".
// O estudo de estilo pelo Instagram logado dela continua no agente (reel-olimpia), devagar (20 min entre leituras, 20 por dia).
// Gera perfis.json (página referencias.html#perfis) e avisa no canal geral do jornal (o mesmo que a Mesa do agente já lê):
//   confirmado (2+ veículos) e Vale postar/Não deixe: prioridade 3 (som, nunca 4/5); forte em apuração (1 fonte): 2 (silencioso);
//   o resto: 1 (só a Mesa, canal <tópico>-mesa). Madrugada (0h-7h): tudo só na Mesa. Tetos: 3 por rodada, 12 por dia no celular.
// Uso: node scripts/perfis.mjs [--agora 2026-11-20T12:00-03:00] [--sem-envio] [--sem-google] [--sem-traducao]
import fs from 'node:fs';
import { toqueNoNtfy } from './ntfy-acoes.mjs';
import { criarDisjuntor } from './disjuntor.mjs';
import * as P from './perfis-regras.mjs';
import { canon, brIso } from './series-regras.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const tem = (k) => process.argv.includes(k);
const AGORA = arg('--agora') ? Date.parse(arg('--agora')) : Date.now();
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7' };
const ICONE = 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png';
const lerJ = (a, p) => { try { return JSON.parse(fs.readFileSync(a, 'utf8')); } catch { return p; } };
const LISTA = JSON.parse(fs.readFileSync(new URL('./perfis-urgencia.json', import.meta.url), 'utf8')).perfis;
const LOCAIS = process.env.PERFIS_FONTES_LOCAIS ? JSON.parse(process.env.PERFIS_FONTES_LOCAIS) : null;   // só nos testes: { url: arquivo, google: arquivo }

async function baixa(url, ms = 15000) {
  if (LOCAIS) { const f = /news\.google\.com/.test(url) ? LOCAIS.google : LOCAIS[url]; if (!f) throw new Error('sem arquivo de teste'); return fs.readFileSync(f, 'utf8'); }
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!r.ok) { await r.body?.cancel().catch(() => {}); throw new Error('HTTP ' + r.status); }
  return await r.text();
}

// ----- estado
const EF = 'perfis-estado.json', seed = !fs.existsSync(EF); const E = lerJ(EF, {}); E.vistos = E.vistos || {};
const salvar = () => fs.writeFileSync(EF, JSON.stringify(E));
const googleLivre = () => !tem('--sem-google') && !((E.googlePausa || 0) > AGORA);
const pausarGoogle = () => { E.googlePausa = AGORA + 3600e3; };

// ----- 1) rotas públicas de cada perfil (todas ao mesmo tempo)
const STATUS = {}; const itens = []; const mencoes = [];
await Promise.all(LISTA.flatMap((p) => {
  STATUS[p.nome] = [];
  const tarefas = p.rotas.map(async (r) => {
    const st = { tipo: r.tipo, url: r.url, ok: false, n: 0 }; STATUS[p.nome].push(st);
    try { const { canal, itens: l } = P.lerFeed(await baixa(r.url), p, r);
      if (!P.confere(r.confere, canal)) throw new Error('o feed respondeu como "' + String(canal).slice(0, 40) + '", não como ' + r.confere);
      st.ok = l.length > 0; st.n = l.length; st.canal = canal; if (!l.length) st.erro = 'sem itens'; itens.push(...l.map((i) => ({ ...i, perfil: p.nome })));
    } catch (e) { st.erro = String(e.message || e).slice(0, 100); }
  });
  if (p.google) tarefas.push((async () => {
    const st = { tipo: 'Google Notícias', url: P.urlGoogle(p.google), ok: false, n: 0 }; STATUS[p.nome].push(st);
    if (!googleLivre()) { st.erro = tem('--sem-google') ? 'desligado nesta rodada' : 'pausado 1 h (o Google bloqueou a busca)'; return; }
    try { const l = P.lerGoogle(await baixa(st.url)); if (!l) { pausarGoogle(); throw new Error('o Google bloqueou a busca (pausa de 1 h)'); }
      const v = l.filter((i) => P.mencaoValida(i, p.google)); st.ok = true; st.n = v.length; mencoes.push(...v.map((i) => ({ ...i, perfil: p.nome })));
    } catch (e) { st.erro = String(e.message || e).slice(0, 100); }
  })());
  return tarefas;
}));
const okRotas = Object.values(STATUS).flat().filter((s) => s.ok).length, totRotas = Object.values(STATUS).flat().length;
console.log('PERFIS: rotas ok', okRotas, 'de', totRotas, '| itens', itens.length, '| menções Google', mencoes.length, '| falharam:', Object.entries(STATUS).flatMap(([n, l]) => l.filter((s) => !s.ok).map((s) => n + ' ' + s.tipo + ' (' + s.erro + ')')).join('; ') || 'nenhuma');

// ----- 2) tradução (inglês -> português) com cache, gratuita (gtx do Google e MyMemory), igual às outras seções
const TF = 'perfis-traducoes.json', cache = lerJ(TF, {});
async function gtx(q) { const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('gtx ' + r.status); const j = await r.json(); return j[0].map((x) => x[0]).join(''); }
async function mym(q) { const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=en|pt-BR', { signal: AbortSignal.timeout(12000) }); const j = await r.json(); if (j.responseStatus != 200 || j.quotaFinished) throw new Error('mymemory'); return String(j.responseData.translatedText || ''); }
async function traduz(q) { if (cache[q]) return cache[q]; if (tem('--sem-traducao')) return ''; for (const f of [gtx, mym]) { try { const o = (await f(q)).trim(); if (o && o.toLowerCase() !== q.toLowerCase() && !/MYMEMORY WARNING|QUERY LENGTH/i.test(o)) { cache[q] = o; return o; } } catch {} } return ''; }
E.vistoEm = E.vistoEm || {};   // site sem hora no RSS (Fórmula 1): vale a 1ª vez que o robô viu o link
for (const i of itens) if (i.semHora) { i.ts = E.vistoEm[i.key] || (E.vistoEm[i.key] = AGORA); }
{ const vivos = new Set(itens.map((i) => i.key)); for (const k of Object.keys(E.vistoEm)) if (!vivos.has(k) && AGORA - E.vistoEm[k] > 48 * 3600e3) delete E.vistoEm[k]; }
const recentes = itens.filter((i) => AGORA - i.ts < 24 * 3600e3 && i.ts <= AGORA + 5 * 60e3);
for (const i of recentes.filter((x) => x.lang)) { const t = await traduz(i.title); if (t) { i.orig = i.title; i.title = t; } }
fs.writeFileSync(TF, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([k]) => recentes.some((i) => i.orig === k)))));
const porLink = new Map(); for (const i of recentes) if (!porLink.has(i.key) || porLink.get(i.key).ts > i.ts) porLink.set(i.key, i);
const lista = [...porLink.values()].sort((a, b) => b.ts - a.ts);

// ----- 3) o que as outras seções do jornal já leram (dezenas de veículos): serve para confirmar o mesmo fato sem nenhuma busca nova
const pool = [];
const pegar = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(pegar);
  const src = o.src || o.veiculo, title = o.title || o.titulo, link = o.link, pub = o.pub || o.publicado;
  if (src && title && /^https?:/.test(link || '') && pub) { const ts = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(pub) ? pub : pub + ':00-03:00'); if (ts) pool.push({ src, title, link, ts }); }
  for (const v of Object.values(o)) if (v && typeof v === 'object') pegar(v); };
for (const f of ['edicao.json', 'series.json', 'esportes.json', 'games.json', 'musica.json', 'emalta.json']) pegar(lerJ(f, null));
const poolTotal = () => [...pool, ...itens, ...mencoes];
// já avisado por outra seção do jornal: não repete no celular
const jaAvisado = new Set([...(lerJ('notificadas.json', {}).vistos || []), ...Object.keys(lerJ('series-estado.json', {}).vistos || {}), ...Object.keys(lerJ('esportes-estado.json', {}).vistos || {}), ...Object.keys(lerJ('games-estado.json', {}).vistos || {})].map(canon));

// ----- 4) candidatos: novos (ou que ganharam veículos), dos últimos 3 h; menções do Google entram como notícia SOBRE o perfil
const candidatos = [...lista, ...mencoes.filter((m) => AGORA - m.ts < 24 * 3600e3)].filter((i) => AGORA - i.ts < P.JANELA_AVISO_MS);
let buscas = 0; const decid = [];
for (const i of candidatos) {
  let c0 = P.confirmar(i, poolTotal()); Object.assign(i, c0);
  if (E.vistos[i.key] != null && E.vistos[i.key] >= i.n) continue;
  let c = P.classificar(i, { agora: AGORA });
  if (!c.confirmado && c.forte && !seed && buscas < P.LIM.googlePorRodada && googleLivre()) {   // forte e só 1 fonte: procura a 2ª fonte no Google Notícias
    buscas++;
    try { const g = P.lerGoogle(await baixa(P.urlGoogle(P.palavras(i.title)))); if (!g) pausarGoogle(); else { pool.push(...g); Object.assign(i, P.confirmar(i, poolTotal())); c = P.classificar(i, { agora: AGORA }); } } catch {}
  }
  decid.push({ i, c });
}

// ----- 5) página: perfis.json
const vista = (i) => { const c = P.classificar(i, { agora: AGORA }); return { perfil: i.perfil, quem: i.src, titulo: i.title, original: i.orig || undefined, link: i.link, publicado: brIso(i.ts), rota: i.rota,
  fontes: i.n || 1, confirmado: (i.n || 1) >= 2, emApuracao: (i.n || 1) < 2 ? true : undefined, forte: c.forte || undefined,
  diz: P.montarAviso(i, c, { agora: AGORA }).alegado ? i.src + ' diz que é exclusivo' : undefined,
  pot: { nota: c.pot.nota, faixa: c.pot.faixa, provisoria: c.pot.provisoria, rotulo: c.pot.rotulo },
  tambemEm: (i.grp || []).slice(0, 4).map((g) => ({ veiculo: g.src, titulo: g.title, link: g.link, publicado: brIso(g.ts) })) }; };
for (const i of lista) if (i.n == null) Object.assign(i, P.confirmar(i, poolTotal()));
const J = { atualizado: brIso(AGORA), cadencia: 'a cada rodada do robô do jornal (cron de 5 min no GitHub Actions; na prática de 3 a 6 min, às vezes mais quando o GitHub atrasa)',
  regra: '1 fonte = em apuração; 2 ou mais veículos diferentes = confirmado. Exclusivo só como "<veículo> diz que é exclusivo". Rotas só públicas e gratuitas, sem conta.',
  perfis: LISTA.map((p) => ({ nome: p.nome, instagram: p.instagram, estudoInstagram: !!p.estudoInstagram, aguarda: p.aguarda || undefined, nicho: p.nicho, rotas: STATUS[p.nome], semRota: p.semRota })),
  itens: [...lista.slice(0, 60), ...mencoes.filter((m) => AGORA - m.ts < 24 * 3600e3).slice(0, 15)].sort((a, b) => b.ts - a.ts).map(vista) };
fs.writeFileSync('perfis.json', JSON.stringify(J));
console.log('PERFIS: página', J.itens.length, 'itens (24 h) | candidatos agora', decid.length, '| buscas Google', buscas);

// ----- 6) avisos
const marcar = (i) => { E.vistos[i.key] = Math.max(E.vistos[i.key] || 0, i.n || 1); };
const limpar = () => { const l = Object.entries(E.vistos); if (l.length > 3000) E.vistos = Object.fromEntries(l.slice(-3000)); };
if (seed) { for (const i of [...lista, ...mencoes]) { if (i.n == null) Object.assign(i, P.confirmar(i, poolTotal())); marcar(i); } limpar(); salvar(); console.log('PERFIS: primeira rodada, estado criado, sem avisos antigos'); process.exit(0); }
const TOP = process.env.NTFY_TOPIC || '', CMD = process.env.NTFY_TOPIC_COMANDO || '', ASS = process.env.NTFY_ASSINATURA || '';
const SRV = (process.env.NTFY_SERVIDOR || 'https://ntfy.sh').replace(/\/$/, '');
if (!TOP || tem('--sem-envio')) { for (const { i } of decid) marcar(i); limpar(); salvar(); console.log(TOP ? 'PERFIS: sem envio (--sem-envio)' : 'PERFIS: sem NTFY_TOPIC, sem envio'); process.exit(0); }
const espera = (ms) => new Promise((z) => setTimeout(z, ms)); const FALHAS = []; const DISJ = criarDisjuntor();
const post = async (m) => {
  if (DISJ.aberto()) { FALHAS.push('ntfy fora nesta rodada: ' + m.title); return false; }
  const corpo = JSON.stringify(toqueNoNtfy({ topic: TOP, icon: ICONE, ...m }));
  for (let t = 0; t < 5; t++) {
    try { const r = await fetch(SRV + '/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, signal: AbortSignal.timeout(20000) });
      if (r.ok) { await espera(+(process.env.NTFY_PAUSA_MS || 1500)); return true; }
      if (r.status !== 429 && r.status < 500) { FALHAS.push(r.status + ' ' + m.title); return false; }
      const ra = +(r.headers.get('retry-after') || 0); await DISJ.espera(ra ? Math.min(ra, 60) * 1000 : (+(process.env.NTFY_RETRY_MS || 5000)) * (t + 1)); if (DISJ.aberto()) break;
    } catch { await DISJ.espera((+(process.env.NTFY_RETRY_MS || 5000)) * (t + 1)); if (DISJ.aberto()) break; }
  }
  DISJ.abrir(); FALHAS.push('5 tentativas: ' + m.title); return false;
};
const D = P.contadores(E, AGORA); let rodada = 0; const saiu = [];
// confirmados primeiro, depois os de nota maior
decid.sort((a, b) => (b.c.prioridade - a.c.prioridade) || (b.c.pot.nota - a.c.pot.nota));
for (const { i, c } of decid) {
  if (jaAvisado.has(i.key) && (E.vistos[i.key] == null)) { marcar(i); continue; }   // outra seção do jornal já avisou este link
  const d = P.destino(i, c, D, { agora: AGORA, rodada });
  if (!d) { marcar(i); continue; }
  const av = P.montarAviso(i, c, { agora: AGORA });
  const ok = await post({ title: av.title, message: av.message, click: i.link, priority: d.prioridade, tags: ['zap'], actions: P.botoes(i, c, { CMD, ASS, SRV, alegado: av.alegado }) });
  if (!ok) continue;   // não saiu: volta na próxima rodada (não marca)
  marcar(i); saiu.push(d.canal + ' p' + d.prioridade + ' ' + i.src);
  if (d.canal === 'celular') { D.celular++; D.porPerfil[i.src] = (D.porPerfil[i.src] || 0) + 1; rodada++; } else D.mesa++;
}
limpar(); salvar();
console.log('PUSH Perfis:', saiu.length ? saiu.join(' | ') : 'nada novo forte', '| hoje: celular', D.celular, 'mesa', D.mesa, FALHAS.length ? '| NÃO SAÍRAM (voltam na próxima rodada): ' + FALHAS.join(' / ') : '');
