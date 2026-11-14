// Teste REAL no ntfy.sh (tópico de TESTE aleatório, nunca os canais dela) do aviso marcado "Hora de postar":
// 1) aviso com hora marcada e sequence_id; 2) troca do aviso marcado pelo mesmo sequence_id; 3) cancelamento (DELETE).
// Testa 2 jeitos: A) JSON {sequence_id, delay}  B) caminho /<tópico>/<sequence_id> com cabeçalho In.
// Mostra o que o servidor faz de verdade. Falha só se NENHUM jeito trocar e cancelar. Uso: node scripts/teste-ntfy-agendado.mjs
import { randomBytes } from 'node:crypto';
const SRV = (process.env.NTFY_SERVIDOR || 'https://ntfy.sh').replace(/\/$/, '');
const T = 'fenix-teste-' + randomBytes(6).toString('hex'); const espera = (ms) => new Promise((z) => setTimeout(z, ms));
const v = await (await fetch(SRV + '/v1/health').catch(() => null))?.text?.().catch(() => '');
console.log('servidor:', SRV, 'health:', String(v || '').trim());
const json = async (o) => { const r = await fetch(SRV + '/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: T, ...o }) }); const j = await r.json().catch(() => ({})); console.log('A POST', r.status, o.title, 'resposta sequence_id=', j.sequence_id ?? '(nenhum)', 'time=', j.time); return j; };
const cab = async (seq, titulo, emSeg) => { const r = await fetch(SRV + '/' + T + '/' + seq, { method: 'POST', headers: { In: emSeg + 's', Title: titulo }, body: 'x' }); const j = await r.json().catch(() => ({})); console.log('B POST', r.status, titulo, 'resposta sequence_id=', j.sequence_id ?? '(nenhum)', 'time=', j.time); return j; };
const del = async (seq) => { const r = await fetch(SRV + '/' + T + '/' + seq, { method: 'DELETE' }); console.log('DELETE', r.status, seq, (await r.text()).slice(0, 120)); };
const ler = async (q) => (await (await fetch(SRV + '/' + T + '/json?poll=1&since=all' + q)).text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
await json({ title: 'A1 antigo', message: 'v1', delay: '25s', sequence_id: 'agenda-aaa' });
await json({ title: 'A2 novo', message: 'v2', delay: '30s', sequence_id: 'agenda-aaa' });
await json({ title: 'A3 cancelar', message: 'x', delay: '30s', sequence_id: 'agenda-bbb' });
await del('agenda-bbb');
await cab('agenda-ccc', 'B1 antigo', 25); await cab('agenda-ccc', 'B2 novo', 30); await cab('agenda-ddd', 'B3 cancelar', 30); await del('agenda-ddd');
const marc = await ler('&scheduled=1'); console.log('marcados no servidor:', marc.filter((m) => m.event === 'message').map((m) => m.title).join(' | ') || '(nenhum listado)');
await espera(42000);
const tudo = await ler(''); const msgs = tudo.filter((m) => m.event === 'message');
console.log('eventos:', tudo.map((m) => m.event + ':' + (m.title || m.sequence_id || '')).join(' | '));
const r = (p) => ({ novo: msgs.some((m) => m.title === p + '2 novo'), antigo: msgs.some((m) => m.title === p + '1 antigo'), cancel: msgs.some((m) => m.title === p + '3 cancelar') });
const A = r('A'), B = r('B');
for (const [n, x] of [['A (JSON)', A], ['B (caminho + In)', B]]) console.log(n, '| novo chegou:', x.novo, '| antigo chegou:', x.antigo, '| cancelado chegou:', x.cancel, x.novo && !x.antigo && !x.cancel ? '=> TROCA E CANCELAMENTO OK' : '=> não troca/cancela no servidor');
const ok = (x) => x.novo && !x.antigo && !x.cancel;
if (ok(A) || ok(B)) console.log('AVISO MARCADO, TROCA E CANCELAMENTO: OK (' + (ok(A) ? 'JSON' : 'caminho + In') + ')'); else { console.log('FALHOU: o servidor entrega os avisos marcados antigos'); process.exitCode = 1; }
