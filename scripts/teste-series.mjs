// Testes da seção 🎬 Séries e Filmes e do selo ⭐ Possível exclusivo (jornal inteiro). Sem rede: fontes e ntfy falsos.
// Uso: node scripts/teste-series.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process'; import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from './series-regras.mjs';
import * as X from './exclusivo.mjs';
import { itensSeries } from './busca-arquivo.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
let n = 0; const ok = (nome, f) => { f(); n++; console.log('ok', nome); };

// 1) marca de exclusivo: só a do próprio título; "shows exclusivos" no meio da frase não conta
ok('alegaExclusivo: títulos reais', () => {
  for (const t of ['Exclusivo: La Caisse (ex-CDPQ) suspende R$ 4,1 bi em investimentos da TAG', 'Exclusivo: Bella Campos confirma romance com a modelo Thalita Ferreira', 'Vingadores: Doutor Destino | Duração do filme é revelada; saiba aqui [EXCLUSIVO]', '[Exclusive] Netflix renews show', 'Stranger Things spinoff sets cast (Exclusive)', 'Fotos exclusivas: Menino levado pelo pai ao Egito é localizado', 'Atriz revela com exclusividade ao Gshow', 'Trailer de Duna em primeira mão']) assert.ok(X.alegaExclusivo(t), t);
  for (const t of ['Lollapalooza Brasil 2027 terá 26 shows exclusivos no país', 'Código promocional LegalZoom: Exclusivo 10% Off', 'YouTuber vai fazer conteúdo exclusivo para Netflix', 'Sem dedicação exclusiva, prefeitos voluntários']) assert.ok(!X.alegaExclusivo(t), t);
  assert.ok(X.alegaExclusivo('Título traduzido sem a marca', 'Show adds cast (Exclusive)'), 'confere o original em inglês');
});
ok('palavrasBusca tira a marca e prioriza nomes', () => { assert.equal(X.palavrasBusca('Exclusivo: Bruna Surfistinha ganha nova série na Netflix'), 'Bruna Surfistinha Netflix ganha série'); });
ok('selo: texto exato, e sem "possível" quando o Google já mostra 3+ veículos', () => {
  const ag = Date.parse('2026-11-17T21:40:00-03:00');
  assert.equal(X.selo({ veiculo: 'Omelete', N: 18, agora: ag }).texto, '⭐ Possível exclusivo: Omelete diz que é exclusivo · só 1 de 18 veículos monitorados publicou até 21:40');
  const s = X.selo({ veiculo: 'Omelete', N: 18, agora: ag, google: { veiculos: 5, em: '21:41' } });
  assert.equal(s.tipo, 'alegado'); assert.match(s.texto, /^📰 Omelete diz que é exclusivo .* Google Notícias: 5 veículos com essas palavras \(24 h, 21:41\)$/);
});

