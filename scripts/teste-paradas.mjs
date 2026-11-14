// Testes sem rede das Paradas por gênero: leitura das paradas públicas (trechos reais de 13/11), posição nunca inventada,
// gênero pela Apple ou pela lista do jornal, samba primeiro, e lançamentos com a regra de 2 fontes. Uso: node scripts/teste-paradas.mjs
import assert from 'node:assert/strict';
import { GENEROS, lerKworb, lerAppleRss, lerItunesGenero, lerDeezer, lerBillboard, generoDe, generoManual, classificar, montarGeneros, agruparLancamentos } from './paradas-regras.mjs';
let n = 0; const ok = (m) => { n++; console.log('ok', n, m); };
assert.equal(GENEROS[0][0], 'samba'); assert.deepEqual(GENEROS.map(g => g[0]).slice(0, 11), ['samba', 'sertanejo', 'funk', 'mpb', 'gospel', 'rap', 'pop', 'eletronica', 'rock', 'forro', 'arrocha']); ok('ordem pedida: samba e pagode primeiro, depois sertanejo, funk, MPB, gospel, rap, pop, eletrônica, rock, forró, arrocha');
// trecho real do kworb (Spotify Brasil, 12/11)
const kw = '<span class="pagetitle">Spotify Daily Chart - Brazil - 2026/11/12 | <a href="br_daily_totals.html">Totals</a></span><table><tbody>\n<tr><td class="np">1</td>\n<td class="np">=</td>\n<td class="text mp"><div><a href="../artist/7gZu.html">Felipe e Rodrigo</a> - <a href="../track/1uDn.html">Pós - Ao Vivo</a></div></td>\n<td>5</td></tr>\n<tr><td class="np">2</td>\n<td class="np">=</td>\n<td class="text mp"><div><a href="../artist/6xer.html">João Gustavo e Murilo</a> - <a href="../track/4RuR.html">Postinho de Gasolina</a> (w/ <a href="../artist/1eIY.html">Grelo</a>)</div></td></tr>\n<tr class="d2"><td class="np">84</td>\n<td class="np">+3</td>\n<td class="text mp"><div><a href="../artist/x.html">Grupo Menos É Mais</a> - <a href="../track/y.html">P do Pecado - Ao Vivo</a></div></td></tr>';
const K = lerKworb(kw); assert.equal(K.data, '2026-11-12'); assert.deepEqual(K.itens.map(i => i.pos), [1, 2, 84]); assert.equal(K.itens[1].artista, 'João Gustavo e Murilo, Grelo'); assert.equal(K.itens[0].titulo, 'Pós - Ao Vivo'); ok('Spotify (kworb): data da parada e posição original lidas da página');
const ap = lerAppleRss({ feed: { updated: 'Sat, 14 Nov 2026 01:41:50 +0000', results: [{ name: 'Pós (Ao Vivo)', artistName: 'Felipe e Rodrigo', genres: [{ name: 'Sertanejo' }, { name: 'Música' }] }] } });
assert.equal(ap.itens[0].pos, 1); assert.deepEqual(ap.itens[0].generosFonte, ['Sertanejo']); ok('Apple Music RSS: gênero da própria Apple');
const it = lerItunesGenero({ feed: { title: { label: 'iTunes Store: Top músicas em Pagode' }, updated: { label: '2026-11-13T17:51:00-07:00' }, entry: [{ 'im:name': { label: 'Tá Escrito (Ao Vivo)' }, 'im:artist': { label: 'Grupo Revelação' }, category: { attributes: { label: 'Pagode' } } }] } });
assert.equal(it.itens[0].titulo, 'Tá Escrito (Ao Vivo)'); assert.equal(it.itens[0].pos, 1); ok('iTunes por gênero (Pagode)');
assert.equal(lerDeezer({ tracks: { data: [{ title: 'A', artist: { name: 'B' } }, { title: 'C', artist: { name: 'D' } }] } }).itens[1].pos, 2); ok('Deezer: posição na playlist oficial');
const bb = '<p>Week of November 14, 2026</p><div class="o-chart-results-list-row-container"><span class="c-label  a-font-primary-bold-l">1</span><h3 id="title-of-a-story" class="c-title">\n\tPos (Em Brasilia)</h3>\n<span class="c-label  a-no-trucate">\n\tFelipe &amp; Rodrigo</span></div><div class="o-chart-results-list-row-container"><span class="c-label  a-font-primary-bold-l">2</span><h3 id="title-of-a-story" class="c-title">Flash</h3><span class="c-label">Hugo &amp; Guilherme</span></div>';
const B = lerBillboard(bb); assert.deepEqual(B.itens.map(i => [i.pos, i.titulo, i.artista]), [[1, 'Pos (Em Brasilia)', 'Felipe & Rodrigo'], [2, 'Flash', 'Hugo & Guilherme']]); assert.equal(B.data, '2026-11-14'); ok('Billboard: semana e posição lidas da página');
assert.equal(generoDe('Pagode'), 'samba'); assert.equal(generoDe('Samba'), 'samba'); assert.equal(generoDe('Sertanejo'), 'sertanejo'); assert.equal(generoDe('Hip-Hop/Rap'), 'rap'); assert.equal(generoDe('Música Cristã'), 'gospel'); assert.equal(generoDe('Brasileira'), ''); ok('gênero da Apple -> gênero do jornal (Brasileira sozinho não vira gênero nenhum)');
assert.equal(generoManual('Vitinho Imperador'), '', 'nome parecido não conta'); assert.equal(generoManual('Turma do Pagode, Grupo Menos É Mais'), 'samba'); assert.equal(generoManual('Pablo'), 'arrocha'); assert.equal(generoManual('João Gomes'), 'forro'); ok('lista do jornal só com o nome inteiro do artista (arrocha e piseiro, que a Apple não separa)');
assert.equal(classificar({ artista: 'Fulano Desconhecido' }, {}).genero, ''); ok('sem gênero conhecido a música não entra em gênero nenhum (nada inventado)');
const P = [{ id: 'spotify-br-dia', nome: 'Spotify Brasil (mais tocadas do dia)', periodo: 'dia', escopo: 'br', data: '12/11/2026', ok: true, itens: K.itens }];
const G = montarGeneros(P, { 'felipe e rodrigo': { genero: 'Sertanejo' }, 'joao gustavo e murilo': { genero: 'Sertanejo' } }, [{ ok: true, genero: 'samba', nome: 'iTunes Brasil: Pagode', id: 'it', periodo: 'dia', escopo: 'br', itens: it.itens }]);
const samba = G.find(g => g.id === 'samba'); assert.deepEqual(samba.listas[0].itens.map(i => i.pos), [84], 'Menos É Mais aparece como #84, a posição real'); assert.equal(samba.listas[1].soDoGenero, true);
assert.deepEqual(G.find(g => g.id === 'sertanejo').listas[0].itens.map(i => i.pos), [1, 2]); ok('cada gênero mostra a posição ORIGINAL na parada da fonte (#84, não #1)');
const t = Date.parse('2026-11-13T12:00:00-03:00');
const L = agruparLancamentos([
  { titulo: 'Claudia Leitte anuncia data de lançamento de novo álbum, Reimaginário', dom: 'aloalobahia.com', veic: 'Alô Alô Bahia', ts: t, link: 'a', escopo: 'br' },
  { titulo: 'Claudia Leitte divulga data do álbum Reimaginário', dom: 'atarde.com.br', veic: 'A TARDE', ts: t - 3600e3, link: 'b', escopo: 'br' },
  { titulo: 'Anitta lança clipe de funk', dom: 'x.com.br', veic: 'X', ts: t, link: 'c', escopo: 'br' },
  { titulo: 'Anitta faz show em SP', dom: 'y.com.br', veic: 'Y', ts: t, link: 'd', escopo: 'br' }], ['Anitta']);
const cl = L.find(l => /Claudia/.test(l.titulo)); assert.equal(cl.fontes, 2); assert.equal(cl.confirmado, true);
assert.ok(L.filter(l => /Anitta/.test(l.titulo)).every(l => l.fontes === 1 && l.emApuracao), 'mesma pessoa, assuntos diferentes: nada de confirmar');
ok('lançamentos: 2 sites sobre o mesmo álbum = confirmado; mesma artista com assuntos diferentes fica em apuração');
console.log('TODOS OS TESTES PASSARAM:', n);
