// node scripts/teste-titulo.mjs : título repetido (título + legenda da foto colados pelo feed), t341
import assert from 'node:assert/strict';
import { semRepetir, tituloDoItem, curarTitulo } from './titulo.mjs';
const T = 'Fãs notam detalhe em publicação de João Chumbinho e especulam romance com Paolla Oliveira';
assert.equal(semRepetir(T + ' ' + T), T);
assert.equal(semRepetir('Cauã Reymond revela bastidores “Avenida Brasil 2” e responde sobre possível par romântico com Mel Maia; assista Cauã Reymond revela bastidores “Avenida Brasil 2” e fala sobre possível par romântico com Mel Maia; assista! (Foto: Globo / Bob Paulino)'), 'Cauã Reymond revela bastidores “Avenida Brasil 2” e responde sobre possível par romântico com Mel Maia; assista');
assert.equal(semRepetir('Jennifer Lopez revela mudança nos treinos aos 57 anos  (Foto: Getty)'), 'Jennifer Lopez revela mudança nos treinos aos 57 anos');
// não corta títulos normais
for (const t of ['Gol gol', 'Neymar marca e Santos vence; Neymar marca de novo no fim', 'O que a Comissão Antimáfia da Itália veio ver no Brasil e o que o Congresso pode aprender com ela',
  'O Festival de Cinema do Mar Vermelho da Arábia Saudita estabelece uma parceria "estratégica" com o Festival de Cinema do Cairo', 'A sequência de ondas gigantes de Maverick continua com uma sessão de surfe emocionante (fotos)'])
  assert.equal(semRepetir(t), t);
assert.equal(tituloDoItem('Thomas Markle: decisão (Foto: Getty) e mais legenda', '<description><![CDATA[x <p>O post <a rel="nofollow" href="https://h/x/">Thomas Markle: decisão</a> apareceu primeiro em <a>Hugo Gloss</a>.</p>]]></description>'), 'Thomas Markle: decisão');
assert.equal(curarTitulo('Joana Sanz anuncia fim do casamento com Daniel Alves e revela motivo da separação Joana Sanz anuncia separação de Daniel Alves após 11 anos e revela motivo; veja', 'oana Sanz anuncia fim do casamento com Daniel Alves e revela motivo da separação apareceu…'), 'Joana Sanz anuncia fim do casamento com Daniel Alves e revela motivo da separação');
assert.equal(curarTitulo('Influencer de 25 anos morre em acidente no CE, e últimas publicações chamam atenção influencer Ana Lívia Alves (Foto_ reprodução_instagram)', 'x O post Influencer de 25 anos morre em acidente no CE, e últimas publicações chamam atenção…'), 'Influencer de 25 anos morre em acidente no CE, e últimas publicações chamam atenção');
console.log('TESTES DE TÍTULO PASSARAM');
