// Teste do toque e dos botões das notificações (17/11). Sem rede.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { paraMesa, botoesApurar, toqueNoNtfy, idDoLink, confirmadosDeApuracao, podeConfirmar, marcarConfirmado, JORNAL } from './ntfy-acoes.mjs';
let n = 0; const t = (nome, f) => { f(); console.log('ok ' + (++n) + ' ' + nome); };
const ASS = 'k'.repeat(48), CMD = 'cmd-teste', link = 'https://www.cnnbrasil.com.br/economia/huang';

t('1 fonte: Apurar no agente / Ver notícia / Não, assinado, sem Sim, publicar', () => {
  const b = botoesApurar({ link, titulo: 'Saída de Huang', pot: { nota: 72, faixa: 'vale' }, origem: 'jornal', CMD, ASS });
  assert.deepEqual(b.map((x) => x.label), ['🔎 Apurar no agente', 'Ver notícia', 'Não']);
  const c = JSON.parse(b[0].body), id = idDoLink(link);
  assert.equal(c.acao, 'apurar'); assert.equal(c.id, id); assert.equal(c.sig, createHmac('sha256', ASS).update(id).digest('hex').slice(0, 32));
  assert.equal(c.link, link); assert.equal(c.nota, 72); assert.ok(!('fontes' in c) && !('fsig' in c), 'apurar nunca leva fontes assinadas');
  assert.ok(!b.some((x) => /publicar/i.test(x.label)));
  assert.equal(b[1].url, link); assert.equal(JSON.parse(b[2].body).acao, 'recusar');
});
t('sem segredo do agente: Ver notícia e Em apuração, como antes', () => {
  assert.deepEqual(botoesApurar({ link, titulo: 'x' }).map((x) => x.label), ['Ver notícia', '🔎 Em apuração']);
});
t('toque: aviso de notícia abre o ntfy (sem click) e o link fica no botão Ver notícia', () => {
  const m = toqueNoNtfy({ title: 'x', click: link, actions: botoesApurar({ link, titulo: 'x', CMD, ASS }) });
  assert.ok(!('click' in m)); assert.ok(m.actions.some((a) => a.label === 'Ver notícia' && a.url === link));
  const m2 = toqueNoNtfy({ title: 'x', click: link, actions: [{ action: 'http', label: 'Sim', body: '{}' }] });
  assert.ok(!('click' in m2)); assert.equal(m2.actions[1].url, link, 'sem botão Ver notícia: ele é criado');
});
t('toque: resumos e páginas do jornal continuam abrindo o jornal; sem espaço para o link, o toque fica', () => {
  const r = { title: '+12 notícias', click: JORNAL + '/', actions: [{ action: 'view', label: 'Abrir jornal', url: JORNAL + '/' }] };
  assert.deepEqual(toqueNoNtfy(r), r);
  const cheio = { title: 'x', click: link, actions: [{ action: 'http', label: 'a' }, { action: 'http', label: 'b' }, { action: 'http', label: 'c' }] };
  assert.equal(toqueNoNtfy(cheio).click, link);
  assert.equal(toqueNoNtfy({ title: 'sem botões', click: link }).click, link);
});
t('em apuração que ganhou a 2ª fonte volta uma vez com Sim, publicar; limite de 15 por dia', () => {
  const agora = Date.parse('2026-11-17T11:00:00-03:00');
  const st = { apuracao: { a: { t: agora - 3600e3, titulo: 'A' }, velha: { t: agora - 30 * 3600e3, titulo: 'V' } } };
  const itens = [{ key: 'b', grp: [{ key: 'a' }], cov: { n: 2 } }, { key: 'velha', grp: [], cov: { n: 2 } }, { key: 'z', grp: [], cov: { n: 3 } }];
  const c = confirmadosDeApuracao(itens, st, { agora });
  assert.equal(c.length, 1); assert.equal(c[0].chave, 'a', 'acha pelo grupo, mesmo com outro veículo à frente');
  marcarConfirmado(st, 'a', { agora }); assert.ok(!st.apuracao.a); assert.equal(confirmadosDeApuracao(itens, st, { agora }).length, 0, 'não repete');
  st.confDia = { dia: '2026-11-17', n: 15 }; assert.equal(podeConfirmar(st, { agora }), false);
  assert.equal(podeConfirmar(st, { agora: agora + 86400e3 }), true, 'novo dia zera');
});
// 18/11: prioridade 1 (Opcional) vai para <tópico>-mesa; o resto fica no tópico de sempre; nunca dobra o sufixo
{ const a = toqueNoNtfy({ topic: 'jornal-x', priority: 1, title: 'o', click: 'https://g1.globo.com/a', actions: [{ action: 'http', label: 'Sim, publicar', url: 'u' }] });
  assert.equal(a.topic, 'jornal-x-mesa'); assert.equal(paraMesa({ topic: 'jornal-x-mesa', priority: 1 }).topic, 'jornal-x-mesa');
  assert.equal(toqueNoNtfy({ topic: 'jornal-x', priority: 2, title: 'v' }).topic, 'jornal-x'); assert.equal(toqueNoNtfy({ topic: 'jornal-x', priority: 5, title: 'n' }).topic, 'jornal-x');
  console.log('ok Opcional vai para a Mesa, Vale e Não deixe ficam no celular'); }
console.log('TODOS OS TESTES PASSARAM: ' + n);
