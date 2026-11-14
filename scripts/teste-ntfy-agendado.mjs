// Teste REAL no ntfy.sh (tópico de TESTE aleatório, nunca os canais dela) do aviso marcado "Hora de postar":
// 1) aviso com hora marcada (delay) e sequence_id; 2) troca do aviso marcado pelo mesmo sequence_id (quando o vídeo fica pronto);
// 3) cancelamento (DELETE). Confere que só a versão nova chega e que o cancelado nunca chega. Uso: node scripts/teste-ntfy-agendado.mjs
import { randomBytes } from 'node:crypto';
const SRV = (process.env.NTFY_SERVIDOR || 'https://ntfy.sh').replace(/\/$/, '');
const T = 'fenix-teste-' + randomBytes(6).toString('hex'); const espera = (ms) => new Promise((z) => setTimeout(z, ms));
const pub = async (o) => { const r = await fetch(SRV + '/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: T, ...o }) }); console.log('POST', r.status, o.title, o.delay ? '(marcado: ' + o.delay + ')' : ''); if (!r.ok) { console.log(await r.text()); process.exitCode = 1; } return r.json().catch(() => ({})); };
const ler = async (q) => (await (await fetch(SRV + '/' + T + '/json?poll=1&since=all' + q)).text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.event === 'message');
await pub({ title: 'TESTE · Hora de postar (versão 1)', message: 'v1', delay: '25s', sequence_id: 'agenda-aaa' });
await pub({ title: 'TESTE · Hora de postar (versão 2, vídeo pronto)', message: 'v2', delay: '30s', sequence_id: 'agenda-aaa', actions: [{ action: 'view', label: 'Abrir', url: 'https://example.com' }] });
await pub({ title: 'TESTE · vai ser cancelado', message: 'x', delay: '30s', sequence_id: 'agenda-bbb' });
const d = await fetch(SRV + '/' + T + '/agenda-bbb', { method: 'DELETE' }); console.log('DELETE', d.status, 'agenda-bbb');
const marcados = await ler('&scheduled=1'); console.log('marcados no servidor:', marcados.map((m) => m.title + ' [' + (m.sequence_id || m.id) + '] às ' + new Date(m.time * 1000).toISOString()).join(' | '));
await espera(40000);
const chegou = await ler(''); console.log('chegaram:', chegou.map((m) => m.title).join(' | '));
const okV2 = chegou.filter((m) => /versão 2/.test(m.title)).length === 1, semV1 = !chegou.some((m) => /versão 1/.test(m.title)), semCancel = !chegou.some((m) => /cancelado/.test(m.title));
console.log('versão nova chegou:', okV2, '| versão antiga não chegou:', semV1, '| cancelado não chegou:', semCancel);
if (okV2 && semV1 && semCancel) console.log('AVISO MARCADO, TROCA E CANCELAMENTO: OK'); else { console.log('FALHOU'); process.exitCode = 1; }