// 2) leitura: RSS e sitemap do Omelete (sem horário real, não entra)
const rss = (itens) => '<?xml version="1.0" encoding="UTF-8"?><rss><channel>' + itens.map(([t, l, d, c]) => '<item><title><![CDATA[' + t + ']]></title><link>' + l + '</link>' + (d ? '<pubDate>' + new Date(d).toUTCString() + '</pubDate>' : '') + (c ? '<category>' + c + '</category>' : '') + '<description>Resumo de teste.</description></item>').join('') + '</channel></rss>';
const sitemap = (itens) => '<?xml version="1.0"?><urlset xmlns:news="x">' + itens.map(([t, l, d]) => '<url><loc>' + l + '</loc><news:news><news:publication_date>' + new Date(d).toISOString() + '</news:publication_date><news:title>' + t + '</news:title></news:news></url>').join('') + '</urlset>';
const T0 = Date.parse('2026-11-17T12:00:00-03:00');
ok('lerFeed: RSS e sitemap de notícias', () => {
  const a = S.lerFeed(rss([['Filme A ganha trailer', 'https://x.com/a', T0], ['Sem data', 'https://x.com/b', 0]]), ['Cinepop', '', 'dedicada', '']);
  assert.equal(a.length, 1); assert.equal(a[0].src, 'Cinepop'); assert.equal(a[0].ts, T0);
  const b = S.lerFeed(sitemap([['Duna 3 | Trailer', 'https://www.omelete.com.br/filmes/duna-3', T0]]), ['Omelete', '', 'omelete', '']);
  assert.equal(b.length, 1); assert.equal(b[0].title, 'Duna 3 | Trailer');
});
ok('ehSeriesFilmes: dedicadas entram, gerais só com série/filme, novela e reality fora, Omelete por seção', () => {
  assert.ok(S.ehSeriesFilmes({ tipo: 'dedicada', title: 'Qualquer', link: 'https://deadline.com/2026/x' }));
  assert.ok(S.ehSeriesFilmes({ tipo: 'geral', title: 'Netflix confirma 2ª temporada de Wandinha', link: 'https://g.com/a' }));
  assert.ok(!S.ehSeriesFilmes({ tipo: 'geral', title: 'Cantora lança álbum novo', link: 'https://g.com/b' }));
  assert.ok(!S.ehSeriesFilmes({ tipo: 'geral', title: 'Novela das nove: série de reviravoltas no capítulo', link: 'https://g.com/c' }));
  assert.ok(S.ehSeriesFilmes({ tipo: 'omelete', title: 'X', link: 'https://www.omelete.com.br/series-tv/x' }));
  assert.ok(!S.ehSeriesFilmes({ tipo: 'omelete', title: 'GTA 6', link: 'https://www.omelete.com.br/games/gta' }));
});

