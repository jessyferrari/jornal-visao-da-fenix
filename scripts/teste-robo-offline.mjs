// Robô geral (robo.mjs) inteiro, SEM REDE (17/11): as fontes são simuladas e o ntfy é um servidor local (nada chega no celular).
// Prova de ponta a ponta o pedido da Jessyca ("clico na notificação, vou para o site, ela some e não tem botão"):
//  R1: notícia de 1 fonte chega sem toque para o site, com 🔎 Apurar no agente / Ver notícia / Não, e fica guardada em apuração.
//  R2: um 2º veículo confirma: sai "✅ Confirmado" com ✅ Sim, publicar, uma vez só (R3 não repete).
// Também pega erro de ordem no código (variável usada antes de existir), que derrubou a Música em 17/11. Uso: node scripts/teste-robo-offline.mjs
import { createServer } from 'node:http'; import { spawn } from 'node:child_process'; import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { tmpdir } from 'node:os'; import { fileURLToPath, pathToFileURL } from 'node:url'; import assert from 'node:assert/strict';
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url))); const T = mkdtempSync(join(tmpdir(), 'robo-offline-'));
for (const f of ['scripts', 'traducoes.json', 'imagens.json', 'porque-importa.json', 'index.html', 'app.js', 'sw.js', 'og']) { try { cpSync(join(RAIZ, f), join(T, f), { recursive: true }); } catch {} }
const MOCK = join(T, 'mock-fontes.mjs');
writeFileSync(MOCK, `const real = globalThis.fetch; const R = +process.env.MOCK_RODADA;
const min = (m) => new Date(Date.now() - m * 60e3).toUTCString();
const rss = (l) => '<?xml version="1.0"?><rss><channel><title>x</title>' + l.map(([t, h, m]) => '<item><title>' + t + '</title><link>' + h + '</link><pubDate>' + min(m) + '</pubDate><description>' + t + '</description></item>').join('') + '</channel></rss>';
const CNN = ['Jensen Huang renuncia ao comando da Nvidia em meio a escândalo', 'https://www.cnnbrasil.com.br/economia/huang-renuncia-nvidia/', 12];
const G1 = ['Jensen Huang renuncia ao comando da Nvidia após escândalo, diz empresa', 'https://g1.globo.com/tecnologia/noticia/huang-renuncia-nvidia.ghtml', 6];
const PAL = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray', 'Yankee', 'Zulu'];
const BASE = PAL.map((w, k) => ['Cidade ' + w + ' recebe obra número ' + (k + 1) + ' do bairro ' + w + 'zinho', 'https://www.estadao.com.br/sp/obra-' + k + '/', 240 + k]);   // a edição precisa de 20+ notícias
globalThis.fetch = async (u, o) => { const s = String(u);
  if (s.startsWith('http://127.0.0.1')) return real(u, o);
  if (s === 'https://www.cnnbrasil.com.br/feed/') return new Response(rss(R >= 1 ? [CNN] : []), { status: 200 });
  if (s === 'https://g1.globo.com/rss/g1/') return new Response(rss(R >= 2 ? [G1] : []), { status: 200 });
  if (s.startsWith('https://www.estadao.com.br/arc/outboundfeeds')) return new Response(rss(BASE.slice(0, 13)), { status: 200 });   // até 14 por veículo e seção
  if (s === 'https://rss.uol.com.br/feed/noticias.xml') return new Response(rss(BASE.slice(13)), { status: 200 });
  return new Response('', { status: 404 }); };`);
