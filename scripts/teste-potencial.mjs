// Teste da nota de potencial de postagem (17/11, pedido A). Sem rede.
import assert from 'node:assert/strict';
import { notaPotencial, prioridadeNota, tituloComNota, linhaNota } from './potencial.mjs';
const A = Date.parse('2026-11-17T12:00:00-03:00'); let ok = 0;
const t = (nome, f) => { f(); console.log('ok ' + (++ok) + ' ' + nome); };

t('faixas: 90 a 100 não deixe de postar, 70 a 89 vale postar, abaixo de 70 opcional', () => {
  const alto = notaPotencial({ titulo: 'Morre Silvio Santos, apresentador', veiculos: ['g1', 'Folha', 'UOL', 'CNN Brasil', 'BBC'], ts: A - 30 * 60e3, agora: A });
  assert.ok(alto.nota >= 90, alto.nota); assert.equal(alto.faixa, 'nao-deixe'); assert.match(alto.rotulo, /não deixe de postar/);
  const medio = notaPotencial({ titulo: 'Morre cantora aos 91 anos', veiculos: ['g1', 'Folha', 'CNN Brasil'], ts: A - 40 * 60e3, agora: A });
  assert.ok(medio.nota >= 70 && medio.nota < 90, medio.nota); assert.equal(medio.faixa, 'vale'); assert.match(medio.rotulo, /^🔥 \d+% · vale postar$/);
  const baixo = notaPotencial({ titulo: 'Prefeitura divulga horário de feira', veiculos: ['portal local', 'outro portal'], ts: A - 30 * 3600e3, agora: A });
  assert.ok(baixo.nota < 70); assert.equal(baixo.faixa, 'opcional');
});
t('não é só contagem de fontes: assunto forte com pessoa famosa e 1 veículo ainda pontua (como provisória)', () => {
  const r = notaPotencial({ titulo: 'Anitta anuncia turnê nos Estados Unidos', veiculos: ['Billboard Brasil'], ts: A - 10 * 60e3, agora: A });
  assert.ok(r.nota >= 50, r.nota); assert.ok(r.provisoria); assert.match(r.motivo, /pessoa famosa: Anitta/);
});
t('nunca inventa: 1 veículo só ou sem horário = nota provisória, com o motivo escrito', () => {
  const um = notaPotencial({ titulo: 'Recorde histórico', veiculos: ['g1'], ts: A, agora: A });
  assert.ok(um.provisoria); assert.match(um.rotulo, /^⏳ \d+% provisória/); assert.match(um.motivo, /só 1 veículo até agora/);
  const semHora = notaPotencial({ titulo: 'Recorde histórico', veiculos: ['g1', 'UOL'], agora: A });
  assert.ok(semHora.provisoria); assert.match(semHora.motivo, /sem horário/);
});
t('motivo em uma linha curta, com os critérios reais', () => {
  const r = notaPotencial({ titulo: 'Corinthians campeão da Copa do Brasil', veiculos: ['ge', 'ESPN', 'Lance'], ts: A - 2 * 3600e3, agora: A });
  assert.ok(!r.motivo.includes('\n')); assert.match(r.motivo, /veículo grande/); assert.match(r.motivo, /3 veículos em 2 h/); assert.match(r.motivo, /tema forte: campeão/);
  assert.deepEqual(Object.keys(r.criterios), ['veiculo', 'repeticao', 'tema', 'pessoa', 'frescor']);
});
t('acento conta como letra: campeã, turnê, Beyoncé, Mbappé', () => {
  assert.match(notaPotencial({ titulo: 'Seleção feminina é campeã', veiculos: ['ge', 'g1'], ts: A, agora: A }).motivo, /tema forte: campeã/);
  assert.match(notaPotencial({ titulo: 'Banda confirma turnê', veiculos: ['a', 'b'], ts: A, agora: A }).motivo, /tema: turnê|tema forte/);
  assert.match(notaPotencial({ titulo: 'Beyoncé faz show surpresa', veiculos: ['a', 'b'], ts: A, agora: A }).motivo, /pessoa famosa: Beyoncé/);
  assert.match(notaPotencial({ titulo: 'Mbappé marca três', veiculos: ['a', 'b'], ts: A, agora: A }).motivo, /pessoa famosa: Mbappé/);
});
t('nota sempre entre 0 e 100', () => {
  const r = notaPotencial({ titulo: 'Urgente: morre Lula, presidente, recorde histórico', veiculos: Array.from({ length: 12 }, (_, n) => 'g1 ' + n), ts: A, agora: A });
  assert.ok(r.nota <= 100 && r.nota >= 0);
});
t('prioridade (18/11): Não deixe confirmada toca alto (5), Vale sem som (2), Opcional e provisória não vão ao celular (1)', () => {
  assert.equal(prioridadeNota({ nota: 95, faixa: 'nao-deixe', provisoria: false }, 2), 4);   // 20/11: nunca 5 (vibra em rajada)
  assert.equal(prioridadeNota({ nota: 95, faixa: 'nao-deixe', provisoria: true }, 2), 1);
  assert.equal(prioridadeNota({ nota: 85, faixa: 'vale', provisoria: false }, 4), 3);   // 20/11: Vale postar toca som
  assert.equal(prioridadeNota({ nota: 61, faixa: 'opcional', provisoria: false }, 5), 1);   // urgente Opcional também não toca
  assert.equal(prioridadeNota(null, 2), 2); assert.equal(prioridadeNota(null, 4), 4); assert.equal(prioridadeNota(null, 5), 4);
});
t('título do aviso começa pela nota, bem visível', () => {
  const r = notaPotencial({ titulo: 'Morre cantora aos 91 anos', veiculos: ['g1', 'Folha', 'CNN Brasil'], ts: A - 40 * 60e3, agora: A });
  assert.match(tituloComNota(r, 'Morre cantora aos 91 anos'), /^👍\d+% · Morre cantora/);   // 17/11: selo curto, a manchete não é cortada
  assert.match(linhaNota(r), /^📊 Vale postar · /);
  assert.match(tituloComNota({ ...r, provisoria: true }, 'X'), /^⏳\d+% · X/); assert.match(tituloComNota({ ...r, faixa: 'nao-deixe', nota: 93 }, 'X'), /^🔥93% · X/);
});
t('portal local com nome parecido não vira veículo grande (Folha do Leste)', () => {
  assert.doesNotMatch(notaPotencial({ titulo: 'Roda de samba', veiculos: ['Folha do Leste'], ts: A, agora: A }).motivo, /veículo grande/);
  assert.match(notaPotencial({ titulo: 'Roda de samba', veiculos: ['Folha de S.Paulo'], ts: A, agora: A }).motivo, /veículo grande \(Folha de S\.Paulo\)/);
  assert.match(notaPotencial({ titulo: 'Roda de samba', veiculos: ['Folha Ilustrada'], ts: A, agora: A }).motivo, /veículo grande/);
});
console.log('TODOS OS TESTES PASSARAM: ' + ok);