// 3) mesmo fato e regra das 2 fontes
const it = (src, title, h, link, extra) => ({ src, title, ts: T0 + h * 60e3, link, key: S.canon(link), tipo: 'dedicada', lang: '', sum: '', ...extra });
ok('agrupar: mesmo fato junta, matérias diferentes sobre o mesmo ator não, republicação conta 1', () => {
  const G = S.agrupar([
    it('Cinepop', "'Bruna Surfistinha 2' ganha primeiro teaser com Deborah Secco", 0, 'https://cinepop.com.br/bs2'),
    it('Pipoca Moderna', 'Bruna Surfistinha 2 ganha primeiro teaser com Deborah Secco e data de estreia', 30, 'https://pipocamoderna.com.br/bs2'),
    it('Deadline', 'Robert Pattinson como James Bond? Baz Bamigboye tem algumas ideias', 5, 'https://deadline.com/rp1'),
    it('Omelete', '007 | Robert Pattinson sobre ser o novo James Bond: "Honra de uma vida"', 10, 'https://www.omelete.com.br/filmes/rp2'),
    it('Estadão Cultura', 'Livro premiado de Tony Bellotto vai virar filme; conheça detalhes', 20, 'https://www.estadao.com.br/cultura/tb'),
    it('Terra Diversão', 'Livro premiado de Tony Bellotto vai virar filme; conheça detalhes', 40, 'https://www.terra.com.br/diversao/tb'),
  ]);
  const bs = G.find((g) => /Bruna/.test(g.title)); assert.equal(bs.n, 2); assert.equal(bs.src, 'Cinepop', 'o mais antigo é o principal');
  const rp = G.filter((g) => /Pattinson/.test(g.title)); assert.equal(rp.length, 2); assert.ok(rp.every((g) => g.n === 1), 'assuntos diferentes do mesmo ator não confirmam');
  const tb = G.find((g) => /Bellotto/.test(g.title)); assert.equal(tb.grp.length, 1); assert.equal(tb.n, 1, 'Terra republicou o Estadão: não é 2ª fonte');
  assert.equal(X.primeiro([bs, ...bs.grp]).veiculo, 'Cinepop');
});
const ASS = 'segredo-de-teste', CMD = 'cmd-teste';
ok('vista e botões: 1 fonte = em apuração sem Sim, publicar; 2+ = Sim, publicar com fontes e selo assinados', () => {
  const [um] = S.agrupar([it('Omelete', 'Vingadores: Doutor Destino | Duração do filme é revelada [EXCLUSIVO]', 0, 'https://www.omelete.com.br/filmes/vdd')]);
  const v1 = S.vista(um, { N: 18, agora: T0 + 3600e3 }); assert.equal(v1.emApuracao, true); assert.equal(v1.selo.tipo, 'possivel'); assert.match(v1.selo.texto, /só 1 de 18 veículos monitorados publicou até 13:00$/);
  const b1 = S.botoes(um, { CMD, ASS, pagina: 'P' }); assert.deepEqual(b1.map((a) => a.label), ['🔎 Apurar no agente', 'Ver notícia', 'Não']); assert.ok(!JSON.stringify(b1).includes('publicar'), '1 fonte: sem Sim, publicar');   // 17/11
  const [dois] = S.agrupar([it('Omelete', 'Vingadores: Doutor Destino tem duração revelada [EXCLUSIVO]', 0, 'https://www.omelete.com.br/filmes/vdd2'), it('Cinepop', 'Vingadores: Doutor Destino tem duração revelada pela Marvel', 50, 'https://cinepop.com.br/vdd')]);
  assert.equal(dois.n, 2); const v2 = S.vista(dois, { N: 18, agora: T0 }); assert.deepEqual(v2.primeiro, { veiculo: 'Omelete', hora: '12:00' }); assert.equal(v2.exclusivoConfirmado, true); assert.equal(v2.selo, undefined);
  const b2 = S.botoes(dois, { CMD, ASS, pagina: 'P' }); assert.equal(b2[0].label, '✅ Sim, publicar'); const c = JSON.parse(b2[0].body);
  assert.equal(c.fontes, 2); assert.equal(c.fsig, createHmac('sha256', ASS).update(c.id + '|fontes=2').digest('hex').slice(0, 32));
  assert.deepEqual(c.selo, { tipo: 'exclusivo', veiculo: 'Omelete', hora: '12:00', fontes: 2 }); assert.equal(c.ssig, X.assinarSelo(ASS, c.id, c.selo)); assert.equal(c.origem, 'series');
});
ok('rastrear: marcado com 1 fonte; quando o 2º veículo publica, vira confirmação com quem saiu primeiro', () => {
  const E = {}; const a = it('Hugo Gloss', 'Exclusivo: atriz confirma papel em nova série da Netflix', 0, 'https://hugogloss.uol.com.br/a');
  let r = X.rastrear(E, S.agrupar([a]), { agora: T0 + 60e3 }); assert.equal(r.novos.length, 1); assert.equal(r.confirmados.length, 0);
  r = X.rastrear(E, S.agrupar([a]), { agora: T0 + 120e3 }); assert.equal(r.novos.length, 0, 'não marca de novo');
  const b = it('Gshow', 'Atriz confirma papel em nova série da Netflix e comemora', 45, 'https://gshow.globo.com/b');
  r = X.rastrear(E, S.agrupar([a, b]), { agora: T0 + 3600e3 }); assert.equal(r.confirmados.length, 1); assert.equal(r.confirmados[0].p.veiculo, 'Hugo Gloss'); assert.equal(r.confirmados[0].p.hora, '12:00');
  assert.match(X.textoConfirmado(r.confirmados[0].p, 2), /^✅ Confirmado por 2 veículos · Hugo Gloss saiu primeiro às 12:00/);
});
await (async () => {
  const xml = '<?xml version="1.0"?><rss><channel><item><title>a</title><source url="x">G1</source></item><item><title>b</title><source url="y">UOL</source></item><item><title>c</title><source url="y">UOL</source></item></channel></rss>';
  const g = await X.contarGoogle('Bruna Surfistinha', { agora: T0, baixar: async () => xml }); assert.deepEqual(g, { itens: 3, veiculos: 2, em: '12:00', q: 'Bruna Surfistinha' });
  assert.equal(await X.contarGoogle('x', { baixar: async () => '<html><title>Sorry...</title></html>' }), null, 'bloqueio do Google = sem número');
  const E = { excl: { k1: { titulo: 'Exclusivo: Fulano em série' }, k2: { titulo: 'Exclusivo: Beltrano em filme' } } }; let chamadas = 0;
  const r = await X.googleParaMarcados(E, ['k1', 'k2'], { agora: T0, baixar: async () => { chamadas++; return '<html>Sorry</html>'; } });
  assert.equal(r.bloqueado, true); assert.equal(chamadas, 1, 'parou na 1ª recusa'); assert.ok(E.googlePausa > T0);
  const r2 = await X.googleParaMarcados(E, ['k1'], { agora: T0 + 60e3, baixar: async () => { chamadas++; return xml; } }); assert.equal(r2.pausado, true); assert.equal(chamadas, 1, 'pausa de 1 h');
  n++; console.log('ok Google Notícias: conta veículos, some quando bloqueia e pausa 1 h');
})();
ok('busca: itens de series.json entram na seção series', () => {
  const l = itensSeries({ destaques: [{ titulo: 'Bruna Surfistinha 2 ganha teaser', link: 'https://cinepop.com.br/bs2', publicado: '2026-11-16T14:34', veiculo: 'Cinepop', fontes: 3, plataformas: [], tambemEm: [{ veiculo: 'g1 Pop & Arte', titulo: 'Bruna Surfistinha 2 teaser', link: 'https://g1.globo.com/bs2' }] }] });
  assert.equal(l.length, 2); assert.ok(l.every((x) => x.c === 'series')); assert.equal(l[1].n, 3);
});
ok('canal Séries: tópico derivado e convite de um toque', () => {
  assert.equal(S.topicoSeries('abc_123'), 'abc_123-series'); assert.equal(S.topicoSeries(''), '');
  const a = S.avisoSeries('https://ntfy.sh', 'abc'); assert.equal(a.actions[0].url, 'ntfy://ntfy.sh/abc-series?display=Fenix+Series+e+Filmes');
});

