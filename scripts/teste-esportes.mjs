// Testes da seção ⚽ Esportes. Sem rede: fontes e ntfy falsos. Uso: node scripts/teste-esportes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawn } from 'node:child_process'; import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from './esportes-regras.mjs';
import * as X from './exclusivo.mjs';
import { itensEsportes } from './busca-arquivo.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
let n = 0; const ok = (nome, f) => { f(); n++; console.log('ok', nome); };
const rss = (itens) => '<?xml version="1.0" encoding="UTF-8"?><rss><channel>' + itens.map(([t, l, d, c]) => '<item><title><![CDATA[' + t + ']]></title><link>' + l + '</link><pubDate>' + new Date(d).toUTCString() + '</pubDate>' + (c ? '<category>' + c + '</category>' : '') + '<description>Resumo de teste.</description></item>').join('') + '</channel></rss>';
const sitemap = (itens) => '<?xml version="1.0"?><urlset xmlns:news="x">' + itens.map(([t, l, d]) => '<url><loc>' + l + '</loc><news:news><news:publication_date>' + new Date(d).toISOString() + '</news:publication_date><news:title>' + t + '</news:title></news:news></url>').join('') + '</urlset>';
const T0 = Date.parse('2026-11-17T12:00:00-03:00'), CMD = 'cmd-teste', ASS = 'k'.repeat(48);
const it = (src, title, link, ts = T0, extra = {}) => ({ src, title, link, key: S.canon(link), ts, sum: '', tipo: 'esporte', lang: '', ...extra });

