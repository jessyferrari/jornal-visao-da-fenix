// Regras puras da seção 🎮 Games (20/11, pedido da Jessyca: "destaque pra tudo que envolva game"): fontes, filtro do assunto,
// plataforma (PlayStation, Xbox, Nintendo, PC, Mobile, eSports, GTA 6), Opinião/Review à parte, mesmo fato, regra das 2 fontes,
// selo de exclusivo, botões e convite de assinatura. Mesma base da seção Esportes (leitura de feed, agrupamento e selo vêm de
// series-regras.mjs e exclusivo.mjs). Testadas em scripts/teste-games.mjs.
import { botoesApurar } from './ntfy-acoes.mjs';
import { notaPotencial } from './potencial.mjs';
import { createHmac } from 'node:crypto';
import { lerFeed, canon, brIso, agrupar, idNoticia, partes } from './series-regras.mjs';
import { alegaExclusivo, primeiro, selo, campoSelo, hhmm } from './exclusivo.mjs';

// [veículo, url, tipo, idioma, rótulo do feed]  testadas em 20/11/2026 (só as que responderam com itens das últimas 48 h)
// tipo 'dedicada' = site só de games; 'geral' = tecnologia/cultura pop, entra só o que fala de game.
// Edições do mesmo veículo têm o mesmo nome (IGN e IGN Brasil, Eurogamer e Eurogamer Portugal, PlayStation Blog e PS Blog BR,
// Xbox Wire e Xbox Wire Brasil): contam como 1 veículo na regra das 2 fontes, porque uma edição traduz a outra.
// Fora por enquanto: The Enemy (o site não respondeu daqui), Voxel (feed vazio), PlayStation Blast (erro 500), Nintendo Blast (links do feed apontam para comentários).
export const FONTES = [
  ['IGN', 'https://br.ign.com/feed.xml', 'dedicada', '', 'IGN Brasil'],
  ['g1 Games', 'https://g1.globo.com/rss/g1/pop-arte/games/', 'dedicada', ''],
  ['ge eSports', 'https://ge.globo.com/rss/ge/esports/', 'dedicada', ''],
  ['Critical Hits', 'https://criticalhits.com.br/feed/', 'dedicada', ''],
  ['MeuPlayStation', 'https://meups.com.br/feed/', 'dedicada', ''],
  ['Eurogamer', 'https://www.eurogamer.pt/feed', 'dedicada', '', 'Eurogamer Portugal'],
  ['PlayStation Blog', 'https://blog.br.playstation.com/feed/', 'dedicada', '', 'PlayStation Blog BR'],
  ['Xbox Wire', 'https://news.xbox.com/pt-br/feed/', 'dedicada', '', 'Xbox Wire Brasil'],
  ['Xbox Power', 'https://www.xboxpower.com.br/feed/', 'dedicada', ''],
  ['Universo Nintendo', 'https://www.universonintendo.com/feed/', 'dedicada', ''],
  ['Mais Esports', 'https://maisesports.com.br/feed/', 'dedicada', ''],
  ['TecMundo', 'https://rss.tecmundo.com.br/feed', 'geral', ''],
  ['Adrenaline', 'https://adrenaline.com.br/feed/', 'geral', ''],
  ['IGN', 'https://feeds.feedburner.com/ign/all', 'dedicada', 'inglês', 'IGN (EUA)'],
  ['GameSpot', 'https://www.gamespot.com/feeds/news/', 'dedicada', 'inglês'],
  ['Eurogamer', 'https://www.eurogamer.net/feed', 'dedicada', 'inglês', 'Eurogamer (Reino Unido)'],
  ['Kotaku', 'https://kotaku.com/rss', 'dedicada', 'inglês'],
  ['Polygon', 'https://www.polygon.com/rss/index.xml', 'dedicada', 'inglês'],
  ['VGC', 'https://www.videogameschronicle.com/feed/', 'dedicada', 'inglês'],
  ['PC Gamer', 'https://www.pcgamer.com/rss/', 'dedicada', 'inglês'],
  ['Rock Paper Shotgun', 'https://www.rockpapershotgun.com/feed', 'dedicada', 'inglês'],
  ['Push Square', 'https://www.pushsquare.com/feeds/latest', 'dedicada', 'inglês'],
  ['Pure Xbox', 'https://www.purexbox.com/feeds/latest', 'dedicada', 'inglês'],
  ['Nintendo Life', 'https://www.nintendolife.com/feeds/latest', 'dedicada', 'inglês'],
  ['Gematsu', 'https://www.gematsu.com/feed', 'dedicada', 'inglês'],
  ['Insider Gaming', 'https://insider-gaming.com/feed/', 'dedicada', 'inglês'],
  ['Siliconera', 'https://www.siliconera.com/feed/', 'dedicada', 'inglês'],
  ['Destructoid', 'https://www.destructoid.com/feed/', 'dedicada', 'inglês'],
  ['PlayStation Blog', 'https://blog.playstation.com/feed/', 'dedicada', 'inglês', 'PlayStation Blog (EUA)'],
  ['Xbox Wire', 'https://news.xbox.com/en-us/feed/', 'dedicada', 'inglês', 'Xbox Wire (EUA)'],
  ['The Verge Games', 'https://www.theverge.com/rss/games/index.xml', 'dedicada', 'inglês'],
  ['Dexerto', 'https://www.dexerto.com/feed/', 'geral', 'inglês'],
];
export const VEICULOS = [...new Set(FONTES.map((f) => f[0]))];
export { lerFeed, canon, brIso, agrupar, idNoticia, partes };

