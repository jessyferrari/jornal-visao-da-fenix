// Regras puras do "Em Alta" (testáveis sem rede): canal próprio derivado do canal Música (sem segredo novo),
// junção de sinais de fontes diferentes no mesmo assunto, etiquetas Subindo / No pico / Caindo / Em alta com base
// no histórico das rodadas, curva de atenção por hora (Wikipedia pt) e Agenda de postagens. Zero IA: só código.
import { createHash, createHmac } from 'node:crypto';

const TOPICO_OK = /^[-_A-Za-z0-9]{1,64}$/;
// canal Em Alta = <canal Música>-alta (o notebook deriva igual do .ntfy.json, como o canal SP)
export const topicoAlta = (musica) => { const t = String(musica || '') + '-alta'; return musica && TOPICO_OK.test(t) ? t : ''; };
export const avisoAlta = (servidor, musica) => {
  const t = topicoAlta(musica); if (!t) return null; const host = String(servidor || 'https://ntfy.sh').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return { title: 'Fênix: assine o canal Em Alta', priority: 4, tags: ['rocket'],
    message: 'Novo canal só com o que está MAIS COMENTADO no Brasil e no mundo e o que está SUBINDO agora, com a Agenda de postagens do dia.\n' +
      'Toque no botão "Assinar Em Alta" logo abaixo. O app ntfy abre e pede para confirmar: toque em Inscrever.\n' +
      'Se o botão não abrir (ou no iPhone): no app ntfy toque em + e digite o mesmo nome do canal Fenix Musica com -alta no final.',
    actions: [{ action: 'view', label: 'Assinar Em Alta', url: 'ntfy://' + host + '/' + t + '?display=Fenix+Em+Alta', clear: false }] };
};

// ===== horário de Brasília (UTC-3 fixo, sem horário de verão desde 2019) =====
export const BR = (ms) => new Date(ms - 3 * 3600e3);
export const brIso = (ms) => BR(ms).toISOString().slice(0, 16);           // 2026-11-14T07:05
export const brDia = (ms) => brIso(ms).slice(0, 10);
export const brHora = (ms) => BR(ms).getUTCHours();
export const brMin = (ms) => BR(ms).getUTCHours() * 60 + BR(ms).getUTCMinutes();
export const hm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
export const deBR = (dia, hhmm) => Date.parse(dia + 'T' + hhmm + ':00-03:00');
export const fimDeSemana = (dia) => [0, 6].includes(new Date(dia + 'T12:00:00-03:00').getUTCDay());

