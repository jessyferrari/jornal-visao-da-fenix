// Teste do disjuntor do ntfy (20/11), com as fontes reais e um ntfy FALSO local (nada chega no celular).
// Reproduz o que derrubou a rodada de 20/11 09:18 (Brasília): o ntfy responde 429 com Retry-After: 60 em TODO aviso.
// Antes: cada aviso levava ~5 min e o job estourava. Agora: com prazo de 8 s, o robô termina rápido, código 0,
// publica a edição, e nenhum aviso é marcado como enviado (todos voltam na próxima rodada). Uso: node scripts/teste-disjuntor.mjs
import { createServer } from 'node:http'; import { spawn } from 'node:child_process'; import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { tmpdir } from 'node:os'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict';
import { criarDisjuntor } from './disjuntor.mjs';
// 1) unidade: prazo e abertura
{ let t = 0; const d = criarDisjuntor({ prazoMs: 1000, agora: () => t }); assert.equal(d.aberto(), false); assert.equal(d.resta(), 1000);
  t = 999; assert.equal(d.aberto(), false); t = 1000; assert.equal(d.aberto(), true, 'prazo esgotado abre');
  const d2 = criarDisjuntor({ prazoMs: 60000 }); d2.abrir(); assert.equal(d2.aberto(), true, 'abrir() abre');
  const d3 = criarDisjuntor({ prazoMs: 300 }); const t0 = Date.now(); await d3.espera(60000); assert.ok(Date.now() - t0 < 2000, 'espera nunca passa do prazo'); }
console.log('disjuntor (unidade): 5 verificações OK');
// 2) robô geral inteiro com o ntfy sempre em 429 + Retry-After: 60
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url))); const T = mkdtempSync(join(tmpdir(), 'robo-disj-'));
for (const f of ['scripts', 'notificadas.json', 'edicao.json', 'traducoes.json', 'imagens.json', 'porque-importa.json', 'index.html', 'app.js', 'sw.js', 'og']) { try { cpSync(join(RAIZ, f), join(T, f), { recursive: true }); } catch {} }
const st = JSON.parse(readFileSync(join(T, 'notificadas.json'), 'utf8')); st.vistos = []; delete st.ritmo; writeFileSync(join(T, 'notificadas.json'), JSON.stringify(st));
let pedidos = 0; const srv = createServer(async (q, r) => { for await (const _ of q); pedidos++; r.writeHead(429, { 'retry-after': '60' }); r.end('{}'); });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const ini = Date.now();
const res = await new Promise((ok) => { const p = spawn(process.execPath, ['scripts/robo.mjs'], { cwd: T, env: { ...process.env, NTFY_TOPIC: 'teste-geral', NTFY_TOPIC_COMANDO: 'teste-cmd', NTFY_ASSINATURA: 'chave-teste', NTFY_SERVIDOR: 'http://127.0.0.1:' + srv.address().port + '/', NTFY_PRAZO_MS: '8000', NTFY_PAUSA_MS: '20' } });
  let out = ''; p.stdout.on('data', (c) => (out += c)); p.stderr.on('data', (c) => (out += c)); p.on('close', (code) => ok({ code, out })); });
srv.close(); const seg = Math.round((Date.now() - ini) / 1000);
const linha = (res.out.split('\n').find((x) => x.startsWith('push enviados')) || '').trim();
console.log('robô com ntfy em 429 (Retry-After 60): código', res.code, '| levou', seg, 's | pedidos ao ntfy', pedidos, '|', linha.slice(0, 160));
assert.equal(res.code, 0, 'robô não cai');
assert.match(res.out, /edição atualizada|sem mudança|lidas \d+/, 'a edição foi montada');
assert.match(linha, /push enviados 0 /, 'nenhum aviso marcado como enviado');
const novos = +((linha.match(/novos (\d+)/) || [])[1] || 0);
if (novos > 0) { assert.match(res.out, /ntfy fora nesta rodada/, 'depois do prazo, os avisos seguintes não esperam'); assert.ok(pedidos <= 6, 'no máximo as 5 tentativas do 1º aviso: ' + pedidos); }
assert.ok(seg < 240, 'robô termina bem antes do limite do job (antes: ~5 min por aviso): ' + seg + ' s');
console.log('DISJUNTOR OK');
