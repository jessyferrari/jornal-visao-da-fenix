// Testes do "📈 Subindo agora" (3+ veículos em 30 min) e da via rápida (fontes rápidas a cada ~90 s), sem rede. Uso: node scripts/teste-subindo-via-rapida.mjs
import assert from 'node:assert/strict'; import { subindo, podeSubindo, marcarSubindo, textoSubindo } from './subindo.mjs'; import { viaRapida } from './via-rapida.mjs';
const H = Date.parse('2026-11-17T15:00:00Z'), m = (x) => H - x * 60e3;   // 12:00 em Brasília
const fato = (n, mins, k = 'a') => ({ key: k + 0, src: 'V0', link: 'https://v0.com/' + k, ts: m(mins[0]), grp: mins.slice(1).map((t, j) => ({ key: k + (j + 1), src: 'V' + (j + 1), link: 'https://v' + (j + 1) + '.com/' + k, ts: m(t) })), title: 'Fato ' + k });
let E = {};
assert.equal(subindo([fato(2, [20, 10])], E, { agora: H }).length, 0, '2 veículos não é subindo');
assert.equal(subindo([fato(3, [80, 70, 10])], E, { agora: H }).length, 0, '3º veículo fora dos 30 min não conta');
assert.equal(subindo([fato(3, [200, 190, 185])], E, { agora: H }).length, 0, 'fato velho (mais de 90 min) não avisa');
const s = subindo([fato(3, [25, 15, 3], 'b'), { ...fato(3, [25, 15, 3], 'b'), grp: [] }], E, { agora: H });
assert.equal(s.length, 1); assert.equal(s[0].dentro.length, 3); assert.equal(s[0].minutos, 22); assert.match(textoSubindo(s[0]), /^📈 3 veículos em 22 min: V0 11:35, V1 11:45, V2 11:57/);
assert.ok(podeSubindo(E, { agora: H })); marcarSubindo(E, s[0], H);
assert.equal(subindo([fato(3, [25, 15, 3], 'b')], E, { agora: H }).length, 0, 'mesmo fato não avisa 2 vezes');
for (let k = 0; k < 5; k++) marcarSubindo(E, { chaves: ['z' + k] }, H); assert.equal(podeSubindo(E, { agora: H }), false, 'teto de 6 por dia');
assert.equal(podeSubindo({}, { agora: Date.parse('2026-11-17T08:30:00Z') }), false, 'madrugada (05:30) não avisa');
console.log('subindo agora: 7 verificações OK');
// via rápida: 2 fontes falsas; a 1ª volta não tem nada (304), na 2ª aparece matéria nova -> encerra cedo
let volta = 0, t = H; const xml = (links) => '<rss><channel>' + links.map((l) => `<item><title>${l}</title><link>https://ex.com/${l}</link><pubDate>${new Date(t - 60e3).toUTCString()}</pubDate></item>`).join('') + '</channel></rss>';
const buscar = async (u, o) => { const nova = volta >= 2 && u.includes('a.') ; if (volta >= 1 && !nova && o.headers['If-None-Match']) return { status: 304, ok: false, headers: new Map() };
  return { status: 200, ok: true, headers: new Map([['etag', 'e1']]), text: async () => xml(nova ? ['velha', 'nova-agora'] : ['velha']) }; };
const r = await viaRapida({ fontes: [['A', 'https://a.com/f'], ['B', 'https://b.com/f']], totalSeg: 180, voltaSeg: 90, buscar, dormir: async (ms) => { volta++; t += ms; }, agora: () => t, log: () => {} });
assert.deepEqual([r.novidade, r.volta, r.novos], [true, 2, 1], 'novidade na 2ª volta encerra a espera');
volta = -99; const r2 = await viaRapida({ fontes: [['B', 'https://b.com/f']], totalSeg: 180, voltaSeg: 90, buscar, dormir: async (ms) => { t += ms; }, agora: () => t, log: () => {} });
assert.deepEqual([r2.novidade, r2.volta], [false, 2], 'sem novidade espera as 2 voltas (180 s) e sai');
console.log('via rápida: 2 verificações OK\nTESTE SUBINDO + VIA RÁPIDA OK');
