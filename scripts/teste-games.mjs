// Testes da seção 🎮 Games (20/11). Sem rede: fontes e ntfy falsos. Uso: node scripts/teste-games.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawn } from 'node:child_process'; import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from './games-regras.mjs';
import * as X from './exclusivo.mjs';
import { itensGames } from './busca-arquivo.mjs';
import { prioridadeNota, PRIORIDADE_EXCLUSIVO } from './potencial.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
let n = 0; const ok = (nome, f) => { f(); n++; console.log('ok', nome); };
const rss = (itens) => '<?xml version="1.0" encoding="UTF-8"?><rss><channel>' + itens.map(([t, l, d, c]) => '<item><title><![CDATA[' + t + ']]></title><link>' + l + '</link><pubDate>' + new Date(d).toUTCString() + '</pubDate>' + (c ? '<category>' + c + '</category>' : '') + '<description>Resumo de teste.</description></item>').join('') + '</channel></rss>';
const T0 = Date.parse('2026-11-20T12:00:00-03:00'), CMD = 'cmd-teste', ASS = 'k'.repeat(48);
const it = (src, title, link, ts = T0, extra = {}) => ({ src, title, link, key: S.canon(link), ts, sum: '', tipo: 'dedicada', lang: '', ...extra });

ok('fontes: 34 feeds de 30 veículos; edições do mesmo veículo (IGN e IGN Brasil etc.) contam como 1', () => {
  assert.equal(S.FONTES.length, 34); assert.equal(S.VEICULOS.length, 30);
  assert.equal(S.FONTES.filter((f) => f[0] === 'IGN').length, 2); assert.equal(S.FONTES.filter((f) => f[0] === 'PlayStation Blog').length, 2);
  for (const v of ['IGN', 'GameSpot', 'Eurogamer', 'Kotaku', 'Polygon', 'PlayStation Blog', 'Xbox Wire', 'Nintendo Life', 'g1 Games']) assert.ok(S.VEICULOS.includes(v), v);
});
ok('Voxel e Omelete Games: só a editoria certa entra, com o nome certo do veículo (TecMundo e séries ficam de fora)', () => {
  const vx = S.FONTES.find((f) => f[0] === 'Voxel'), om = S.FONTES.find((f) => f[0] === 'Omelete');
  const xml = rss([['GTA 6 tem quantas missões? Veja a lista', 'https://www.estadao.com.br/tecmundo/voxel/gta-6-missoes/', T0], ['O que comprar na Black Friday', 'https://www.estadao.com.br/tecmundo/guia-de-compras/black-friday/', T0], ['Falhas no nginx', 'https://www.estadao.com.br/tecmundo/ciberseguranca/nginx/', T0]]);
  const l = S.lerFonte(xml, vx); assert.equal(l.length, 1); assert.equal(l[0].src, 'Voxel'); assert.match(l[0].link, /\/tecmundo\/voxel\//);
  const sm = '<?xml version="1.0"?><urlset xmlns:news="x">' + [['https://www.omelete.com.br/games/gta-6-musicas', 'GTA 6 e as músicas brasileiras'], ['https://www.omelete.com.br/gta-6/carro-brian', 'Carro de Brian está no GTA 6'], ['https://www.omelete.com.br/series-tv/terra-da-mafia', 'Terra da Máfia 3ª temporada']].map(([u, t]) => '<url><loc>' + u + '</loc><news:news><news:publication_date>2026-11-20T11:00:00-03:00</news:publication_date><news:title>' + t + '</news:title></news:news></url>').join('') + '</urlset>';
  const o = S.lerFonte(sm, om); assert.equal(o.length, 2); assert.ok(o.every((i) => i.src === 'Omelete')); assert.ok(!o.some((i) => /series-tv/.test(i.link)));
  assert.equal(S.lerFonte(xml, ['X', '', 'dedicada', '']).length, 3);   // fonte sem filtro: tudo entra, como antes
  // a mesma matéria do Voxel também vem no feed geral do TecMundo: fica 1 só, como Voxel, com o horário mais cedo
  const tec = S.lerFonte(rss([['GTA 6 tem quantas missões? Veja a lista', 'https://www.estadao.com.br/tecmundo/voxel/gta-6-missoes/', T0 - 60e3]]), ['TecMundo', '', 'geral', '']);
  for (const ordem of [[...tec, ...l], [...l, ...tec]]) { const j = S.juntarPorLink(ordem); assert.equal(j.length, 1); assert.equal(j[0].src, 'Voxel'); assert.equal(j[0].ts, T0 - 60e3); }
});
ok('filtro: site geral só entra com assunto de game; guia, código e aposta ficam de fora', () => {
  assert.ok(S.ehGame(it('TecMundo', 'Sony anuncia novo PS5 Pro mais barato', 'https://tecmundo.com.br/a', T0, { tipo: 'geral' })));
  assert.ok(!S.ehGame(it('TecMundo', 'O que comprar na Black Friday do Mercado Livre', 'https://tecmundo.com.br/b', T0, { tipo: 'geral' })));
  assert.ok(!S.ehGame(it('TecMundo', 'Banco Central anuncia nova regra do Pix', 'https://tecmundo.com.br/c', T0, { tipo: 'geral' })));
  assert.ok(!S.ehGame(it('VGC', 'GTA 6: How to use the first-person mode glitch', 'https://www.videogameschronicle.com/guide/gta-6-first-person/')));
  assert.ok(!S.ehGame(it('Dexerto', 'Fortnite redeem codes for November', 'https://dexerto.com/fortnite/fortnite-redeem-codes-x/', T0, { tipo: 'geral' })));
  assert.ok(S.ehGame(it('IGN', 'GTA 6 vende 25 milhões no primeiro dia', 'https://br.ign.com/gta/1/x')));
});
ok('plataforma pelo título e caminho (sem pista = Games); GTA 6 tem a sua', () => {
  const p = (t, l = 'https://a.com/b') => S.plataforma(it('X', t, l));
  assert.equal(p('GTA 6 bate recorde de vendas'), 'GTA 6'); assert.equal(p('Grand Theft Auto VI ganha patch'), 'GTA 6');
  assert.equal(p('Nintendo Switch 2 vende 10 milhões'), 'Nintendo'); assert.equal(p('PS5 Pro recebe atualização'), 'PlayStation');
  assert.equal(p('Xbox Game Pass recebe 6 jogos'), 'Xbox'); assert.equal(p('Steam bate recorde de jogadores'), 'PC');
  assert.equal(p('LOUD vence final do CBLOL'), 'eSports'); assert.equal(p('Estúdio indie anuncia jogo novo'), 'Games');
  assert.ok(S.trailer(it('X', 'Novo trailer de Wolverine', 'https://a.com/w'))); assert.ok(!S.trailer(it('X', 'Vendas de console caem', 'https://a.com/v')));
});
ok('Opinião/Review à parte; furo marcado como exclusivo segue como notícia', () => {
  assert.ok(S.ehOpiniao(it('IGN', 'Review: Stellar Blade 2 é melhor', 'https://br.ign.com/review/x')));
  assert.ok(S.ehOpiniao(it('Critical Hits', 'Análise: GTA 6 é tudo isso?', 'https://criticalhits.com.br/games/x')));
  assert.ok(!S.ehOpiniao(it('Kotaku', 'Exclusive: Rockstar prepara DLC de GTA 6', 'https://kotaku.com/opinion/x')));
  assert.ok(!S.ehOpiniao(it('IGN', 'GTA 6 vende 25 milhões', 'https://br.ign.com/gta/x')));
});
ok('mesmo fato: 2 veículos = confirmado; IGN e IGN Brasil = 1 veículo (nunca confirma sozinho)', () => {
  const g = S.agrupar([it('IGN', 'Rockstar confirma que GTA 6 vendeu 25 milhões de cópias no primeiro dia', 'https://br.ign.com/a', T0), it('GameSpot', 'Take-Two e Rockstar confirmam que GTA 6 vendeu 25 milhões de cópias no primeiro dia', 'https://gamespot.com/b', T0 + 600e3)]);
  assert.equal(g.length, 1); assert.equal(g[0].n, 2); const v = S.vista(g[0], { N: 28, agora: T0 }); assert.equal(v.confirmado, true); assert.deepEqual(v.primeiro, { veiculo: 'IGN', hora: '12:00' }); assert.equal(v.modalidade, 'GTA 6');
  const um = S.agrupar([it('IGN', 'GTA 6 vende 25 milhões de cópias no primeiro dia', 'https://br.ign.com/a', T0), it('IGN', 'GTA 6 vende 25 milhões de cópias no primeiro dia', 'https://www.ign.com/a', T0 + 600e3)]);
  assert.ok(um.every((x) => x.n === 1), 'duas edições da IGN não confirmam');
});
ok('selo e botões: 1 fonte "Exclusivo" = possível exclusivo com "<veículo> diz que é exclusivo", sem Sim, publicar; 2 fontes = Sim, publicar assinado, origem games', () => {
  const um = S.agrupar([it('Insider Gaming', 'Exclusivo: Rockstar prepara modo online de GTA 6 para 2027', 'https://insider-gaming.com/x')])[0];
  const v = S.vista(um, { N: 28, agora: T0 }); assert.match(v.selo.texto, /Insider Gaming diz que é exclusivo/); assert.doesNotMatch(JSON.stringify(v), /Olimpia/i);
  const b1 = S.botoes(um, { CMD, ASS, pagina: 'p' }); assert.deepEqual(b1.map((b) => b.label), ['🔎 Apurar no agente', 'Ver notícia', 'Não']); assert.equal(JSON.parse(b1[0].body).origem, 'games');
  const dois = S.agrupar([it('Insider Gaming', 'Exclusivo: Rockstar prepara modo online de GTA 6 para 2027', 'https://insider-gaming.com/x'), it('Kotaku', 'Rockstar prepara modo online de GTA 6 para 2027, diz site', 'https://kotaku.com/y', T0 + 900e3)])[0];
  const b = S.botoes(dois, { CMD, ASS, pagina: 'p' }); const c = JSON.parse(b[0].body);
  assert.equal(b[0].label, '✅ Sim, publicar'); assert.equal(c.origem, 'games'); assert.equal(c.fsig, createHmac('sha256', ASS).update(c.id + '|fontes=2').digest('hex').slice(0, 32)); assert.equal(c.ssig, X.assinarSelo(ASS, c.id, c.selo));
});
ok('prioridades (20/11): Vale postar = 3 (som), Não deixe = 4 (som, sem rajada), exclusivo confirmado = 4, nunca 5', () => {
  assert.equal(prioridadeNota({ faixa: 'vale', provisoria: false }), 3); assert.equal(prioridadeNota({ faixa: 'nao-deixe', provisoria: false }), 4);
  assert.equal(prioridadeNota({ faixa: 'opcional', provisoria: false }), 1); assert.equal(prioridadeNota(null, 5), 4); assert.equal(PRIORIDADE_EXCLUSIVO, 4);
});
ok('convite único do canal Games: 1 botão, prioridade 2 (sem som), só de dia', () => {
  assert.equal(S.topicoGames('abc_1'), 'abc_1-games'); assert.equal(S.topicoGames(''), ''); assert.equal(S.topicoGames('a b'), '');
  const a = S.avisoGames('https://ntfy.sh', 'abc'); assert.equal(a.priority, 2);
  assert.deepEqual(a.actions.map((x) => [x.label, x.url]), [['Assinar Games', 'ntfy://ntfy.sh/abc-games?display=Fenix+Games']]);
  assert.ok(S.podeConvidar(7) && S.podeConvidar(21) && !S.podeConvidar(22) && !S.podeConvidar(3));
});
ok('busca: games.json entra na seção games, com trailers e Opinião/Review', () => {
  const l = itensGames({ destaques: [{ titulo: 'GTA 6 vende 25 milhões', link: 'https://br.ign.com/a', publicado: '2026-11-20T12:00', veiculo: 'IGN', fontes: 2, modalidade: 'GTA 6', tambemEm: [{ veiculo: 'GameSpot', titulo: 'GTA 6 sells 25 million', link: 'https://gamespot.com/b' }] }], trailers: [{ titulo: 'Trailer de Wolverine', link: 'https://kotaku.com/w', publicado: '2026-11-20T11:00', veiculo: 'Kotaku', fontes: 1, modalidade: 'PlayStation' }], opiniao: [{ titulo: 'Review: GTA 6', link: 'https://polygon.com/r', publicado: '2026-11-20T10:00', veiculo: 'Polygon', tipo: 'Opinião/Review', modalidade: 'GTA 6' }] });
  assert.equal(l.length, 4); assert.ok(l.every((x) => x.c === 'games')); assert.match(l[0].s, /^Games · GTA 6/); assert.match(l[3].s, /Opinião\/Review/);
});

// ponta a ponta: games.mjs com fontes locais e ntfy falso (nada chega no celular)
await (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'games-')); const agora = Date.parse('2026-11-20T11:30:00-03:00');
  const f = (nome, xml) => { const p = path.join(dir, nome + '.xml'); fs.writeFileSync(p, xml); return p; };
  const fontes1 = { 'IGN Brasil': f('ign1', rss([['GTA 6 vende 25 milhões de cópias no primeiro dia', 'https://br.ign.com/gta/a', agora - 50 * 60e3]])),
    'Critical Hits': f('ch1', rss([['Exclusivo: Rockstar prepara modo online de GTA 6 para 2027', 'https://criticalhits.com.br/games/rockstar-online', agora - 20 * 60e3], ['Review: Stellar Blade 2 vale a pena', 'https://criticalhits.com.br/review/stellar', agora - 30 * 60e3]])) };
  let recebidos = [], falhar = 0;
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { if (falhar > 0) { falhar--; r.writeHead(429); return r.end(); } recebidos.push(JSON.parse(b)); r.writeHead(200); r.end('{}'); }); });
  await new Promise((z) => srv.listen(0, z)); const SRV = 'http://127.0.0.1:' + srv.address().port;
  const roda = (fontes, min) => new Promise((z) => { const p = spawn(process.execPath, [path.join(AQUI, 'games.mjs'), '--agora', new Date(agora + min * 60e3).toISOString(), '--sem-google', '--sem-traducao'], { cwd: dir, env: { ...process.env, GAMES_FONTES_LOCAIS: JSON.stringify(fontes), NTFY_TOPIC_MUSICA: 'mus', NTFY_TOPIC_COMANDO: CMD, NTFY_ASSINATURA: ASS, NTFY_SERVIDOR: SRV, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '10' } }); let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => z({ c, o })); });
  // 1ª rodada: só o convite (1 botão, prioridade 2, canal Música); nenhum aviso antigo
  let r = await roda(fontes1, 0); assert.equal(r.c, 0, r.o);
  assert.equal(recebidos.length, 1, JSON.stringify(recebidos.map((x) => x.title))); assert.equal(recebidos[0].topic, 'mus'); assert.equal(recebidos[0].title, 'Fênix: assine o canal Games'); assert.equal(recebidos[0].priority, 2);
  assert.deepEqual(recebidos[0].actions.map((a) => a.url.replace(/:\d+\//, '/')), ['ntfy://127.0.0.1/mus-games?display=Fenix+Games']);
  const J1 = JSON.parse(fs.readFileSync(path.join(dir, 'games.json'), 'utf8'));
  assert.equal(J1.exclusivos.length, 1); assert.match(J1.exclusivos[0].selo.texto, /Critical Hits diz que é exclusivo/); assert.match(J1.exclusivos[0].selo.texto, /só 1 de 2 veículos monitorados publicou até 11:30$/);
  assert.equal(J1.opiniao.length, 1); assert.equal(J1.opiniao[0].tipo, 'Opinião/Review'); assert.ok(!J1.brasil.some((x) => /Stellar/.test(x.titulo)), 'review não entra como notícia');
  assert.deepEqual(J1.modalidades, S.PLATAFORMAS);
  // 2ª rodada: novo exclusivo e o ntfy recusa 5 vezes: nada marcado; 3ª rodada sai; o convite não repete
  const fontes2 = { ...fontes1, 'MeuPlayStation': f('mp2', rss([['Exclusivo: Sony prepara State of Play para dezembro', 'https://meups.com.br/noticias/state-of-play', agora + 5 * 60e3]])) };
  recebidos = []; falhar = 5; r = await roda(fontes2, 10); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 0); assert.match(r.o, /NÃO SAÍRAM/);
  r = await roda(fontes2, 20); const ex = recebidos.filter((x) => /^⭐ Possível exclusivo: Exclusivo: Sony/.test(x.title)); assert.equal(ex.length, 1, r.o + JSON.stringify(recebidos.map((x) => x.title)));
  assert.equal(ex[0].topic, 'mus-games'); assert.equal(ex[0].priority, 2); assert.ok(!JSON.stringify(ex[0].actions).includes('"acao\\":\\"publicar'), '1 fonte: sem Sim, publicar'); assert.ok(!recebidos.some((x) => /assine/.test(x.title)), 'convite não repete');
  // 4ª rodada: IGN confirma o furo do Critical Hits: "⭐ EXCLUSIVO confirmado" com Sim, publicar, prioridade 4 (som, nunca 5)
  const fontes3 = { ...fontes2, 'IGN Brasil': f('ign3', rss([['GTA 6 vende 25 milhões de cópias no primeiro dia', 'https://br.ign.com/gta/a', agora - 50 * 60e3], ['Rockstar prepara modo online de GTA 6 para 2027, diz site', 'https://br.ign.com/gta/online', agora + 25 * 60e3]])) };
  recebidos = []; r = await roda(fontes3, 30); assert.equal(r.c, 0, r.o);
  const cf = recebidos.find((x) => /^⭐ EXCLUSIVO confirmado: Exclusivo: Rockstar/.test(x.title)); assert.ok(cf, r.o + JSON.stringify(recebidos.map((x) => x.title))); assert.equal(cf.priority, 4); assert.equal(cf.topic, 'mus-games');
  assert.match(cf.message, /^✅ Confirmado por 2 veículos · Critical Hits saiu primeiro às 11:10/); const corpo = JSON.parse(cf.actions[0].body); assert.equal(corpo.origem, 'games'); assert.equal(corpo.acao, 'publicar');
  // resumo das 14h no canal Games, prioridade 2 (sem som)
  const fontes4 = { ...fontes3, 'Xbox Power': f('xp4', rss([['Halo chega ao PS5 em março', 'https://www.xboxpower.com.br/2026/11/20/halo-ps5', agora + 3.5 * 3600e3]])) };
  recebidos = []; r = await roda(fontes4, 4 * 60 + 5); assert.equal(r.c, 0, r.o); const rs = recebidos.find((x) => /^🎮 Games 14h/.test(x.title)); assert.ok(rs, r.o + JSON.stringify(recebidos.map((x) => x.title)));
  assert.equal(rs.topic, 'mus-games'); assert.equal(rs.priority, 2); assert.match(rs.message, /1 notícia com só 1 fonte até agora/);
  srv.close(); n++; console.log('ok ponta a ponta: convite único silencioso, Review à parte, exclusivo em apuração, 429 sem perder, confirmação assinada com som (4), resumo silencioso');
})();
console.log('\nTODOS OS TESTES DE GAMES PASSARAM:', n);