// ===== texto =====
export const sem = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// "#VcNaCoreiaComNovex" -> "vc na coreia com novex"; "Jensen_Huang" -> "jensen huang"
export const norm = (t) => sem(String(t || '').replace(/^#/, '').replace(/_/g, ' ').replace(/([a-zà-ú])([A-ZÀ-Ú])/g, '$1 $2')).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const VAZIAS = new Set(['brasil', 'governo', 'hoje', 'agora', 'noticias', 'video', 'futebol', 'jogo', 'eleicao', 'sexta feira', 'sabado', 'domingo', 'segunda feira']);
// termo serve para casar com texto? (palavra inteira; 1 palavra só com 6+ letras; várias palavras com 5+)
const DATA = /^((segunda|terca|quarta|quinta|sexta)( feira)?|sabado|domingo|friday|monday|saturday|sunday)( the)?( \d+(th)?)?$|^\d+$/;
// curto: termo de busca do Google ou assunto do X (já é específico) pode ter 1 palavra de 4+ letras (ex.: mpox)
export const termoBom = (k, curto) => !!k && !VAZIAS.has(k) && !DATA.test(k) && (k.includes(' ') ? k.length >= 5 : k.length >= (curto ? 4 : 6));
export const casa = (termo, texto, curto) => { const k = norm(termo); if (!termoBom(k, curto)) return false; return (' ' + norm(texto) + ' ').includes(' ' + k + ' '); };
export const chave = (t) => norm(t).replace(/ /g, '-').slice(0, 60);
export const idAlta = (k) => createHash('sha1').update('alta|' + k).digest('hex').slice(0, 12);

export const TIPOS = { gt: 'Google Trends', x: 'X', gnews: 'Google Notícias', imprensa: 'Imprensa', wiki: 'Wikipedia' };
const trafegoN = (s) => +(String(s || '').replace(/[^0-9]/g, '')) || 0;

// ===== junta os sinais no mesmo assunto =====
// sinal: { tipo, termo, escopo, texto?, eid?, veiculos?: [{nome,titulo,link}], dados: {...} }
export function juntar(sinais) {
  const grupos = [];
  const textoDe = (s) => s.tipo === 'imprensa' ? s.texto || s.termo : s.termo;
  const mesmo = (a, b) => {
    if (a.tipo === 'imprensa' && b.tipo === 'imprensa') return a.eid && a.eid === b.eid;
    const ka = norm(a.termo), kb = norm(b.termo); if (ka && ka === kb) return true;
    const curto = (s) => s.tipo === 'gt' || s.tipo === 'x';
    if (a.tipo !== 'imprensa' && casa(a.termo, textoDe(b), curto(a))) return true;
    if (b.tipo !== 'imprensa' && casa(b.termo, textoDe(a), curto(b))) return true;
    return false;
  };
  for (const s of sinais) {
    const alvo = grupos.filter((g) => g.sinais.some((x) => mesmo(x, s)));
    if (!alvo.length) { grupos.push({ sinais: [s] }); continue; }
    const g0 = alvo[0]; g0.sinais.push(s);
    for (const g of alvo.slice(1)) { g0.sinais.push(...g.sinais); grupos.splice(grupos.indexOf(g), 1); }
  }
  return grupos.map(montar);
}
function montar(g) {
  const S = g.sinais; const tipos = [...new Set(S.map((s) => s.tipo))];
  const veic = new Map();
  for (const s of S) for (const v of s.veiculos || []) { const k = sem(v.nome).replace(/[^a-z0-9]/g, ''); if (k && !veic.has(k)) veic.set(k, v); }
  const termo = (S.find((s) => s.tipo === 'gt') || S.find((s) => s.tipo === 'x') || S.find((s) => s.tipo === 'wiki') || S[0]).termo;
  const pressa = S.find((s) => s.tipo === 'imprensa'); const manchete = pressa ? pressa.termo : (S.find((s) => s.tipo === 'gnews') || {}).termo || '';
  const nome = S.every((s) => s.tipo === 'imprensa' || s.tipo === 'gnews') ? manchete : String(termo).replace(/_/g, ' ');
  const n = {};
  const gt = S.filter((s) => s.tipo === 'gt'); if (gt.length) { const m = gt.sort((a, b) => trafegoN(b.dados.trafego) - trafegoN(a.dados.trafego))[0]; n.gt = { trafego: m.dados.trafego, inicio: Math.min(...gt.map((x) => x.dados.inicio || Infinity)), pais: [...new Set(gt.map((x) => x.escopo))] }; }
  const x = S.filter((s) => s.tipo === 'x'); if (x.length) { const br = x.find((s) => s.escopo === 'br') || x[0]; n.x = { posicao: br.dados.posicao, melhor: Math.min(...x.map((s) => s.dados.melhor || 99)), horas: Math.max(...x.map((s) => s.dados.horas || 0)), posts: br.dados.posts || '', onde: [...new Set(x.map((s) => s.escopo))] }; }
  const w = S.find((s) => s.tipo === 'wiki'); if (w) n.wiki = { views: w.dados.views, artigo: w.dados.artigo, vezesMedia: w.dados.vezesMedia || null, dia: w.dados.dia };
  const gn = S.filter((s) => s.tipo === 'gnews'); if (gn.length) n.gnews = gn.length;
  if (pressa) n.imprensa = veic.size;
  const escopos = new Set(S.map((s) => s.escopo)); const escopo = escopos.has('br') && escopos.has('mundo') ? 'ambos' : escopos.has('br') ? 'br' : 'mundo';
  const chaves = [...new Set(S.map((s) => s.tipo === 'imprensa' ? 'eid:' + s.eid : chave(s.termo)).filter(Boolean))];
  const direto = (u) => u && !/news\.google\.com/.test(u);   // link direto do veículo primeiro (o do Google Notícias é um redirecionamento longo)
  const link = (pressa && pressa.link) || ([...veic.values()].find((v) => direto(v.link)) || {}).link || ([...veic.values()][0] || {}).link || (S.find((s) => s.link) || {}).link || '';
  return { nome: String(nome).slice(0, 160), manchete: String(manchete).slice(0, 220), termo, tipos, veiculos: [...veic.values()].slice(0, 12), numeros: n, escopo, chaves, link };
}

// entra na lista? (sem tamanho fixo: entra tudo o que passar no corte)
export function relevante(t) {
  const n = t.numeros;
  // Google Notícias sozinho não basta (toda manchete está lá): precisa de outra fonte
  return t.tipos.length >= 2 || (t.tipos.includes('imprensa') && t.veiculos.length >= 3) || trafegoN(n.gt && n.gt.trafego) >= 1000 || (n.x && n.x.horas >= 2 && n.x.melhor <= 5) || (n.wiki && n.wiki.vezesMedia >= 3);
}
export const publicavel = (t) => t.veiculos.length >= 2;   // REGRA DE VERDADE: 2 sites diferentes
export const confianca = (t) => t.tipos.length >= 3 ? 'alta' : t.tipos.length === 2 ? 'média' : 'baixa';

// ===== histórico e etiquetas =====
// estado.topicos[k] = { primeiro, seed, hist: [{t, tipos, veic, xpos, gt}] }  (chave principal = 1ª chave; apelidos em estado.apelidos)
export function lembrar(E, t, agora, seed) {
  E.topicos = E.topicos || {}; E.apelidos = E.apelidos || {};
  let k = t.chaves.map((c) => E.apelidos[c] || (E.topicos[c] ? c : '')).find(Boolean) || t.chaves[0];
  const T = E.topicos[k] || (E.topicos[k] = { primeiro: agora, seed: !!seed, hist: [] });
  for (const c of t.chaves) E.apelidos[c] = k;
  const n = t.numeros; T.hist.push({ t: agora, tipos: t.tipos.length, veic: t.veiculos.length, xpos: n.x ? n.x.posicao || null : null, gt: n.gt ? trafegoN(n.gt.trafego) : 0 });
  T.hist = T.hist.filter((h) => agora - h.t < 6 * 3600e3).slice(-30); T.visto = agora;
  return [k, T];
}
export function esquecer(E, agora) {
  for (const [k, T] of Object.entries(E.topicos || {})) if (agora - (T.visto || 0) > 36 * 3600e3) delete E.topicos[k];
  for (const [a, k] of Object.entries(E.apelidos || {})) if (!E.topicos[k]) delete E.apelidos[a];
}
const ha = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''); };
export function etiquetar(t, T, agora) {
  const H = T.hist, atual = H[H.length - 1], ant = H.filter((h) => agora - h.t >= 50 * 60e3 && agora - h.t <= 3.2 * 3600e3);
  const motivo = []; const n = t.numeros;
  const novoNosso = !T.seed && agora - T.primeiro < 2 * 3600e3;
  const novoGt = n.gt && isFinite(n.gt.inicio) && agora >= n.gt.inicio && agora - n.gt.inicio < 2 * 3600e3;
  const novoX = n.x && n.x.posicao && n.x.horas <= 2;
  if (novoNosso) motivo.push('apareceu no jornal há ' + ha(agora - T.primeiro));
  if (novoGt) motivo.push('começou a subir no Google às ' + brIso(n.gt.inicio).slice(11, 16));
  if (novoX) motivo.push('no X há ' + (n.x.horas <= 1 ? 'menos de 2 h' : n.x.horas + ' h'));
  let cresce = false, cai = false;
  const xAnt = ant.filter((h) => h.xpos).map((h) => h.xpos);
  if (atual.xpos && xAnt.length) { const pior = Math.max(...xAnt); if (pior - atual.xpos >= 3) { cresce = true; motivo.push('no X subiu de ' + pior + 'º para ' + atual.xpos + 'º'); } const melhor = Math.min(...xAnt); if (atual.xpos - melhor >= 5) { cai = true; motivo.push('no X caiu de ' + melhor + 'º para ' + atual.xpos + 'º'); } }
  if (!atual.xpos && xAnt.length && H.slice(-3, -1).some((h) => h.xpos)) { cai = true; motivo.push('saiu dos assuntos do X'); }
  if (ant.length) {
    const minT = Math.min(...ant.map((h) => h.tipos)), maxT = Math.max(...ant.map((h) => h.tipos)), minV = Math.min(...ant.map((h) => h.veic)), minG = Math.min(...ant.map((h) => h.gt));
    if (atual.tipos > minT) { cresce = true; motivo.push('espalhou: de ' + minT + ' para ' + atual.tipos + ' fontes'); }
    if (atual.veic >= minV + 2) { cresce = true; motivo.push('de ' + minV + ' para ' + atual.veic + ' veículos'); }
    if (atual.gt > minG && minG > 0) { cresce = true; motivo.push('Google: de ' + minG + '+ para ' + atual.gt + '+ buscas'); }
    if (atual.tipos < maxT && !cresce) { cai = true; motivo.push('perdeu fonte: de ' + maxT + ' para ' + atual.tipos); }
  }
  let etiqueta;
  if (cai && !cresce) etiqueta = 'caindo';
  else if (cresce || ((novoNosso || novoGt || novoX) && t.tipos.length >= 2)) etiqueta = 'subindo';
  else if (t.tipos.length >= 3 || (t.tipos.length >= 2 && ((n.x && n.x.melhor <= 10 && n.x.horas >= 3) || t.veiculos.length >= 5 || trafegoN(n.gt && n.gt.trafego) >= 1000))) etiqueta = 'pico';
  else etiqueta = 'estavel';
  if (etiqueta === 'pico' && !motivo.length) motivo.push('em ' + t.tipos.length + ' fontes, estável no topo');
  return { etiqueta, motivo };
}
export const ROTULO = { subindo: '🚀 Subindo', pico: '🔥 No pico', caindo: '📉 Caindo', estavel: '🟢 Em alta' };
export const ORDEM = { subindo: 0, pico: 1, estavel: 2, caindo: 3 };

