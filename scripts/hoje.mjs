// Painel do dia (17/11, pedido da Jessyca): numa página e numa notificação, tudo junto para ela bater o olho e escolher o que postar.
// 1) Datas do dia, nacionais e internacionais, só com fonte oficial (scripts/datas.json).
// 2) O que vale postar hoje (nota 70% ou mais, de todas as seções), em ordem de horário: madrugada, manhã, tarde, noite.
// 3) Exclusivos, só como o veículo disse ("X diz que é exclusivo"), nunca afirmados pelo jornal.
// 4) Também importantes: 3 ou mais veículos, para ela não perder nada grande.
// Lê edicao.json, musica.json, series.json, esportes.json e emalta.json. Gera hoje.json e manda 2 avisos por dia (7h e 19h, prioridade 2).
// Uso: node scripts/hoje.mjs [--agora 2026-11-17T07:05-03:00] [--sem-envio]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const AGORA = arg('--agora') ? Date.parse(arg('--agora')) : Date.now();
const brIso = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 16);
export const PAGINA = 'https://jessyferrari.github.io/jornal-visao-da-fenix/hoje.html';
const SECOES = [['edicao', 'Jornal'], ['musica', 'Música'], ['series', 'Séries e Filmes'], ['esportes', 'Esportes'], ['emalta', 'Em Alta']];
export const PERIODOS = [['madrugada', 'Madrugada', 0], ['manha', 'Manhã', 6], ['tarde', 'Tarde', 12], ['noite', 'Noite', 18]];
export const periodo = (hhmm) => { const h = +String(hhmm).slice(0, 2); return [...PERIODOS].reverse().find((p) => h >= p[2])[0]; };