ok('fontes: 29 feeds de 25 veículos (ESPN Brasil fora: horário falso no feed); feeds do ge contam como 1 veículo', () => { assert.equal(S.FONTES.length, 29); assert.equal(S.VEICULOS.length, 25); assert.ok(!S.VEICULOS.includes('ESPN Brasil')); assert.equal(S.FONTES.filter((f) => f[0] === 'ge').length, 5); });
ok('filtro: aposta, palpite e saúde ficam de fora', () => {
  assert.ok(!S.ehEsporte(it('Lance!', 'Por que o corpo sente o sedentarismo', 'https://www.lance.com.br/lance-saude/x.html')));
  assert.ok(!S.ehEsporte(it('X', 'Palpite Flamengo x Palmeiras: odds', 'https://x.com/a')));
  assert.ok(!S.ehEsporte(it('Olimpíada Todo Dia', 'Lavar ovos faz mal?', 'https://www.olimpiadatododia.com.br/bem-estar-todo-dia/1/')));
  assert.ok(S.ehEsporte(it('ge', 'Brasil vence Singapura', 'https://ge.globo.com/futebol/selecao-brasileira/x')));
});
ok('Opinião/Crítica: só com a marca do próprio veículo; furo de colunista marcado como exclusivo segue como notícia', () => {
  assert.ok(S.ehOpiniao(it('UOL Esporte', 'Vasco derrubou jejum', 'https://www.uol.com.br/esporte/futebol/colunas/mauro-cezar-pereira/2026/11/17/x.htm')));
  assert.ok(S.ehOpiniao(it('ESPN Brasil', 'OPINIÃO: Corinthians dá salto', 'https://www.espn.com.br/futebol/x')));
  assert.ok(S.ehOpiniao(it('Motorsport.com Brasil', 'Análise: Norris e Verstappen brilham', 'https://motorsport.uol.com.br/f1/news/x')));
  assert.ok(S.ehOpiniao(it('Trivela', 'Tim Vickery: Seleção deveria ser melhor', 'https://trivela.com.br/brasil/tim-vickery-selecao-analise-critica-ancelotti/')));
  assert.ok(!S.ehOpiniao(it('Sky Sports', 'Transfer Centre LIVE', 'https://www.skysports.com/football/live-blog/1/2')));
  assert.ok(!S.ehOpiniao(it('UOL Esporte', 'Exclusivo: Superbet rompe com o São Paulo', 'https://www.uol.com.br/esporte/futebol/colunas/rodrigo-mattos/x.htm')));
  assert.ok(!S.ehOpiniao(it('ge', 'Flamengo vence o Vasco', 'https://ge.globo.com/futebol/x')));
});
ok('modalidade pelo caminho e pelo título (o nome do site não decide); sem pista = Esportes', () => {
  const m = (l, t) => S.modalidade(it('X', t, l));
  assert.equal(m('https://www.olimpiadatododia.com.br/voleidepraia/1/', 'Dupla vence etapa'), 'Vôlei de praia');
  assert.equal(m('https://www.olimpiadatododia.com.br/futebol/2/', 'Santos x São Paulo – Paulistão Feminino'), 'Futebol');
  assert.equal(m('https://ge.globo.com/surfe/noticia/x', 'Kemily Sampaio vence etapa'), 'Surfe');
  assert.equal(m('https://ge.globo.com/motor/formula-1/x', 'Bortoleto renova'), 'F1 e automobilismo');
  assert.equal(m('https://a.com/b', 'Embiid faz 37 pontos na NBA'), 'Basquete');
  assert.equal(m('https://a.com/b', 'Notícia da Austrália sem esporte claro'), 'Esportes');
});
ok('mesmo fato: 2 veículos = confirmado; 2 feeds do ge = 1 veículo', () => {
  const g = S.agrupar([it('Estadão Esportes', 'Alemanha goleia Holanda e avança às quartas da Liga das Nações', 'https://estadao.com.br/a', T0), it('Folha Esporte', 'Alemanha atropela Holanda e avança às quartas da Liga das Nações', 'https://folha.uol.com.br/b', T0 + 600e3)]);
  assert.equal(g.length, 1); assert.equal(g[0].n, 2);
  const v = S.vista(g[0], { N: 26, agora: T0 }); assert.equal(v.confirmado, true); assert.deepEqual(v.primeiro, { veiculo: 'Estadão Esportes', hora: '12:00' }); assert.equal(v.modalidade, 'Futebol');
});
ok('selo e botões: 1 fonte com "Exclusivo:" = possível exclusivo, sem Sim, publicar; 2 fontes = Sim, publicar assinado, origem esportes', () => {
  const um = S.agrupar([it('UOL Esporte', 'Exclusivo: Superbet prepara rescisão com São Paulo e Fluminense', 'https://uol.com.br/x')])[0];
  const v = S.vista(um, { N: 26, agora: T0 }); assert.match(v.selo.texto, /^⭐ Possível exclusivo: UOL Esporte diz que é exclusivo · só 1 de 26 veículos monitorados publicou até 12:00$/);
  { const b1 = S.botoes(um, { CMD, ASS, pagina: 'p' }); assert.deepEqual(b1.map((b) => b.label), ['🔎 Apurar no agente', 'Ver notícia', 'Não']); assert.ok(!JSON.stringify(b1).includes('publicar'), '1 fonte: sem Sim, publicar'); }   // 17/11
  const dois = S.agrupar([it('UOL Esporte', 'Exclusivo: Superbet prepara rescisão com São Paulo e Fluminense', 'https://uol.com.br/x'), it('Lance!', 'Superbet prepara rescisão de contrato com São Paulo e Fluminense', 'https://lance.com.br/y', T0 + 900e3)])[0];
  const b = S.botoes(dois, { CMD, ASS, pagina: 'p' }); const c = JSON.parse(b[0].body);
  assert.equal(b[0].label, '✅ Sim, publicar'); assert.equal(c.origem, 'esportes'); assert.equal(c.fsig, createHmac('sha256', ASS).update(c.id + '|fontes=2').digest('hex').slice(0, 32));
  assert.equal(c.selo.tipo, 'exclusivo'); assert.equal(c.ssig, X.assinarSelo(ASS, c.id, c.selo));
});
ok('convite único: 2 botões (Séries e Esportes) no canal Música', () => {
  assert.equal(S.topicoEsportes('abc_1'), 'abc_1-esportes'); assert.equal(S.topicoEsportes(''), '');
  const a = S.avisoCombinado('https://ntfy.sh', 'abc'); assert.equal(a.actions.length, 2);
  assert.deepEqual(a.actions.map((x) => [x.label, x.url]), [['Assinar Séries e Filmes', 'ntfy://ntfy.sh/abc-series?display=Fenix+Series+e+Filmes'], ['Assinar Esportes', 'ntfy://ntfy.sh/abc-esportes?display=Fenix+Esportes']]);
});
ok('busca: esportes.json entra na seção esportes, com as colunas', () => {
  const l = itensEsportes({ destaques: [{ titulo: 'Alemanha goleia Holanda', link: 'https://estadao.com.br/a', publicado: '2026-11-16T18:00', veiculo: 'Estadão Esportes', fontes: 2, modalidade: 'Futebol', tambemEm: [{ veiculo: 'Folha Esporte', titulo: 'Alemanha atropela Holanda', link: 'https://folha.uol.com.br/b' }] }], opiniao: [{ titulo: 'Vasco derrubou jejum', link: 'https://uol.com.br/c', publicado: '2026-11-17T07:00', veiculo: 'UOL Esporte', tipo: 'Opinião/Crítica', modalidade: 'Futebol' }] });
  assert.equal(l.length, 3); assert.ok(l.every((x) => x.c === 'esportes')); assert.match(l[2].s, /Opinião\/Crítica/);
});

