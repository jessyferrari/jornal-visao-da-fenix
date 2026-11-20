// Regras puras da URGÊNCIA dos perfis do agente (20/11, Jessyca t320/t322). Testadas em scripts/teste-perfis.mjs.
// Ideia: o estudo de estilo pelo Instagram logado dela é lento (1 leitura a cada 20 min, 20 por dia). Para não perder uma notícia forte
// de um desses perfis, o robô do jornal confere a cada rodada (~5 min) as rotas PÚBLICAS de cada perfil (RSS do site, RSS do YouTube,
// Google Notícias), sem conta nenhuma. Regra da verdade: 1 fonte = em apuração; 2+ veículos diferentes = confirmado;
// "exclusivo" só como "<veículo> diz que é exclusivo"; nunca dizemos que a Olimpia Shakur foi a primeira.
// Bateria (t320): "Vale postar" e "Não deixe de postar" confirmados podem tocar SOM (prioridade 3, nunca 4 ou 5, que forçam vibração longa);
// forte em apuração chega silencioso (2); o resto vai só para a Mesa do agente (1 = canal <tópico>-mesa, que o celular não assina).
import { createHmac } from 'node:crypto';
import { botoesApurar } from './ntfy-acoes.mjs';
import { notaPotencial, ehSurf } from './potencial.mjs';
import { alegaExclusivo, primeiro, campoSelo, hhmm } from './exclusivo.mjs';
import { mesmo, canon, brIso, idNoticia } from './series-regras.mjs';

export const PAGINA = 'https://jessyferrari.github.io/jornal-visao-da-fenix/referencias.html#perfis-agente';
export const LIM = { porRodada: 3, celularDia: 12, porPerfilDia: 4, mesaDia: 20, googlePorRodada: 2 };
export const JANELA_AVISO_MS = 3 * 3600e3;   // só avisa o que saiu há até 3 h (urgência é agora)