// números que as fontes deram (nada calculado vira "dado")
export function numerosTexto(t) {
  const n = t.numeros, o = [];
  if (n.gt) o.push('Google ' + (n.gt.pais.includes('mundo') && !n.gt.pais.includes('br') ? 'EUA' : 'Brasil') + ': ' + n.gt.trafego + ' buscas');
  if (n.x) o.push('X' + (n.x.onde.includes('br') ? ' Brasil' : ' mundo') + ': ' + (n.x.posicao ? n.x.posicao + 'º agora' : 'melhor ' + n.x.melhor + 'º') + (n.x.horas ? ', ' + n.x.horas + ' h em alta' : '') + (n.x.posts ? ', ' + n.x.posts + ' posts' : ''));
  if (t.veiculos.length) o.push(t.veiculos.length + (t.veiculos.length > 1 ? ' veículos' : ' veículo'));
  if (n.wiki) o.push('Wikipedia' + (n.wiki.dia ? ' (' + n.wiki.dia.slice(8, 10) + '/' + n.wiki.dia.slice(5, 7) + ')' : '') + ': ' + n.wiki.views.toLocaleString('pt-BR') + ' leituras' + (n.wiki.vezesMedia ? ' (' + n.wiki.vezesMedia + 'x a média da semana)' : ''));
  return o.join(' · ');
}

