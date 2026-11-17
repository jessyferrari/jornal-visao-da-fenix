// Regras puras da seção ⚽ Esportes: fontes, filtro, modalidade, Opinião/Crítica separada de notícia, mesmo fato,
// regra das 2 fontes, selo de exclusivo, botões e convite de assinatura. Mesma base da seção Séries e Filmes
// (leitura de feed, agrupamento e selo vêm de series-regras.mjs e exclusivo.mjs). Testadas em scripts/teste-esportes.mjs.
import { createHmac } from 'node:crypto';
import { lerFeed, canon, brIso, agrupar, idNoticia, partes } from './series-regras.mjs';
import { alegaExclusivo, primeiro, selo, campoSelo, hhmm } from './exclusivo.mjs';

// [veículo, url, tipo, idioma, rótulo do feed]  todas as fontes são de esporte (testadas em 17/11/2026, só as que responderam com itens recentes)
// ESPN Brasil ficou de fora: o feed põe o MESMO horário (do momento da leitura, com fuso errado) em todas as matérias, então não dá para saber quem saiu primeiro
// feeds do mesmo veículo (ge, ESPN) têm o mesmo nome: contam como 1 veículo na regra das 2 fontes e no "só 1 de N"
export const FONTES = [
  ['ge', 'https://ge.globo.com/rss/ge/', 'esporte', '', 'ge'],
  ['ge', 'https://ge.globo.com/rss/ge/volei/', 'esporte', '', 'ge Vôlei'],
  ['ge', 'https://ge.globo.com/rss/ge/surfe/', 'esporte', '', 'ge Surfe'],
  ['ge', 'https://ge.globo.com/rss/ge/motor/formula-1/', 'esporte', '', 'ge Motor'],
  ['ge', 'https://ge.globo.com/rss/ge/combate/', 'esporte', '', 'ge Combate'],
  ['UOL Esporte', 'https://rss.uol.com.br/feed/esporte.xml', 'esporte', ''],
  ['Lance!', 'https://www.lance.com.br/sitemap-news.xml', 'esporte', ''],
  ['Gazeta Esportiva', 'https://www.gazetaesportiva.com/feed/', 'esporte', ''],
  ['Folha Esporte', 'https://feeds.folha.uol.com.br/esporte/rss091.xml', 'esporte', ''],
  ['Estadão Esportes', 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/esportes/?outputType=xml', 'esporte', ''],
  ['Placar', 'https://placar.com.br/feed/', 'esporte', ''],
  ['Trivela', 'https://trivela.com.br/feed/', 'esporte', ''],
  ['Terra Esportes', 'https://www.terra.com.br/esportes/rss.xml', 'esporte', ''],
  ['Metrópoles Esportes', 'https://www.metropoles.com/esportes/feed', 'esporte', ''],
  ['Motorsport.com Brasil', 'https://br.motorsport.com/rss/all/news/', 'esporte', ''],
  ['Tênis Brasil', 'https://tenisbrasil.uol.com.br/rss/', 'esporte', ''],
  ['Agência Brasil Esportes', 'https://agenciabrasil.ebc.com.br/rss/esportes/feed.xml', 'esporte', ''],
  ['Olimpíada Todo Dia', 'https://www.olimpiadatododia.com.br/feed/', 'esporte', ''],
  ['Web Vôlei', 'https://webvolei.com.br/feed/', 'esporte', ''],
  ['Waves', 'https://www.waves.com.br/feed/', 'esporte', ''],
  ['UFC Brasil', 'https://www.ufc.com.br/rss/news', 'esporte', ''],
  ['BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'esporte', 'inglês'],
  ['ESPN', 'https://www.espn.com/espn/rss/news', 'esporte', 'inglês'],
  ['The Athletic', 'https://www.nytimes.com/athletic/rss/news/', 'esporte', 'inglês'],
  ['Sky Sports', 'https://www.skysports.com/rss/12040', 'esporte', 'inglês'],
  ['The Guardian Sport', 'https://www.theguardian.com/sport/rss', 'esporte', 'inglês'],
  ['Autosport', 'https://www.autosport.com/rss/feed/all', 'esporte', 'inglês'],
  ['Surfer', 'https://www.surfer.com/feed', 'esporte', 'inglês'],
  ['MMA Fighting', 'https://www.mmafighting.com/rss/index.xml', 'esporte', 'inglês'],
];
export const VEICULOS = [...new Set(FONTES.map((f) => f[0]))];
export { lerFeed, canon, brIso, agrupar, idNoticia, partes };

// fora do assunto: saúde/bem-estar e apostas (palpite e odds não são notícia e ela não posta aposta)
const RX_FORA_URL = /[/-](bem-estar|saude|horoscopo|receitas?|apostas?|betting|casino)[-/.]/i;
const RX_FORA_TIT = /\b(palpites?|odds|apostas?|bet365|betano|cassino|cupom|horóscopo)\b/i;
export function ehEsporte(i) { return !RX_FORA_URL.test(i.link) && !RX_FORA_TIT.test(i.title); }

// 🗣️ Opinião/Crítica: só quando o próprio veículo marca (coluna, blog, análise, opinião no endereço, no título ou na categoria)
const RX_OP_URL = /\/(colunas?|columns?|blogs?|opiniao|opinion|analise|analysis|commentisfree)\/|analise-critica|\/blog-d[oa]-/i;
const RX_OP_TIT = /^\s*(an[áa]lise|opini[ãa]o|coluna|cr[íi]tica|editorial|opinion|analysis|column)\s*[:|\-–]/i;
const RX_OP_CAT = /\b(opini[ãa]o|colunas?|colunistas?|opinion|analysis|column)\b/i;
export function ehOpiniao(i) { if (/live-?blog/i.test(i.link) || alegaExclusivo(i.orig || i.title, i.title)) return false;   // furo de colunista marcado como exclusivo segue no fluxo de notícia (selo e regra das 2 fontes)
  return RX_OP_URL.test(i.link) || RX_OP_TIT.test(i.orig || i.title) || RX_OP_CAT.test(i.cats || ''); }

// modalidade: pelo endereço da matéria e pelo título (só o que está escrito; sem chute vira "Esportes")
const MOD = [
  ['Vôlei de praia', /v[ôo]lei[- ]?de[- ]?praia|beach[- ]?volley/i],
  ['Vôlei', /\/volei\/|v[ôo]lei|superliga|volleyball|fivb/i],
  ['Surfe', /\/surfe?\/|surf|wsl|ondas gigantes|big wave|pipeline/i],
  ['F1 e automobilismo', /\/motor\/|formula-?1|f[óo]rmula 1|\bf1\b|stock car|indy|nascar|motogp|\bwrc\b|\bwec\b|dakar|\brali\b|autosport|motorsport|grand prix|\bgp\b/i],
  ['Tênis', /t[êe]nis|tennis|\batp\b|\bwta\b|roland garros|wimbledon|us open|australian open/i],
  ['MMA e lutas', /\/combate\/|\bmma\b|\bufc\b|boxe|boxing|jiu-?jitsu|jungle fight|\bpfl\b|bkfc|lutador[a]?|luta principal/i],
  ['Basquete', /basquete|basketball|\bnba\b|\bnbb\b|\bwnba\b/i],
  ['Futebol americano', /\bnfl\b|super bowl|futebol americano/i],
  ['Olímpicos', /ol[íi]mpi|paral[íi]mpi|atletismo|nata[çc][ãa]o|gin[áa]stica|jud[ôo]|skate|canoagem|handebol|rugby|esgrima|taekwondo|levantamento de peso|athletics|swimming|gymnastics|goalball|tiro-esportivo|maratona ?aqu[áa]tica|paralimpiada|golfe|volei-sentado/i],
  ['Futebol', /\/futebol|futebol|football|soccer|sele[çc][ãa]o|brasileir[ãa]o|amistosos?|paulist[ãa]o|carioca|neymar|kings (cup|league)|mbapp[ée]|vini(cius)? jr|endrick|ancelotti|dorival|bayern|real madrid|barcelona|liverpool|arsenal|chelsea|manchester|juventus|\bpsg\b|tricolor|alvinegro|rubro-negro|nations league|liga das na[çc][õo]es|libertadores|copa do (brasil|mundo)|champions|premier league|la liga|serie a|ancelotti|\bfifa\b|\bcbf\b|\bgols?\b|flamengo|palmeiras|corinthians|s[ãa]o paulo fc|santos|vasco|botafogo|fluminense|gr[êe]mio|internacional|cruzeiro|atl[ée]tico/i],
];
const caminho = (u) => { try { return new URL(String(u).replace(/^.*\*(https?:)/, '$1')).pathname; } catch { return ''; } };   // só o caminho: o nome do site (ex.: olimpiadatododia) não decide a modalidade
export function modalidade(i) { const t = caminho(i.link) + ' ' + (i.orig || '') + ' ' + i.title + ' ' + (i.cats || ''); const m = MOD.find(([, r]) => r.test(t)); return m ? m[0] : 'Esportes'; }
export const MODALIDADES = MOD.map(([n]) => n).concat('Esportes');
export const aoVivo = (i) => /\bao vivo\b|\blive\b|tempo real|minuto a minuto|live-?blog/i.test(i.title + ' ' + i.link);

// item público (esportes.json): tudo o que a página e o painel mostram, sem nada inventado
export function vista(i, { N, agora, google }) {
  const confirmado = i.n >= 2, alegado = alegaExclusivo(i.title, i.orig, ...i.grp.map((g) => g.title), ...i.grp.map((g) => g.orig));
  const p = confirmado ? primeiro([i, ...i.grp]) : null;
  const v = { id: idNoticia(i.link), titulo: i.title, veiculo: i.src, link: i.link, publicado: brIso(i.ts), fontes: i.n, confirmado,
    emApuracao: confirmado ? undefined : true, resumo: i.sum || undefined, modalidade: modalidade(i), aoVivo: aoVivo(i) || undefined,
    tambemEm: i.grp.slice(0, 4).map((g) => ({ veiculo: g.src, titulo: g.title, link: g.link, publicado: brIso(g.ts), republicadaDe: g.republicada || undefined })) };
  if (i.orig) { v.original = i.orig; v.traduzido = 'Traduzido do ' + i.lang; }
  if (alegado && !confirmado) v.selo = selo({ veiculo: i.src, N, agora, google });
  if (confirmado) { v.primeiro = { veiculo: p.veiculo, hora: p.hora }; if (alegado) v.exclusivoConfirmado = true; }
  return v;
}
// opinião/crítica: aparece marcada, nunca conta como 2ª fonte de um fato e nunca tem botão de post
export const vistaOpiniao = (i) => ({ id: idNoticia(i.link), titulo: i.title, veiculo: i.src, link: i.link, publicado: brIso(i.ts), tipo: 'Opinião/Crítica', modalidade: modalidade(i), resumo: i.sum || undefined, ...(i.orig ? { original: i.orig, traduzido: 'Traduzido do ' + i.lang } : {}) });

// botões ntfy (máx. 3): 2+ fontes = Sim, publicar / Ver notícia / Não; 1 fonte = Ver notícia / Em apuração
export function botoes(i, { CMD, ASS, SRV = 'https://ntfy.sh', pagina }) {
  const ver = { action: 'view', label: 'Ver notícia', url: i.link, clear: false };
  if (i.n < 2 || !CMD || !ASS) return [ver, { action: 'view', label: i.n < 2 ? '🔎 Em apuração' : 'Abrir Esportes', url: pagina, clear: false }];
  const id = idNoticia(i.link), sig = createHmac('sha256', ASS).update(id).digest('hex').slice(0, 32), fontes = i.n;
  const fsig = createHmac('sha256', ASS).update(id + '|fontes=' + fontes).digest('hex').slice(0, 32);
  const alegado = alegaExclusivo(i.title, i.orig, ...i.grp.map((g) => g.title), ...i.grp.map((g) => g.orig));
  const p = primeiro([i, ...i.grp]);
  const texto = [i.title, 'Veículo: ' + i.src + ' · ' + brIso(i.ts).replace('T', ' ') + ' (Brasília)', i.sum ? String(i.sum).slice(0, 280) : ''].filter(Boolean).join('\n').slice(0, 500);
  const links = i.grp.map((g) => g.link).filter((l) => l && l !== i.link).slice(0, 2).join('\n');
  const base = { id, sig, titulo: String(i.title).slice(0, 160) };
  return [
    { action: 'http', label: '✅ Sim, publicar', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'publicar', ...base, fontes, fsig, link: i.link, links, texto, origem: 'esportes', ...campoSelo(ASS, id, { p, fontes, alegado }) }), clear: true },
    ver,
    { action: 'http', label: 'Não', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'recusar', ...base }), clear: true },
  ];
}
export const linha = (i) => '• ' + i.title + ' (' + i.src + ', ' + hhmm(i.ts) + (i.n >= 2 ? ', ' + i.n + ' veículos ✅' : ', 1 fonte 🔎') + ')';

