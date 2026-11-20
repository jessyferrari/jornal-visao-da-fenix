// Comparar manchetes entre veículos (20/11, t339): títulos em CAIXA ALTA (vídeos do YouTube, ex.: Gigantes de Nazaré) e com emojis,
// hashtags ou @menções não casavam com a mesma notícia de outro veículo. A regra da verdade NÃO afrouxa: continua exigindo veículos
// distintos, palavras em comum e um nome próprio em comum. O que muda é só COMO lemos o título:
//  - emojis saem; #hashtags e @menções no FIM do título (#Shorts #gigantesdenazare @Canal) saem; no meio da frase fica a palavra
//    ("É #FAKE que..." -> "É FAKE que..."), porque ali ela faz parte da notícia;
//  - acentos e caixa já eram normalizados nas palavras; os nomes próprios também comparam sem acento;
//  - título GRITADO (70%+ das letras maiúsculas) não diz o que é nome próprio: herda do outro título só os nomes próprios que o
//    outro veículo escreveu com maiúscula E que aparecem nele. Dois títulos gritados ficam como antes (sem ganho e sem perda).
export const EMOJI = /[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]/gu;
export const sem = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const TAGS_FIM = /(?:[\s|·•–—-]*[#@][\p{L}\p{N}_.]+)+[\s|·•–—!.-]*$/u;
export function limparComparar(t) {
  let s = String(t || '').replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(TAGS_FIM, '').trim();
  return s.replace(/(^|[\s(“"'‘])[#@](?=[\p{L}\p{N}])/gu, '$1').replace(/\s+/g, ' ').trim();
}
export function gritado(t) {
  const l = limparComparar(t).match(/\p{L}/gu) || []; if (l.length < 8) return false;
  let up = 0; for (const c of l) if (c !== c.toLowerCase() && c === c.toUpperCase()) up++;
  return up / l.length >= 0.7;
}
export const tokens = (t) => new Set(sem(limparComparar(t)).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean));
/** nomes próprios pela caixa (rx com flag g), sem acento; em título gritado o Set vem marcado (.gritado), porque a caixa não informa nada */
export function nomesPelaCaixa(t, rx, filtro = () => true) {
  const c = limparComparar(t), s = new Set((c.match(rx) || []).map(sem).filter(filtro));
  if (gritado(c)) s.gritado = true;
  return s;
}
// nome do outro título aparece neste? (nome composto "beija-flor" exige todas as partes)
const aparece = (e, k) => { const p = e.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean); return p.length > 0 && p.every((x) => k.has(x)); };
/** nomes efetivos de um par: quem tem caixa confiável fica com os seus; o gritado herda do outro só o que aparece nele */
export function nomesDoPar(ta, na, tb, nb) {
  if (!na?.gritado === !nb?.gritado) return [na, nb];   // os dois normais ou os dois gritados: igual a antes
  if (na.gritado) { const k = tokens(ta); return [new Set([...nb].filter((e) => aparece(e, k))), nb]; }
  const k = tokens(tb); return [na, new Set([...na].filter((e) => aparece(e, k)))];
}