// ===== curva de atenção: Wikipedia em português, visitas por hora (todas as páginas) =====
// horas: { 'AAAA-MM-DD HH' (Brasília): visitas }. Só dias completos (24 h) entram. Separa dias úteis e fim de semana.
export function curva(horas) {
  const dias = {}; for (const [k, v] of Object.entries(horas || {})) { const [d, h] = k.split(' '); (dias[d] = dias[d] || {})[+h] = v; }
  const completos = Object.entries(dias).filter(([, hs]) => Object.keys(hs).length === 24).sort();
  const media = (lista) => { if (!lista.length) return null; const p = Array(24).fill(0); for (const [, hs] of lista) { const tot = Object.values(hs).reduce((a, b) => a + b, 0); for (let h = 0; h < 24; h++) p[h] += hs[h] / tot; } return p.map((x) => +(x / lista.length * 100).toFixed(2)); };
  const uteis = completos.filter(([d]) => !fimDeSemana(d)), fds = completos.filter(([d]) => fimDeSemana(d));
  return { dias: completos.length, de: completos.length ? completos[0][0] : null, ate: completos.length ? completos[completos.length - 1][0] : null,
    todos: media(completos), uteis: media(uteis), diasUteis: uteis.length, fimDeSemana: media(fds), diasFimDeSemana: fds.length };
}
// melhores horários do dia: as horas de maior atenção (7h a 23h), com pelo menos 2 h entre uma e outra
export function horarios(C, dia, quantos = 4) {
  if (!C || !C.dias) return [];
  const fds = fimDeSemana(dia); const p = (fds ? C.fimDeSemana : C.uteis) || C.todos; const base = fds ? C.diasFimDeSemana : C.diasUteis;
  const cand = []; for (let h = 7; h <= 23; h++) cand.push({ h, pct: p[h] });
  cand.sort((a, b) => b.pct - a.pct); const esc = [];
  for (const c of cand) { if (esc.length >= quantos) break; if (esc.every((e) => Math.abs(e.h - c.h) >= 2)) esc.push(c); }
  return esc.sort((a, b) => a.h - b.h).map((c) => ({ hora: String(c.h).padStart(2, '0') + ':00', pct: c.pct, acima: Math.round((c.pct / (100 / 24) - 1) * 100), dias: base || C.dias, tipoDia: fds ? 'fim de semana' : 'dia útil' }));
}
// Agenda: cada horário que ainda não passou ganha um assunto (Subindo nos mais próximos; publicáveis primeiro)
export function agenda(slots, itens, agora, dia) {
  const usados = new Set(); const hoje = dia || brDia(agora);
  const fila = [...itens].filter((i) => i.etiqueta !== 'caindo').sort((a, b) => (b.publicavel - a.publicavel) || (ORDEM[a.etiqueta] - ORDEM[b.etiqueta]) || (b.tipos.length - a.tipos.length));
  return slots.map((s) => {
    const alvo = deBR(hoje, s.hora); const passou = alvo < agora;
    if (passou) return { ...s, passou: true, item: null };
    const it = fila.find((i) => !usados.has(i.id)); if (it) usados.add(it.id);
    return { ...s, passou: false, item: it ? { id: it.id, nome: it.nome, etiqueta: it.etiqueta, publicavel: it.publicavel } : null };
  });
}
// próximo horário da agenda com tempo para produzir (75 min) — para o botão "Agendar HH:MM"
export function proximoHorario(slots, agora, dia) { const hoje = dia || brDia(agora); return (slots || []).find((s) => deBR(hoje, s.hora) - agora >= 75 * 60e3) || null; }

