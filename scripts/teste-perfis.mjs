// Testes da urgência dos perfis do agente (20/11). Uso: node scripts/teste-perfis.mjs  (nada chega no celular: ntfy falso local)
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import { createHmac } from 'node:crypto';
import * as P from './perfis-regras.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url)); let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const rss = (canal, l) => '<?xml version="1.0"?><rss version="2.0"><channel><title>' + canal + '</title>' + l.map(([t, u, ts]) => '<item><title><![CDATA[' + t + ']]></title><link>' + u + '</link>' + (ts ? '<pubDate>' + new Date(ts).toUTCString() + '</pubDate>' : '') + '</item>').join('') + '</channel></rss>';
const atom = (canal, l) => '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>' + canal + '</title><author><name>' + canal + '</name></author>' + l.map(([t, u, ts]) => '<entry><title>' + t + '</title><link rel="alternate" href="' + u + '"/><published>' + new Date(ts).toISOString() + '</published></entry>').join('') + '</feed>';
const LISTA = JSON.parse(fs.readFileSync(path.join(AQUI, 'perfis-urgencia.json'), 'utf8')).perfis;
const agora = Date.parse('2026-11-20T12:00:00-03:00');

// 1) lista real: os perfis do estudo do agente estão na urgência, com rota pública; CazéTV já na urgência, fora do estudo até ela confirmar
{ const nomes = LISTA.map((p) => p.nome); for (const x of ['Hugo Gloss', 'Forbes Brasil', 'Fórmula 1', 'CazéTV']) assert.ok(nomes.includes(x), x);
  for (const p of LISTA) { assert.ok(p.rotas.length || p.google, p.nome + ' sem rota'); for (const r of p.rotas) assert.match(r.url, /^https:\/\//); assert.ok(!JSON.stringify(p).match(/instagram\.com\/|api\.(twitter|x)\.com/), 'nenhuma rota de Instagram/X'); }
  assert.equal(LISTA.find((p) => p.nome === 'CazéTV').estudoInstagram, false); ok('lista de perfis e rotas públicas'); }
// 2) leitura: RSS, Atom (YouTube), confere, site sem hora, Google Notícias e ruído de "onde assistir"
{ const hg = LISTA[0], r = hg.rotas[0];
  const a = P.lerFeed(rss('Hugo Gloss', [['Título A', 'https://hugogloss.uol.com.br/a/?utm_source=x', agora - 60e3], ['Sem hora', 'https://hugogloss.uol.com.br/b/', 0]]), hg, r);
  assert.equal(a.itens.length, 1); assert.equal(a.itens[0].key, 'https://hugogloss.uol.com.br/a'); assert.ok(P.confere('Hugo Gloss', a.canal)); assert.ok(!P.confere('Hugo Gloss', 'Outro Site'));
  const f1 = LISTA.find((p) => p.nome === 'Fórmula 1'); const b = P.lerFeed(rss('Latest F1 News', [['Sem hora', 'https://www.formula1.com/x', 0]]), f1, f1.rotas[0]); assert.equal(b.itens.length, 1); assert.ok(b.itens[0].semHora);
  const yt = P.lerFeed(atom('CazéTV', [['GOLAÇO', 'https://www.youtube.com/watch?v=1', agora]]), LISTA[3], LISTA[3].rotas[0]); assert.equal(yt.itens.length, 1); assert.equal(yt.canal, 'CazéTV');
  const g = P.lerGoogle('<rss version="2.0"><channel><item><title>CazéTV fecha acordo com a NBA - ge</title><link>https://news.google.com/a</link><pubDate>' + new Date(agora).toUTCString() + '</pubDate><source url="https://ge.globo.com">ge</source></item><item><title>Jogos de hoje na CazéTV: onde assistir - Site X</title><link>https://news.google.com/b</link><pubDate>' + new Date(agora).toUTCString() + '</pubDate><source url="https://x">Site X</source></item></channel></rss>');
  assert.equal(g.length, 2); assert.equal(g[0].title, 'CazéTV fecha acordo com a NBA'); assert.equal(g[0].src, 'ge');
  assert.deepEqual(g.filter((i) => P.mencaoValida(i, 'CazéTV')).map((i) => i.src), ['ge']); assert.equal(P.lerGoogle('<html>Sorry</html>'), null);
  ok('RSS, Atom, confere, sem hora, Google Notícias e ruído'); }
// 3) verdade e bateria: 1 fonte = em apuração; 2+ = confirmado; nunca prioridade 4/5; exclusivo só como "<veículo> diz que é exclusivo"; nunca Olimpia primeiro
{ const base = { src: 'Hugo Gloss', title: 'Exclusivo: Anitta anuncia fim da turnê Funk Generation e se aposenta dos palcos', link: 'https://hugogloss.uol.com.br/anitta', key: 'https://hugogloss.uol.com.br/anitta', ts: agora - 10 * 60e3, rota: 'site' };
  const g1 = { src: 'g1', title: 'Anitta anuncia fim da turnê Funk Generation e diz que vai se aposentar dos palcos', link: 'https://g1.globo.com/anitta', ts: agora - 5 * 60e3 };
  const um = { ...base, ...P.confirmar(base, [g1].slice(0, 0)) }; assert.equal(um.n, 1);
  const c1 = P.classificar(um, { agora }); assert.equal(c1.confirmado, false); assert.equal(c1.prioridade, 2, 'forte com 1 fonte: silencioso');
  const a1 = P.montarAviso(um, c1, { agora }); assert.match(a1.title, /^🔎 Hugo Gloss publicou: /); assert.match(a1.message, /Em apuração/); assert.match(a1.message, /⭐ Hugo Gloss diz que é exclusivo/);
  const b1 = P.botoes(um, c1, { CMD: 'cmd', ASS: 'k' }); assert.ok(!JSON.stringify(b1).includes('\\"acao\\":\\"publicar'), '1 fonte nunca tem Sim, publicar'); assert.equal(b1[0].label, '🔎 Apurar no agente');
  const dois = { ...base, ...P.confirmar(base, [g1]) }; assert.equal(dois.n, 2);
  const c2 = P.classificar(dois, { agora }); assert.equal(c2.confirmado, true); assert.ok(['vale', 'nao-deixe'].includes(c2.pot.faixa), c2.pot.rotulo); assert.equal(c2.prioridade, 3, 'Vale postar confirmado toca som (3)');
  const a2 = P.montarAviso(dois, c2, { agora }); assert.match(a2.message, /✅ 2 veículos: Hugo Gloss, g1/); assert.match(a2.message, /Hugo Gloss publicou primeiro às 11:50/);
  for (const t of [a1.title, a1.message, a2.title, a2.message]) { assert.ok(!/olimpia/i.test(t), 'nunca fala da Olimpia'); assert.ok(!/(^|[^ ])EXCLUSIVO|primeiro a noticiar/i.test(t.replace(/Exclusivo: Anitta/, '')), t); }
  const b2 = P.botoes(dois, c2, { CMD: 'cmd', ASS: 'k', alegado: true }); const corpo = JSON.parse(b2[0].body); assert.equal(b2[0].label, '✅ Sim, publicar'); assert.equal(corpo.fontes, 2);
  assert.equal(corpo.fsig, createHmac('sha256', 'k').update(corpo.id + '|fontes=2').digest('hex').slice(0, 32)); assert.equal(corpo.selo.tipo, 'exclusivo'); assert.equal(corpo.origem, 'perfis');
  const fraco = { src: 'Forbes Brasil', title: 'Seria este champanhe a Birkin dos vinhos?', link: 'https://forbes.com.br/x', key: 'https://forbes.com.br/x', ts: agora, n: 1, grp: [] };
  assert.equal(P.classificar(fraco, { agora }).prioridade, 0, 'fraco com 1 fonte: nada');
  for (const x of [um, dois, fraco]) assert.ok(P.classificar(x, { agora }).prioridade <= 3, 'nunca 4 ou 5');
  const D = P.contadores({}, agora); assert.deepEqual(P.destino(dois, c2, D, { agora, rodada: 0 }), { canal: 'celular', prioridade: 3 });
  assert.deepEqual(P.destino(dois, c2, D, { agora: Date.parse('2026-11-20T03:00:00-03:00'), rodada: 0 }), { canal: 'celular', prioridade: 3 }, 'madrugada (t330): Vale postar confirmado chega no celular 24 h');
  assert.deepEqual(P.destino(dois, { ...c2, prioridade: 2 }, D, { agora: Date.parse('2026-11-20T03:00:00-03:00'), rodada: 0 }), { canal: 'mesa', prioridade: 1 }, 'madrugada: em apuração (silencioso) vai só para a Mesa');
  assert.deepEqual(P.destino(dois, c2, { ...D, celular: 12 }, { agora, rodada: 0 }), { canal: 'mesa', prioridade: 1 }, 'teto do celular: vai para a Mesa');
  ok('regra da verdade, exclusivo citado, prioridades da bateria, madrugada e tetos'); }
// 4) ponta a ponta: perfis.mjs com feeds locais e ntfy falso
await (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perfis-')); const f = (nome, x) => { const p = path.join(dir, nome); fs.writeFileSync(p, x); return p; };
  const HG = 'https://hugogloss.uol.com.br/feed/', FB = 'https://forbes.com.br/feed/';
  const loc = (hg, fb) => ({ [HG]: f('hg-' + Math.random() + '.xml', rss('Hugo Gloss', hg)), [FB]: f('fb-' + Math.random() + '.xml', rss('Forbes Brasil', fb)) });
  const velho = [['Matéria antiga do Hugo', 'https://hugogloss.uol.com.br/antiga', agora - 30 * 60e3]];
  let recebidos = [], falhar = 0;
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { if (falhar > 0) { falhar--; r.writeHead(429); return r.end(); } recebidos.push(JSON.parse(b)); r.writeHead(200); r.end('{}'); }); });
  await new Promise((z) => srv.listen(0, z)); const SRV = 'http://127.0.0.1:' + srv.address().port;
  const roda = (locais, min, extra = ['--sem-google']) => new Promise((z) => { const p = spawn(process.execPath, [path.join(AQUI, 'perfis.mjs'), '--agora', new Date(agora + min * 60e3).toISOString(), '--sem-traducao', ...extra], { cwd: dir, env: { ...process.env, PERFIS_FONTES_LOCAIS: JSON.stringify(locais), NTFY_TOPIC: 'jornal', NTFY_TOPIC_COMANDO: 'cmd', NTFY_ASSINATURA: 'k', NTFY_SERVIDOR: SRV, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '10', NTFY_PRAZO_MS: '3000' } }); let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => z({ c, o })); });
  let r = await roda(loc(velho, []), 0); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 0, '1ª rodada: só cria o estado'); assert.match(r.o, /primeira rodada/);
  const J = JSON.parse(fs.readFileSync(path.join(dir, 'perfis.json'), 'utf8')); assert.equal(J.itens.length, 1); assert.equal(J.itens[0].emApuracao, true); assert.ok(J.perfis.find((p) => p.nome === 'Hugo Gloss').rotas[0].ok);
  // 2ª rodada: Hugo Gloss publica algo forte; ntfy recusa 5 vezes: nada marcado; 3ª: sai silencioso (2), em apuração, sem Sim, publicar
  const forte = [...velho, ['Exclusivo: Anitta anuncia fim da turnê Funk Generation e se aposenta dos palcos', 'https://hugogloss.uol.com.br/anitta', agora + 4 * 60e3]];
  const fraco = [['Seria este champanhe a Birkin dos vinhos?', 'https://forbes.com.br/champanhe', agora + 4 * 60e3]];
  falhar = 5; r = await roda(loc(forte, fraco), 5); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 0); assert.match(r.o, /NÃO SAÍRAM/);
  r = await roda(loc(forte, fraco), 10); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 1, r.o + JSON.stringify(recebidos.map((x) => x.title)));
  let m = recebidos[0]; assert.equal(m.topic, 'jornal'); assert.equal(m.priority, 2); assert.match(m.title, /^🔎 Hugo Gloss publicou: Exclusivo: Anitta/); assert.ok(!m.actions.some((a) => /publicar/.test(a.body || '')));
  // 4ª rodada: o g1 (lido pela edição geral do jornal) dá o mesmo fato: chega "Confirmado" com som (3) e Sim, publicar
  fs.writeFileSync(path.join(dir, 'edicao.json'), JSON.stringify({ stories: [{ src: 'g1', title: 'Anitta anuncia fim da turnê Funk Generation e diz que vai se aposentar dos palcos', link: 'https://g1.globo.com/anitta', pub: '2026-11-20T12:12' }] }));
  recebidos = []; r = await roda(loc(forte, fraco), 15); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 1, r.o);
  m = recebidos[0]; assert.equal(m.priority, 3); assert.match(m.title, /% · Hugo Gloss publicou: /); assert.equal(m.actions[0].label, '✅ Sim, publicar'); assert.match(m.message, /✅ 2 veículos: Hugo Gloss, g1/); assert.ok(!('click' in m), 'toque abre o ntfy com os botões');
  recebidos = []; r = await roda(loc(forte, fraco), 20); assert.equal(recebidos.length, 0, 'não repete');
  // madrugada (t330): confirmado novo com nota de Vale postar chega no celular 24 h, com som e sem prioridade 5
  const noite = Date.parse('2026-11-21T02:00:00-03:00'), dm = (noite - agora) / 60e3;
  const n1 = [...forte, ['Neymar anuncia aposentadoria do futebol e emociona torcida no Santos', 'https://hugogloss.uol.com.br/neymar', noite - 5 * 60e3]];
  fs.writeFileSync(path.join(dir, 'edicao.json'), JSON.stringify({ stories: [{ src: 'ge', title: 'Neymar anuncia aposentadoria do futebol e se despede da torcida do Santos', link: 'https://ge.globo.com/neymar', pub: '2026-11-21T01:57' }] }));
  recebidos = []; r = await roda(loc(n1, fraco), dm); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 1, r.o); assert.equal(recebidos[0].topic, 'jornal', r.o); assert.ok(recebidos[0].priority >= 3 && recebidos[0].priority <= 4, 'Vale postar de madrugada: som (3/4), nunca 5');
  // Google Notícias: forte com 1 fonte procura a 2ª fonte na busca pública; Folha confirma e já chega "Confirmado"
  const tarde = Date.parse('2026-11-21T15:00:00-03:00'), dt = (tarde - agora) / 60e3;
  const g = f('google.xml', '<rss version="2.0"><channel><item><title>Ivete Sangalo anuncia fim da banda e se despede dos palcos após 30 anos - Folha de S.Paulo</title><link>https://news.google.com/folha</link><pubDate>' + new Date(tarde - 2 * 60e3).toUTCString() + '</pubDate><source url="https://www1.folha.uol.com.br">Folha de S.Paulo</source></item></channel></rss>');
  fs.writeFileSync(path.join(dir, 'edicao.json'), '{}');
  const iv = [...n1, ['Ivete Sangalo anuncia fim da banda e se despede dos palcos com show histórico', 'https://hugogloss.uol.com.br/ivete', tarde - 4 * 60e3]];
  recebidos = []; r = await roda({ ...loc(iv, fraco), google: g }, dt, []); assert.equal(r.c, 0, r.o); assert.match(r.o, /buscas Google 1/);
  const ivm = recebidos.find((x) => /Ivete/.test(x.title)); assert.ok(ivm, r.o + JSON.stringify(recebidos.map((x) => x.title))); assert.match(ivm.message, /✅ 2 veículos: Hugo Gloss, Folha de S\.Paulo/); assert.equal(ivm.actions[0].label, '✅ Sim, publicar');
  srv.close(); ok('Google Notícias confirma a 2ª fonte'); ok('ponta a ponta: 1ª rodada sem aviso, 429 sem perder, em apuração silencioso, confirmação com som e Sim, publicar, sem repetir, Vale postar de madrugada no celular (t330)');
})();
console.log('\nTODOS OS TESTES DA URGÊNCIA DOS PERFIS PASSARAM:', n);