// ponta a ponta: esportes.mjs com fontes locais e ntfy falso (nada chega no celular)
await (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esportes-')); const agora = Date.parse('2026-11-17T11:30:00-03:00');
  const f = (nome, xml) => { const p = path.join(dir, nome + '.xml'); fs.writeFileSync(p, xml); return p; };
  const fontes1 = { 'ge': f('ge1', rss([['Brasil goleia Singapura no último amistoso do ano', 'https://ge.globo.com/futebol/selecao/a', agora - 50 * 60e3]])),
    'UOL Esporte': f('uol1', rss([['Exclusivo: Superbet prepara rescisão com São Paulo e Fluminense', 'https://www.uol.com.br/esporte/futebol/ultimas/x', agora - 20 * 60e3], ['Vasco derrubou jejum de 28 anos', 'https://www.uol.com.br/esporte/futebol/colunas/mauro/x', agora - 30 * 60e3]])) };
  let recebidos = [], falhar = 0;
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { if (falhar > 0) { falhar--; r.writeHead(429); return r.end(); } recebidos.push(JSON.parse(b)); r.writeHead(200); r.end('{}'); }); });
  await new Promise((z) => srv.listen(0, z)); const SRV = 'http://127.0.0.1:' + srv.address().port;
  const roda = (fontes, min, script = 'esportes.mjs', env = {}) => new Promise((z) => { const p = spawn(process.execPath, [path.join(AQUI, script), '--agora', new Date(agora + min * 60e3).toISOString(), '--sem-google', '--sem-traducao'], { cwd: dir, env: { ...process.env, ESPORTES_FONTES_LOCAIS: JSON.stringify(fontes), NTFY_TOPIC_MUSICA: 'mus', NTFY_TOPIC_COMANDO: CMD, NTFY_ASSINATURA: ASS, NTFY_SERVIDOR: SRV, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '10', ...env } }); let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => z({ c, o })); });
  // 1ª rodada: o convite sai uma vez, com os 2 botões, no canal Música; nenhum aviso antigo
  let r = await roda(fontes1, 0); assert.equal(r.c, 0, r.o);
  assert.equal(recebidos.length, 1, JSON.stringify(recebidos.map((x) => x.title))); assert.equal(recebidos[0].topic, 'mus'); assert.equal(recebidos[0].title, 'Fênix: assine Séries e Filmes e Esportes');
  assert.deepEqual(recebidos[0].actions.map((a) => a.url.replace(/:\d+\//, '/')), ['ntfy://127.0.0.1/mus-series?display=Fenix+Series+e+Filmes', 'ntfy://127.0.0.1/mus-esportes?display=Fenix+Esportes']);
  const J1 = JSON.parse(fs.readFileSync(path.join(dir, 'esportes.json'), 'utf8'));
  assert.equal(J1.exclusivos.length, 1); assert.match(J1.exclusivos[0].selo.texto, /só 1 de 2 veículos monitorados publicou até 11:30$/);
  assert.equal(J1.opiniao.length, 1); assert.equal(J1.opiniao[0].tipo, 'Opinião/Crítica'); assert.ok(!J1.brasil.some((x) => /jejum/.test(x.titulo)), 'coluna não entra como notícia');
  // Séries não manda o convite dele de novo (o combinado já levou o botão de Séries)
  recebidos = []; r = await roda({}, 1, 'series.mjs', { SERIES_FONTES_LOCAIS: '{}' }); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 0, 'Séries não repete convite: ' + JSON.stringify(recebidos.map((x) => x.title)));
  // 2ª rodada: novo exclusivo e o ntfy recusa 5 vezes: nada marcado; 3ª rodada sai; o convite não repete
  const fontes2 = { ...fontes1, 'Lance!': f('la2', sitemap([['Exclusivo: Neymar acerta volta ao Barcelona por uma temporada', 'https://www.lance.com.br/futebol/neymar', agora + 5 * 60e3]])) };
  recebidos = []; falhar = 5; r = await roda(fontes2, 10); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 0); assert.match(r.o, /NÃO SAÍRAM/);
  r = await roda(fontes2, 20); const ex = recebidos.filter((x) => /^⭐ Possível exclusivo: Exclusivo: Neymar/.test(x.title)); assert.equal(ex.length, 1, r.o + JSON.stringify(recebidos.map((x) => x.title)));
  assert.equal(ex[0].topic, 'mus-esportes'); assert.ok(!JSON.stringify(ex[0].actions).includes('"acao\\":\\"publicar'), '1 fonte: sem Sim, publicar'); assert.ok(!('click' in ex[0]), '17/11: o toque abre o ntfy com os botões'); assert.ok(!recebidos.some((x) => /assine/.test(x.title)), 'convite não repete');
  // 4ª rodada: ge confirma o furo do UOL: "✅ Confirmado" com Sim, publicar e selo assinado
  const fontes3 = { ...fontes2, 'ge': f('ge3', rss([['Brasil goleia Singapura no último amistoso do ano', 'https://ge.globo.com/futebol/selecao/a', agora - 50 * 60e3], ['Superbet prepara rescisão de contrato com São Paulo e Fluminense', 'https://ge.globo.com/futebol/superbet', agora + 25 * 60e3]])) };
  recebidos = []; r = await roda(fontes3, 30); assert.equal(r.c, 0, r.o);
  const cf = recebidos.find((x) => /^⭐ EXCLUSIVO confirmado: Exclusivo: Superbet/.test(x.title)); assert.ok(cf, JSON.stringify(recebidos.map((x) => x.title))); assert.equal(cf.priority, 5);
  assert.match(cf.message, /^✅ Confirmado por 2 veículos · UOL Esporte saiu primeiro às 11:10/); const corpo = JSON.parse(cf.actions[0].body);
  assert.equal(corpo.origem, 'esportes'); assert.equal(corpo.selo.tipo, 'exclusivo'); assert.equal(corpo.ssig, X.assinarSelo(ASS, corpo.id, corpo.selo));
  // resumo das 14h: confirmados listados, 1 fonte só contada, colunas à parte
  const fontes4 = { ...fontes3, 'Placar': f('pl4', rss([['Sada Cruzeiro vira sobre Suzano e segue invicto na Superliga', 'https://placar.com.br/volei/sada', agora + 3.5 * 3600e3]])) };
  recebidos = []; r = await roda(fontes4, 4 * 60 + 5); assert.equal(r.c, 0, r.o); const rs = recebidos.find((x) => /^⚽ Esportes 14h/.test(x.title)); assert.ok(rs, r.o + JSON.stringify(recebidos.map((x) => x.title)));
  assert.match(rs.message, /1 notícia com só 1 fonte até agora/); assert.doesNotMatch(rs.message, /Sada Cruzeiro/, '1 fonte só contada, sem linha'); assert.equal(rs.topic, 'mus-esportes');
  srv.close(); n++; console.log('ok ponta a ponta: convite único com 2 botões, Séries não repete, Opinião à parte, exclusivo em apuração, 429 sem perder, confirmação assinada, resumo');
})();
console.log('\nTODOS OS TESTES DE ESPORTES PASSARAM:', n);
