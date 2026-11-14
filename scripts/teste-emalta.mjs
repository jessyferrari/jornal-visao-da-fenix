// Testes das regras do Em Alta (sem rede). Uso: node scripts/teste-emalta.mjs
import assert from 'node:assert/strict';
import * as R from './emalta-regras.mjs';
import { createHmac } from 'node:crypto';
let n = 0; const ok = (nome, f) => { f(); console.log('ok', ++n, nome); };
const V = (...nomes) => nomes.map((x) => ({ nome: x, titulo: 't ' + x, link: 'https://' + x.toLowerCase().replace(/ /g, '') + '.com/a' }));
const H = Date.parse('2026-11-14T15:00:00-03:00');

ok('canal Em Alta = canal Música + -alta; aviso com botão Assinar Em Alta (ntfy://)', () => {
  assert.equal(R.topicoAlta('fenix-musica-abc'), 'fenix-musica-abc-alta'); assert.equal(R.topicoAlta(''), ''); assert.equal(R.topicoAlta('x'.repeat(60)), '');
  const a = R.avisoAlta('https://ntfy.sh', 'fenix-musica-abc'); assert.equal(a.title, 'Fênix: assine o canal Em Alta'); assert.equal(a.actions[0].label, 'Assinar Em Alta'); assert.equal(a.actions[0].url, 'ntfy://ntfy.sh/fenix-musica-abc-alta?display=Fenix+Em+Alta');
});
ok('junta sinais do mesmo assunto em fontes diferentes (Google, X, imprensa, Wikipedia)', () => {
  const T = R.juntar([
    { tipo: 'gt', termo: 'mpox', escopo: 'br', veiculos: V('G1', 'CNN Brasil'), dados: { trafego: '2000+', inicio: H - 3600e3 } },
    { tipo: 'x', termo: '#Mpox', escopo: 'br', dados: { posicao: 4, melhor: 4, horas: 2 } },
    { tipo: 'imprensa', termo: 'Ministério confirma novos casos de mpox em SP', texto: 'Ministério confirma novos casos de mpox em SP', eid: 'e1', escopo: 'br', veiculos: V('Folha', 'G1') },
    { tipo: 'wiki', termo: 'Jensen Huang', escopo: 'br', dados: { views: 21150 } },
    { tipo: 'x', termo: '#JensenHuang', escopo: 'br', dados: { posicao: 8, melhor: 8, horas: 1 } },
  ]);
  assert.equal(T.length, 2); const m = T.find((t) => t.termo === 'mpox'); assert.deepEqual(m.tipos.sort(), ['gt', 'imprensa', 'x']); assert.equal(m.veiculos.length, 3, 'G1 não conta 2 vezes');
  assert.ok(T.find((t) => /jensen/i.test(t.termo)).tipos.length === 2);
});
ok('data e dia da semana não juntam assuntos diferentes ("Sexta-feira 13" não engole notícias)', () => {
  const T = R.juntar([{ tipo: 'wiki', termo: 'Sexta-feira 13', escopo: 'br', dados: { views: 4000 } }, { tipo: 'imprensa', termo: 'Navio vira em Nova Orleans', texto: 'Navio vira em Nova Orleans nesta sexta-feira 13', eid: 'e2', escopo: 'mundo', veiculos: V('BBC', 'Folha') }]);
  assert.equal(T.length, 2); assert.equal(R.casa('gilmar', 'Gilmar Mendes vota'), true); assert.equal(R.casa('gil', 'Gil'), false, 'palavra curta não casa');
});
ok('lista sem tamanho fixo: entra o que passa no corte; Google Notícias sozinho não entra', () => {
  const t = (o) => ({ tipos: [], veiculos: [], numeros: {}, ...o });
  assert.ok(R.relevante(t({ tipos: ['x', 'gt'] }))); assert.ok(!R.relevante(t({ tipos: ['gnews'], veiculos: V('A', 'B', 'C', 'D') }))); assert.ok(R.relevante(t({ tipos: ['imprensa'], veiculos: V('A', 'B', 'C') })));
  assert.ok(R.relevante(t({ tipos: ['gt'], numeros: { gt: { trafego: '5000+' } } }))); assert.ok(!R.relevante(t({ tipos: ['gt'], numeros: { gt: { trafego: '200+' } } })));
  assert.ok(R.relevante(t({ tipos: ['x'], numeros: { x: { horas: 3, melhor: 2 } } }))); assert.ok(!R.relevante(t({ tipos: ['x'], numeros: { x: { horas: 1, melhor: 2 } } })));
});
ok('regra de verdade: só publicável com 2 veículos diferentes; confiança por número de fontes', () => {
  assert.equal(R.publicavel({ veiculos: V('A') }), false); assert.equal(R.publicavel({ veiculos: V('A', 'B') }), true);
  assert.equal(R.confianca({ tipos: ['x', 'gt', 'wiki'] }), 'alta'); assert.equal(R.confianca({ tipos: ['x', 'gt'] }), 'média'); assert.equal(R.confianca({ tipos: ['x'] }), 'baixa');
});
const topico = (tipos, veic, x, gt) => ({ tipos, veiculos: V(...veic), chaves: ['k-teste'], numeros: { ...(x ? { x: { posicao: x, melhor: x, horas: 4, onde: ['br'] } } : {}), ...(gt ? { gt: { trafego: gt + '+', inicio: Infinity, pais: ['br'] } } : {}) } });
ok('🚀 Subindo: no X subiu de 15º para 4º em 2 h', () => {
  const E = {}; R.lembrar(E, topico(['x', 'gt'], ['A'], 15), H - 2 * 3600e3, true); R.lembrar(E, topico(['x', 'gt'], ['A'], 9), H - 3600e3);
  const t = topico(['x', 'gt'], ['A'], 4); const [, T] = R.lembrar(E, t, H); const r = R.etiquetar(t, T, H);
  assert.equal(r.etiqueta, 'subindo'); assert.ok(r.motivo.some((m) => /subiu de 15º para 4º/.test(m)), r.motivo.join());
});
ok('🚀 Subindo: espalhou de 1 para 3 fontes; 📉 Caindo: caiu no X e perdeu fonte; 🔥 No pico: 3 fontes estável', () => {
  let E = {}; R.lembrar(E, topico(['x'], ['A'], 5), H - 90 * 60e3, true); let t = topico(['x', 'gt', 'imprensa'], ['A', 'B'], 5); let [, T] = R.lembrar(E, t, H); assert.equal(R.etiquetar(t, T, H).etiqueta, 'subindo');
  E = {}; R.lembrar(E, topico(['x', 'gt'], ['A'], 2), H - 2 * 3600e3, true); R.lembrar(E, topico(['x', 'gt'], ['A'], 3), H - 3600e3); t = topico(['x'], ['A'], 12); [, T] = R.lembrar(E, t, H); const c = R.etiquetar(t, T, H); assert.equal(c.etiqueta, 'caindo'); assert.ok(c.motivo.some((m) => /caiu de 2º para 12º/.test(m)));
  E = {}; R.lembrar(E, topico(['x', 'gt', 'wiki'], ['A', 'B'], 3), H - 2 * 3600e3, true); R.lembrar(E, topico(['x', 'gt', 'wiki'], ['A', 'B'], 3), H - 3600e3, true); t = topico(['x', 'gt', 'wiki'], ['A', 'B'], 3); [, T] = R.lembrar(E, t, H, true); assert.equal(R.etiquetar(t, T, H).etiqueta, 'pico');
});
ok('1ª rodada (seed) não chama tudo de novo; depois, assunto novo em 2 fontes = Subindo', () => {
  let E = {}; let t = topico(['x', 'gt'], ['A'], 6); let [, T] = R.lembrar(E, t, H, true); assert.notEqual(R.etiquetar(t, T, H).etiqueta, 'subindo');
  E = {}; t = topico(['x', 'gt'], ['A'], 6); [, T] = R.lembrar(E, t, H - 20 * 60e3, false); [, T] = R.lembrar(E, t, H); const r = R.etiquetar(t, T, H); assert.equal(r.etiqueta, 'subindo'); assert.ok(r.motivo.some((m) => /apareceu no jornal há 20 min/.test(m)));
});
const horasFalsas = () => { const h = {}; const forma = [3, 2, 1.5, 1, .8, .6, .7, 1, 2, 3, 4, 4.5, 5, 5.2, 5.4, 5.1, 5.3, 5.6, 5.8, 5.7, 6.2, 6.5, 6.4, 4.8];
  for (let d = 1; d <= 14; d++) { const dia = '2026-11-' + String(d).padStart(2, '0'); for (let i = 0; i < 24; i++) h[dia + ' ' + String(i).padStart(2, '0')] = forma[i] * (fimDeSemanaDia(dia) ? 0.8 : 1) * 1000; } delete h['2026-11-14 23']; return h; };
