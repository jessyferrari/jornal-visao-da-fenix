// Teste do lembrete único para assinar Séries e Filmes e Esportes (20/11), sem rede e com ntfy FALSO local (nada chega no celular).
// Uso: node scripts/teste-lembrete-assinar.mjs
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import * as S from './esportes-regras.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const t = (s) => Date.parse(s + '-03:00');
// unidade
assert.equal(S.deveLembrar({ avisoEsportes: '2026-11-17T09:00' }, t('2026-11-20T11:30'), 11), true, 'convite antigo, de dia: lembra');
assert.equal(S.deveLembrar({ avisoEsportes: '2026-11-17T09:00', lembreteAssinar: '2026-11-20T11:30' }, t('2026-11-20T12:00'), 12), false, 'só uma vez');
assert.equal(S.deveLembrar({ avisoEsportes: '2026-11-17T09:00' }, t('2026-11-20T23:30'), 23), false, 'nunca de noite');
assert.equal(S.deveLembrar({ avisoEsportes: '2026-11-17T09:00' }, t('2026-11-18T11:00'), 11), false, 'nunca antes de 20/11');
assert.equal(S.deveLembrar({ avisoEsportes: '2026-11-20T09:00' }, t('2026-11-20T11:00'), 11), false, 'convite do mesmo dia: não repete');
assert.equal(S.deveLembrar({}, t('2026-11-20T11:00'), 11), false, 'sem convite: o convite original sai antes');
const L = S.lembreteCombinado('https://ntfy.sh', 'abc');
assert.equal(L.priority, 3); assert.match(L.title, /^Lembrete: assine Séries e Filmes e Esportes$/);
assert.deepEqual(L.actions.map((a) => a.label), ['Assinar Séries e Filmes', 'Assinar Esportes']);
assert.equal(S.lembreteCombinado('https://ntfy.sh', ''), null, 'sem canal Música não monta');
console.log('lembrete (unidade): 10 verificações OK');
// ponta a ponta com esportes.mjs
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lembrete-'));
const rss = (itens) => '<?xml version="1.0" encoding="UTF-8"?><rss><channel>' + itens.map(([ti, l, d]) => '<item><title><![CDATA[' + ti + ']]></title><link>' + l + '</link><pubDate>' + new Date(d).toUTCString() + '</pubDate><description>Resumo de teste.</description></item>').join('') + '</channel></rss>';
const f = (nome, xml) => { const p = path.join(dir, nome + '.xml'); fs.writeFileSync(p, xml); return p; };
let recebidos = []; const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { recebidos.push(JSON.parse(b)); r.writeHead(200); r.end('{}'); }); });
await new Promise((z) => srv.listen(0, z)); const SRV = 'http://127.0.0.1:' + srv.address().port;
const roda = (agora) => { const fontes = { ge: f('ge' + agora, rss([['Brasil vence amistoso ' + agora, 'https://ge.globo.com/futebol/a' + agora, agora - 50 * 60e3]])) };
  return new Promise((z) => { const p = spawn(process.execPath, [path.join(AQUI, 'esportes.mjs'), '--agora', new Date(agora).toISOString(), '--sem-google', '--sem-traducao'], { cwd: dir, env: { ...process.env, ESPORTES_FONTES_LOCAIS: JSON.stringify(fontes), NTFY_TOPIC_MUSICA: 'mus', NTFY_TOPIC_COMANDO: 'cmd', NTFY_ASSINATURA: 'chave', NTFY_SERVIDOR: SRV, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '10' } }); let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => z({ c, o })); }); };
const lem = () => recebidos.filter((x) => /^Lembrete: assine/.test(x.title));
let r = await roda(t('2026-11-17T09:00')); assert.equal(r.c, 0, r.o); assert.equal(recebidos.filter((x) => x.title === 'Fênix: assine Séries e Filmes e Esportes').length, 1, 'convite original no 1º dia'); assert.equal(lem().length, 0);
r = await roda(t('2026-11-20T23:30')); assert.equal(r.c, 0, r.o); assert.equal(lem().length, 0, 'de noite não lembra');
r = await roda(t('2026-11-20T11:30')); assert.equal(r.c, 0, r.o); assert.equal(lem().length, 1, 'lembra uma vez de dia'); assert.equal(lem()[0].topic, 'mus'); assert.equal(lem()[0].priority, 3);
r = await roda(t('2026-11-20T11:40')); assert.equal(r.c, 0, r.o); assert.equal(lem().length, 1, 'não repete');
r = await roda(t('2026-11-21T11:40')); assert.equal(r.c, 0, r.o); assert.equal(lem().length, 1, 'não repete no dia seguinte');
assert.equal(recebidos.filter((x) => x.title === 'Fênix: assine Séries e Filmes e Esportes').length, 1, 'convite original nunca repete');
srv.close(); console.log('lembrete (ponta a ponta, esportes.mjs): 5 rodadas OK | avisos recebidos no ntfy falso:', recebidos.length);
console.log('LEMBRETE OK');
