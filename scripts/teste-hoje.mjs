// Teste do Painel do dia (17/11). Sem rede.
import assert from 'node:assert/strict';
import { montar, aviso, periodo, itensDe } from './hoje.mjs';
let n = 0; const t = (nome, f) => { f(); console.log('ok ' + (++n) + ' ' + nome); };
const AG = Date.parse('2026-11-17T19:05:00-03:00');
const pot = (nota, faixa, provisoria = false) => ({ nota, faixa, provisoria, motivo: 'motivo ' + nota });
const secoes = {
  edicao: { stories: [
    { title: 'Notícia da tarde que vale', link: 'https://a/1', src: 'g1', pub: '2026-11-17T14:32', cov: { n: 3 }, pot: pot(78, 'vale') },
    { title: 'Notícia da madrugada', link: 'https://a/2', src: 'Folha', pub: '2026-11-17T03:10', cov: { n: 2 }, pot: pot(91, 'nao-deixe') },
    { title: 'Opcional grande', link: 'https://a/3', src: 'UOL', pub: '2026-11-17T10:00', cov: { n: 5 }, pot: pot(55, 'opcional') },
    { title: 'Ontem', link: 'https://a/4', src: 'UOL', pub: '2026-11-16T22:00', cov: { n: 2 }, pot: pot(95, 'nao-deixe') },
    { title: 'Exclusivo dito pelo veículo', link: 'https://a/5', src: 'CNN Brasil', pub: '2026-11-17T09:00', cov: { n: 1 }, pot: pot(48, 'opcional', true), excl: { tipo: 'possivel', texto: '⭐ Possível exclusivo: CNN Brasil diz que é exclusivo' } }] },
  esportes: { destaques: [{ titulo: 'Notícia da manhã', link: 'https://b/1', veiculo: 'ge', publicado: '2026-11-17T08:16', fontes: '4', pot: pot(81, 'vale') },
    { titulo: 'Repetida com nota menor', link: 'https://a/1', veiculo: 'ge', publicado: '2026-11-17T14:32', fontes: '3', pot: pot(70, 'vale') }] },
};
const datas = [{ dia: '17/11', nome: 'Dia oficial', ambito: 'internacional', fonte: 'ONU', link: 'https://un' }, { dia: '17/11', nome: 'Sem fonte', ambito: 'nacional' }, { dia: '18/11', nome: 'Amanhã', ambito: 'nacional', fonte: 'Lei', link: 'https://l' }];
const h = montar({ secoes, datas, agora: AG });
t('períodos: madrugada 0h, manhã 6h, tarde 12h, noite 18h', () => { assert.equal(periodo('03:10'), 'madrugada'); assert.equal(periodo('06:00'), 'manha'); assert.equal(periodo('12:00'), 'tarde'); assert.equal(periodo('23:59'), 'noite'); });
t('vale postar: só 70% ou mais, só de hoje, em ordem de horário dentro de cada período', () => {
  assert.deepEqual(h.valePostar.map((p) => [p.nome, p.itens.map((i) => i.titulo)]), [['Madrugada', ['Notícia da madrugada']], ['Manhã', ['Notícia da manhã']], ['Tarde', ['Notícia da tarde que vale']], ['Noite', []]]);
  assert.equal(h.totalVale, 3); assert.equal(h.naoDeixe, 1);
});
t('mesma notícia em duas seções aparece uma vez, com a maior nota', () => { assert.equal(h.valePostar[2].itens[0].nota, 78); });
t('datas: só a de hoje e só com fonte oficial e link', () => { assert.deepEqual(h.datas.internacionais.map((d) => d.nome), ['Dia oficial']); assert.equal(h.datas.nacionais.length, 0); });
t('exclusivo: aparece com a frase do veículo, nunca afirmado pelo jornal', () => { assert.equal(h.exclusivos.length, 1); assert.match(h.exclusivos[0].selo.texto, /diz que é exclusivo/); });
t('também importantes: 3+ veículos fora da lista do que vale postar', () => { assert.deepEqual(h.importantes.map((i) => i.titulo), ['Opcional grande']); });
t('aviso do dia: datas no topo e as 5 melhores notas com hora', () => {
  const a = aviso(h, { quando: 'noite' }); assert.match(a.title, /^🌙 Painel da noite 17\/11: 3 vale postar · 1 data/);
  assert.match(a.message, /^📅 Dia oficial/); assert.match(a.message, /03:10 · 91% · Notícia da madrugada/); assert.ok(a.message.length < 4000);
});
t('lê qualquer formato de seção (title/titulo/nome, pub/publicado, cov/fontes/veiculos)', () => {
  const l = itensDe({ itens: [{ nome: 'GOTY', link: 'https://c', veiculos: [{ nome: 'Folha' }, { nome: 'g1' }], pot: pot(72, 'vale'), publicado: '2026-11-17T11:00' }] }, 'Em Alta');
  assert.equal(l[0].titulo, 'GOTY'); assert.equal(l[0].fontes, 2); assert.equal(l[0].veiculo, 'Folha');
});
console.log('TODOS OS TESTES PASSARAM: ' + n);
