// Teste ponta a ponta da Música com as fontes públicas reais e um ntfy FALSO local (nada chega no celular de ninguém).
// Roda musica.mjs 2 vezes numa cópia temporária do repositório e confere: SP só no canal SP, o resto no canal Música,
// aviso de assinatura uma vez só, nenhum botão de post com menos de 2 fontes. Uso: node scripts/teste-musica-e2e.mjs [--hora 15]
import { createServer } from 'node:http'; import { spawnSync, spawn } from 'node:child_process'; import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { tmpdir } from 'node:os'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict';
import { assinarFontes } from './musica-regras.mjs';
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url))); const T = mkdtempSync(join(tmpdir(), 'musica-e2e-'));
for (const f of ['scripts', 'musica-estado.json', 'musica-locais.json', 'musica-traducoes.json']) { try { cpSync(join(RAIZ, f), join(T, f), { recursive: true }); } catch {} }
// --estado-limpo: começa sem notícias já avisadas (para ver o roteamento com muitas notícias de uma vez)
if (process.argv.includes('--estado-limpo')) { const { writeFileSync } = await import('node:fs'); let E = {}; try { E = JSON.parse(readFileSync(join(T, 'musica-estado.json'), 'utf8')); } catch {} E.notificadas = []; E.madrugada = []; delete E.avisoSP; writeFileSync(join(T, 'musica-estado.json'), JSON.stringify(E)); }
// falhas de propósito na rodada 1: o 1º envio leva 429 com Retry-After e todo aviso '🔥' leva 503 (o ntfy fora do ar para eles)
let rodada = 1, primeiro = true; const recusados = [];
const posts = []; const srv = createServer(async (q, r) => { let b = ''; for await (const c of q) b += c; let m = {}; try { m = JSON.parse(b); } catch {}
  if (q.method === 'POST' && rodada === 1 && primeiro) { primeiro = false; r.writeHead(429, { 'retry-after': '1' }); return r.end('{}'); }
  if (q.method === 'POST' && rodada === 1 && /^🔥/.test(m.title || '')) { recusados.push(m.title); r.writeHead(503); return r.end('{}'); }
  if (q.method === 'POST') posts.push(m); r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"id":"x"}'); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const MUS = 'teste-musica-e2e', ASS = 'chave-de-teste'; const hArg = process.argv.indexOf('--hora'); const hora = hArg > 0 ? process.argv[hArg + 1] : '15';
const rodar = () => new Promise(ok => { const p = spawn(process.execPath, ['scripts/musica.mjs', '--hora', hora], { cwd: T, env: { ...process.env, NTFY_TOPIC_MUSICA: MUS, NTFY_TOPIC_COMANDO: 'teste-cmd', NTFY_ASSINATURA: ASS, NTFY_SERVIDOR: 'http://127.0.0.1:' + srv.address().port, NTFY_RETRY_MS: '200', NTFY_PAUSA_MS: '50' } }); let out = ''; p.stdout.on('data', c => out += c); p.stderr.on('data', c => out += c); p.on('close', () => ok(out)); });
const o1 = await rodar(); const n1 = posts.length; rodada = 2; const o2 = await rodar(); srv.close();
// SEM PERDER NOTÍCIA: o que levou 503 na rodada 1 não foi marcado como avisado e saiu na rodada 2
const r1 = [...new Set(recusados)]; const saiu2 = new Set(posts.slice(n1).map(p => p.title));
console.log('rodada 1: recusados pelo ntfy falso', r1.length, '| 429 com Retry-After respeitado:', /assine o canal/.test(posts[0] && posts[0].title || '') ? 'sim (o aviso saiu na 2ª tentativa)' : 'ver log');
for (const t of r1) assert.ok(saiu2.has(t), 'aviso que falhou volta na rodada seguinte: ' + t);
if (r1.length) assert.match(o1.split('\n').find(l => l.startsWith('PUSH por canal')) || '', /NÃO SAÍRAM/);
const linha = (o, k) => (o.split('\n').find(l => l.startsWith(k)) || '').trim();
console.log('rodada 1:', linha(o1, 'PUSH por canal'), '|', linha(o1, 'fontes ok')); console.log('rodada 2:', linha(o2, 'PUSH por canal'));
const J = JSON.parse(readFileSync(join(T, 'musica.json'), 'utf8'));
const avisos = posts.filter(p => /assine o canal Música São Paulo/.test(p.title || ''));
assert.equal(avisos.length, 1, 'aviso SP uma vez só (rodada 1), não repete na rodada 2'); assert.equal(avisos[0].topic, MUS, 'aviso vai no canal Música que ela já assina');
assert.match(avisos[0].actions[0].url, new RegExp('^ntfy://127\\.0\\.0\\.1:\\d+/' + MUS + '-sp\\?display=Fenix\\+Musica\\+SP$'));
for (const p of posts) { assert.ok([MUS, MUS + '-sp'].includes(p.topic), 'só os 2 canais da música'); assert.equal(p.icon, 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png', 'logo em toda notificação'); assert.ok((p.actions || []).length >= 1 && p.actions.length <= 3, 'todo aviso tem botão visível: ' + p.title); }
for (const p of posts) if (/fonte|Quente|Lançamento|DJs|Música|Samba|Pagode/.test(p.title) && p.click && !/musica\.html$/.test(p.click)) { assert.ok(p.actions.some(a => a.label === 'Ver notícia' && a.url === p.click), 'notícia tem Ver notícia: ' + p.title); }
const sp = posts.filter(p => p.topic === MUS + '-sp'), mus = posts.filter(p => p.topic === MUS && p !== avisos[0]);
for (const p of sp) assert.ok(/ SP\b|SP:|SP$/.test(p.title) || (p.tags || []).includes('sp'), 'no canal SP só São Paulo: ' + p.title);
for (const p of mus) assert.ok(!(p.tags || []).includes('sp') && !/Quente SP\b|DJs e Festivais SP\b|Música SP\b/.test(p.title), 'São Paulo não vai no canal Música: ' + p.title);
let comBotao = 0; for (const p of posts) for (const a of p.actions || []) if (a.action === 'http' && /"acao":"publicar"/.test(a.body || '')) { const b = JSON.parse(a.body); comBotao++; assert.ok(b.fontes >= 2, 'botão Sim, publicar só com 2+ fontes'); assert.equal(b.fsig, assinarFontes(ASS, b.id, b.fontes), 'número de fontes assinado'); }
const todos = JSON.stringify(J); const itens = []; JSON.parse(todos, (k, v) => { if (v && typeof v === 'object' && 'fontes' in v && 'titulo' in v) itens.push(v); return v; });
for (const i of itens) { if (i.fontes < 2) assert.ok(!i.fazerPost && i.emApuracao, '1 fonte: sem Fazer post, em apuração: ' + i.titulo); }
console.log('posts no ntfy falso: rodada 1', n1, '| rodada 2', posts.length - n1, '| canal SP', sp.length, '| canal Música', mus.length, '| aviso SP', avisos.length, '| botões Sim, publicar conferidos', comBotao);
console.log('botões por aviso:', posts.map(p => (p.actions || []).map(a => a.label).join(' / ')).filter((x, i, a) => a.indexOf(x) === i).join('  ||  '));
console.log('itens na página:', itens.length, '| com 1 fonte (em apuração, sem Fazer post):', itens.filter(i => i.fontes < 2).length, '| com 2+ fontes:', itens.filter(i => i.fontes >= 2).length);
for (const p of posts) console.log('  [' + (p.topic === MUS + '-sp' ? 'canal SP' : 'canal Música') + ']', p.title);
const nog = itens.filter(i => /Jo[aã]o Nogueira/.test(i.titulo)).map(i => i.titulo.slice(0, 70) + ' | fontes ' + i.fontes + ' | ' + (i.local || '') + ' | furo ' + JSON.stringify(i.furo || null)); console.log('João Nogueira na página:', nog.length ? nog : '(fora da janela de 48 h nesta rodada)');
console.log('Ticket360:', linha(o1, 'ok ') && (o1.split('\n').find(l => /Ticket360/.test(l)) || '').trim());
console.log('E2E OK');
