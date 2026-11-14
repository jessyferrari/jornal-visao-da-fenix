// Teste ponta a ponta do Em Alta com as fontes públicas REAIS e um ntfy FALSO local (nada chega no celular de ninguém).
// Roda emalta.mjs 5 vezes numa cópia temporária, simulando o dia (07:10, 07:40, 13:05, 17:10, 20:05 de Brasília) e confere:
// aviso de assinatura uma vez só, resumos nos horários sem repetir, agenda às 7h, botões assinados, regra das 2 fontes,
// logo em todo aviso, no máximo 3 botões. Uso: node scripts/teste-emalta-e2e.mjs
import { createServer } from 'node:http'; import { spawn } from 'node:child_process'; import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { tmpdir } from 'node:os'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict';
import { assinar, assinarFontes, assinarAgenda, deBR } from './emalta-regras.mjs';
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url))); const T = mkdtempSync(join(tmpdir(), 'emalta-e2e-'));
for (const f of ['scripts', 'edicao.json']) cpSync(join(RAIZ, f), join(T, f), { recursive: true });
const posts = []; let primeiro = true;
const srv = createServer(async (q, r) => { let b = ''; for await (const c of q) b += c;
  if (primeiro) { primeiro = false; r.writeHead(429, { 'retry-after': '1' }); return r.end('{}'); }   // 1º envio leva 429: tem que tentar de novo
  let m = {}; try { m = JSON.parse(b); } catch {} posts.push({ ...m, _rodada: rodada }); r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"id":"x"}'); });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const MUS = 'teste-musica-emalta', ASS = 'chave-de-teste', CMD = 'teste-cmd'; let rodada = '';
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const rodar = (hh) => new Promise((ok) => { rodada = hh; const p = spawn(process.execPath, ['scripts/emalta.mjs', '--agora', hoje + 'T' + hh + ':00-03:00'], { cwd: T, env: { ...process.env, NTFY_TOPIC_MUSICA: MUS, NTFY_TOPIC_COMANDO: CMD, NTFY_ASSINATURA: ASS, NTFY_SERVIDOR: 'http://127.0.0.1:' + srv.address().port, NTFY_PAUSA_MS: '0', NTFY_RETRY_MS: '200' } });
  let o = ''; p.stdout.on('data', (c) => (o += c)); p.stderr.on('data', (c) => (o += c)); p.on('close', (c) => { console.log('--- rodada ' + hh + ' (saída ' + c + ')\n' + o.trim()); assert.equal(c, 0, 'emalta.mjs terminou com erro'); ok(o); }); });
for (const h of ['07:10', '07:40', '13:05', '17:10', '20:05']) await rodar(h);
srv.close();
const J = JSON.parse(readFileSync(join(T, 'emalta.json'), 'utf8')); const A = JSON.parse(readFileSync(join(T, 'atencao.json'), 'utf8'));
const avisos = posts.filter((p) => p.title === 'Fênix: assine o canal Em Alta');
assert.equal(avisos.length, 1, 'aviso de assinatura uma vez só'); assert.equal(avisos[0].topic, MUS, 'aviso vai no canal Música que ela já assina');
assert.match(avisos[0].actions[0].url, new RegExp('^ntfy://127\\.0\\.0\\.1:\\d+/' + MUS + '-alta\\?display=Fenix\\+Em\\+Alta$'));
const alta = posts.filter((p) => p !== avisos[0]);
for (const p of posts) { assert.equal(p.icon, 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png', 'logo em todo aviso'); assert.ok((p.actions || []).length >= 1 && p.actions.length <= 3, 'de 1 a 3 botões: ' + p.title); assert.ok(Buffer.byteLength(p.message || '') <= 3900, 'texto cabe nos 4.096 bytes do ntfy: ' + p.title); assert.ok(Buffer.byteLength(JSON.stringify(p)) < 8000, 'pedido cabe no limite do ntfy (2 x 4.096): ' + p.title); }
for (const p of alta) assert.equal(p.topic, MUS + '-alta', 'Em Alta só no canal Em Alta: ' + p.title);
const r07 = alta.filter((p) => /^☀️ Bom dia · Em Alta 07h00/.test(p.title)); assert.ok(r07.length >= 1, 'resumo das 7h saiu'); assert.ok(r07.every((p) => p._rodada === '07:10'), 'resumo das 7h não repete às 7h40');
assert.match(r07[0].message, /AGENDA DE POSTAGENS DE HOJE/); assert.match(r07[0].message, /dias medidos/);
assert.ok(alta.some((p) => /Em Alta 17h00/.test(p.title) && p._rodada === '17:10'), 'resumo das 17h'); assert.ok(alta.some((p) => /Em Alta 20h00/.test(p.title) && p._rodada === '20:05'), 'resumo das 20h');
assert.ok(!alta.some((p) => p._rodada === '07:10' && /^🚀 Subindo agora/.test(p.title)), 'na 1ª rodada nada é "Subindo agora"');
let assinados = 0;
for (const p of alta) for (const a of p.actions || []) if (a.action === 'http') { const b = JSON.parse(a.body); assinados++;
  assert.ok(['publicar', 'agendar'].includes(b.acao)); assert.ok(b.fontes >= 2, 'só com 2+ veículos: ' + b.titulo); assert.equal(b.sig, assinar(ASS, b.id)); assert.equal(b.fsig, assinarFontes(ASS, b.id, b.fontes)); assert.equal(a.url, 'http://127.0.0.1:' + new URL(a.url).port + '/' + CMD);
  if (b.acao === 'agendar') { assert.equal(b.asig, assinarAgenda(ASS, b.id, b.dia, b.hora)); assert.ok(deBR(b.dia, b.hora) - deBR(hoje, p._rodada) >= 75 * 60e3, 'Agendar só com 75 min de folga para produzir: ' + b.hora + ' na rodada ' + p._rodada); } }
for (const i of J.itens) if (!i.publicavel) assert.ok(i.veiculos.length < 2);
assert.ok(J.agenda.curva.dias >= 20, 'curva com 20+ dias completos (Wikipedia, até 35)'); assert.ok(Object.keys(A.horas).length >= 24 * 20);
console.log('\nposts no ntfy falso:', posts.length, '| aviso de assinatura 1 | botões assinados conferidos', assinados);
for (const p of posts) console.log('  [' + p._rodada + '] [' + (p.topic === MUS ? 'canal Música' : 'canal Em Alta') + '] ' + p.title + '  ||  ' + (p.actions || []).map((a) => a.label).join(' / '));
console.log('\n1º resumo (07:10):\n' + r07[0].message.split('\n').slice(0, 16).join('\n'));
console.log('\nE2E EM ALTA OK');