const ent = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const limpa = (s) => ent(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); return m ? limpa(m[1]) : ''; };
const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** 20/11: o feed do Hugo Gloss repete a manchete inteira 2 vezes no <title>; fica 1 vez só */
import { semRepetir, tituloDoItem } from './titulo.mjs';
export { semRepetir };
/** mesmo assunto que o jornal já avisou? (link de qualquer veículo do grupo ou manchete equivalente nas últimas 24 h) */
export function jaAvisadoAssunto(i, links, titulos, agora) {
  if ([i.key, ...(i.grp || []).map((g) => g.key || canon(g.link))].some((k) => k && links.has(k))) return true;
  const a = { src: '__perfil', title: i.title, ts: i.ts || agora };
  return titulos.some((x) => agora - x.t < 24 * 3600e3 && mesmo(a, { src: '__jornal', title: x.titulo, ts: x.t }));
}
/** RSS 2.0 ou Atom (YouTube). Devolve { canal, itens: [{ src, title, link, key, ts, sum, rota }] } */
export function lerFeed(xml, perfil, rota) {
  const x = String(xml || '');
  const cab = (x.match(/<channel[\s\S]*?<item/i) || x.match(/<feed[\s\S]*?<entry/i) || [''])[0];
  const canal = tag((cab.match(/<author>[\s\S]*?<\/author>/i) || [''])[0], 'name') || tag(cab, 'title');
  const itens = [];
  for (const b of (x.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || []).slice(0, 60)) {
    let link = tag(b, 'link'); if (!/^https?:/.test(link)) { const m = b.match(/<link[^>]*href=["']([^"']+)/i); link = m ? ent(m[1]) : ''; }
    const title = tituloDoItem(tag(b, 'title'), b), ts = Date.parse(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated'));
    if (!/^https?:\/\//.test(link) || !title || (!ts && !rota.semData)) continue;   // sem horário real, não entra (rota.semData: o site não publica a hora; vale a hora em que o robô viu)
    itens.push({ src: perfil.nome, title, link, key: canon(link), ts: ts || 0, semHora: !ts || undefined, sum: (tag(b, 'description') || tag(b, 'media:description')).slice(0, 300), rota: rota.tipo, lang: perfil.idioma || '' });
  }
  return { canal, itens };
}
/** o feed declarou o perfil esperado? (URL trocada responde com outro nome: a rota falha e nada é avisado) */
export const confere = (esperado, canal) => !esperado || sem(canal).includes(sem(esperado));

/** Google Notícias (RSS de busca): título "Manchete - Veículo"; veículo em <source>. Bloqueio (HTML/Sorry) => null */
export function lerGoogle(xml) {
  const x = String(xml || ''); if (!/<rss[\s>]/i.test(x.slice(0, 600))) return null;
  const out = [];
  for (const b of (x.match(/<item>[\s\S]*?<\/item>/gi) || []).slice(0, 60)) {
    const src = tag(b, 'source'), t0 = tag(b, 'title'), ts = Date.parse(tag(b, 'pubDate')), link = tag(b, 'link');
    const title = src && t0.endsWith(' - ' + src) ? t0.slice(0, -(src.length + 3)).trim() : t0.replace(/\s+-\s+[^-]{2,60}$/, '').trim();
    if (src && title && ts && /^https?:\/\//.test(link)) out.push({ src, title, link, key: canon(link), ts, sum: '', rota: 'Google Notícias' });
  }
  return out;
}
export const urlGoogle = (q, janela = '1d') => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:' + janela) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
// menção ao perfil no Google Notícias: o nome precisa estar na manchete, e grade de jogos/"onde assistir" não é notícia
const RUIDO = /onde assistir|onde vai passar|programa[cç][aã]o|jogos de hoje|agenda (esportiva|de jogos)|guia de jogos|hor[aá]rio e escala[cç]/i;
export const mencaoValida = (i, nome) => sem(i.title).includes(sem(nome)) && !RUIDO.test(i.title);

const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma para por com que se ao à após diz sobre mais como foi ser the of to in and for on is at by with from video vídeo assista veja confira'.split(' '));
/** palavras para buscar a confirmação no Google Notícias: nomes próprios primeiro */
export function palavras(titulo) {
  const t = String(titulo || '').replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, ' ');
  const nomes = t.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'+-]{2,}/g) || [], resto = t.match(/[\wÀ-ÿ'+-]{5,}/g) || [];
  const out = []; for (const w of [...nomes, ...resto]) { const k = w.toLowerCase(); if (!STOP.has(k) && !out.some((x) => x.toLowerCase() === k)) out.push(w); if (out.length >= 5) break; }
  return out.join(' ');
}

/** mesmo fato em outros veículos (pool = outras seções do jornal + Google Notícias); conta veículos distintos (nome normalizado) */
export function confirmar(item, pool) {
  const grp = []; const nomes = new Set([sem(item.src)]);
  for (const o of pool) {
    if (!o || !o.title || !o.ts || nomes.has(sem(o.src))) continue;
    if (canon(o.link) === item.key) continue;
    if (mesmo({ src: item.src, title: item.title, ts: item.ts }, { src: o.src, title: o.title, ts: o.ts })) { grp.push(o); nomes.add(sem(o.src)); }
  }
  return { grp, n: nomes.size };
}

// urgência de verdade com 1 fonte só (aviso silencioso): morte, prisão, acidente, tragédia, fim, aposentadoria, título, "urgente"
const palavra = (alt) => new RegExp('(?<![\\p{L}\\p{N}])(?:' + alt + ')(?![\\p{L}\\p{N}])', 'iu');
export const URGENTE = palavra('urgente|[uú]ltima hora|breaking|morre|morreu|morte de|falece|faleceu|falecimento|luto|preso|presa|pris[aã]o|detid[oa]|acidente|trag[eé]dia|atentado|explos[aã]o|terremoto|inc[eê]ndio|internad[oa]|hospitalizad[oa]|se aposenta|aposentadoria|anuncia fim|anuncia sa[ií]da|deixa a|demitid[oa]|ren[uú]ncia|renuncia|separa[cç][aã]o|div[oó]rcio|gr[aá]vida|campe[aã]o|campe[aã]|t[ií]tulo mundial|recorde hist[oó]rico|dies|died|death|arrested|crash|injured|hospital|retire|retires|retirement|champion|wins the title|sacked|fired|quits');
/** classifica: { pot, forte, confirmado, prioridade, motivoNaoAviso } */
export function classificar(i, { agora }) {
  const veic = [i.src, ...(i.grp || []).map((g) => g.src)];
  const pot = notaPotencial({ titulo: i.title, resumo: i.sum, veiculos: veic, ts: Math.min(i.ts, ...(i.grp || []).map((g) => g.ts).filter(Boolean)), agora });
  const forte = URGENTE.test(i.title) || (i.orig && URGENTE.test(i.orig));
  const confirmado = (i.n || 1) >= 2;
  // bateria: só confirmado "Vale postar"/"Não deixe" toca som (3); forte em apuração chega silencioso (2); o resto só na Mesa (1)
  // 🏄 t339: surf em apuração (1 fonte) vai para a Mesa como cartão em apuração (1, silencioso); confirmado já é Vale postar pelo piso de surf
  const surf = !!(ehSurf(i.title, i.sum) || (i.orig && ehSurf(i.orig)));
  const prioridade = confirmado && !pot.provisoria && (pot.faixa === 'vale' || pot.faixa === 'nao-deixe') ? 3 : !confirmado && forte ? 2 : confirmado ? 1 : surf ? 1 : 0;
  return { pot, forte, confirmado, prioridade, surf };
}

/** madrugada (0h a 7h de Brasília): Vale postar/Não deixe confirmado chega no celular 24 h (t330); o resto vai só para a Mesa */
export const madrugada = (agora) => +brIso(agora).slice(11, 13) < 7;

/** título e texto do aviso: sempre "<perfil> publicou"; exclusivo só como "<veículo> diz que é exclusivo"; nunca "Olimpia primeiro" */
export function montarAviso(i, c, { agora }) {
  const alegado = alegaExclusivo(i.title, i.orig);
  const faixa = { 'nao-deixe': 'Não deixe de postar', vale: 'Vale postar', opcional: 'Opcional' }[c.pot.faixa];
  const pre = c.confirmado ? (c.prioridade === 3 ? (c.pot.faixa === 'nao-deixe' ? '🔥 ' : '👍 ') + c.pot.nota + '% · ' : '') : '🔎 ';
  const title = (pre + i.src + ' publicou: ' + i.title).slice(0, 180);
  const L = [];
  L.push(c.confirmado ? '📊 ' + faixa + ' · ' + c.pot.motivo : '🔎 Em apuração: só ' + i.src + ' até agora (1 fonte). Sem botão de post até um 2º veículo publicar.');
  if (alegado) L.push('⭐ ' + i.src + ' diz que é exclusivo');
  L.push(i.src + ' · ' + (i.rota === 'YouTube' ? 'YouTube' : i.rota === 'Google Notícias' ? 'Google Notícias' : 'site') + ' · ' + hhmm(i.ts) + (i.orig ? ' · traduzido do inglês' : ''));
  if (c.confirmado) { const p = primeiro([i, ...i.grp]); L.push('✅ ' + i.n + ' veículos: ' + [i.src, ...i.grp.map((g) => g.src)].slice(0, 5).join(', ')); if (p) L.push(p.veiculo + ' publicou primeiro às ' + p.hora + ' (horário de cada site)'); }
  L.push('⚡ Urgência dos perfis do agente (rotas públicas, sem a sua conta)');
  return { title, message: L.join('\n'), alegado };
}

/** botões (máx. 3): confirmado = Sim, publicar / Ver notícia / Não (assinado, como o resto do jornal); 1 fonte = Apurar no agente */
export function botoes(i, c, { CMD, ASS, SRV = 'https://ntfy.sh', alegado }) {
  const ver = { action: 'view', label: 'Ver notícia', url: i.link, clear: false };
  const texto = [i.title, 'Veículo: ' + i.src + ' · ' + brIso(i.ts).replace('T', ' ') + ' (Brasília)', i.sum ? String(i.sum).slice(0, 280) : ''].filter(Boolean).join('\n').slice(0, 500);
  if (!c.confirmado) return botoesApurar({ link: i.link, titulo: i.title, texto, pot: c.pot, origem: 'perfis', id: idNoticia(i.link), CMD, ASS, SRV, pagina: PAGINA });
  if (!CMD || !ASS) return [ver, { action: 'view', label: 'Abrir Perfis', url: PAGINA, clear: false }];
  const id = idNoticia(i.link), sig = createHmac('sha256', ASS).update(id).digest('hex').slice(0, 32), fontes = i.n;
  const fsig = createHmac('sha256', ASS).update(id + '|fontes=' + fontes).digest('hex').slice(0, 32);
  const base = { id, sig, titulo: String(i.title).slice(0, 160) }, links = i.grp.map((g) => g.link).filter((l) => l && l !== i.link).slice(0, 2).join('\n');
  return [
    { action: 'http', label: '✅ Sim, publicar', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'publicar', ...base, fontes, fsig, nota: c.pot.nota, faixa: c.pot.faixa, link: i.link, links, texto, origem: 'perfis', ...campoSelo(ASS, id, { p: primeiro([i, ...i.grp]), fontes, alegado }) }), clear: true },
    ver,
    { action: 'http', label: 'Não', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'recusar', ...base }), clear: true },
  ];
}

/** contadores do dia (Brasília) */
export function contadores(E, agora) {
  const dia = brIso(agora).slice(0, 10);
  if (!E.envios || E.envios.dia !== dia) E.envios = { dia, celular: 0, mesa: 0, porPerfil: {} };
  return E.envios;
}
/** decide o canal de um item já classificado: 'celular' (prioridade 2/3), 'mesa' (1) ou null (nada) */
export function destino(i, c, D, { agora, rodada }) {
  if (!c.prioridade) return null;
  const quer = madrugada(agora) && c.prioridade === 2 ? 1 : c.prioridade;   // 20/11 (t330): Vale postar/Não deixe confirmado (3) chega 24 h; só o em apuração (2) vai para a Mesa de madrugada
  if (quer > 1 && rodada < LIM.porRodada && D.celular < LIM.celularDia && (D.porPerfil[i.src] || 0) < LIM.porPerfilDia) return { canal: 'celular', prioridade: quer };
  if (D.mesa < LIM.mesaDia) return { canal: 'mesa', prioridade: 1 };   // passou do teto do celular: vai só para a Mesa
  return null;
}
