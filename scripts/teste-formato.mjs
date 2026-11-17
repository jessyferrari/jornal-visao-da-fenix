// Teste do 🎯 Melhor formato: o jornal estuda a notícia e sugere Imagem, Carrossel ou Vídeo. Uso: node scripts/teste-formato.mjs
import assert from 'node:assert/strict'; import { estudarFormato, linhaFormato } from './formato.mjs';
let n = 0; const ok = (c, m) => { assert.ok(c, m); console.log('ok', ++n, m); };
const f = (title, extra = {}) => estudarFormato({ title, ...extra }).formato;
ok(f('Vini Jr. marca golaço e Real Madrid vence clássico; assista ao lance') === 'video', 'gol e lance: vídeo');
ok(f('Marvel divulga trailer de novo filme dos Vingadores') === 'video', 'trailer: vídeo');
ok(f('Entenda o que muda no Imposto de Renda com a nova lei aprovada') === 'carrossel', 'explicar o que muda: carrossel');
ok(f('7 séries que estreiam na Netflix em dezembro') === 'carrossel', 'lista numerada: carrossel');
ok(f('Ator de Hollywood morre aos 78 anos') === 'imagem', 'morte: imagem sóbria');
ok(estudarFormato({ title: 'Cantor morre em acidente; veja vídeo do show' }).formato === 'imagem', 'assunto delicado nunca vira vídeo de impacto');
ok(f('Nvidia anuncia nova CEO') === 'imagem', 'fato rápido: imagem');
ok(f('Notícia comum', { link: 'https://www.youtube.com/watch?v=x' }) === 'video', 'link de vídeo na fonte: vídeo');
ok(/^🎯 Melhor formato: 🎠 Carrossel · /.test(linhaFormato(estudarFormato({ title: 'Ranking dos clubes mais ricos do mundo' }))), 'linha do aviso com rótulo e motivo');
console.log('TODOS OS TESTES PASSARAM:', n);
