// Título repetido (20/11, t341). CAUSA: alguns feeds WordPress (ex.: Hugo Gloss) colam no <title> o título + a legenda
// da foto (que costuma ser o mesmo título de novo, às vezes com palavras trocadas, e/ou "(Foto: ...)").
// O título verdadeiro vem no rodapé do próprio item: "O post <a href=...>TÍTULO</a> apareceu primeiro em ...".
const ent = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const esp = s => String(s || '').replace(/\s+/g, ' ').trim();
const FOTO = /\s*\((?:fotos?|imagens?|reprodução|crédito|divulgação)\s*[:_/][^()]*\)?\s*$/i;

// título + 2ª cópia (igual ou quase igual) e/ou "(Foto: ...)" no fim: fica só a 1ª cópia
export function semRepetir(t) {
  let s = esp(t).replace(FOTO, '').trim();
  const w = s.split(' ');
  const n = Math.min(5, Math.floor(w.length / 2));
  if (n >= 3) {
    const cab = w.slice(0, n).join(' ').toLowerCase();
    for (let k = Math.max(n, Math.ceil(w.length * 0.35)); k <= w.length - n; k++)
      if (w.length - k >= k * 0.5 && w.slice(k, k + n).join(' ').toLowerCase() === cab) return w.slice(0, k).join(' ').replace(/[\s:;,–-]+$/, '');
  }
  // título longo (16+ palavras) cuja 2ª parte recomeça com as 2 primeiras palavras: é legenda reescrita colada
  // (maiúsculas iguais e 1ª palavra com 4+ letras, para não cortar "O que ... e o que ...")
  if (w.length >= 16 && w[0].length >= 4) {
    const cab2 = w.slice(0, 2).join(' ');
    for (let k = Math.ceil(w.length * 0.4); k <= w.length - 6; k++)
      if (w.slice(k, k + 2).join(' ') === cab2) return w.slice(0, k).join(' ').replace(/[\s:;,–-]+$/, '');
  }
  return s;
}

// na leitura do feed: usa o título do rodapé "O post <a>…</a>" / "The post <a>…</a>" quando o <title> começa com ele e é mais longo
export function tituloDoItem(titulo, bloco) {
  const t = esp(titulo);
  const m = ent(bloco).match(/(?:O post|The post)\s*<a\b[^>]*>([\s\S]*?)<\/a>/i);
  if (m) { const real = esp(m[1].replace(/<[^>]+>/g, '')); if (real.length >= 12 && t.length > real.length && t.startsWith(real)) return real; }
  return semRepetir(t);
}

// no arquivo já gravado (só tem o resumo cortado: "… O post COMEÇO-DO-TÍTULO…" ou "…FIM-DO-TÍTULO apareceu primeiro em"):
// corta a legenda colada depois do título usando esses pedaços do próprio item
export function curarTitulo(t, resumo) {
  const s = semRepetir(t), r = esp(resumo), w = s.split(' '), low = w.map(x => x.toLowerCase());
  const corte = k => w.slice(0, k).join(' ').replace(/[\s:;,–-]+$/, '');
  // 1) fim do título conhecido: "… TÍTULO apareceu primeiro em"
  const f = r.match(/((?:\S+ ){2,7}\S+) apareceu(?: primeiro|…)/);
  if (f) { const cauda = f[1].replace(/^.*O post /, '').replace(/^…/, ''); const j = s.indexOf(cauda); if (cauda.length >= 15 && j >= 0 && j + cauda.length < s.length) return esp(s.slice(0, j + cauda.length)); }
  // 2) começo do título conhecido: "O post COMEÇO…": depois dele, a legenda recomeça com a 1ª palavra (ou as 2 primeiras) do título
  const m = r.match(/O post (.{20,}?)…?$/);
  if (m) {
    const pre = m[1].replace(/…$/, '').trim();
    if (s.startsWith(pre)) {
      const n = low[0].length >= 4 ? 1 : 2, cab = low.slice(0, n).join(' ');
      for (let k = pre.split(' ').length; k <= w.length - n; k++) if (low.slice(k, k + n).join(' ') === cab) return corte(k);
    }
  }
  return s;
}
