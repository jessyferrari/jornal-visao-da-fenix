// Paradas por gênero: regras puras (sem rede), testáveis. Nunca inventa posição: cada música guarda a posição
// que ela tem na parada da fonte (ex.: "#12 no Spotify Brasil, dia 12/11").
import { mesmoFato, pessoas } from './musica-regras.mjs';

const sem = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ent = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ordem pedida: samba/pagode primeiro
export const GENEROS = [
  ['samba', 'Samba e Pagode'], ['sertanejo', 'Sertanejo'], ['funk', 'Funk'], ['mpb', 'MPB'], ['gospel', 'Gospel'],
  ['rap', 'Rap e Trap'], ['pop', 'Pop'], ['eletronica', 'Eletrônica'], ['rock', 'Rock'], ['forro', 'Forró e Piseiro'],
  ['arrocha', 'Arrocha'], ['axe', 'Axé'], ['latina', 'Latina (internacional)'], ['afro', 'Afrobeats (internacional)'],
];
// gênero que a própria Apple (Apple Music / iTunes) dá para a música ou o artista -> gênero do jornal
const MAPA = [
  ['samba', /^(samba|pagode)$/], ['sertanejo', /sertanejo/], ['funk', /baile funk|funk carioca|funk brasileiro|^funk$|brazilian funk/],
  ['mpb', /^mpb$|bossa nova|^choro$/], ['forro', /forro|piseiro|xote|baiao/], ['axe', /^axe$/], ['arrocha', /arrocha/],
  ['gospel', /gospel|crista|christian|louvor|religios|worship|ccm/], ['rap', /hip-hop|hip hop|\brap\b|trap|drill/],
  ['latina', /latin|reggaeton|urbano|salsa|regional mexicano|pop em espanhol|musica mexicana/], ['afro', /afro|amapiano|africa/],
  ['eletronica', /eletr|electronic|dance|house|techno|trance|dubstep|drum/], ['rock', /rock|alternativ|metal|punk|indie|grunge|emo/],
  ['pop', /pop/],
];
export const generoDe = (nome) => { const n = sem(nome); for (const [g, re] of MAPA) if (re.test(n)) return g; return ''; };
// gêneros que a Apple não separa (arrocha, piseiro) ou erra: lista do jornal, sempre marcada como "lista do jornal"
export const MANUAIS = {
  arrocha: ['pablo', 'silvanno salles', 'nadson o ferinha', 'devinho novaes', 'unha pintada', 'thiago aquino', 'kanario', 'raphael lima', 'tayrone', 'toque dez', 'nadson', 'ramon e randinho'],
  forro: ['joao gomes', 'vitor fernandes', 'ze vaqueiro', 'tarcisio do acordeon', 'baroes da pisadinha', 'wesley safadao', 'xand avioes', 'mari fernandez', 'nattan', 'felipe amorim', 'calcinha preta', 'solange almeida', 'heitor costa', 'iguinho e lulinha', 'luan estilizado'],
  funk: ['mc ryan sp', 'mc ig', 'mc ph', 'mc daniel', 'mc kevin o chris', 'mc tuto', 'mc paiva', 'mc cabelinho', 'mc livinho', 'mc hariel', 'kevin o chris', 'dj glenner', 'mc pedrinho', 'mc don juan', 'mc kadu', 'mc poze do rodo', 'mc menor jp', 'mc lele jp', 'mc jacare', 'mc meno k', 'mc luuky', 'mc brinquedo'],
  samba: ['thiaguinho', 'ferrugem', 'menos e mais', 'pericles', 'dilsinho', 'sorriso maroto', 'grupo menos e mais', 'turma do pagode', 'zeca pagodinho', 'xande de pilares', 'mumuzinho', 'belo', 'suel', 'grupo revelacao', 'di proposito', 'grupo di proposito', 'numanice', 'ludmilla numanice', 'pixote', 'alexandre pires', 'raca negra', 'exaltasamba', 'atitude 67', 'diogo nogueira', 'arlindinho', 'tiee', 'vitinho', 'kamisa 10', 'pique novo', 'grupo pique novo', 'jorge aragao', 'fundo de quintal', 'mart nalia', 'alcione', 'pagodinho', 'molejo', 'rodriguinho', 'sambo'],
};
// só o NOME INTEIRO de um dos artistas da faixa ("Vitinho Imperador" não é "Vitinho")
const partes = (artista) => sem(artista).split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bpart\.?|\bw\/|\bx\b|\be\b(?= (?:grupo|mc|dj) ))\s*/).map(x => x.replace(/^grupo /, '').trim()).filter(Boolean);
export const generoManual = (artista) => { const ps = partes(artista); for (const [g, nomes] of Object.entries(MANUAIS)) if (nomes.some(n => ps.includes(n.replace(/^grupo /, '')))) return g; return ''; };
export const artistaPrincipal = (a) => String(a || '').split(/\s*(?:,|&| feat\.? | ft\.? | part\.? | x | e (?=[A-Z][a-z]+ [A-Z]))\s*/)[0].trim();