let rodada = 0; const posts = [];
const srv = createServer(async (q, r) => { let b = ''; for await (const c of q) b += c; let m = {}; try { m = JSON.parse(b); } catch {} posts.push({ ...m, rodada }); r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"id":"x"}'); });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const rodar = () => new Promise((ok) => { const p = spawn(process.execPath, ['--import', pathToFileURL(MOCK).href, 'scripts/robo.mjs'], { cwd: T, env: { ...process.env, MOCK_RODADA: String(rodada), NTFY_TOPIC: 'teste-geral', NTFY_TOPIC_COMANDO: 'teste-cmd', NTFY_ASSINATURA: 'chave-teste', NTFY_SERVIDOR: 'http://127.0.0.1:' + srv.address().port + '/', NTFY_RETRY_MS: '50', NTFY_PAUSA_MS: '5', GITHUB_STEP_SUMMARY: '' } });
  let out = ''; p.stdout.on('data', (c) => out += c); p.stderr.on('data', (c) => out += c); p.on('close', (code) => ok({ out, code })); });
let n = 0; const ok = (t) => console.log('ok ' + (++n) + ' ' + t);
try {
  const r0 = await rodar(); assert.equal(r0.code, 0, r0.out.slice(-1500)); ok('rodada semente (sem notificadas.json) roda sem erro e não avisa nada: ' + posts.length + ' avisos');
  rodada = 1; const r1 = await rodar(); assert.equal(r1.code, 0, r1.out.slice(-1500));
  const a = posts.find((p) => p.rodada === 1 && /Jensen Huang/.test(p.title || ''));
  assert.ok(a, 'a notícia de 1 fonte foi avisada\n' + r1.out.slice(-800));
  assert.ok(!('click' in a), 'o toque não abre mais o site');
  assert.deepEqual(a.actions.map((x) => x.label), ['🔎 Apurar no agente', 'Ver notícia', 'Não']);
  assert.ok(!JSON.stringify(a.actions).includes('Sim, publicar'), '1 fonte nunca tem Sim, publicar');
  const ap = JSON.parse(a.actions[0].body); assert.equal(ap.acao, 'apurar'); assert.match(ap.sig, /^[a-f0-9]{32}$/); assert.equal(ap.link, 'https://www.cnnbrasil.com.br/economia/huang-renuncia-nvidia/');
  assert.equal(a.actions[1].url, ap.link);
  const st1 = JSON.parse(readFileSync(join(T, 'notificadas.json'), 'utf8')); assert.ok(Object.keys(st1.apuracao || {}).length >= 1, 'guardada em apuração');
  ok('1 fonte: sem toque para o site; 🔎 Apurar no agente / Ver notícia / Não; guardada em apuração');
  rodada = 2; const r2 = await rodar(); assert.equal(r2.code, 0, r2.out.slice(-1500));
  // o 2º veículo chega como aviso novo (o do g1, já com 2 veículos) ou, se o grupo já foi avisado, como "✅ Confirmado": os dois com Sim, publicar
  const c = posts.find((p) => p.rodada === 2 && /Jensen Huang/.test(p.title || ''));
  assert.ok(c, 'a confirmação chegou\n' + r2.out.split('\n').filter((l) => /apura|push|confirm/i.test(l)).join('\n'));
  assert.ok(c.actions.some((x) => /Sim, publicar/.test(x.label)), 'confirmada tem Sim, publicar: ' + JSON.stringify(c.actions.map((x) => x.label)));
  assert.ok(!('click' in c), 'toque abre o ntfy com os botões');
  const st2 = JSON.parse(readFileSync(join(T, 'notificadas.json'), 'utf8')); assert.equal(Object.keys(st2.apuracao || {}).length, 0, 'saiu da apuração');
  ok('2º veículo confirmou: chegou com ✅ Sim, publicar (' + c.title.slice(0, 60) + ') e saiu da apuração');
  rodada = 3; const r3 = await rodar(); assert.equal(r3.code, 0);
  assert.equal(posts.filter((p) => p.rodada === 3 && /Jensen Huang/.test(p.title || '')).length, 0); ok('a notícia não se repete na rodada seguinte');
  console.log('TODOS OS TESTES PASSARAM: ' + n);
} finally { srv.close(); rmSync(T, { recursive: true, force: true }); }