// ===== botões (ntfy aceita no máximo 3) =====
export const assinar = (ass, id) => createHmac('sha256', String(ass)).update(String(id)).digest('hex').slice(0, 32);
export const assinarFontes = (ass, id, n) => createHmac('sha256', String(ass)).update(String(id) + '|fontes=' + (+n || 0)).digest('hex').slice(0, 32);
export const assinarAgenda = (ass, id, dia, hora) => createHmac('sha256', String(ass)).update(String(id) + '|agendar|' + dia + '|' + hora).digest('hex').slice(0, 32);
export function textoProducao(i) {
  return ['Assunto em alta: ' + i.nome, i.manchete && i.manchete !== i.nome ? 'Manchete: ' + i.manchete : '', 'Veículos: ' + i.veiculos.map((v) => v.nome).slice(0, 5).join(', ')].filter(Boolean).join('\n').slice(0, 300);
}
export function corpoComando(acao, i, { CMD, ASS, dia, hora }) {
  const fontes = i.veiculos.length, b = { acao, id: i.id, sig: assinar(ASS, i.id), titulo: String(i.nome).slice(0, 120), fontes, fsig: assinarFontes(ASS, i.id, fontes), link: i.link, links: i.veiculos.map((v) => v.link).filter((u) => u && u !== i.link && !/news\.google\.com/.test(u)).slice(0, 2).join('\n'), texto: textoProducao(i), origem: 'emalta' };
  if (acao === 'agendar') Object.assign(b, { dia, hora, asig: assinarAgenda(ASS, i.id, dia, hora) });
  return JSON.stringify(b);
}
export function botoesItem(i, { SRV = 'https://ntfy.sh', CMD, ASS, slot, dia, pagina }) {
  const ver = { action: 'view', label: 'Ver notícia', url: i.link || pagina, clear: false };
  if (!i.publicavel || !CMD || !ASS) return [ver, { action: 'view', label: i.publicavel ? 'Abrir Em Alta' : '🔎 Em apuração', url: pagina, clear: false }];
  const url = SRV.replace(/\/$/, '') + '/' + CMD;
  const a = [{ action: 'http', label: '✅ Sim, publicar', url, method: 'POST', body: corpoComando('publicar', i, { CMD, ASS }), clear: true }];
  if (slot) a.push({ action: 'http', label: '⏰ Agendar ' + slot.hora, url, method: 'POST', body: corpoComando('agendar', i, { CMD, ASS, dia, hora: slot.hora }), clear: true });
  a.push(ver); return a.slice(0, 3);
}