// assunto: palavras de game (para os sites 'geral' e para a Mesa reconhecer o nicho)
export const RX_GAME = /\bgames?\b|\bgamer|\bgaming\b|videogames?|v[íi]deo-?games?|\bjogos? (eletr[ôo]nicos?|de (videogame|console|pc|celular|tiro|luta|corrida|terror|mundo aberto))|\bconsoles?\b|playstation|\bps[2345]\b|\bps vita\b|\bps plus\b|dualsense|\bxbox\b|game ?pass|\bnintendo\b|switch 2|\bswitch\b(?= (oled|lite|2|online))|\bsteam\b(?! ?(?:engine|turbine|power|boat|room|bath|punk))|steam deck|steam machine|\bepic games\b|\brockstar\b|\bgta\b|grand theft auto|\bcall of duty\b|\bfortnite\b|\bminecraft\b|\broblox\b|\bfree fire\b|league of legends|\blol\b(?= (worlds|cblol|lck|lec))|\bvalorant\b|counter-strike|\bcs2\b|\bdota\b|\bzelda\b|\bmario\b|\bpok[ée]mon\b|\bhalo\b|god of war|the last of us|\bea sports\b|\bea fc\b|\bfifa \d{2}\b|\bubisoft\b|\bactivision\b|\bblizzard\b|bethesda|\bcapcom\b|square enix|bandai namco|\bsega\b|\bkonami\b|naughty dog|\bfromsoftware\b|elden ring|\bcyberpunk\b|the game awards|state of play|nintendo direct|xbox showcase|summer game fest|gamescom|brasil game show|\bbgs\b|\btwitch\b|\be-?sports?\b|\bcblol\b|\bdlc\b|\bremake\b(?=.*\b(jogo|game))|\bgameplay\b|\brpg\b|\bmmo\b|battle royale|\bsoulslike\b|\bindie games?\b/i;
// fora do assunto: guia/detonado, código de resgate, oferta e aposta não são notícia (ela posta notícia)
const RX_FORA_URL = /\/(guides?|guias?|walkthroughs?|deals?|ofertas?|cupons?|codes?|codigos?|apostas?|betting|casino)\/|[/-](promo-codes?|codigos-de-resgate|redeem-codes|walkthrough|tier-list)[-/.]/i;
const RX_FORA_TIT = /^(guide|guia|how to|como (conseguir|resgatar|completar|encontrar|fazer)|where to|onde encontrar|best deals?|deal:)\b|\b(codes? (for|de)|c[óo]digos? de resgate|palpites?|odds|apostas?|bet365|betano|cassino|cupom|black friday)\b/i;
export function ehGame(i) {
  if (RX_FORA_URL.test(i.link) || RX_FORA_TIT.test(i.title)) return false;
  return i.tipo !== 'geral' || RX_GAME.test(i.title + ' ' + (i.cats || '') + ' ' + caminho(i.link));
}

// 🗣️ Opinião/Review: só quando o próprio veículo marca (análise, review, crítica, opinião, coluna)
const RX_OP_URL = /\/(colunas?|columns?|blogs?\/opiniao|opiniao|opinion|analise|analises|reviews?|critica|features?\/opinion)\//i;
const RX_OP_TIT = /^\s*(an[áa]lise|review|opini[ãa]o|coluna|cr[íi]tica|editorial|opinion|column|impress[õo]es)\s*[:|\-–]/i;
const RX_OP_CAT = /\b(opini[ãa]o|colunas?|reviews?|an[áa]lises?|opinion|column)\b/i;
export function ehOpiniao(i) { if (alegaExclusivo(i.orig || i.title, i.title)) return false;
  return RX_OP_URL.test(i.link) || RX_OP_TIT.test(i.orig || i.title) || RX_OP_CAT.test(i.cats || ''); }

