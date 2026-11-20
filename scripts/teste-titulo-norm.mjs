// Testes do casamento de manchetes com CAIXA ALTA, emojis, #hashtags e @menções (20/11, t339). Sem rede.
// A regra da verdade não afrouxa: veículos distintos, 3+ palavras em comum, nome próprio em comum e (séries/perfis) palavra do fato.
// Uso: node scripts/teste-titulo-norm.mjs
import assert from 'node:assert/strict';
import * as N from './titulo-norm.mjs';
import { mesmo } from './series-regras.mjs';
let n = 0; const ok = (nome, f) => { f(); n++; console.log('ok', nome); };
const agora = Date.parse('2026-11-20T12:00:00-03:00');
const it = (src, title, h = 0) => ({ src, title, ts: agora - h * 3600e3 });
// títulos reais do canal Gigantes de Nazaré em 20/11/2026 (YouTube, 07:00 e 11:00 BRT)
const GN1 = '🌊 TEMPORADA DE ONDAS GIGANTES ABERTA NA NAZARÉ! 🔥 #gigantesdenazare';
const GN2 = '🌊 WILL SANTANA FOGE DE ONDA GIGANTE NA NAZARÉ! 😱 @GigantesdeNazaré';

ok('limpeza: emojis e tags do fim saem; #/@ no meio vira palavra; caixa e acento normalizados', () => {
  assert.equal(N.limparComparar(GN1), 'TEMPORADA DE ONDAS GIGANTES ABERTA NA NAZARÉ!');
  assert.equal(N.limparComparar(GN2), 'WILL SANTANA FOGE DE ONDA GIGANTE NA NAZARÉ!');
  assert.equal(N.limparComparar('Ana Castela celebra 23 anos #Shorts #HojeEmDia'), 'Ana Castela celebra 23 anos');
  assert.equal(N.limparComparar('É #FAKE que MP aumenta imposto'), 'É FAKE que MP aumenta imposto');
  assert.ok(N.gritado(GN1) && N.gritado(GN2)); assert.ok(!N.gritado('Lula diz que STF e PF agem dentro da lei'));
  assert.ok(N.tokens(GN1).has('nazare'));
});
ok('Gigantes (CAIXA ALTA) casa com o mesmo fato em outro veículo escrito normal', () => {
  assert.equal(mesmo(it('Gigantes de Nazaré', GN1), it('ge', 'Temporada de ondas gigantes é aberta em Nazaré com brasileiros', 1)), true);
  assert.equal(mesmo(it('Gigantes de Nazaré', GN2), it('ge', 'Will Santana foge de onda gigante em Nazaré', 2)), true);
  assert.equal(mesmo(it('ge', 'Will Santana foge de onda gigante em Nazaré', 2), it('Gigantes de Nazaré', GN2)), true, 'simétrico');
});
ok('nada de par falso: mesmo canal, fatos diferentes, sem nome em comum, dois gritados, fora da janela', () => {
  assert.equal(mesmo(it('Gigantes de Nazaré', GN1), it('Gigantes de Nazaré', GN1.toLowerCase(), 1)), false, 'mesmo veículo nunca confirma');
  assert.equal(mesmo(it('Gigantes de Nazaré', GN1), it('X', GN2, 1)), false, 'dois vídeos diferentes');
  assert.equal(mesmo(it('Gigantes de Nazaré', GN2), it('ge', 'Lucas Chumbo pega onda gigante em Nazaré', 1)), false, 'outro surfista: Santana não aparece');
  assert.equal(mesmo(it('Gigantes de Nazaré', GN1), it('ge', 'Temporada de ondas gigantes aberta na praia, sem nome', 1)), false, 'sem nome próprio em comum');
  assert.equal(mesmo(it('A', 'TEMPORADA DE ONDAS GIGANTES ABERTA NA NAZARÉ!'), it('B', 'TEMPORADA DE ONDAS GIGANTES ABERTA NA NAZARÉ HOJE', 1)), false, 'dois gritados: igual a antes (sem nome confirmado)');
  assert.equal(mesmo(it('Gigantes de Nazaré', GN1), it('ge', 'Temporada de ondas gigantes é aberta em Nazaré', 19)), false, 'mais de 18 h');
  // gritado não "inventa" nome: só herda o que o outro veículo escreveu com maiúscula
  assert.equal(mesmo(it('A', 'TRUMP DIZ QUE VAI TAXAR CARROS DO JAPÃO'), it('B', 'Governo diz que vai taxar carros importados', 1)), false);
});
ok('nomes do par: gritado herda só os nomes do outro que aparecem nele (nome composto exige todas as partes)', () => {
  const rx = () => /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]{2,}/g;
  const a = 'EVENTO - O GRES. VITÓRIA RÉGIA LANÇA ENREDO COM SHOW DE NEGUINHO DA BEIJA-FLOR', b = 'Neguinho da Beija-Flor lança em Manaus samba da Vitória-Régia';
  const [ea, eb] = N.nomesDoPar(a, N.nomesPelaCaixa(a, rx()), b, N.nomesPelaCaixa(b, rx()));
  assert.deepEqual([...ea].sort(), ['beija-flor', 'neguinho', 'vitoria-regia']); assert.ok(eb.has('manaus') && !ea.has('manaus'));
  const c = 'Lula e Alckmin', d = 'Haddad e Tebet';
  const [ec, ed] = N.nomesDoPar(c, N.nomesPelaCaixa(c, rx()), d, N.nomesPelaCaixa(d, rx())); assert.deepEqual([...ec], ['lula', 'alckmin']); assert.deepEqual([...ed], ['haddad', 'tebet']);
});
console.log('TODOS OS TESTES DE CAIXA ALTA, EMOJIS E HASHTAGS PASSARAM:', n);
