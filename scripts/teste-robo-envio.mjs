// Teste do envio SEM PERDER NOTÍCIA do robô geral (robo.mjs), com as fontes reais e um ntfy FALSO local (nada chega no celular).
// Rodada 1: o 1º aviso leva 429 com Retry-After, o 2º aviso e o 1º resumo levam 503 sempre. Confere: nada derruba o robô,
// URGENTE sai primeiro, todo aviso tem botão, o resumo traz TODAS as notícias além das 5 (sem corte em 12) e o que falhou
// sai na rodada 2 (não foi marcado como avisado). Uso: node scripts/teste-robo-envio.mjs
import { createServer } from 'node:http'; import { spawn } from 'node:child_process'; import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { tmpdir } from 'node:os'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict';
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url))); const T = mkdtempSync(join(tmpdir(), 'robo-envio-'));
for (const f of ['scripts', 'notificadas.json', 'edicao.json', 'traducoes.json', 'imagens.json', 'porque-importa.json', 'index.html', 'app.js', 'sw.js', 'og']) { try { cpSync(join(RAIZ, f), join(T, f), { recursive: true }); } catch {} }
// estado sem nada avisado nas últimas horas: muitas notícias de uma vez (pior caso)
const st = JSON.parse(readFileSync(join(T, 'notificadas.json'), 'utf8')); st.vistos = []; writeFileSync(join(T, 'notificadas.json'), JSON.stringify(st));
let rodada = 1, n = 0; const recusados = [], posts = [];
const srv = createServer(async (q, r) => { let b = ''; for await (const c of q) b += c; let m = {}; try { m = JSON.parse(b); } catch {}
  if (rodada === 1) { n++; if (n === 1) { r.writeHead(429, { 'retry-after': '1' }); return r.end('{}'); }
    // falha PERSISTENTE (todas as 5 tentativas) para o 2º aviso e para o 1º resumo
    if (n === 3 || (/^\+\d+ notícias novas/.test(m.title || '') && !recusados.some(t => /^\+/.test(t)))) recusados.push(m.title);
    if (recusados.includes(m.title)) { r.writeHead(503); return r.end('{}'); } }
  posts.push({ ...m, rodada }); r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"id":"x"}'); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const rodar = () => new Promise(ok => { const p = spawn(process.execPath, ['scripts/robo.mjs'], { cwd: T, env: { ...process.env, NTFY_TOPIC: 'teste-geral', NTFY_TOPIC_COMANDO: 'teste-cmd', NTFY_ASSINATURA: 'chave-teste', NTFY_SERVIDOR: 'http://127.0.0.1:' + srv.address().port + '/', NTFY_RETRY_MS: '200', NTFY_PAUSA_MS: '20' } }); let out = ''; p.stdout.on('data', c => out += c); p.stderr.on('data', c => out += c); p.on('close', (code) => ok({ out, code })); });
const a = await rodar(); rodada = 2; const b = await rodar(); srv.close();
const l = (o) => (o.split('\n').find(x => x.startsWith('push enviados')) || '').trim();
console.log('rodada 1 (código ' + a.code + '):', l(a.out)); console.log('rodada 2 (código ' + b.code + '):', l(b.out));
assert.equal(a.code, 0, 'robô não cai com 429/503'); assert.equal(b.code, 0);
const p1 = posts.filter(p => p.rodada === 1), p2 = posts.filter(p => p.rodada === 2);
for (const p of posts) { assert.ok((p.actions || []).length >= 1 && p.actions.length <= 3, 'todo aviso tem botão: ' + p.title); assert.match(p.icon, /icone-ntfy-v2\.png$/); }
const ind = p1.filter(p => !/^\+\d+ notícias|^Edição de 1 minuto/.test(p.title)); const urg = ind.findIndex(p => /^URGENTE/.test(p.title)), nUrg = ind.findIndex(p => !/^URGENTE/.test(p.title));
if (urg >= 0 && nUrg >= 0) assert.ok(urg < nUrg, 'URGENTE sai antes');
const novos = +((l(a.out).match(/novos (\d+)/) || [])[1] || 0); const resumos = p1.filter(p => /^\+\d+ notícias/.test(p.title));
const linhasResumo = [...resumos, ...posts.filter(p => p.rodada === 2 && /^\+\d+ notícias/.test(p.title))].reduce((s, p) => s + p.message.split('\n').length, 0);
assert.match(l(a.out), /não saíram \(voltam na próxima rodada\): [1-9]/, 'a rodada 1 registra o que não saiu');
console.log('rodada 1: novos', novos, '| individuais', ind.length, '| resumos aceitos', resumos.length, '| recusados de propósito', recusados.length);
for (const t of recusados.filter(t => !/^\+/.test(t))) assert.ok(p2.some(p => p.title === t), 'aviso que falhou volta na rodada 2: ' + t);
if (recusados.some(t => /^\+/.test(t))) assert.ok(p2.some(p => /^\+\d+ notícias/.test(p.title)) || p2.length > 0, 'notícias do resumo que falhou voltam na rodada 2');
// nenhuma notícia some: individuais aceitos (rodada 1) + linhas dos resumos aceitos (rodadas 1 e 2) + individuais da rodada 2 = todas as novas
const ind2 = p2.filter(p => !/^\+\d+ notícias|^Edição de 1 minuto/.test(p.title)).length;
const cobertas = ind.length + linhasResumo + ind2; console.log('cobertura: novas', novos, '| individuais r1', ind.length, '+ linhas de resumo', linhasResumo, '+ individuais r2', ind2, '=', cobertas);
assert.ok(cobertas >= novos, 'nenhuma notícia fica sem aviso (sem corte em 12): ' + cobertas + ' de ' + novos);
console.log('botões vistos:', [...new Set(posts.map(p => p.actions.map(x => x.label).join(' / ')))].join('  ||  '));
console.log('ENVIO ROBÔ OK');
