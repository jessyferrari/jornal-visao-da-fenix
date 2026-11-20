// Testes de 20/11 (t328, t329, t330): barra de atalhos sem cobrir conteúdo, reenvio único do convite de Games (que sumiu da barra),
// Vale postar 24 h (inclusive de 0h a 7h) e o resto silencioso. Nada é enviado de verdade: ntfy falso local.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { aplicarAtalhos } from './atalhos.mjs';
import { valePostar, prioridadeNota } from './potencial.mjs';
import { podeSubindo } from './subindo.mjs';
import * as S from './games-regras.mjs';
import * as P from './perfis-regras.mjs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
let ok = 0; const t = async (n, f) => { await f(); ok++; console.log('ok', n); };

await t('atalhos: os 6 botões continuam, mesmas cores, nenhum em position:fixed solto; #root encolhe; idempotente', () => {
  const velho = '<html><head><style>x</style></head><body><a id="jf-musica" href="musica.html" style="position:fixed;right:14px;bottom:14px">🎵 Música</a><a id="jf-games" href="games.html" style="position:fixed">🎮 Games</a><div id="root"></div></body></html>';
  const h1 = aplicarAtalhos(velho), h2 = aplicarAtalhos(h1);
  assert.equal(h1, h2);
  for (const id of ['jf-games', 'jf-emalta', 'jf-musica', 'jf-series', 'jf-esportes', 'jf-referencias']) assert.equal(h1.split('id="' + id + '"').length - 1, 1, id);
  assert.ok(!/<a id="jf-[^"]+"[^>]*position:fixed/.test(h1), 'nenhum atalho flutuando sobre o conteúdo');
  assert.match(h1, /<nav id="jf-atalhos"[^>]*>(<a id="jf-[a-z]+"[^>]*>[^<]+<\/a>){6}<\/nav>/);
  assert.match(h1, /#root\{height:calc\(100% - var\(--jf-barra\)/); assert.match(h1, /#root>div\.jf\{height:100%!important\}/);
  for (const cor of ['background:#d4af37;color:#111', 'background:#5fd38d;color:#111', 'background:#e0413a;color:#fff', 'background:#0d0b08;color:#d4af37;border:1.5px solid #d4af37']) assert.ok(h1.includes(cor), cor);
});
await t('Vale postar: só nota firme 70%+ (vale ou não deixe); provisória e opcional não', () => {
  assert.equal(valePostar({ faixa: 'vale', nota: 75 }), true); assert.equal(valePostar({ faixa: 'nao-deixe', nota: 92 }), true);
  assert.equal(valePostar({ faixa: 'vale', provisoria: true }), false); assert.equal(valePostar({ faixa: 'opcional' }), false); assert.equal(valePostar(null), false);
  assert.equal(prioridadeNota({ faixa: 'vale' }), 3); assert.equal(prioridadeNota({ faixa: 'nao-deixe' }), 4); assert.equal(prioridadeNota(null, 5), 4, 'nunca 5');
});
await t('Subindo agora de madrugada: só se for Vale postar (t330)', () => {
  const tres = Date.parse('2026-11-21T03:00:00-03:00'), dez = Date.parse('2026-11-21T10:00:00-03:00');
  assert.equal(podeSubindo({}, { agora: tres }), false); assert.equal(podeSubindo({}, { agora: tres, vale: true }), true); assert.equal(podeSubindo({}, { agora: dez }), true);
});
await t('convite de Games: toque no próprio aviso abre a assinatura; silencioso; reenvio diz que o 1º sumiu', () => {
  const a = S.avisoGames('https://ntfy.sh', 'mus'), b = S.avisoGames('https://ntfy.sh', 'mus', { reenvio: true });
  assert.equal(a.click, 'ntfy://ntfy.sh/mus-games?display=Fenix+Games'); assert.equal(a.priority, 2); assert.equal(b.priority, 2);
  assert.equal(b.title, 'Fênix: assine o canal Games (de novo)'); assert.match(b.message, /primeiro convite sumiu/);
});
await t('ponta a ponta: estado com o convite antigo (que sumiu) reenvia 1 vez só; estado novo não reenvia', async () => {
  const recebidos = []; const srv = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { recebidos.push(JSON.parse(b)); r.writeHead(200); r.end('{}'); }); });
  await new Promise((z) => srv.listen(0, z)); const SRV = 'http://127.0.0.1:' + srv.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't328-')); const agora = Date.parse('2026-11-20T12:40:00-03:00');
  fs.writeFileSync(path.join(dir, 'f.xml'), '<rss><channel></channel></rss>');
  const roda = () => new Promise((z) => { const p = spawn(process.execPath, [path.join(AQUI, 'games.mjs'), '--agora', new Date(agora).toISOString(), '--sem-google', '--sem-traducao'], { cwd: dir, env: { ...process.env, GAMES_FONTES_LOCAIS: JSON.stringify({ 'IGN Brasil': path.join(dir, 'f.xml') }), NTFY_TOPIC_MUSICA: 'mus', NTFY_TOPIC_COMANDO: 'cmd', NTFY_ASSINATURA: 'k', NTFY_SERVIDOR: SRV, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '10' } }); let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => z({ c, o })); });
  fs.writeFileSync(path.join(dir, 'games-estado.json'), JSON.stringify({ avisoGames: '2026-11-20T11:45', vistos: {}, excl: {} }));
  let r = await roda(); assert.equal(r.c, 0, r.o);
  assert.deepEqual(recebidos.map((x) => x.title), ['Fênix: assine o canal Games (de novo)'], r.o);
  assert.equal(recebidos[0].topic, 'mus'); assert.equal(recebidos[0].priority, 2); assert.match(recebidos[0].click, /^ntfy:\/\/127\.0\.0\.1:\d+\/mus-games\?display=Fenix\+Games$/);
  r = await roda(); assert.equal(r.c, 0, r.o); assert.equal(recebidos.length, 1, 'reenvio não repete');
  srv.close();
});
await t('perfis: manchete repetida no feed fica 1 vez; assunto já avisado por link do grupo não repete', () => {
  assert.equal(P.semRepetir('Influencer morre aos 29 anos: ‘Dor’ Influencer morre aos 29 anos: ‘Dor’'), 'Influencer morre aos 29 anos: ‘Dor’');
  assert.equal(P.semRepetir('Gol gol'), 'Gol gol');
  const now = Date.parse('2026-11-20T12:10:00-03:00');
  assert.equal(P.jaAvisadoAssunto({ key: 'a', title: 'x', ts: now, grp: [{ key: 'g1' }] }, new Set(['g1']), [], now), true);
  assert.equal(P.jaAvisadoAssunto({ key: 'a', title: 'Neymar anuncia aposentadoria do futebol e se despede da torcida do Santos', ts: now, grp: [] }, new Set(), [{ t: now - 3600e3, titulo: 'Neymar anuncia aposentadoria do futebol e se despede do Santos na Vila' }], now), true);
  assert.equal(P.jaAvisadoAssunto({ key: 'a', title: 'Neymar anuncia aposentadoria do futebol e se despede da torcida do Santos', ts: now, grp: [] }, new Set(), [{ t: now - 30 * 3600e3, titulo: 'Neymar anuncia aposentadoria do futebol e se despede do Santos na Vila' }], now), false, 'só últimas 24 h');
});
console.log('\nTODOS OS TESTES T328 PASSARAM:', ok);