// 4) ponta a ponta: series.mjs com fontes locais e ntfy falso (nada chega no celular)
await (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'series-')); const agora = Date.parse('2026-11-17T11:30:00-03:00');
  const f = (nome, xml) => { const p = path.join(dir, nome + '.xml'); fs.writeFileSync(p, xml); return p; };
  const fontes1 = { 'Omelete': f('om1', sitemap([['Duna 3 | Trailer final revela Zendaya e Timothée Chalamet', 'https://www.omelete.com.br/filmes/duna-3-trailer', agora - 50 * 60e3]])),
    'Hugo Gloss': f('hg1', rss([['Exclusivo: Deborah Secco revela papel em nova série da Netflix', 'https://hugogloss.uol.com.br/ds', agora - 20 * 60e3, 'Cinema e TV']])) };
  let recebidos = [], falhar = 0;
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { if (falhar > 0) { falhar--; r.writeHead(429); return r.end(); } recebidos.push(JSON.parse(b)); r.writeHead(200); r.end('{}'); }); });
  await new Promise((z) => srv.listen(0, z)); const SRV = 'http://127.0.0.1:' + srv.address().port;
  const roda = (fontes, min) => new Promise((z) => { const p = spawn(process.execPath, [path.join(AQUI, 'series.mjs'), '--agora', new Date(agora + min * 60e3).toISOString(), '--sem-google', '--sem-traducao'], { cwd: dir, env: { ...process.env, SERIES_FONTES_LOCAIS: JSON.stringify(fontes), NTFY_TOPIC_MUSICA: 'mus', NTFY_TOPIC_COMANDO: CMD, NTFY_ASSINATURA: ASS, NTFY_SERVIDOR: SRV, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '10' } }); let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => z({ c, o })); });
  let r = await roda(fontes1, 0); assert.equal(r.c, 0, r.o);
  assert.equal(recebidos.length, 1, 'primeira rodada: só o convite ' + JSON.stringify(recebidos.map((x) => x.title))); assert.equal(recebidos[0].topic, 'mus'); assert.match(recebidos[0].actions[0].url, /^ntfy:\/\/127\.0\.0\.1:\d+\/mus-series\?display=/);
  const J1 = JSON.parse(fs.readFileSync(path.join(dir, 'series.json'), 'utf8')); assert.equal(J1.exclusivos.length, 1); assert.match(J1.exclusivos[0].selo.texto, /^⭐ Possível exclusivo: Hugo Gloss diz que é exclusivo · só 1 de 2 veículos monitorados publicou até 11:30$/);
  // 2ª rodada: um novo exclusivo e o ntfy recusa (429) 5 vezes: nada é marcado; 3ª rodada: sai
  recebidos = []; const fontes2 = { ...fontes1, 'PapelPop': f('pp2', rss([['Exclusivo: Marina Ruy Barbosa estrela filme da Globoplay', 'https://www.papelpop.com/mrb', agora + 5 * 60e3, 'Filmes']])) };
  falhar = 5; r = await roda(fontes2, 10); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 0, JSON.stringify(recebidos.map((x) => x.title)) + r.o); assert.match(r.o, /NÃO SAÍRAM/);
  r = await roda(fontes2, 20); assert.equal(r.c, 0, r.o); const ex = recebidos.filter((x) => /^⭐ Possível exclusivo/.test(x.title)); assert.equal(ex.length, 1, r.o + JSON.stringify(recebidos.map((x) => x.title)));
  assert.equal(ex[0].topic, 'mus-series'); assert.ok(!JSON.stringify(ex[0].actions).includes('"acao\\":\\"publicar'), 'exclusivo de 1 fonte não tem Sim, publicar'); assert.ok(!('click' in ex[0]), '17/11: o toque abre o ntfy com os botões');
  // 4ª rodada: Gshow confirma o fato da Deborah Secco: chega "✅ Confirmado" com Sim, publicar e o selo assinado
  recebidos = []; const fontes3 = { ...fontes2, 'Gshow': f('gs3', rss([['Deborah Secco revela papel em nova série da Netflix e comemora', 'https://gshow.globo.com/ds', agora + 25 * 60e3, 'Séries']])) };
  r = await roda(fontes3, 30); assert.equal(r.c, 0, r.o);
  const cf = recebidos.find((x) => /^✅ Confirmado: Exclusivo: Deborah Secco/.test(x.title)); assert.ok(cf, JSON.stringify(recebidos.map((x) => x.title)));
  assert.match(cf.message, /^✅ Confirmado por 2 veículos · Hugo Gloss saiu primeiro às 11:10/); const corpo = JSON.parse(cf.actions[0].body);
  assert.equal(cf.actions[0].label, '✅ Sim, publicar'); assert.equal(corpo.selo.tipo, 'exclusivo'); assert.equal(corpo.ssig, X.assinarSelo(ASS, corpo.id, corpo.selo));
  recebidos = []; r = await roda(fontes3, 40); assert.ok(!recebidos.some((x) => /Confirmado/.test(x.title)), 'não repete a confirmação');
  // resumo das 14h: o que ainda não foi avisado vai inteiro
  const fontes4 = { ...fontes3, 'Cinepop': f('cp4', rss([['Filme brasileiro Cidade Azul ganha data de estreia nos cinemas', 'https://cinepop.com.br/ca', agora + 3.5 * 3600e3]])) };
  recebidos = []; r = await roda(fontes4, 4 * 60 + 5); assert.equal(r.c, 0, r.o); const rs = recebidos.find((x) => /^🎬 Séries e Filmes 14h/.test(x.title)); assert.ok(rs, JSON.stringify(recebidos.map((x) => x.title))); assert.match(rs.message, /Cidade Azul/); assert.match(rs.message, /1 fonte 🔎/);
  srv.close(); n++; console.log('ok ponta a ponta: convite, exclusivo em apuração, 429 sem perder aviso, confirmação com Sim, publicar, resumo');
})();
console.log('\nTODOS OS TESTES DE SÉRIES E EXCLUSIVO PASSARAM:', n);
