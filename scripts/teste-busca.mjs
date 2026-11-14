// Testes da busca do jornal (14/11, caso Anitta no Grammy Latino):
// 1) a função de busca do app.js acha notícia que está só no arquivo (fora da edição/página atual) e na seção Música;
// 2) ignora acento e maiúsculas e aceita palavras fora de ordem;
// 3) o arquivo por dia não duplica, guarda a tradução e lê os itens da Música (incluindo "também em").
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
import { arquivar, itensMusica } from './busca-arquivo.mjs';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const m = app.match(/var __jfBuscaFn=(function\(D,arq,q\)\{[\s\S]*?\}\)\}\);return out\.sort\([\s\S]*?\)\}\);?\};)/) || app.match(/var __jfBuscaFn=(function[\s\S]*?\});var __jfCarregaArquivo/);
assert.ok(m, 'função de busca encontrada no app.js');
const busca = eval('(' + m[1].replace(/;$/, '') + ')');
let ok = 0; const t = (n, f) => { f(); ok++; console.log('ok', n); };
const D = Array.from({ length: 220 }, (_, i) => ({ id: 's' + i, sec: 'br', src: 'g1', title: 'Notícia geral ' + i, sum: 'resumo', link: 'https://g1.globo.com/n/' + i, pub: '2026-11-13T2' + (i % 10) + ':00' }));
const arq = [
  { t: "Anitta faz história e vence seu primeiro Grammy Latino com 'EQUILIBRIVM'", s: 'Melhor Álbum de Pop Contemporâneo em Língua Portuguesa', f: 'g1 Pop & Arte', l: 'https://g1.globo.com/pop-arte/anitta-grammy.ghtml', p: '2026-11-12T23:57', c: 'cultura', n: 3 },
  { t: 'Grammy Latino: Rosalía, Anitta e Emicida saem vitoriosos', s: 'Música: Música geral', f: 'NOIZE', l: 'https://www.noize.com.br/grammy-latino-2026-vencedores', p: '2026-11-13T08:10', c: 'musica' },
  { t: 'Notícia geral 3', s: 'duplicada da edição', f: 'g1', l: 'https://g1.globo.com/n/3?utm_source=x', p: '2026-11-13T23:00', c: 'br' },
];
t('acha Anitta só no arquivo (fora das 220 da edição)', () => { const r = busca(D, arq, 'Anitta'); assert.equal(r.length, 2); assert.ok(r.some(x => x.title.startsWith('Anitta faz história') && x.src === 'g1 Pop & Arte')); });
t('maiúsculas, acento e ordem das palavras', () => { assert.equal(busca(D, arq, 'GRAMMY anitta').length, 2); assert.equal(busca(D, arq, 'rosalia').length, 1); assert.equal(busca(D, arq, 'história').length, 1); assert.equal(busca(D, arq, 'historia').length, 1); });
t('seção Música entra na busca', () => { const r = busca(D, arq, 'emicida'); assert.equal(r.length, 1); assert.equal(r[0].sec, 'musica'); assert.equal(busca(D, arq, 'musica emicida').length, 1); });
t('não duplica notícia da edição que também está no arquivo', () => { assert.equal(busca(D, arq, 'Notícia geral 3').length, 1); });
t('sem arquivo carregado ainda, busca a edição inteira (todas as páginas)', () => { assert.equal(busca(D, null, 'geral').length, 220); assert.equal(busca(D, null, 'Notícia geral 219').length, 1); });
t('consulta vazia não lista tudo', () => { assert.equal(busca(D, arq, '  ').length, 0); });
// arquivo por dia
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'busca-')); const cwd = process.cwd(); process.chdir(tmp);
try {
  t('arquiva por dia, sem duplicar, guarda tradução e apaga dia velho', () => {
    fs.mkdirSync('busca'); fs.writeFileSync('busca/2026-10-01.json', '[\n]\n');
    let r = arquivar([{ t: 'Here is the latest', f: 'NYT', l: 'https://nyt.com/a', p: '2026-11-13T10:00', c: 'mundo' }, { t: 'Anitta', f: 'g1', l: 'https://g1.globo.com/x', p: '2026-11-12T23:57', c: 'cultura' }], '2026-11-14T00:00:00Z');
    assert.equal(r.novos, 2);
    r = arquivar([{ t: 'Aqui está o mais recente', o: 'Here is the latest', f: 'NYT', l: 'https://nyt.com/a?utm=1', p: '2026-11-13T10:00', c: 'mundo' }], '2026-11-14T00:00:00Z');
    assert.equal(r.novos, 0); assert.equal(r.atualizados, 1);
    const d13 = JSON.parse(fs.readFileSync('busca/2026-11-13.json', 'utf8')); assert.equal(d13.length, 1); assert.equal(d13[0].t, 'Aqui está o mais recente');
    assert.equal(fs.existsSync('busca/2026-10-01.json'), false);
    const ix = JSON.parse(fs.readFileSync('busca/indice.json', 'utf8')); assert.deepEqual(ix.dias.map(d => d.dia), ['2026-11-13', '2026-11-12']);
  });
  t('lê itens da seção Música, inclusive "também em"', () => {
    const its = itensMusica({ setores: { geral: { nome: 'Música geral', fora: [{ titulo: 'Grammy Latino 2026: Anitta fazendo história', link: 'https://g1.globo.com/g', publicado: '2026-11-12T17:29', veiculo: 'g1 Pop & Arte', fontes: 4, tambemEm: [{ veiculo: 'NOIZE', titulo: 'Grammy Latino: Rosalía, Anitta e Emicida', link: 'https://www.noize.com.br/g' }] }] } } });
    assert.equal(its.length, 2); assert.equal(its.every(i => i.c === 'musica'), true); assert.equal(its[1].p, '2026-11-12T17:29');
  });
} finally { process.chdir(cwd); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('teste-busca:', ok, 'de 8 passaram');
