// 📈 "Subindo agora" (17/11): o mesmo fato chegou em 3 ou mais veículos diferentes em até 30 minutos.
// É o sinal de assunto ganhando força: hora de postar rápido. Só sai com 3+ veículos (a regra das 2 fontes já está cumprida),
// uma vez por fato, até 6 por dia por canal, e de madrugada (antes das 7h) só se for Vale postar (t330). Usado pela edição geral, Séries e Esportes.
import { hhmm } from './exclusivo.mjs';
const dom = (u) => { try { return new URL(String(u).replace(/^.*\*(https?:)/, '$1')).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const LIM_SUBINDO = { dia: 6, janelaMin: 30, minVeiculos: 3, recenteMin: 90 };
// itens: fatos agrupados ({ key, src, link, ts, grp: [{ src, link, ts, key, republicada }] }); devolve os que estão subindo e ainda não foram avisados
export function subindo(itens, E, { agora, lim = LIM_SUBINDO } = {}) {
  E.subindo = E.subindo || {}; for (const [k, t] of Object.entries(E.subindo)) if (agora - Date.parse(t) > 48 * 3600e3) delete E.subindo[k];
  const out = [];
  for (const i of itens) {
    const L = [i, ...(i.grp || [])].filter((x) => x && x.ts && !x.republicada).sort((a, b) => a.ts - b.ts);
    const vist = new Map(); for (const x of L) { const v = x.src || dom(x.link); if (!vist.has(v)) vist.set(v, x); }
    const pri = [...vist.values()]; if (!pri.length) continue; const t0 = pri[0].ts;
    const dentro = pri.filter((x) => x.ts - t0 <= lim.janelaMin * 60e3);
    if (dentro.length < lim.minVeiculos || agora - t0 > lim.recenteMin * 60e3) continue;
    const chaves = L.map((x) => x.key).filter(Boolean); if (chaves.some((k) => E.subindo[k])) continue;
    out.push({ i, dentro, minutos: Math.max(1, Math.round((dentro[dentro.length - 1].ts - t0) / 60e3)), chaves });
  }
  return out.sort((a, b) => b.dentro.length - a.dentro.length || a.minutos - b.minutos);
}
// 20/11 (t330): de madrugada só passa o que é Vale postar / Não deixe de postar (vale: true)
export const podeSubindo = (E, { agora, lim = LIM_SUBINDO, vale = false }) => { const dia = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10), h = new Date(agora - 3 * 3600e3).getUTCHours();
  if (!E.subindoDia || E.subindoDia.dia !== dia) E.subindoDia = { dia, n: 0 }; return (h >= 7 || vale) && E.subindoDia.n < lim.dia; };
export const marcarSubindo = (E, s, agora) => { const t = new Date(agora).toISOString(); for (const k of s.chaves) E.subindo[k] = t; E.subindoDia.n++; };
export const textoSubindo = (s) => '📈 ' + s.dentro.length + ' veículos em ' + s.minutos + ' min: ' + s.dentro.slice(0, 6).map((x) => x.src + ' ' + hhmm(x.ts)).join(', ') +
  '\nAssunto subindo agora: bom momento para postar rápido. Regra das 2 fontes já cumprida.';
