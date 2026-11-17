// "Possível exclusivo" e "Primeiro a noticiar" no jornal inteiro (17/11, pedido da Jessyca: só quando for verdade).
// O que o jornal afirma, e nada além disso:
//  1) "Veículo X diz que é exclusivo": o PRÓPRIO título traz Exclusivo:/(Exclusive)/com exclusividade. É a palavra do veículo, citada.
//  2) "só 1 de N veículos monitorados até HH:MM": contagem real dos sites que o robô leu nesta rodada.
//  3) "Google Notícias: M veículos com essas palavras (24 h)": contagem da busca pública, só para itens marcados, poucas por rodada.
//  4) Depois que um 2º veículo publica: "Confirmado por N veículos, X saiu primeiro às HH:MM" (pelo horário publicado por cada site).
// Nunca: "exclusivo" como fato absoluto, nem contagem de posts de Instagram/TikTok (não há forma gratuita e legítima).
import { createHmac } from 'node:crypto';

const BR = (ms) => new Date(ms - 3 * 3600e3);
export const hhmm = (ms) => BR(ms).toISOString().slice(11, 16);
const SEP = '\\s*[:|\\-\\u2013\\u2014]';
const PAL = '(?:exclusiv[oa]s?|exclusive|em primeira m[aã]o)';
const RX = [
  new RegExp('^\\s*[\\[(]\\s*' + PAL + '\\s*[\\])]', 'i'),                         // [Exclusivo] título  /  (EXCLUSIVE) título
  new RegExp('^\\s*' + PAL + SEP, 'i'),                                            // Exclusivo: título  /  EXCLUSIVO | título
  new RegExp('^\\s*(?:fotos?|v[ií]deos?|entrevista|imagens?|[áa]udios?)\\s+exclusiv[oa]s?' + SEP, 'i'),   // Fotos exclusivas: ...
  new RegExp('[\\[(]\\s*(?:exclusiv[oa]|exclusive)\\s*[\\])]\\s*$', 'i'),          // título (Exclusive)
  new RegExp('[\\-\\u2013\\u2014|]\\s*(?:exclusiv[oa]|exclusive)\\s*$', 'i'),      // título – Exclusive
  /\bcom exclusividade\b/i, /\bem primeira m[aã]o\b/i,                               // "revela com exclusividade", "em primeira mão"
];
// true só quando o título (ou o original, antes da tradução) traz a marca de exclusivo do próprio veículo
export const alegaExclusivo = (...titulos) => titulos.some((t) => typeof t === 'string' && t && RX.some((r) => r.test(t)));

// primeiro a publicar entre os itens do mesmo fato (pelo horário que cada site publicou)
export function primeiro(itens) {
  const l = (itens || []).filter((x) => x && x.ts && x.src && !x.republicada).sort((a, b) => a.ts - b.ts);
  return l.length ? { veiculo: l[0].src, hora: hhmm(l[0].ts), ts: l[0].ts, link: l[0].link || '' } : null;
}

// texto do selo de um item de 1 fonte que o próprio veículo chama de exclusivo
export function selo({ veiculo, N, agora, google }) {
  const base = veiculo + ' diz que é exclusivo · só 1 de ' + N + ' veículos monitorados publicou até ' + hhmm(agora);
  const g = google && google.veiculos != null ? ' · Google Notícias: ' + google.veiculos + (google.veiculos === 1 ? ' veículo' : ' veículos') + ' com essas palavras (24 h, ' + google.em + ')' : '';
  const contra = google && google.veiculos >= 3;   // a busca já mostra vários veículos: não chamamos de "possível exclusivo"
  return { tipo: contra ? 'alegado' : 'possivel', texto: (contra ? '📰 ' : '⭐ Possível exclusivo: ') + base + g };
}
export const textoConfirmado = (p, n) => '✅ Confirmado por ' + n + ' veículos · ' + p.veiculo + ' saiu primeiro às ' + p.hora + ' (horário publicado por cada site)';