/** todo item com nota de potencial, de qualquer formato de seção */
export function itensDe(dados, secao) {
  const out = [];
  const andar = (o) => {
    if (Array.isArray(o)) return o.forEach(andar);
    if (!o || typeof o !== 'object') return;
    if (o.pot && typeof o.pot.nota === 'number' && (o.link || o.url)) {
      const pub = String(o.pub || o.publicado || '').slice(0, 16);
      const fontes = (o.cov && o.cov.n) || (Array.isArray(o.veiculos) ? o.veiculos.length : +o.fontes || 1);
      const selo = o.selo || o.excl || null;
      out.push({ secao, titulo: String(o.title || o.titulo || o.nome || '').slice(0, 200), link: o.link || o.url, veiculo: o.src || o.veiculo || (Array.isArray(o.veiculos) && o.veiculos[0] && o.veiculos[0].nome) || '',
        publicado: pub, fontes, nota: o.pot.nota, faixa: o.pot.faixa, provisoria: !!o.pot.provisoria, motivo: o.pot.motivo || '', selo: selo && selo.texto ? { tipo: selo.tipo, texto: selo.texto } : null });
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') andar(v);
  };
  andar(dados); return out;
}

export function montar({ secoes, datas, agora = AGORA }) {
  const hoje = brIso(agora).slice(0, 10), ddmm = hoje.slice(8, 10) + '/' + hoje.slice(5, 7);
  const vistos = new Map();
  for (const [nome, rot] of SECOES) for (const i of itensDe(secoes[nome] || {}, rot)) {
    if (!i.titulo || !i.publicado.startsWith(hoje)) continue;
    const o = vistos.get(i.link); if (!o || i.nota > o.nota) vistos.set(i.link, i);
  }
  const todos = [...vistos.values()].sort((a, b) => a.publicado.localeCompare(b.publicado));
  const valePostar = todos.filter((i) => i.nota >= 70);
  const porPeriodo = PERIODOS.map(([id, nome]) => ({ id, nome, itens: valePostar.filter((i) => periodo(i.publicado.slice(11, 16)) === id) }));
  const exclusivos = todos.filter((i) => i.selo);
  const usados = new Set([...valePostar, ...exclusivos].map((i) => i.link));
  const importantes = todos.filter((i) => !usados.has(i.link) && i.fontes >= 3).sort((a, b) => b.fontes - a.fontes || b.nota - a.nota).slice(0, 12);
  const doDia = (datas || []).filter((d) => d.dia === ddmm && d.fonte && /^https?:\/\//.test(d.link || ''));
  return { atualizado: brIso(agora), dia: hoje, datas: { nacionais: doDia.filter((d) => d.ambito === 'nacional'), internacionais: doDia.filter((d) => d.ambito !== 'nacional') },
    valePostar: porPeriodo, totalVale: valePostar.length, naoDeixe: valePostar.filter((i) => i.faixa === 'nao-deixe').length, exclusivos, importantes, meta: 5 };
}

/** texto do aviso do dia (um só, cabe no limite do ntfy) */
export function aviso(h, { quando = 'manha' } = {}) {
  const d = [...h.datas.nacionais, ...h.datas.internacionais];
  const l = [];
  if (d.length) l.push('📅 ' + d.map((x) => x.nome).join(' · '));
  else l.push('📅 Nenhuma data oficial cadastrada para hoje');
  const top = h.valePostar.flatMap((p) => p.itens).sort((a, b) => b.nota - a.nota).slice(0, 5);
  if (top.length) l.push('', '🔥 Vale postar (' + h.totalVale + '):', ...top.map((i) => '• ' + i.publicado.slice(11, 16) + ' · ' + i.nota + '% · ' + i.titulo.slice(0, 90)));
  else l.push('', quando === 'manha' ? 'Ainda nada com 70% ou mais hoje: o painel enche ao longo do dia.' : 'Nada com 70% ou mais hoje até agora.');
  if (h.exclusivos.length) l.push('', '⭐ ' + h.exclusivos.length + ' com selo de exclusivo (como o veículo disse)');
  const titulo = (quando === 'manha' ? '☀️ Painel do dia ' : '🌙 Painel da noite ') + h.dia.slice(8, 10) + '/' + h.dia.slice(5, 7) + ': ' + h.totalVale + ' vale postar' + (d.length ? ' · ' + d.length + (d.length > 1 ? ' datas' : ' data') : '');
  return { title: titulo, message: l.join('\n').slice(0, 3800) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ler = (f, p) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return p; } };
  const secoes = Object.fromEntries(SECOES.map(([n]) => [n, ler(n + '.json', {})]));
  const datas = ler(new URL('./datas.json', import.meta.url), { datas: [] }).datas;
  const h = montar({ secoes, datas });
  fs.writeFileSync('hoje.json', JSON.stringify(h));
  console.log('PAINEL DO DIA', h.dia, '| datas', h.datas.nacionais.length + h.datas.internacionais.length, '| vale postar', h.totalVale, '| exclusivos', h.exclusivos.length, '| importantes', h.importantes.length);
  // 2 avisos por dia (7h e 19h de Brasília), prioridade 2: sem som, sem gastar bateria e dentro do limite do ntfy grátis
  const TOPIC = process.env.NTFY_TOPIC, EF = 'hoje-estado.json', E = ler(EF, {}), hora = +brIso(AGORA).slice(11, 13);
  const vez = hora >= 19 ? 'noite' : hora >= 7 ? 'manha' : null, chave = h.dia + '-' + vez;
  if (!TOPIC || process.argv.includes('--sem-envio') || !vez || E[chave]) { console.log('aviso do dia:', !vez ? 'antes das 7h' : E[chave] ? 'já enviado' : 'sem envio'); process.exit(0); }
  const m = aviso(h, { quando: vez });
  const r = await fetch(process.env.NTFY_SERVIDOR || 'https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ topic: TOPIC, title: m.title, message: m.message, click: PAGINA, priority: 2, tags: ['calendar'], icon: 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png',
      actions: [{ action: 'view', label: 'Abrir painel do dia', url: PAGINA, clear: false }] }) }).catch((e) => ({ ok: false, status: String(e.message) }));
  console.log('aviso do dia', vez, r.ok ? 'enviado' : 'falhou: ' + r.status);
  if (r.ok) { E[chave] = brIso(AGORA); for (const k of Object.keys(E)) if (k < brIso(AGORA - 7 * 86400e3).slice(0, 10)) delete E[k]; fs.writeFileSync(EF, JSON.stringify(E)); }
}
