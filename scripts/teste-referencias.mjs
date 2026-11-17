// Teste da seção Referências (17/11, pedido B). Sem rede: fetch falso.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
process.chdir(mkdtempSync(join(tmpdir(), 'ref-')));
const AG = Date.parse('2026-11-17T12:00:00-03:00'); process.argv.push('--agora', '2026-11-17T12:00-03:00');
const atom = (nome, l) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${nome}</title><author><name>${nome}</name></author>` + l.map(([t, h, d]) => `<entry><title>${t}</title><link rel="alternate" href="${h}"/><published>${d}</published></entry>`).join('') + '</feed>';
const rss = (nome, l) => `<rss><channel><title>${nome}</title>` + l.map(([t, h, d]) => `<item><title><![CDATA[${t}]]></title><link>${h}</link><pubDate>${new Date(d).toUTCString()}</pubDate></item>`).join('') + '</channel></rss>';
const pedidos = [];
globalThis.fetch = async (url) => { const u = String(url); pedidos.push(u);
  const ok = (b) => new Response(b, { status: 200 });
  if (u === 'https://www.youtube.com/@canalbom') return ok('<html><head><link rel="alternate" type="application/rss+xml" title="RSS" href="https://www.youtube.com/feeds/videos.xml?channel_id=UCaaaaaaaaaaaaaaaaaaaaaa"></head></html>');
  if (u === 'https://www.youtube.com/@naoexiste') return new Response('', { status: 404 });
  if (u.includes('channel_id=UCaaaaaaaaaaaaaaaaaaaaaa')) return ok(atom('Canal Bom', [['Vídeo novo de hoje', 'https://www.youtube.com/watch?v=1', '2026-11-17T13:00:00Z'], ['Vídeo de 5 dias atrás', 'https://www.youtube.com/watch?v=2', '2026-11-12T13:00:00Z']]));
  if (u === 'https://site.example/feed/') return ok(rss('Site Sério', [['Matéria do site', 'https://site.example/m', '2026-11-17T14:30:00Z']]));
  if (u === 'https://quebrado.example/feed/') throw new Error('fetch failed');
  return new Response('', { status: 404 }); };
const { coletar, lerFeed, anuncioRss, PRECISA } = await import(new URL('./referencias.mjs', import.meta.url));
let n = 0; const t = (nome, f) => Promise.resolve(f()).then(() => console.log('ok ' + (++n) + ' ' + nome));

await t('lê RSS e Atom com o nome que o próprio feed declara', () => {
  const a = lerFeed(atom('Canal X', [['A', 'https://y/1', '2026-11-17T10:00:00Z']])); assert.equal(a.canal, 'Canal X'); assert.equal(a.itens[0].link, 'https://y/1');
  const r = lerFeed(rss('Site Y', [['B &amp; C', 'https://s/1', '2026-11-17T10:00:00Z']])); assert.equal(r.canal, 'Site Y'); assert.equal(r.itens[0].titulo, 'B & C');
});
await t('descobre o RSS oficial pelo anúncio da página (RSS autodiscovery), sem ler o conteúdo da página', () => {
  assert.equal(anuncioRss('<link rel="alternate" type="application/rss+xml" href="https://www.youtube.com/feeds/videos.xml?channel_id=UCx">', 'https://www.youtube.com/@a'), 'https://www.youtube.com/feeds/videos.xml?channel_id=UCx');
  assert.equal(anuncioRss('<link rel="stylesheet" href="a.css">', 'https://x'), null);
});
await t('"fulano publicou", com link e hora; só as últimas 72 h', async () => {
  const { itens, perfis } = await coletar([{ nome: 'Pessoa Boa', tipo: 'pessoa', nicho: 'empreendedorismo', pais: 'Brasil', youtube: '@canalbom', rss: ['https://site.example/feed/'], redes: ['Instagram', 'X', 'TikTok'] }]);
  assert.equal(itens.length, 2, JSON.stringify(itens));
  assert.equal(itens[0].frase, 'Pessoa Boa publicou no site'); assert.equal(itens[0].publicado, '2026-11-17T11:30'); assert.equal(itens[0].link, 'https://site.example/m');
  assert.equal(itens[1].frase, 'Pessoa Boa publicou no YouTube'); assert.equal(itens[1].canal, 'Canal Bom');
  assert.ok(!itens.some((i) => /5 dias/.test(i.titulo)));
  assert.ok(perfis[0].ativo); assert.equal(perfis[0].rotas.find((r) => r.tipo === 'YouTube').canal, 'Canal Bom');
});
await t('canal inexistente ou site fora do ar: falha visível, sem quebrar e sem inventar', async () => {
  const { itens, perfis } = await coletar([{ nome: 'Errado', tipo: 'pessoa', nicho: 'x', pais: 'Brasil', youtube: '@naoexiste', rss: ['https://quebrado.example/feed/'], redes: [] }]);
  assert.equal(itens.length, 0); assert.equal(perfis[0].ativo, false); assert.equal(perfis[0].rotas.length, 2); assert.ok(perfis[0].rotas.every((r) => !r.ok && r.erro));
});
await t('Instagram, X e TikTok listados com o que precisaria; perfil sem rota nenhuma diz o que falta', async () => {
  const { perfis } = await coletar([{ nome: 'Só redes', tipo: 'pessoa', nicho: 'x', pais: 'EUA', youtube: '', rss: [], redes: ['Instagram', 'X', 'TikTok'] }]);
  const s = perfis[0].semRota; assert.match(s[0].precisa, /endereço oficial do canal ou do site/);
  assert.equal(s.find((x) => x.rede === 'X').precisa, PRECISA.X); assert.match(PRECISA.X, /API paga/); assert.match(PRECISA.Instagram, /Meta/);
});
await t('nenhum pedido a Instagram, X ou TikTok (sem raspagem)', () => {
  assert.ok(!pedidos.some((u) => /instagram\.com|twitter\.com|x\.com|tiktok\.com/.test(u)), pedidos.join('\n'));
});
await t('a lista curada tem os perfis pedidos por ela', async () => {
  const L = JSON.parse((await import('node:fs')).readFileSync(new URL('./referencias.json', import.meta.url), 'utf8')).perfis.map((p) => p.nome).join(' | ');
  for (const nome of ['CNN', 'Globo', 'Globoplay', 'Flávio Augusto', 'Nathalia Arcuri', 'Joel Jota', 'Viola Davis']) assert.ok(L.includes(nome), nome);
});
console.log('TODOS OS TESTES PASSARAM: ' + n);