// selo assinado que vai no corpo do "Sim, publicar" (o agente confere antes de liberar o card EXCLUSIVO / Primeiro a noticiar)
export const assinarSelo = (ass, id, s) => createHmac('sha256', String(ass)).update(String(id) + '|selo=' + s.tipo + '|' + s.veiculo + '|' + s.hora + '|' + s.fontes).digest('hex').slice(0, 32);
export function campoSelo(ass, id, { p, fontes, alegado }) {
  if (!ass || !p || !(fontes >= 2)) return {};
  const selo = { tipo: alegado ? 'exclusivo' : 'primeiro', veiculo: String(p.veiculo).slice(0, 60), hora: p.hora, fontes };
  return { selo, ssig: assinarSelo(ass, id, selo) };
}

// rastreia itens marcados (1 fonte + veículo diz exclusivo) até a confirmação por um 2º veículo
// itens: [{ key, src, title, orig, link, ts, n, grp: [{ key, src, link, ts }] }]
export function rastrear(estado, itens, { agora }) {
  const R = estado.excl = estado.excl || {}; const novos = [], confirmados = [];
  for (const i of itens) {
    const keys = [i.key, ...(i.grp || []).map((g) => g.key)];
    const k = keys.find((x) => R[x]); const t = k && R[k];
    if (t) { if (!t.confirmado && i.n >= 2) confirmados.push({ k, t, i, p: primeiro([i, ...(i.grp || [])]) }); continue; }
    if (i.n === 1 && agora - i.ts < 24 * 3600e3 && alegaExclusivo(i.title, i.orig)) {
      R[i.key] = { titulo: String(i.title).slice(0, 200), veiculo: i.src, link: i.link, ts: i.ts, desde: agora };
      novos.push(i);
    }
  }
  for (const [k, t] of Object.entries(R)) if (agora - (t.desde || t.ts) > 72 * 3600e3) delete R[k];
  return { novos, confirmados };
}

// palavras para a busca do Google Notícias: nomes próprios primeiro, sem a marca de exclusivo
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma para por com que se ao à após diz sobre mais como foi ser the of to in and for on is at by with from exclusivo exclusiva exclusive primeira mão fotos video vídeo'.split(' '));
export function palavrasBusca(titulo) {
  const t = String(titulo || '').replace(/^\s*[\[(]?[^:|\]\)]{0,30}exclusiv[^:|\]\)]*[\])]?\s*[:|\-\u2013\u2014]?\s*/i, '').replace(/[\[(]\s*exclusiv\w*\s*[\])]\s*$/i, '');
  const nomes = (t.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'+-]{2,}/g) || []).filter((w, n) => n > 0 || true);
  const resto = (t.match(/[\wÀ-ÿ'+-]{5,}/g) || []);
  const out = []; for (const w of [...nomes, ...resto]) { const k = w.toLowerCase(); if (!STOP.has(k) && !out.some((x) => x.toLowerCase() === k)) out.push(w); if (out.length >= 5) break; }
  return out.join(' ');
}
// contagem pública do Google Notícias (RSS de busca). Bloqueio ("Sorry"/429/HTML) => null, sem inventar número
export async function contarGoogle(q, { agora = Date.now(), baixar } = {}) {
  if (!q) return null;
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:1d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
  try {
    const x = baixar ? await baixar(url) : await (async () => { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0)' }, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })();
    if (!/<rss[\s>]/i.test(x.slice(0, 600))) return null;
    const itens = (x.match(/<item>/g) || []).length; const v = new Set((x.match(/<source[^>]*>([^<]+)<\/source>/g) || []).map((s) => s.replace(/<[^>]+>/g, '').trim()));
    return { itens, veiculos: v.size, em: hhmm(agora), q };
  } catch { return null; }
}
// no máximo `max` buscas por rodada; resultado guardado por 3 h; bloqueio pausa as buscas por 1 h
export async function googleParaMarcados(estado, chaves, { agora = Date.now(), max = 2, baixar } = {}) {
  const R = estado.excl || {}; let feitas = 0;
  if ((estado.googlePausa || 0) > agora) return { feitas, pausado: true };
  for (const k of chaves) {
    const t = R[k]; if (!t || t.confirmado || feitas >= max) continue;
    if (t.google && agora - (t.google.t || 0) < 3 * 3600e3) continue;
    feitas++; const g = await contarGoogle(palavrasBusca(t.titulo), { agora, baixar });
    if (!g) { estado.googlePausa = agora + 3600e3; delete t.google; return { feitas, bloqueado: true }; }
    t.google = { ...g, t: agora };
  }
  return { feitas };
}