const fimDeSemanaDia = (d) => R.fimDeSemana(d);
ok('curva de atenção: só dias completos, separa dias úteis e fim de semana, diz quantos dias mediu', () => {
  const C = R.curva(horasFalsas()); assert.equal(C.dias, 13, 'o dia 14 está incompleto e não entra'); assert.equal(C.de, '2026-11-01'); assert.equal(C.diasUteis + C.diasFimDeSemana, 13);
  assert.ok(Math.abs(C.todos.reduce((a, b) => a + b, 0) - 100) < 0.2); assert.equal(C.todos.indexOf(Math.max(...C.todos)), 21);
});
ok('melhores horários: 4 picos entre 7h e 23h com 2 h ou mais entre eles; agenda pula o que passou', () => {
  const C = R.curva(horasFalsas()); const s = R.horarios(C, '2026-11-13'); assert.equal(s.length, 4); for (let i = 1; i < s.length; i++) assert.ok(parseInt(s[i].hora) - parseInt(s[i - 1].hora) >= 2);
  assert.ok(s.every((x) => parseInt(x.hora) >= 7)); assert.equal(s[0].tipoDia, 'dia útil'); assert.equal(R.horarios(C, '2026-11-14')[0].tipoDia, 'fim de semana');
  const itens = [{ id: 'a', nome: 'A', etiqueta: 'pico', publicavel: true, tipos: ['x', 'gt'] }, { id: 'b', nome: 'B', etiqueta: 'subindo', publicavel: true, tipos: ['x', 'gt'] }, { id: 'c', nome: 'C', etiqueta: 'caindo', publicavel: true, tipos: ['x', 'gt', 'w'] }];
  const ag = R.agenda(s, itens, Date.parse('2026-11-13T18:30:00-03:00'), '2026-11-13'); assert.ok(ag.filter((x) => x.passou).length >= 1); const fut = ag.filter((x) => !x.passou);
  assert.equal(fut[0].item.id, 'b', 'Subindo vai para o horário mais próximo'); assert.ok(!ag.some((x) => x.item && x.item.id === 'c'), 'Caindo não entra na agenda');
  assert.equal(R.proximoHorario(s, Date.parse('2026-11-13T23:00:00-03:00'), '2026-11-13'), null, 'sem horário com 75 min de folga');
});
ok('botões: no máximo 3; 2 veículos = Sim, publicar + Agendar + Ver (assinados); 1 veículo = Ver + Em apuração', () => {
  const ASS = 'k'.repeat(40), i = { id: 'abcdefabcdef', nome: 'Mpox em SP', manchete: 'm', link: 'https://g1.com/a', veiculos: V('G1', 'Folha'), publicavel: true };
  const b = R.botoesItem(i, { CMD: 'cmd', ASS, slot: { hora: '20:00' }, dia: '2026-11-14', pagina: 'P' }); assert.deepEqual(b.map((x) => x.label), ['✅ Sim, publicar', '⏰ Agendar 20:00', 'Ver notícia']);
  const pub = JSON.parse(b[0].body), ag = JSON.parse(b[1].body); assert.equal(pub.acao, 'publicar'); assert.equal(pub.fontes, 2);
  assert.equal(pub.sig, createHmac('sha256', ASS).update(i.id).digest('hex').slice(0, 32)); assert.equal(pub.fsig, createHmac('sha256', ASS).update(i.id + '|fontes=2').digest('hex').slice(0, 32));
  assert.equal(ag.acao, 'agendar'); assert.equal(ag.hora, '20:00'); assert.equal(ag.asig, createHmac('sha256', ASS).update(i.id + '|agendar|2026-11-14|20:00').digest('hex').slice(0, 32));
  assert.ok(JSON.stringify(b).length < 3000, 'cabe no limite de 4.096 bytes do ntfy');
  const u = R.botoesItem({ ...i, veiculos: V('G1'), publicavel: false }, { CMD: 'cmd', ASS, slot: { hora: '20:00' }, pagina: 'P' }); assert.deepEqual(u.map((x) => x.label), ['Ver notícia', '🔎 Em apuração']); assert.ok(!JSON.stringify(u).includes('publicar'));
});
ok('números só os que a fonte dá', () => {
  const t = { tipos: ['gt', 'x', 'wiki'], veiculos: V('A', 'B'), numeros: { gt: { trafego: '2000+', pais: ['br'] }, x: { posicao: 3, melhor: 3, horas: 4, posts: '', onde: ['br'] }, wiki: { views: 21150, vezesMedia: 2.6, dia: '2026-11-12' } } };
  assert.equal(R.numerosTexto(t), 'Google Brasil: 2000+ buscas · X Brasil: 3º agora, 4 h em alta · 2 veículos · Wikipedia (12/11): 21.150 leituras (2.6x a média da semana)');
});
console.log('TODOS OS TESTES PASSARAM:', n);
