// Teste REAL no ntfy.sh, num tópico de TESTE aleatório (nunca os canais dela): manda os 3 tipos de aviso que o robô usa
// e lê de volta pelo /json?poll=1 para conferir que os botões e a logo chegaram. Uso: node scripts/teste-ntfy-botoes.mjs
import { randomBytes } from 'node:crypto';
const SRV = (process.env.NTFY_SERVIDOR || 'https://ntfy.sh').replace(/\/$/, '');
const T = 'fenix-teste-' + randomBytes(6).toString('hex'); const I = 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png';
const J = 'https://jessyferrari.github.io/jornal-visao-da-fenix/';
const msgs = [
  { title: 'TESTE · notícia com 2 fontes', message: 'Teste de botões (canal de teste)', click: 'https://g1.globo.com/', icon: I, actions: [{ action: 'http', label: '✅ Sim, publicar', url: SRV + '/' + T + '-cmd', method: 'POST', body: '{"acao":"teste"}', clear: true }, { action: 'view', label: 'Ver notícia', url: 'https://g1.globo.com/' }, { action: 'http', label: 'Não', url: SRV + '/' + T + '-cmd', method: 'POST', body: '{}', clear: true }] },
  { title: 'TESTE · notícia com 1 fonte', message: '🔎 Em apuração', click: 'https://g1.globo.com/', icon: I, actions: [{ action: 'view', label: 'Ver notícia', url: 'https://g1.globo.com/' }, { action: 'view', label: '🔎 Em apuração', url: J }] },
  { title: 'TESTE · +14 notícias novas no Jornal', message: '• a\n• b', click: J, icon: I, actions: [{ action: 'view', label: 'Abrir jornal', url: J }] },
];
for (const m of msgs) { const r = await fetch(SRV + '/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: T, ...m }) }); console.log('POST', r.status, m.title); if (!r.ok) process.exitCode = 1; }
const lidos = (await (await fetch(SRV + '/' + T + '/json?poll=1')).text()).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
for (const j of lidos) console.log('lido de volta de ' + SRV + ':', j.title, '| logo:', j.icon === I ? 'sim' : 'NÃO', '| botões:', (j.actions || []).map(a => a.action + ':' + a.label).join(' / '));
if (lidos.length !== 3 || lidos.some(j => !(j.actions || []).length || j.icon !== I)) { console.log('FALHOU'); process.exitCode = 1; } else console.log('BOTÕES E LOGO CHEGARAM: OK');