// plataforma: pelo caminho da matéria e pelo título (só o que está escrito; sem pista vira "Games")
const PLAT = [
  ['GTA 6', /\bgta ?(6|vi)\b|grand[- ]theft[- ]auto[- ](6|vi)\b|gta-?(6|vi)\b/i],
  ['eSports', /\/e-?sports?\/|\be-?sports?\b|\bcblol\b|\blck\b|\blec\b|\bworlds\b|\bmajor\b.*\b(cs2|counter-strike)\b|\bvct\b|\bdraft5\b|\bfuria\b|\bpain gaming\b|\bloud\b(?= (vence|perde|anuncia|contrata))/i],
  ['Nintendo', /nintendo|\bswitch\b|\bmario\b|\bzelda\b|pok[ée]mon|\bkirby\b|metroid|donkey kong|smash bros/i],
  ['PlayStation', /playstation|\bps[45]\b|\bps5 pro\b|\bps plus\b|dualsense|\bsony\b|naughty dog|insomniac|santa monica studio|guerrilla|bungie|state of play/i],
  ['Xbox', /\bxbox\b|game ?pass|\bmicrosoft\b|\bhalo\b|\bforza\b|bethesda|activision|blizzard|\bgears\b/i],
  ['PC', /\bsteam\b|\bpc\b|\bepic games store\b|\bnvidia\b|\bgeforce\b|\bradeon\b|\bamd\b|\bintel\b|\bmods?\b|\bgpu\b|placa de v[íi]deo|graphics card/i],
  ['Mobile', /mobile|celular|\bandroid\b|\biphone\b|\bios\b|free fire|clash|genshin|honkai|zenless/i],
];
const caminho = (u) => { try { return new URL(String(u).replace(/^.*\*(https?:)/, '$1')).pathname; } catch { return ''; } };
export function plataforma(i) { const t = caminho(i.link) + ' ' + (i.orig || '') + ' ' + i.title + ' ' + (i.cats || ''); const m = PLAT.find(([, r]) => r.test(t)); return m ? m[0] : 'Games'; }
export const PLATAFORMAS = PLAT.map(([n]) => n).concat('Games');
// 🔴 ao vivo e 🎬 trailer (o que ela mais posta de games): só o que o título ou o endereço diz
export const aoVivo = (i) => /\bao vivo\b|\blive\b(?! action| service)|tempo real|minuto a minuto|live-?blog|live updates/i.test(i.title + ' ' + i.link);
export const trailer = (i) => /\btrailers?\b|\bteaser\b|\breveal(ed)?\b|\brevelad[oa]\b|\banunciad[oa]\b|\bannounced?\b|gameplay/i.test((i.orig || '') + ' ' + i.title);

// item público (games.json): tudo o que a página, a busca e a Mesa mostram, sem nada inventado
export function vista(i, { N, agora, google }) {
  const confirmado = i.n >= 2, alegado = alegaExclusivo(i.title, i.orig, ...i.grp.map((g) => g.title), ...i.grp.map((g) => g.orig));
  const p = confirmado ? primeiro([i, ...i.grp]) : null;
  const pot = notaPotencial({ titulo: i.title, resumo: i.sum, veiculos: [i.src, ...i.grp.map((g) => g.src)], ts: Math.min(i.ts, ...i.grp.map((g) => g.ts).filter(Boolean)), agora });
  const v = { id: idNoticia(i.link), titulo: i.title, veiculo: i.src, link: i.link, publicado: brIso(i.ts), fontes: i.n, confirmado, pot: { nota: pot.nota, faixa: pot.faixa, provisoria: pot.provisoria, rotulo: pot.rotulo, motivo: pot.motivo },
    emApuracao: confirmado ? undefined : true, resumo: i.sum || undefined, modalidade: plataforma(i), aoVivo: aoVivo(i) || undefined, trailer: trailer(i) || undefined,
    tambemEm: i.grp.slice(0, 4).map((g) => ({ veiculo: g.src, titulo: g.title, link: g.link, publicado: brIso(g.ts), republicadaDe: g.republicada || undefined })) };
  if (i.orig) { v.original = i.orig; v.traduzido = 'Traduzido do ' + i.lang; }
  if (alegado && !confirmado) v.selo = selo({ veiculo: i.src, N, agora, google });
  if (confirmado) { v.primeiro = { veiculo: p.veiculo, hora: p.hora }; if (alegado) v.exclusivoConfirmado = true; }
  return v;
}
export const vistaOpiniao = (i) => ({ id: idNoticia(i.link), titulo: i.title, veiculo: i.src, link: i.link, publicado: brIso(i.ts), tipo: 'Opinião/Review', modalidade: plataforma(i), resumo: i.sum || undefined, ...(i.orig ? { original: i.orig, traduzido: 'Traduzido do ' + i.lang } : {}) });

