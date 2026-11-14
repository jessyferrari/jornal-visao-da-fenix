// Arquivo de busca do jornal: TODAS as notícias lidas pelo robô (não só as 220 da edição),
// mais as da seção Música, guardadas por dia em busca/AAAA-MM-DD.json (uma notícia por linha,
// novas no fim, para o git guardar só a diferença). busca/indice.json lista os dias.
// O campo de busca do site lê esses arquivos, então achar "Anitta" não depende da notícia ainda estar na capa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = 'busca';
export const DIAS_GUARDADOS = 14;
const canon = u => String(u || '').trim().split('#')[0].split('?')[0].replace(/\/$/, '');
const corta = (s, n) => { s = String(s || '').replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
const linha = o => JSON.stringify(o);

function lerDia(dia) {
  try { return fs.readFileSync(path.join(DIR, dia + '.json'), 'utf8').split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l.replace(/,$/, ''))); } catch { return []; }
}
function gravarDia(dia, lista) {
  fs.writeFileSync(path.join(DIR, dia + '.json'), '[\n' + lista.map(linha).join(',\n') + '\n]\n');
}

// itens: [{ t, s, f, l, p, c, n? }]  t=título, s=resumo, f=fonte, l=link, p=AAAA-MM-DDTHH:MM (Brasília), c=seção, n=nº de fontes
export function arquivar(itens, hojeIso) {
  fs.mkdirSync(DIR, { recursive: true });
  const porDia = new Map();
  for (const i of itens) {
    if (!i || !i.t || !i.l || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(i.p || '')) continue;
    const dia = i.p.slice(0, 10); if (!porDia.has(dia)) porDia.set(dia, []); porDia.get(dia).push(i);
  }
  const hoje = (hojeIso || new Date().toISOString()).slice(0, 10);
  const limite = new Date(Date.parse(hoje + 'T12:00:00Z') - DIAS_GUARDADOS * 86400e3).toISOString().slice(0, 10);
  let novos = 0, atualizados = 0;
  for (const [dia, lista] of porDia) {
    if (dia < limite) continue;
    const atual = lerDia(dia); const idx = new Map(atual.map((x, k) => [canon(x.l), k]));
    let mudou = false;
    for (const i of lista) {
      const o = { t: corta(i.t, 220), s: corta(i.s, 180), f: i.f || '', l: i.l, p: i.p.slice(0, 16), c: i.c || 'br' };
      if (i.o) o.o = corta(i.o, 220);   // título original (notícia traduzida)
      if (i.n && i.n > 1) o.n = i.n;
      const k = canon(i.l);
      if (!idx.has(k)) { idx.set(k, atual.length); atual.push(o); novos++; mudou = true; continue; }
      const velho = atual[idx.get(k)];
      // atualiza no mesmo lugar só quando ganha informação (tradução, resumo, mais fontes, seção Música)
      const melhor = { ...velho };
      if (o.o && !velho.o) { melhor.t = o.t; melhor.o = o.o; }
      if (!velho.s && o.s) melhor.s = o.s;
      if ((o.n || 1) > (velho.n || 1)) melhor.n = o.n;
      if (o.c === 'musica' && velho.c !== 'musica') melhor.c2 = 'musica';
      if (JSON.stringify(melhor) !== JSON.stringify(velho)) { atual[idx.get(k)] = melhor; atualizados++; mudou = true; }
    }
    if (mudou) gravarDia(dia, atual);
  }
  // limpa dias velhos e regrava o índice
  const dias = fs.readdirSync(DIR).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).map(f => f.slice(0, 10)).sort();
  for (const d of dias) if (d < limite) fs.unlinkSync(path.join(DIR, d + '.json'));
  const ficam = dias.filter(d => d >= limite).sort().reverse();
  const indice = { dias: ficam.map(d => ({ dia: d, itens: lerDia(d).length })) };
  const antes = (() => { try { return fs.readFileSync(path.join(DIR, 'indice.json'), 'utf8'); } catch { return ''; } })();
  const depois = JSON.stringify(indice);
  if (antes !== depois) fs.writeFileSync(path.join(DIR, 'indice.json'), depois);
  return { novos, atualizados, dias: ficam.length, total: indice.dias.reduce((a, d) => a + d.itens, 0) };
}

// Itens da seção Música (musica.json): qualquer objeto com titulo + link + publicado
export function itensMusica(m) {
  const out = [], vistos = new Set();
  const anda = (x, setor) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { for (const y of x) anda(y, setor); return; }
    if (typeof x.titulo === 'string' && typeof x.link === 'string' && /^https?:/.test(x.link) && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(x.publicado || '')) {
      const k = canon(x.link);
      if (!vistos.has(k)) { vistos.add(k); out.push({ t: x.titulo, s: [x.resumo || '', x.local ? 'Local: ' + x.local : '', setor ? 'Música: ' + setor : ''].filter(Boolean).join(' · '), f: x.veiculo || x.dominio || '', l: x.link, p: x.publicado, c: 'musica', n: x.fontes || 1, o: x.tituloOriginal || x.original || '' }); }
    }
    if (Array.isArray(x.tambemEm) && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(x.publicado || '')) for (const y of x.tambemEm) {
      if (y && typeof y.titulo === 'string' && typeof y.link === 'string' && /^https?:/.test(y.link) && !vistos.has(canon(y.link))) { vistos.add(canon(y.link)); out.push({ t: y.titulo, s: 'Mesmo fato de: ' + x.titulo, f: y.veiculo || '', l: y.link, p: x.publicado, c: 'musica', n: x.fontes || 1 }); }
    }
    for (const [k, v] of Object.entries(x)) if (v && typeof v === 'object' && !/^(placar|auditoriaLocal)$/.test(k)) anda(v, x.nome && typeof x.nome === 'string' ? x.nome : setor);
  };
  anda(m, '');
  return out;
}

// CLI: depois do musica.mjs, arquiva a seção Música e a edição atual
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let itens = [];
  try { itens = itens.concat(itensMusica(JSON.parse(fs.readFileSync('musica.json', 'utf8')))); } catch (e) { console.log('busca: musica.json não lido', e.message); }
  try { const e = JSON.parse(fs.readFileSync('edicao.json', 'utf8')); itens = itens.concat(e.stories.map(s => ({ t: s.title, s: s.sum, f: s.src, l: s.link, p: s.pub, c: s.sec, n: s.cov && s.cov.n, o: s.orig }))); } catch (e) { console.log('busca: edicao.json não lido', e.message); }
  const r = arquivar(itens, new Date(Date.now() - 3 * 3600e3).toISOString());
  console.log('busca: arquivo atualizado', JSON.stringify(r));
}