// ===== leitores das paradas públicas (texto/JSON já baixado) =====
// kworb: espelho público das paradas Spotify; página tem "Spotify Daily Chart - Brazil - 2026/11/12"
export function lerKworb(html) {
  const d = (String(html).match(/pagetitle">[^<]*?(\d{4})\/(\d{2})\/(\d{2})/) || []).slice(1); const itens = [];
  for (const tr of String(html).split(/<tr(?:\s[^>]*)?>/).slice(1)) {   // linhas com e sem class="d2"
    const pos = +(tr.match(/<td class="np">(\d+)<\/td>/) || [])[1]; const div = (tr.match(/<div>([\s\S]*?)<\/div>/) || [])[1]; if (!pos || !div) continue;
    const m = div.match(/^([\s\S]*?) - <a href="\.\.\/track\/[^"]+">([\s\S]*?)<\/a>([\s\S]*)$/); if (!m) continue;
    const feat = ent(m[3]).replace(/^\(w\/\s*|\)$/g, '');
    itens.push({ pos, artista: ent(m[1]) + (feat ? ', ' + feat : ''), titulo: ent(m[2]) });
  }
  return { data: d.length ? d.join('-') : '', itens };
}
export function lerAppleRss(json) {
  const f = (typeof json === 'string' ? JSON.parse(json) : json).feed || {};
  return { data: f.updated ? new Date(f.updated).toISOString() : '', itens: (f.results || []).map((r, n) => ({ pos: n + 1, titulo: r.name, artista: r.artistName, generosFonte: (r.genres || []).map(g => g.name).filter(g => !/^m[uú]sica$|^music$/i.test(g)) })) };
}
export function lerItunesGenero(json) {
  const f = (typeof json === 'string' ? JSON.parse(json) : json).feed || {};
  const e = [].concat(f.entry || []);
  return { data: f.updated?.label ? new Date(f.updated.label).toISOString() : '', titulo: f.title?.label || '', itens: e.map((x, n) => ({ pos: n + 1, titulo: x['im:name']?.label, artista: x['im:artist']?.label, generosFonte: [x.category?.attributes?.label].filter(Boolean) })) };
}
export function lerDeezer(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json; const arr = d.tracks?.data || d.data || [];
  return { data: '', itens: arr.map((t, n) => ({ pos: n + 1, titulo: t.title, artista: t.artist?.name })) };
}
// Billboard: página pública da parada; cada linha tem o título em h3#title-of-a-story e o artista no span logo depois
export function lerBillboard(html) {
  const s = String(html); const w = s.match(/Week of ([A-Z][a-z]+ \d{1,2}, \d{4})/); const itens = [];
  for (const bloco of s.split('o-chart-results-list-row-container').slice(1)) {
    const t = bloco.match(/<h3[^>]*id="title-of-a-story"[^>]*>([\s\S]*?)<\/h3>\s*<span[^>]*>([\s\S]*?)<\/span>/); if (!t) continue;
    const pos = +(bloco.match(/<span class="c-label[^"]*"[^>]*>\s*(\d{1,3})\s*<\/span>/) || [])[1] || itens.length + 1;
    itens.push({ pos, titulo: ent(t[1]), artista: ent(t[2]) });
  }
  return { data: w ? new Date(w[1] + ' 12:00 UTC').toISOString().slice(0, 10) : '', itens };   // semana da Billboard: só a data
}

// ===== classificação: gênero da própria fonte, depois o gênero do artista na Apple, depois a lista do jornal =====
export function classificar(item, cacheArtistas = {}) {
  for (const g of item.generosFonte || []) { const k = generoDe(g); if (k) return { genero: k, como: 'gênero na fonte: ' + g }; }
  const man = generoManual(item.artista); if (man) return { genero: man, como: 'lista do jornal' };
  const a = sem(artistaPrincipal(item.artista)); const c = cacheArtistas[a];
  if (c && c.genero) { const k = generoDe(c.genero); if (k) return { genero: k, como: 'gênero do artista na Apple: ' + c.genero }; }
  return { genero: '', como: c ? 'Apple não dá subgênero (' + (c.genero || 'sem resposta') + ')' : 'gênero ainda não consultado' };
}

// por gênero, filtra cada parada mantendo a POSIÇÃO ORIGINAL da fonte
export function montarGeneros(paradas, cacheArtistas = {}, porGenero = []) {
  const out = GENEROS.map(([id, nome]) => ({ id, nome, listas: [] }));
  const ix = Object.fromEntries(out.map(g => [g.id, g]));
  for (const p of paradas) {
    if (!p.ok) continue; const grupos = {};
    for (const it of p.itens) { const c = classificar(it, cacheArtistas); if (!c.genero) continue; (grupos[c.genero] ||= []).push({ pos: it.pos, titulo: it.titulo, artista: it.artista, como: c.como }); }
    for (const [g, itens] of Object.entries(grupos)) ix[g]?.listas.push({ fonte: p.nome, id: p.id, periodo: p.periodo, escopo: p.escopo, data: p.data, url: p.url, deTotal: p.itens.length, itens: itens.slice(0, 15) });
  }
  // paradas oficiais só de um gênero (iTunes por gênero, Billboard por gênero): entram inteiras (top 15)
  for (const p of porGenero) if (p.ok && ix[p.genero]) ix[p.genero].listas.push({ fonte: p.nome, id: p.id, periodo: p.periodo, escopo: p.escopo, data: p.data, url: p.url, deTotal: p.itens.length, soDoGenero: true, itens: p.itens.slice(0, 15).map(i => ({ pos: i.pos, titulo: i.titulo, artista: i.artista, como: 'parada do próprio gênero' })) });
  const peso = { br: 0, mundo: 1 }, per = { dia: 0, semana: 1 };
  for (const g of out) g.listas.sort((a, b) => (peso[a.escopo] - peso[b.escopo]) || (per[a.periodo] - per[b.periodo]) || (!!a.soDoGenero - !!b.soDoGenero));
  return out;
}

// ===== lançamentos mais esperados: notícias públicas agrupadas; só vira "confirmado" com 2 sites diferentes =====
export function agruparLancamentos(noticias, nomesConhecidos = []) {
  // nomes de artistas das próprias paradas (ex.: Anitta, uma palavra só) também contam como "mesma pessoa"
  const conh = [...new Set(nomesConhecidos.map(sem).filter(n => n.length >= 4))].map(n => [n, new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)')]);
  const quem = (t) => { const q = new Set(); for (const n of pessoas(t)) { const w = n.split(' '); for (let i = 0; i < w.length - 1; i++) for (let j = i + 2; j <= w.length; j++) q.add(w.slice(i, j).join(' ')); } const st = sem(t); for (const [n, re] of conh) if (re.test(st)) q.add(n); return q; };
  const ord = [...noticias].sort((a, b) => b.ts - a.ts); const grupos = [];
  const tok = (t) => new Set(sem(t).split(/[^a-z0-9]+/).filter(w => w.length > 3));
  // parecido = mesmas palavras E a mesma pessoa/banda no título ("X lança álbum" e "Y lança álbum" nunca se juntam)
  const VAZIAS = new Set(['lanca', 'lancamento', 'novo', 'nova', 'album', 'single', 'musica', 'data', 'anuncia', 'announces', 'album', 'release', 'date', 'with', 'sobre', 'para', 'como', 'mais', 'esperado', 'esperados', 'disco', 'clipe', 'faixa', 'faixas', 'feat', 'new']);
  const parecido = (a, b) => { const pa = quem(a.titulo), pb = quem(b.titulo); if (![...pa].some(x => pb.has(x))) return false; const nomeW = new Set([...pa, ...pb].flatMap(x => x.split(' '))); const A = new Set([...tok(a.titulo)].filter(w => !VAZIAS.has(w) && !nomeW.has(w))), B = new Set([...tok(b.titulo)].filter(w => !VAZIAS.has(w) && !nomeW.has(w))); if (!A.size || !B.size) return false; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)) >= 0.5; };
  for (const n of ord) {
    const g = grupos.find(g => g.itens.some(x => x.dom !== n.dom && (parecido(x, n) || mesmoFato({ title: x.titulo, ts: x.ts, dom: x.dom }, { title: n.titulo, ts: n.ts, dom: n.dom }))) || g.itens.some(x => x.link === n.link || (x.dom === n.dom && sem(x.titulo) === sem(n.titulo))));
    if (g) g.itens.push(n); else grupos.push({ itens: [n] });
  }
  return grupos.map(g => { const doms = new Set(g.itens.map(x => x.dom)); const p = g.itens[0];
    return { titulo: p.titulo, link: p.link, veiculo: p.veic, publicado: p.ts, fontes: doms.size, confirmado: doms.size >= 2, emApuracao: doms.size < 2 || undefined, escopo: p.escopo, tambemEm: g.itens.slice(1).filter((x, i, a) => x.dom !== p.dom && a.findIndex(y => y.dom === x.dom) === i).slice(0, 3).map(x => ({ veiculo: x.veic, titulo: x.titulo, link: x.link })) }; })
    .sort((a, b) => (b.confirmado - a.confirmado) || (b.fontes - a.fontes) || (b.publicado - a.publicado));
}
