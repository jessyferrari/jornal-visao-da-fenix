// 17/11: roda o scripts/musica.mjs INTEIRO, sem rede, com notícias simuladas (teste-musica-mock.mjs), numa cópia temporária.
// Pega erro que só aparece com notícia de verdade no laço (ex.: função usada antes de ser definida), que o teste sem notícia não pega.
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, existsSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..'), T = mkdtempSync(join(tmpdir(), 'musica-off-'));
for (const f of ['scripts', 'musica-estado.json', 'musica-locais.json', 'musica-traducoes.json']) if (existsSync(join(RAIZ, f))) cpSync(join(RAIZ, f), join(T, f), { recursive: true });
const r = spawnSync(process.execPath, ['--import', './scripts/teste-musica-mock.mjs', 'scripts/musica.mjs', '--sem-push'], { cwd: T, encoding: 'utf8', timeout: 400000, env: { ...process.env, NTFY_TOPIC_MUSICA: '', NTFY_TOPIC_COMANDO: '', NTFY_ASSINATURA: '' } });
assert.equal(r.status, 0, 'musica.mjs parou com erro:\n' + (r.stderr || '').slice(-1500)); console.log('ok 1 musica.mjs roda até o fim com notícias');
const d = JSON.parse(readFileSync(join(T, 'musica.json'), 'utf8')); const notas = [];
const w = (o) => { if (Array.isArray(o)) o.forEach(w); else if (o && typeof o === 'object') { if (o.titulo && o.pot) notas.push(o); Object.values(o).forEach(w); } }; w(d);
assert.ok(notas.length >= 2, 'itens com nota: ' + notas.length); console.log('ok 2 itens da Música saem com a nota de potencial');
assert.ok(!notas.some((o) => /pessoa famosa: roda de samba/i.test(o.pot.motivo)), 'termo de gênero não é pessoa famosa'); assert.ok(notas.some((o) => /pessoa famosa: Zeca Pagodinho/.test(o.pot.motivo)));
console.log('ok 3 pessoa famosa só com nome de artista');
console.log('TODOS OS TESTES PASSARAM: 3');
