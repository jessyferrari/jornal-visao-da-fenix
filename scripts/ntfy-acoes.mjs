// Botões e toque das notificações (17/11, pedido da Jessyca: "clico na notificação, vou para o site, a notificação some e não tem botão").
// 1) Toque: o aviso de UMA notícia não abre mais o site. Sem "click", o app ntfy abre o próprio canal, onde a mensagem
//    fica com os botões (conferido no código do ntfy-android: NotificationService usa detailActivityIntent quando click é vazio,
//    e DetailAdapter.maybeRenderActions desenha os até 3 botões em cada mensagem). O site abre só pelo botão "Ver notícia".
// 2) Notícia de 1 fonte: 🔎 Apurar no agente / Ver notícia / Não. "Apurar" leva a notícia ao agente pelo mesmo caminho
//    do Fenix Link (modo tema): a produção procura a confirmação e vale a regra das 2 fontes. Nunca vira "Sim, publicar".
import { createHash, createHmac } from 'node:crypto';
export const JORNAL = 'https://jessyferrari.github.io/jornal-visao-da-fenix';
export const idDoLink = (l) => createHash('sha1').update(String(l)).digest('hex').slice(0, 12);
const assinar = (ASS, id) => createHmac('sha256', String(ASS)).update(String(id)).digest('hex').slice(0, 32);

export function botoesApurar({ link, titulo, texto, pot, origem, id, CMD, ASS, SRV = 'https://ntfy.sh', pagina = JORNAL + '/' }) {
  const ver = { action: 'view', label: 'Ver notícia', url: link || pagina, clear: false };
  if (!CMD || !ASS || !/^https?:\/\//.test(link || '')) return [ver, { action: 'view', label: '🔎 Em apuração', url: pagina, clear: false }];
  id = /^[a-f0-9]{12}$/.test(id || '') ? id : idDoLink(link);
  const url = SRV.replace(/\/$/, '') + '/' + CMD, sig = assinar(ASS, id), tit = String(titulo || link).slice(0, 160);
  const corpo = { acao: 'apurar', id, sig, titulo: tit, link, texto: String(texto || tit).slice(0, 500), ...(pot && pot.nota != null ? { nota: pot.nota, faixa: pot.faixa } : {}), ...(origem ? { origem } : {}) };
  return [
    { action: 'http', label: '🔎 Apurar no agente', url, method: 'POST', body: JSON.stringify(corpo), clear: true },
    ver,
    { action: 'http', label: 'Não', url, method: 'POST', body: JSON.stringify({ acao: 'recusar', id, sig, titulo: tit }), clear: true },
  ];
}

/** aviso de uma notícia: tira o "click" para o site (o toque abre o ntfy com os botões), sem perder o link */
export function toqueNoNtfy(m) {
  const c = String(m.click || ''), a = m.actions || [];
  if (!/^https?:\/\//.test(c) || c.startsWith(JORNAL) || !a.length) return m;   // resumos e páginas do jornal continuam abrindo o jornal
  const temLink = a.some((x) => x.action === 'view' && x.url === c);
  if (!temLink && a.length >= 3) return m;   // sem espaço para o botão Ver notícia: mantém o toque no site para não perder o link
  const r = { ...m }; delete r.click;
  if (!temLink) r.actions = [...a, { action: 'view', label: 'Ver notícia', url: c, clear: false }];
  return r;
}

// ✅ em apuração que confirmou (17/11): o jornal geral avisava a notícia de 1 fonte e nunca mais voltava nela.
// st.apuracao = { chave: { t, titulo } } das que foram avisadas com 1 fonte; quando a notícia (ou o grupo dela) chega a 2+ veículos,
// sai um aviso "✅ Confirmado" com Sim, publicar. Limite de 15 por dia (bateria e o limite de 250 mensagens do ntfy grátis).
export function confirmadosDeApuracao(itens2mais, st, { agora }) {
  const ap = st.apuracao || {}, out = [], usados = new Set();
  for (const i of itens2mais) {
    const chave = [i.key, ...(i.grp || []).map((g) => g.key)].find((k) => ap[k]);
    if (!chave || usados.has(chave) || agora - ap[chave].t > 24 * 3600e3) continue;
    usados.add(chave); out.push({ i, chave });
  }
  return out;
}
const diaBR = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
export const podeConfirmar = (st, { agora, max = 15 }) => !(st.confDia && st.confDia.dia === diaBR(agora) && st.confDia.n >= max);
export function marcarConfirmado(st, chave, { agora }) {
  delete st.apuracao[chave];
  const d = diaBR(agora); st.confDia = st.confDia && st.confDia.dia === d ? { dia: d, n: st.confDia.n + 1 } : { dia: d, n: 1 };
}