// canal Fenix Esportes: <tópico Música>-esportes (sem segredo novo; a ponte do agente deriva igual)
const TOPICO_OK = /^[-_A-Za-z0-9]{1,64}$/;
export const topicoEsportes = (musica) => { const t = String(musica || '') + '-esportes'; return musica && TOPICO_OK.test(t) ? t : ''; };
// convite ÚNICO com os 2 canais novos (ela ainda não assinou o de Séries e quer assinar os dois de uma vez)
export const avisoCombinado = (servidor, musica) => {
  const ser = musica ? String(musica) + '-series' : '', esp = topicoEsportes(musica); if (!esp || !TOPICO_OK.test(ser)) return null;
  const host = String(servidor || 'https://ntfy.sh').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return { title: 'Fênix: assine Séries e Filmes e Esportes', priority: 4, tags: ['clapper', 'soccer'],
    message: 'Dois canais novos, assine os dois agora:\n🎬 Séries e Filmes: séries, filmes e streaming.\n⚽ Esportes: futebol, vôlei, vôlei de praia, surfe, F1, tênis, lutas, basquete e esportes olímpicos, do Brasil e de fora, com as colunas de Opinião/Crítica marcadas à parte.\n' +
      'Os dois têm o selo ⭐ Possível exclusivo só quando o próprio site diz que é exclusivo, e "Sim, publicar" só com 2 veículos ou mais.\n' +
      'Toque em "Assinar Séries e Filmes", confirme em Inscrever-se, volte aqui e toque em "Assinar Esportes", e confirme em Inscrever-se.\n' +
      'Se um botão não abrir: no app ntfy toque em + e digite o mesmo nome do canal Fenix Musica com -series (ou -esportes) no final.',
    actions: [
      { action: 'view', label: 'Assinar Séries e Filmes', url: 'ntfy://' + host + '/' + ser + '?display=Fenix+Series+e+Filmes', clear: false },
      { action: 'view', label: 'Assinar Esportes', url: 'ntfy://' + host + '/' + esp + '?display=Fenix+Esportes', clear: false },
    ] };
};
export { alegaExclusivo, primeiro, hhmm };
