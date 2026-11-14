// Regras puras do setor Música (testáveis sem rede): canal só de São Paulo, mesmo fato com palavras diferentes,
// e a regra de verdade: notícia com 1 fonte só fica "em apuração" (sem "Sim, publicar" e sem "Fazer post").
import { createHmac } from 'node:crypto';

export const ARTISTAS = /\b(zeca pagodinho|alcione|martinho da vila|paulinho da viola|leci brand[aã]o|arlindo cruz|arlindinho|xande de pilares|diogo nogueira|p[eé]ricles|thiaguinho|fundo de quintal|jorge arag[aã]o|dudu nobre|mumuzinho|ferrugem|sorriso maroto|grupo revela[cç][aã]o|exaltasamba|belo(?! horizonte)|p[eé] no ch[aã]o|turma do pagode|menos [eé] mais|di propósito|di prop[oó]sito|dilsinho|suel|tiee|vitinho|ludmilla|numanice|teresa cristina|mart'?n[aá]lia|maria rita|roberta s[aá]|mosquito|marcelo d2|seu jorge|beth carvalho|clara nunes|cartola|noel rosa|adoniran barbosa|jo[aã]o nogueira|bezerra da silva|dona ivone lara|elza soares|monarco|nei lopes|wilson das neves|neguinho da beija-?flor|zeca baleiro|raça negra|ra[cç]a negra|art popular|katinguel[eê]|s[oó] pra contrariar|alexandre pires|rodriguinho|mart[ií]nho|reinaldo|sombrinha|almir guineto|jovelina|grupo molejo|anderson leonardo|xamã|negritude j[uú]nior|chrigor|swing e simpatia|harmonia do samba|[eé] o tchan|psirico|l[eé]o santana|parangol[eé]|samba de raiz|roda de samba)\b/i;

// ===== canal só de São Paulo: derivado do segredo NTFY_TOPIC_MUSICA (sem segredo novo, sem rodar nada no notebook) =====
const TOPICO_OK = /^[-_A-Za-z0-9]{1,64}$/;
export const topicoSP = (musica) => { const t = String(musica || '') + '-sp'; return musica && TOPICO_OK.test(t) ? t : ''; };
// São Paulo vai SÓ para o canal SP; RJ, resto do Brasil e Internacional seguem no canal Música
export const destino = (reg, musica) => (reg === 'sp' && topicoSP(musica)) ? topicoSP(musica) : musica;
export const avisoSP = (servidor, musica) => {
  const sp = topicoSP(musica); if (!sp) return null; const host = String(servidor || 'https://ntfy.sh').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return { title: 'Fênix: assine o canal Música São Paulo', priority: 4, tags: ['bell', 'sp'],
    message: 'A partir de agora as notícias de música de São Paulo chegam num canal só delas: Fenix Musica SP. Rio de Janeiro, resto do Brasil e Internacional continuam aqui no Fenix Musica.\nToque no botão Assinar Música SP. No iPhone, ou se o botão não abrir: no app ntfy toque em + e digite o mesmo nome do canal Fenix Musica com -sp no final.',
    actions: [{ action: 'view', label: 'Assinar Música SP', url: 'ntfy://' + host + '/' + sp + '?display=Fenix+Musica+SP', clear: false }] };
};

// ===== regra de verdade: só com 2 fontes (sites diferentes) a notícia pode virar post =====
export const podePublicar = (fontes) => (+fontes || 0) >= 2;
// assinatura do número de fontes (o agente confere: ninguém transforma 1 fonte em 2 no caminho)
export const assinarFontes = (chave, id, fontes) => createHmac('sha256', String(chave)).update(String(id) + '|fontes=' + (+fontes || 0)).digest('hex').slice(0, 32);

// ===== mesmo fato contado com palavras diferentes (ex.: "João Nogueira completaria 85 anos" x "João Nogueira faria 85 anos") =====
const sem = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const LUGARES = new Set(['sao paulo', 'rio de janeiro', 'belo horizonte', 'porto alegre', 'santa catarina', 'minas gerais', 'distrito federal', 'espirito santo', 'mato grosso', 'rio grande', 'baixada fluminense', 'zona norte', 'zona sul', 'zona leste', 'zona oeste', 'grande sp', 'barra funda', 'vila madalena', 'grammy latino', 'carnaval', 'samba', 'pagode']);
export function pessoas(titulo) {
  const out = new Set();
  for (const m of String(titulo || '').matchAll(/(?:^|[^\p{L}])(\p{Lu}[\p{Ll}'’-]+(?:\s+(?:d[aeo]s?\s+)?\p{Lu}[\p{Ll}'’-]+)+)/gu)) { const n = sem(m[1]); if (!LUGARES.has(n)) out.add(n); }
  for (const m of String(titulo || '').matchAll(new RegExp(ARTISTAS.source, 'gi'))) { const n = sem(m[0]); if (!/^(roda de samba|samba de raiz)$/.test(n)) out.add(n.replace(/^jo[aã]o/, 'joao')); }
  return out;
}
const EVENTOS = [
  ['aniversario', /\b\d{2,3} anos\b|anivers[aá]rio|completaria|centen[aá]rio/i],
  ['dvd', /\bdvd\b|audiovisual|grava[cç][aã]o (do |de )?(dvd|audiovisual|ao vivo)/i],
  ['ep', /\bep\b/i], ['album', /[aá]lbum/i], ['single', /\bsingle\b|nova m[uú]sica|\bclipe\b/i],
  ['luto', /\b(morre|morreu|faleceu|falece|morte d[eoa]|vel[oó]rio|sepultad[oa]|enterrad[oa]|luto)\b/i],
  ['show', /\bshows?\b|turn[eê]|apresenta[cç][aã]o/i],
];
export const eventos = (t) => new Set(EVENTOS.filter(([, re]) => re.test(t)).map(([k]) => k));
const anos = (t) => new Set([...String(t).matchAll(/\b(\d{2,3}) anos\b/gi)].map((m) => m[1]));
// a, b: { title, dom, ts, cidade? }. Junta só se: sites diferentes, até 72 h de distância, mesma pessoa/artista no título e mesmo tipo de fato.
// "show" exige também a mesma cidade (dois shows diferentes do mesmo artista não viram um fato só); aniversário exige o mesmo número de anos.
export function mesmoFato(a, b) {
  if (!a || !b || a === b || (a.dom && a.dom === b.dom) || Math.abs((a.ts || 0) - (b.ts || 0)) > 72 * 3600e3) return false;
  const pa = pessoas(a.title), pb = pessoas(b.title); if (![...pa].some((x) => pb.has(x))) return false;
  const ea = eventos(a.title), eb = eventos(b.title); const comum = [...ea].filter((x) => eb.has(x)); if (!comum.length) return false;
  if (comum.length === 1 && comum[0] === 'show' && !(a.cidade && a.cidade === b.cidade)) return false;
  if (comum.includes('aniversario')) { const na = anos(a.title), nb = anos(b.title); if (na.size && nb.size && ![...na].some((x) => nb.has(x))) return false; }
  return true;
}