// botões ntfy (máx. 3): 2+ fontes = Sim, publicar / Ver notícia / Não; 1 fonte = Apurar no agente / Ver notícia / Não
export function botoes(i, { CMD, ASS, SRV = 'https://ntfy.sh', pagina }) {
  const ver = { action: 'view', label: 'Ver notícia', url: i.link, clear: false };
  if (i.n < 2) return botoesApurar({ link: i.link, titulo: i.title, texto: [i.title, 'Veículo: ' + i.src, i.sum ? String(i.sum).slice(0, 280) : ''].filter(Boolean).join('\n'), origem: 'games', id: idNoticia(i.link), CMD, ASS, SRV, pagina });
  if (!CMD || !ASS) return [ver, { action: 'view', label: 'Abrir Games', url: pagina, clear: false }];
  const id = idNoticia(i.link), sig = createHmac('sha256', ASS).update(id).digest('hex').slice(0, 32), fontes = i.n;
  const fsig = createHmac('sha256', ASS).update(id + '|fontes=' + fontes).digest('hex').slice(0, 32);
  const alegado = alegaExclusivo(i.title, i.orig, ...i.grp.map((g) => g.title), ...i.grp.map((g) => g.orig));
  const p = primeiro([i, ...i.grp]);
  const texto = [i.title, 'Veículo: ' + i.src + ' · ' + brIso(i.ts).replace('T', ' ') + ' (Brasília)', i.sum ? String(i.sum).slice(0, 280) : ''].filter(Boolean).join('\n').slice(0, 500);
  const links = i.grp.map((g) => g.link).filter((l) => l && l !== i.link).slice(0, 2).join('\n');
  const base = { id, sig, titulo: String(i.title).slice(0, 160) };
  const pt = notaPotencial({ titulo: i.title, resumo: i.sum, veiculos: [i.src, ...i.grp.map((g) => g.src)], ts: Math.min(i.ts, ...i.grp.map((g) => g.ts).filter(Boolean)), agora: Date.now() });
  return [
    { action: 'http', label: '✅ Sim, publicar', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'publicar', ...base, fontes, fsig, nota: pt.nota, faixa: pt.faixa, link: i.link, links, texto, origem: 'games', ...campoSelo(ASS, id, { p, fontes, alegado }) }), clear: true },
    ver,
    { action: 'http', label: 'Não', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'recusar', ...base }), clear: true },
  ];
}
export const linha = (i) => '• ' + i.title + ' (' + i.src + ', ' + hhmm(i.ts) + (i.n >= 2 ? ', ' + i.n + ' veículos ✅' : ', 1 fonte 🔎') + ')';

// canal Fenix Games: <tópico Música>-games (sem segredo novo; a ponte do agente deriva igual)
const TOPICO_OK = /^[-_A-Za-z0-9]{1,64}$/;
export const topicoGames = (musica) => { const t = String(musica || '') + '-games'; return musica && TOPICO_OK.test(t) ? t : ''; };
// convite ÚNICO para assinar o canal Games, no canal Música (que ela já assina). Prioridade 2: chega sem som e sem vibrar (bateria).
// Sai de dia (7h às 22h, Brasília); de madrugada espera a manhã.
export const podeConvidar = (horaBR) => horaBR >= 7 && horaBR < 22;
export const avisoGames = (servidor, musica) => {
  const gm = topicoGames(musica); if (!gm) return null;
  const host = String(servidor || 'https://ntfy.sh').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return { title: 'Fênix: assine o canal Games', priority: 2, tags: ['video_game'],
    message: 'Canal novo 🎮 Games: jogos, PlayStation e PS5, Xbox, Nintendo, PC, celular, eSports, lançamentos (como GTA 6), trailers e estúdios, do Brasil e de fora.\n' +
      'Regra de sempre: ✅ "Sim, publicar" só com 2 veículos ou mais; 🔎 1 fonte fica em apuração; ⭐ "exclusivo" só quando o próprio site diz.\n' +
      'Toque em "Assinar Games" e confirme em Inscrever-se. Este convite chega sem som e não volta.\n' +
      'Se o botão não abrir: no app ntfy toque em + e digite o mesmo nome do canal Fenix Musica com -games no final.',
    actions: [{ action: 'view', label: 'Assinar Games', url: 'ntfy://' + host + '/' + gm + '?display=Fenix+Games', clear: false }] };
};
export { alegaExclusivo, primeiro, hhmm };
