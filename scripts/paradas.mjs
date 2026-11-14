// Paradas por gênero (samba primeiro): mais tocadas do DIA e da SEMANA, Brasil e mundo, só de fontes públicas
// (Spotify via kworb, Apple Music RSS, iTunes por gênero, Deezer API, Billboard), mais os "lançamentos mais esperados"
// tirados de notícias públicas (2 sites diferentes = confirmado; 1 site = em apuração). Nada é inventado: cada
// música mostra a posição que tem na parada da fonte, com o nome da fonte e a data em horário de Brasília.
// Gera paradas.json (página) e paradas-generos.json (cache: artista -> gênero na Apple).
import fs from 'node:fs';
import { GENEROS, lerKworb, lerAppleRss, lerItunesGenero, lerDeezer, lerBillboard, montarGeneros, agruparLancamentos, artistaPrincipal, generoManual } from './paradas-regras.mjs';

const UA = 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)';
const brIso = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T');
const sem = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const espera = ms => new Promise(r => setTimeout(r, ms));
async function baixa(url, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }, signal: c.signal, redirect: 'follow' });
    if (!r.ok) { try { await r.body?.cancel(); } catch {} throw new Error('HTTP ' + r.status); } return await r.text(); } finally { clearTimeout(t); }
}

const K = 'https://kworb.net/spotify/country/';
const APPLE = (cc) => `https://rss.marketingtools.apple.com/api/v2/${cc}/music/most-played/100/songs.json`;
const DZ = (pl) => `https://api.deezer.com/playlist/${pl}`;
const BB = (c) => `https://www.billboard.com/charts/${c}/`;
// paradas gerais: depois são separadas por gênero mantendo a posição original
const PARADAS = [
  ['spotify-br-dia', 'Spotify Brasil (mais tocadas do dia)', 'dia', 'br', K + 'br_daily.html', lerKworb],
  ['spotify-br-semana', 'Spotify Brasil (mais tocadas da semana)', 'semana', 'br', K + 'br_weekly.html', lerKworb],
  ['spotify-mundo-dia', 'Spotify Global (mais tocadas do dia)', 'dia', 'mundo', K + 'global_daily.html', lerKworb],
  ['spotify-mundo-semana', 'Spotify Global (mais tocadas da semana)', 'semana', 'mundo', K + 'global_weekly.html', lerKworb],
  ['apple-br', 'Apple Music Brasil (mais tocadas)', 'dia', 'br', APPLE('br'), lerAppleRss],
  ['apple-eua', 'Apple Music EUA (mais tocadas)', 'dia', 'mundo', APPLE('us'), lerAppleRss],
  ['deezer-br', 'Deezer Top Brasil', 'dia', 'br', DZ(1111141961), lerDeezer],
  ['deezer-mundo', 'Deezer Top Mundial', 'dia', 'mundo', DZ(3155776842), lerDeezer],
  ['billboard-br', 'Billboard Brasil Hot 100', 'semana', 'br', BB('billboard-brasil-hot-100'), lerBillboard],
  ['billboard-global', 'Billboard Global 200', 'semana', 'mundo', BB('billboard-global-200'), lerBillboard],
];
// paradas oficiais de UM gênero (iTunes Store por gênero = mais compradas; Billboard por gênero)
const IT = (cc, g) => `https://itunes.apple.com/${cc}/rss/topsongs/limit=50/genre=${g}/json`;
const POR_GENERO = [
  ['samba', 'itunes-br-samba', 'iTunes Brasil: Samba', 'br', IT('br', 1227)], ['samba', 'itunes-br-pagode', 'iTunes Brasil: Pagode', 'br', IT('br', 1226)],
  ['sertanejo', 'itunes-br-sertanejo', 'iTunes Brasil: Sertanejo', 'br', IT('br', 1228)], ['funk', 'itunes-br-funk', 'iTunes Brasil: Baile Funk', 'br', IT('br', 1229)],
  ['mpb', 'itunes-br-mpb', 'iTunes Brasil: MPB', 'br', IT('br', 1225)], ['gospel', 'itunes-br-gospel', 'iTunes Brasil: Música religiosa', 'br', IT('br', 22)],
  ['rap', 'itunes-br-rap', 'iTunes Brasil: Hip-Hop/Rap', 'br', IT('br', 18)], ['pop', 'itunes-br-pop', 'iTunes Brasil: Pop', 'br', IT('br', 14)],
  ['eletronica', 'itunes-br-eletronica', 'iTunes Brasil: Eletrônica', 'br', IT('br', 7)], ['rock', 'itunes-br-rock', 'iTunes Brasil: Rock', 'br', IT('br', 21)],
  ['forro', 'itunes-br-forro', 'iTunes Brasil: Forró', 'br', IT('br', 1223)], ['axe', 'itunes-br-axe', 'iTunes Brasil: Axé', 'br', IT('br', 1220)],
  ['rap', 'itunes-eua-rap', 'iTunes EUA: Hip-Hop/Rap', 'mundo', IT('us', 18)], ['pop', 'itunes-eua-pop', 'iTunes EUA: Pop', 'mundo', IT('us', 14)],
  ['eletronica', 'itunes-eua-dance', 'iTunes EUA: Dance', 'mundo', IT('us', 17)], ['rock', 'itunes-eua-rock', 'iTunes EUA: Rock', 'mundo', IT('us', 21)],
  ['gospel', 'itunes-eua-gospel', 'iTunes EUA: Christian & Gospel', 'mundo', IT('us', 22)], ['latina', 'itunes-eua-latina', 'iTunes EUA: Latina', 'mundo', IT('us', 12)],
  ['afro', 'itunes-eua-afro', 'iTunes EUA: Africana', 'mundo', IT('us', 1203)],
  ['rock', 'billboard-rock', 'Billboard Hot Rock & Alternative Songs', 'mundo', BB('hot-rock-songs'), 'semana'],
  ['afro', 'billboard-afro', 'Billboard U.S. Afrobeats Songs', 'mundo', BB('billboard-u-s-afrobeats-songs'), 'semana'],
  ['latina', 'billboard-latin', 'Billboard Hot Latin Songs', 'mundo', BB('latin-songs'), 'semana'],
  ['rap', 'billboard-rap', 'Billboard Hot Rap Songs', 'mundo', BB('rap-song'), 'semana'],
  ['eletronica', 'billboard-dance', 'Billboard Hot Dance/Electronic Songs', 'mundo', BB('dance-electronic-songs'), 'semana'],
  ['rap', 'billboard-rnb-hiphop', 'Billboard Hot R&B/Hip-Hop Songs', 'mundo', BB('r-b-hip-hop-songs'), 'semana'],
  ['gospel', 'billboard-christian', 'Billboard Hot Christian Songs', 'mundo', BB('christian-songs'), 'semana'],
];
const gn = (q, hl = 'pt-BR', gl = 'BR', ceid = 'BR:pt-419') => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:7d') + `&hl=${hl}&gl=${gl}&ceid=${ceid}`;
const NOTICIAS = [
  ['br', gn('"novo álbum" "data de lançamento"')], ['br', gn('anuncia "novo álbum" OR "novo EP" cantor OR cantora OR grupo')], ['br', gn('"pré-save" música lançamento')],
  ['br', gn('lança nesta sexta música nova samba OR pagode OR sertanejo OR funk')], ['br', gn('"mais esperado" álbum 2026 OR 2027 música')], ['br', gn('samba OR pagode "novo álbum" OR "novo DVD" OR "nova música" lançamento')],
  ['mundo', gn('"most anticipated" album 2026 OR 2027', 'en-US', 'US', 'US:en')], ['mundo', gn('"announces new album" release date', 'en-US', 'US', 'US:en')],
  ['mundo', gn('"new album" "out on" friday', 'en-US', 'US', 'US:en')],
];
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const ent = s => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
function lerNoticias(xml, escopo) {
  const out = [];
  for (const b of String(xml).split('<item>').slice(1)) {
    const t = ent((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const link = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const sm = b.match(/<source[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i); const ts = Date.parse((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
    if (!t || !sm || !ts) continue; const veic = ent(sm[2]); const titulo = t.replace(new RegExp('\\s+-\\s+' + veic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '');
    out.push({ titulo, link, veic, dom: host(sm[1]), ts, escopo });
  }
  return out;
}

const agora = new Date(); const fontes = [];
const lista = async (id, nome, periodo, escopo, url, parser) => {
  try { let txt; try { txt = await baixa(url); } catch (e) { await espera(3000); txt = await baixa(url, 40000); }   // 1 nova tentativa
    const r = parser(txt); const ok = r.itens.length > 0;
    fontes.push({ id, nome, periodo, escopo, url, ok, n: r.itens.length, data: r.data ? (r.data.length === 10 ? r.data.split('-').reverse().join('/') : brIso(new Date(r.data))) : 'lida em ' + brIso(agora), erro: ok ? undefined : 'sem itens' });
    return { id, nome, periodo, escopo, url, ok, itens: r.itens, data: fontes.at(-1).data };
  } catch (e) { fontes.push({ id, nome, periodo, escopo, url, ok: false, n: 0, erro: String(e.message || e).slice(0, 80) }); return { id, ok: false, itens: [] }; }
};
const paradas = []; for (const p of PARADAS) paradas.push(await lista(...p));
const porGenero = [];
for (const [genero, id, nome, escopo, url, per] of POR_GENERO) { const p = await lista(id, nome, per || 'dia', escopo, url, url.includes('billboard') ? lerBillboard : lerItunesGenero); porGenero.push({ ...p, genero }); await espera(250); }

// gênero do artista na Apple (pesquisa pública do iTunes), guardado para as próximas rodadas
const CF = 'paradas-generos.json'; let cache = {}; try { cache = JSON.parse(fs.readFileSync(CF, 'utf8')); } catch {}
const artistas = [...new Set(paradas.filter(p => p.ok).flatMap(p => p.itens.filter(i => !(i.generosFonte || []).length && !generoManual(i.artista)).map(i => sem(artistaPrincipal(i.artista)))))].filter(a => a && !cache[a]);
const LIM = +(process.env.PARADAS_LOOKUPS || 60); let consultas = 0;
for (const a of artistas.slice(0, LIM)) {
  try { const j = JSON.parse(await baixa('https://itunes.apple.com/search?entity=musicArtist&limit=3&country=br&term=' + encodeURIComponent(a), 10000));
    const r = (j.results || []).find(x => sem(x.artistName) === a) || (j.results || [])[0];
    cache[a] = { genero: r ? r.primaryGenreName : '', visto: brIso(agora) }; consultas++;
  } catch (e) { if (/HTTP 403|HTTP 429/.test(e.message)) break; }
  await espera(+(process.env.PARADAS_PAUSA_MS || 3100));
}
fs.writeFileSync(CF, JSON.stringify(cache, null, 0));

const generos = montarGeneros(paradas, cache, porGenero);
// lançamentos mais esperados
let noticias = []; for (const [escopo, url] of NOTICIAS) { try { noticias.push(...lerNoticias(await baixa(url), escopo)); fontes.push({ id: 'noticias', nome: 'Google Notícias (lançamentos)', periodo: 'semana', escopo, url, ok: true, n: noticias.length }); } catch (e) { fontes.push({ id: 'noticias', nome: 'Google Notícias (lançamentos)', escopo, url, ok: false, n: 0, erro: String(e.message).slice(0, 80) }); } }
noticias = noticias.filter(n => agora - n.ts < 7 * 86400e3 && /[aá]lbum|\bEP\b|single|m[uú]sica nova|nova m[uú]sica|lan[cç]a|lan[cç]amento|pr[eé]-save|album|release|single|DVD|clipe/i.test(n.titulo) && !/resenha|review|cr[ií]tica:|ranking dos piores/i.test(n.titulo));
const nomes = paradas.filter(p => p.ok).flatMap(p => p.itens.map(i => artistaPrincipal(i.artista)));
const lanc = agruparLancamentos(noticias, nomes).map(l => ({ ...l, publicado: brIso(new Date(l.publicado)) }));
const lancamentos = { br: lanc.filter(l => l.escopo === 'br').slice(0, 25), mundo: lanc.filter(l => l.escopo === 'mundo').slice(0, 25) };

const semGenero = paradas.filter(p => p.ok).reduce((n, p) => n + p.itens.filter(i => !montarGeneros([{ ...p, itens: [i] }], cache).some(g => g.listas.length)).length, 0);
const out = { geradoEm: brIso(agora), fuso: 'horário de Brasília', regra: 'Posição = a da própria parada da fonte, nunca inventada. Lançamento só é "confirmado" com 2 sites diferentes; com 1 site fica "em apuração".',
  ordem: GENEROS.map(g => g[0]), generos, topGeral: paradas.filter(p => p.ok).map(p => ({ fonte: p.nome, id: p.id, periodo: p.periodo, escopo: p.escopo, data: p.data, url: p.url, itens: p.itens.slice(0, 10).map(i => ({ pos: i.pos, titulo: i.titulo, artista: i.artista })) })),
  lancamentos, fontes, semGenero, artistasConsultadosNaApple: consultas, artistasNoCache: Object.keys(cache).length };
fs.writeFileSync('paradas.json', JSON.stringify(out));
console.log('PARADAS:', fontes.filter(f => f.ok && f.id !== 'noticias').length, 'paradas ok de', PARADAS.length + POR_GENERO.length, '| falharam:', fontes.filter(f => !f.ok).map(f => f.nome + ' (' + f.erro + ')').join('; ') || 'nenhuma');
for (const g of generos) console.log('  ' + g.nome.padEnd(26) + g.listas.length + ' listas | ' + g.listas.map(l => l.fonte.replace(/ \(.*\)/, '') + ' ' + l.itens.length).join(', '));
console.log('LANÇAMENTOS: Brasil', lancamentos.br.length, '(confirmados', lancamentos.br.filter(l => l.confirmado).length + ') | mundo', lancamentos.mundo.length, '(confirmados', lancamentos.mundo.filter(l => l.confirmado).length + ') | artistas consultados na Apple nesta rodada', consultas, '| sem gênero', semGenero);