// ===== DJs e Festivais: lista curada (scripts/djs-festivais.json) =====
// nome com contexto=true (palavra comum: Fisher, Black Coffee, The Town...) só conta com contexto de música no texto
const CTX = /\b(dj|djs|festival|festivais|set|line-?up|show|shows|turn[eê]|tour|[aá]lbum|album|faixa|track|remix|single|m[uú]sica|music|eletr[oô]nic|techno|house|palco|stage|edi[cç][aã]o|ingressos?|headliner|atra[cç][aã]o|apresenta)\b/i;
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function montarDJF(lista) {
  const ent = [];
  for (const [tipo, l] of [['dj', lista.djs || []], ['festival', lista.festivais || []]]) for (const d of l) {
    const nomes = [...(d.soAliases ? [] : [d.nome]), ...(d.aliases || [])];
    for (const n of nomes) ent.push({ tipo, nome: d.nome, contexto: !!d.contexto || n.length <= 3, re: new RegExp('(^|[^\\p{L}\\p{N}&])' + esc(sem(n)).replace(/\\\.\\\.$/, '(\\.\\.)?') + '(?![\\p{L}\\p{N}])', 'iu'), pais: d.pais || '', cidade: d.cidade || '' });
  }
  ent.sort((a, b) => b.re.source.length - a.re.source.length);   // nome mais longo primeiro (Tomorrowland Brasil antes de Tomorrowland)
  return ent;
}
// devolve { tipo, nome } do 1º DJ/festival citado no texto, ou null
export function djfNoTexto(texto, ent) {
  const t = sem(texto); const ctx = CTX.test(texto) || CTX.test(t);
  for (const e of ent) if (e.re.test(t) && (!e.contexto || ctx)) return { tipo: e.tipo, nome: e.nome, pais: e.pais, cidade: e.cidade };
  return null;
}
// buscas públicas de notícia por grupos de nomes (Google Notícias aceita OR; grupos de 8 para não passar do tamanho)
export function buscasDJF(lista, n = 8) {
  const nomes = (l) => l.flatMap((d) => d.soAliases ? (d.aliases || []).slice(0, 1) : [d.nome]).map((x) => '"' + x.replace(/\.\.$/, '') + '"');
  const grupos = (arr) => { const g = []; for (let i = 0; i < arr.length; i += n) g.push(arr.slice(i, i + n)); return g; };
  return { djs: grupos(nomes(lista.djs || [])), festivais: grupos(nomes(lista.festivais || [])) };
}
