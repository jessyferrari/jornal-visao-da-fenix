// Painel do dia (17/11, pedido da Jessyca): numa página e numa notificação, tudo junto para ela bater o olho e escolher o que postar.
// 1) Datas do dia, nacionais e internacionais, só com fonte oficial (scripts/datas.json).
// 2) O que vale postar hoje (nota 70% ou mais, de todas as seções), em ordem de horário: madrugada, manhã, tarde, noite.
// 3) Exclusivos, só como o veículo disse ("X diz que é exclusivo"), nunca afirmados pelo jornal.
// 4) Também importantes: 3 ou mais veículos, para ela não perder nada grande.
// Lê edicao.json, musica.json, series.json, esportes.json e emalta.json. Gera hoje.json e manda 2 avisos por dia (7h e 19h, prioridade 2).
// Uso: node scripts/hoje.mjs [--agora 2026-11-17T07:05-03:00] [--sem-envio]
import fs from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { rotuloCurto } from './ntfy-acoes.mjs';
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

// 25/11 (Jessyca: "Dia Internacional pela Eliminação da Violência contra as Mulheres" e "...para a Eliminação da Violência Contra as Mulheres" vieram
// como 2 datas): a mesma data escrita de jeitos diferentes conta uma vez só (fica a de fonte do governo brasileiro, se houver)
const LIGA = new Set('dia de da do das dos e a o as os pela pelo para internacional nacional mundial contra'.split(' '));
const chaveData = (n) => new Set(String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !LIGA.has(w)));
export function semDatasRepetidas(lista) {
  const out = [];
  for (const d of [...lista].sort((a, b) => (/gov\.br/.test(b.link || '') ? 1 : 0) - (/gov\.br/.test(a.link || '') ? 1 : 0))) {
    const k = chaveData(d.nome); if (!k.size) { out.push(d); continue; }
    const igual = out.some((o) => { const ko = chaveData(o.nome); const com = [...k].filter((w) => ko.has(w)).length; return com / Math.max(k.size, ko.size) >= 0.8; });
    if (!igual) out.push(d);
  }
  return lista.filter((d) => out.includes(d));
}
export function montar({ secoes, datas, meses = [], agora = AGORA }) {
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
  const doDia = semDatasRepetidas((datas || []).filter((d) => d.dia === ddmm && d.fonte && /^https?:\/\//.test(d.link || '')));
  const doMes = (meses || []).filter((m) => m.mes === hoje.slice(5, 7) && m.fonte && /^https?:\/\//.test(m.link || ''));
  return { atualizado: brIso(agora), dia: hoje, datas: { nacionais: doDia.filter((d) => d.ambito === 'nacional'), internacionais: doDia.filter((d) => d.ambito !== 'nacional'), mes: doMes },
    valePostar: porPeriodo, totalVale: valePostar.length, naoDeixe: valePostar.filter((i) => i.faixa === 'nao-deixe').length, exclusivos, importantes, meta: 5 };
}

/** 25/11 (Jessyca: "do painel do dia eu não consigo mandar fazer o post; tenho que abrir notícia por notícia, copiar o link e colar na Mesa"):
 *  até 2 botões "📝 Post: <data>" que mandam a data direto ao agente (comando assinado); o celular pergunta o formato e a produção começa no toque.
 *  O 3º botão abre o painel do dia. Sem comando configurado, fica só o botão do painel. */
export function botoesDatas(h, { CMD = process.env.NTFY_TOPIC_COMANDO || '', ASS = process.env.NTFY_ASSINATURA || '', SRV = process.env.NTFY_SERVIDOR || 'https://ntfy.sh' } = {}) {
  const painel = { action: 'view', label: 'Abrir painel do dia', url: PAGINA, clear: false };
  if (!CMD || !ASS) return [painel];
  const url = SRV.replace(/\/$/, '') + '/' + CMD, hoje = h.dia.slice(8, 10) + '/' + h.dia.slice(5, 7);
  const todas = [...h.datas.nacionais, ...h.datas.internacionais, ...(h.datas.mes || [])].filter((d) => /^https?:\/\//.test(d.link || ''));
  const bt = todas.slice(0, 2).map((d) => {
    const id = createHash('sha1').update('data|' + h.dia + '|' + d.nome).digest('hex').slice(0, 12), sig = createHmac('sha256', String(ASS)).update(id).digest('hex').slice(0, 32);
    const curto = String(d.nome).replace(/^(Dia|Semana|Mês)\s+(Nacional|Internacional|Mundial)?\s*(d[aeo]s?|pela|pelo|para a|para o)?\s*/i, '').split(/\s+/).slice(0, 6).join(' ').replace(/\s+(d[aeo]s?|e|a|o|as|os|contra|para|pela|pelo)$/i, '');
    const texto = (d.mes ? 'Campanha do mês: ' : 'Hoje, ' + hoje + ', é ') + d.nome + '. ' + String(d.descricao || d.resumo || '').slice(0, 600);
    return { action: 'http', label: '📝 Post: ' + curto, url, method: 'POST', clear: false, body: JSON.stringify({ acao: 'data', id, sig, titulo: d.nome, link: d.link, texto }) };
  });
  return [...bt, painel];
}

/** 25/11 (Jessyca: a mais forte do dia não pode se perder na lista do Painel da noite): aviso próprio com "✅ Post" (comando assinado, 2+ fontes),
 *  "Abrir na Mesa" e "Ver notícia". Vai só para o agente (canal -mesa, prioridade 1); o agente repassa ao celular apenas se ela ainda não decidiu
 *  nada sobre a notícia. Sem comando configurado ou sem notícia de 70%+ com 2 fontes, não sai nada. */
export function avisoTopNoite(h, { TOPIC = process.env.NTFY_TOPIC || '', CMD = process.env.NTFY_TOPIC_COMANDO || '', ASS = process.env.NTFY_ASSINATURA || '', SRV = process.env.NTFY_SERVIDOR || 'https://ntfy.sh' } = {}) {
  if (!TOPIC || !CMD || !ASS) return null;
  const i = h.valePostar.flatMap((p) => p.itens).filter((x) => x.fontes >= 2 && /^https?:\/\//.test(x.link || '')).sort((a, b) => b.nota - a.nota || b.fontes - a.fontes)[0];
  if (!i) return null;
  const id = createHash('sha1').update(i.link).digest('hex').slice(0, 12), sig = createHmac('sha256', String(ASS)).update(id).digest('hex').slice(0, 32);
  const fsig = createHmac('sha256', String(ASS)).update(id + '|fontes=' + i.fontes).digest('hex').slice(0, 32);
  const texto = [i.titulo, 'Veículo: ' + i.veiculo + ' · ' + i.publicado.slice(8, 10) + '/' + i.publicado.slice(5, 7) + ' ' + i.publicado.slice(11, 16), i.motivo].filter(Boolean).join('\n').slice(0, 500);
  const mesa = 'https://jessyferrari.github.io/jornal-visao-da-fenix/mesa.html#c=' + encodeURIComponent(CMD + '-mesa') + '&a=decidir';
  return { topic: TOPIC + '-mesa', priority: 1, tags: ['top-noite', 'newspaper'], click: i.link,
    title: '🏆 A mais forte de hoje ainda sem post: ' + i.titulo.slice(0, 110),
    message: i.nota + '% · ' + i.fontes + ' veículos · ' + i.veiculo + ' às ' + i.publicado.slice(11, 16) + '\nAinda dá tempo de postar hoje. Toque em Post e escolha o formato.',
    actions: [
      { action: 'http', label: rotuloCurto('✅ Post: ', i.titulo), url: SRV.replace(/\/$/, '') + '/' + CMD, method: 'POST', clear: false, body: JSON.stringify({ acao: 'publicar', id, sig, titulo: i.titulo.slice(0, 160), fontes: i.fontes, fsig, nota: i.nota, faixa: i.faixa, link: i.link, links: '', texto }) },
      { action: 'view', label: 'Abrir na Mesa', url: mesa, clear: false },
      { action: 'view', label: 'Ver notícia', url: i.link, clear: false },
    ] };
}

/** texto do aviso do dia (um só, cabe no limite do ntfy) */
export function aviso(h, { quando = 'manha' } = {}) {
  const d = [...h.datas.nacionais, ...h.datas.internacionais];
  const l = [];
  if (d.length) l.push('📅 ' + d.map((x) => x.nome).join(' · '));
  if ((h.datas.mes || []).length) l.push('🎗️ ' + h.datas.mes.map((x) => x.nome).join(' · '));
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
  const DJ = ler(new URL('./datas.json', import.meta.url), { datas: [] }), datas = DJ.datas, meses = DJ.meses || [];
  const h = montar({ secoes, datas, meses });
  fs.writeFileSync('hoje.json', JSON.stringify(h));
  console.log('PAINEL DO DIA', h.dia, '| datas', h.datas.nacionais.length + h.datas.internacionais.length, '| vale postar', h.totalVale, '| exclusivos', h.exclusivos.length, '| importantes', h.importantes.length);
  // 2 avisos por dia (7h e 19h de Brasília), prioridade 2: sem som, sem gastar bateria e dentro do limite do ntfy grátis
  const TOPIC = process.env.NTFY_TOPIC, EF = 'hoje-estado.json', E = ler(EF, {}), hora = +brIso(AGORA).slice(11, 13);
  const vez = hora >= 19 ? 'noite' : hora >= 7 ? 'manha' : null, chave = h.dia + '-' + vez;
  if (!TOPIC || process.argv.includes('--sem-envio') || !vez || E[chave]) { console.log('aviso do dia:', !vez ? 'antes das 7h' : E[chave] ? 'já enviado' : 'sem envio'); process.exit(0); }
  const m = aviso(h, { quando: vez });
  const r = await fetch(process.env.NTFY_SERVIDOR || 'https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ topic: TOPIC, title: m.title, message: m.message, click: PAGINA, priority: 2, tags: ['calendar'], icon: 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png',
      actions: botoesDatas(h) }) }).catch((e) => ({ ok: false, status: String(e.message) }));
  console.log('aviso do dia', vez, r.ok ? 'enviado' : 'falhou: ' + r.status);
  if (r.ok && vez === 'noite') { const t = avisoTopNoite(h);
    if (t) { await new Promise((z) => setTimeout(z, 1500)); const r2 = await fetch(process.env.NTFY_SERVIDOR || 'https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ icon: 'https://jessyferrari.github.io/jornal-visao-da-fenix/assets/icone-ntfy-v2.png', ...t }) }).catch((e) => ({ ok: false, status: String(e.message) }));
      console.log('mais forte do dia (via agente):', r2.ok ? 'enviada' : 'falhou: ' + r2.status); } else console.log('mais forte do dia: nenhuma com 70%+ e 2 fontes'); }
  if (r.ok) { E[chave] = brIso(AGORA); for (const k of Object.keys(E)) if (k < brIso(AGORA - 7 * 86400e3).slice(0, 10)) delete E[k]; fs.writeFileSync(EF, JSON.stringify(E)); }
}
