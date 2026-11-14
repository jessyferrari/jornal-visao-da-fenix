// Testes sem rede das regras da Música: canal só de SP, mesmo fato com palavras diferentes (caso real João Nogueira, 12/11)
// e a regra de verdade (1 fonte = em apuração, sem botão de post). Uso: node scripts/teste-musica.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { montarDJF, djfNoTexto, buscasDJF, topicoSP, destino, avisoSP, podePublicar, assinarFontes, mesmoFato, pessoas } from './musica-regras.mjs';
let n = 0; const ok = (m) => { n++; console.log('ok', n, m); };
// canal SP derivado do segredo existente
assert.equal(topicoSP('fenix-musica-abc123'), 'fenix-musica-abc123-sp'); assert.equal(topicoSP(''), ''); assert.equal(topicoSP('x'.repeat(62)), '', 'acima de 64 caracteres não vale');
assert.equal(destino('sp', 'mus'), 'mus-sp'); for (const r of ['rj', 'br', 'int', '']) assert.equal(destino(r, 'mus'), 'mus'); ok('São Paulo vai só para o canal SP; RJ, Brasil e Internacional ficam no canal Música');
const av = avisoSP('https://ntfy.sh', 'mus123'); assert.equal(av.title, 'Fênix: assine o canal Música São Paulo'); assert.equal(av.actions[0].url, 'ntfy://ntfy.sh/mus123-sp?display=Fenix+Musica+SP'); assert.doesNotMatch(av.message, /mus123/, 'o texto do aviso não mostra o nome do canal'); ok('aviso de assinatura com botão ntfy:// e nome Fenix Musica SP');
// caso real: mesmo fato, palavras diferentes, um blog e O Globo
const blog = { title: 'João Nogueira completaria 85 anos nesta quinta-feira; sambista deixou um legado de grandes composições', dom: 'blogdoeloiltoncajuhy.com.br', ts: Date.parse('2026-11-12T16:20:00-03:00'), cidade: 'Rio de Janeiro' };
const globo = { title: 'João Nogueira faria 85 anos: veja qual música do sambista é a mais tocada no Brasil', dom: 'oglobo.globo.com', ts: Date.parse('2026-11-12T08:00:00-03:00') };
assert.ok(mesmoFato(blog, globo) && mesmoFato(globo, blog)); ok('João Nogueira 85 anos: blog + O Globo viram 1 fato com 2 fontes');
assert.ok(!mesmoFato(blog, { ...globo, dom: blog.dom }), 'mesmo site não conta como 2ª fonte'); ok('mesmo site não é 2ª fonte');
assert.ok(!mesmoFato(blog, { ...globo, title: 'João Nogueira faria 90 anos: homenagem' }), 'anos diferentes'); ok('aniversário com número de anos diferente não junta');
assert.ok(!mesmoFato(blog, { ...globo, title: 'Diogo Nogueira faria show de 85 anos de samba' }), 'outra pessoa'); ok('outra pessoa não junta');
assert.ok(!mesmoFato({ title: 'Thiaguinho faz show em Salvador', dom: 'a.com', ts: 0, cidade: 'Salvador' }, { title: 'Thiaguinho faz show em Recife', dom: 'b.com', ts: 0, cidade: 'Recife' })); ok('dois shows do mesmo artista em cidades diferentes não juntam');
assert.ok(!mesmoFato(blog, { ...globo, ts: blog.ts + 5 * 86400e3 })); ok('mais de 72 h de distância não junta');
assert.ok(pessoas('Show em São Paulo com Alexandre Pires').has('alexandre pires') && !pessoas('Show em São Paulo').has('sao paulo')); ok('lugar não conta como pessoa');
// regra de verdade
assert.equal(podePublicar(1), false); assert.equal(podePublicar(undefined), false); assert.equal(podePublicar(2), true);
assert.notEqual(assinarFontes('k', 'aaaaaaaaaaaa', 1), assinarFontes('k', 'aaaaaaaaaaaa', 2)); ok('1 fonte não publica; a assinatura muda com o número de fontes');
// DJs e Festivais: lista curada, nome comum só com contexto de música
const L = JSON.parse(fs.readFileSync(new URL('./djs-festivais.json', import.meta.url), 'utf8')); const D = montarDJF(L);
assert.ok(L.djs.length >= 40 && L.festivais.length >= 25); for (const x of ['Alok', 'Vintage Culture', 'Anyma', 'Martin Garrix', 'David Guetta', 'Tiësto', 'Peggy Gou', 'Black Coffee', 'Keinemusik', 'Fred again..', 'KVSH', 'Dubdogz']) assert.ok(L.djs.some(d => d.nome === x), x);
for (const x of ['Rock in Rio', 'Lollapalooza Brasil', 'Tomorrowland', 'Tomorrowland Brasil', 'Ultra Music Festival', 'Coachella', 'Primavera Sound', 'Time Warp', 'Kaballah', 'XXXPERIENCE', 'Universo Paralello', 'Afropunk', 'The Town']) assert.ok(L.festivais.some(d => d.nome === x), x); ok('lista curada com os DJs e festivais pedidos');
assert.equal(djfNoTexto('Alok anuncia novo álbum', D).nome, 'Alok'); assert.equal(djfNoTexto('Tomorrowland Brasil anuncia data de 2027', D).nome, 'Tomorrowland Brasil'); assert.equal(djfNoTexto('Tiesto lança remix', D).nome, 'Tiësto');
assert.equal(djfNoTexto('Carrie Fisher ganha homenagem', D), null); assert.equal(djfNoTexto('Café: Black Coffee é bom', D), null); assert.equal(djfNoTexto('DJ Black Coffee confirma show no Brasil', D).nome, 'Black Coffee');
assert.equal(djfNoTexto('Câmara de the town hall', D), null); assert.equal(djfNoTexto('The Town divulga line-up de 2027', D).nome, 'The Town'); ok('DJ/festival reconhecido; nome comum sem contexto de música não conta');
const B = buscasDJF(L); assert.ok(B.djs.every(g => g.length <= 8) && B.djs.flat().includes('"Alok"')); ok('buscas públicas por grupos de 8 nomes');
console.log('TODOS OS TESTES PASSARAM:', n);
