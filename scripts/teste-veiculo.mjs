// Testes: o mesmo veículo nunca confirma a si mesmo (20/11). Sem rede. Uso: node scripts/teste-veiculo.mjs
import assert from 'node:assert/strict';
import * as V from './veiculo.mjs';
import { mesmo, agrupar } from './series-regras.mjs';
import { confirmar } from './perfis-regras.mjs';
const agora = Date.parse('2026-11-20T12:00:00-03:00');
const T = 'Presidente Lula sanciona lei que amplia isenção do imposto de renda para quem ganha até R$ 5 mil';
let n = 0; const ok = (nome, f) => { f(); n++; console.log('ok', nome); };
ok('domínio: www., m., amp., mobile. do mesmo endereço viram o mesmo veículo; marcas do mesmo grupo continuam separadas', () => {
  assert.equal(V.dominioVeiculo('https://www.eldoradofm.com.br/x'), 'eldoradofm.com.br'); assert.equal(V.dominioVeiculo('eldoradofm.com.br'), 'eldoradofm.com.br');
  assert.equal(V.dominioVeiculo('https://m.folha.uol.com.br/a'), 'folha.uol.com.br'); assert.equal(V.dominioVeiculo('https://amp.theguardian.com/a'), 'theguardian.com');
  assert.notEqual(V.dominioVeiculo('https://ge.globo.com/a'), V.dominioVeiculo('https://g1.globo.com/b')); assert.ok(!V.mesmoVeiculo('https://folha.uol.com.br/a', 'https://hugogloss.uol.com.br/b')); assert.ok(!V.mesmoVeiculo('https://noticias.uol.com.br/a', 'https://noticias.r7.com/b')); assert.ok(V.mesmoVeiculo('https://www.g1.globo.com/a', 'https://g1.globo.com/b'));
  assert.equal(V.dominioVeiculo('https://news.google.com/rss/articles/x'), 'news.google.com'); assert.notEqual(V.dominioVeiculo('https://a.blogspot.com'), V.dominioVeiculo('https://b.blogspot.com'));
});
ok('nome: g1 = G1, LANCE! = Lance!, www.site = site; veículos diferentes continuam diferentes', () => {
  assert.ok(V.mesmoVeiculo('g1', 'G1')); assert.ok(V.mesmoVeiculo('LANCE!', 'Lance!')); assert.ok(V.mesmoVeiculo('www.eldoradofm.com.br', 'eldoradofm.com.br'));
  assert.ok(!V.mesmoVeiculo('g1', 'ge')); assert.ok(!V.mesmoVeiculo('BBC', 'Bloomberg')); assert.ok(!V.mesmoVeiculo('', ''));
  assert.deepEqual(V.veiculosDistintos(['G1', 'g1', 'UOL', 'uol.com.br', 'BBC']), ['G1', 'UOL', 'BBC']);
  // marcas do mesmo grupo confirmam uma à outra (decisão da Jessyca, 20/11)
  assert.equal(mesmo({ src: 'g1', title: T, ts: agora, link: 'https://g1.globo.com/a' }, { src: 'ge', title: T, ts: agora, link: 'https://ge.globo.com/b' }), true);
  assert.equal(mesmo({ src: 'Folha de S.Paulo', title: T, ts: agora, link: 'https://www1.folha.uol.com.br/a' }, { src: 'UOL', title: T, ts: agora, link: 'https://noticias.uol.com.br/b' }), true);
});
ok('mesmo fato no g1 e no G1 (ou em www. e sem www.) não vira confirmado', () => {
  assert.equal(mesmo({ src: 'g1', title: T, ts: agora, link: 'https://g1.globo.com/a' }, { src: 'G1', title: T, ts: agora, link: 'https://g1.globo.com/b' }), false);
  const g = agrupar([{ src: 'www.eldoradofm.com.br', title: T, ts: agora, link: 'https://www.eldoradofm.com.br/a' }, { src: 'eldoradofm.com.br', title: T, ts: agora + 60e3, link: 'https://eldoradofm.com.br/a' }]);
  assert.ok(g.every((x) => (x.n || 1) < 2), 'um veículo só');
  const c = confirmar({ src: 'g1', title: T, ts: agora, key: 'k', link: 'https://g1.globo.com/a' }, [{ src: 'G1', title: T, ts: agora, link: 'https://g1.globo.com/c' }]);
  assert.ok((c.n || 1) < 2, 'perfis: G1 não confirma g1');
});
ok('veículos diferentes continuam confirmando', () => {
  assert.equal(mesmo({ src: 'g1', title: T, ts: agora, link: 'https://g1.globo.com/a' }, { src: 'Poder360', title: T, ts: agora, link: 'https://www.poder360.com.br/a' }), true);
});
console.log('TODOS OS TESTES DE VEÍCULO PASSARAM:', n);
