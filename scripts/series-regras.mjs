// Regras puras da seção 🎬 Séries e Filmes (streaming): fontes, filtro do assunto, agrupamento do mesmo fato,
// regra das 2 fontes, plataforma citada, selo de exclusivo, botões e resumos. Testadas em scripts/teste-series.mjs.
import { notaPotencial } from './potencial.mjs';
import { createHash, createHmac } from 'node:crypto';
import { alegaExclusivo, primeiro, selo, campoSelo, hhmm } from './exclusivo.mjs';

// [nome, url, tipo, idioma]  tipo: 'dedicada' = só cinema/séries/streaming; 'geral' = entretenimento, entra só o que fala de série/filme
export const FONTES = [
  ['Pipoca Moderna', 'https://pipocamoderna.com.br/feed/', 'dedicada', ''],
  ['Cinepop', 'https://cinepop.com.br/feed/', 'dedicada', ''],
  ['Minha Série', 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/minha-serie/?outputType=xml', 'dedicada', ''],
  ['Omelete', 'https://www.omelete.com.br/sitemap-news.xml', 'omelete', ''],
  ['Deadline', 'https://deadline.com/feed/', 'dedicada', 'inglês'],
  ['Variety', 'https://variety.com/feed/', 'dedicada', 'inglês'],
  ['The Hollywood Reporter', 'https://www.hollywoodreporter.com/feed/', 'dedicada', 'inglês'],
  ['Notícias da TV', 'https://noticiasdatv.uol.com.br/feed', 'geral', ''],
  ['Contigo', 'https://contigo.com.br/feed', 'geral', ''],
  ['PapelPop', 'https://www.papelpop.com/feed/', 'geral', ''],
  ['Hugo Gloss', 'https://hugogloss.uol.com.br/feed/', 'geral', ''],
  ['Gshow', 'https://gshow.globo.com/rss/gshow/', 'geral', ''],
  ['Metrópoles Entretenimento', 'https://www.metropoles.com/entretenimento/feed', 'geral', ''],
  ['Terra Diversão', 'https://www.terra.com.br/diversao/rss.xml', 'geral', ''],
  ['g1 Pop & Arte', 'https://g1.globo.com/rss/g1/pop-arte/', 'geral', ''],
  ['UOL Entretenimento', 'https://rss.uol.com.br/feed/entretenimento.xml', 'geral', ''],
  ['Folha Ilustrada', 'https://feeds.folha.uol.com.br/ilustrada/rss091.xml', 'geral', ''],
  ['Estadão Cultura', 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/cultura/?outputType=xml', 'geral', ''],
];
export const LC = { 'inglês': 'en' };

const ent = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const limpa = (s) => ent(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); return m ? limpa(m[1]) : ''; };
export const canon = (u) => String(u || '').trim().split('#')[0].split('?')[0].replace(/\/$/, '');
export const brIso = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 16);

// RSS/Atom e sitemap de notícias (Omelete não tem RSS; o sitemap público traz título e horário de publicação)
export function lerFeed(xml, [src, , tipo, lang]) {
  const out = [];
  if (/<urlset/i.test(xml.slice(0, 800))) {
    for (const b of (xml.match(/<url>[\s\S]*?<\/url>/gi) || []).slice(0, 120)) {
      const link = tag(b, 'loc'), title = tag(b, 'news:title'), ts = Date.parse(tag(b, 'news:publication_date'));
      if (link && title && ts) out.push({ src, tipo, lang, title, link, key: canon(link), ts, sum: '' });
    }
    return out;
  }
  for (const b of (xml.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || []).slice(0, 80)) {
    let link = tag(b, 'link'); if (!/^https?:/.test(link)) { const m = b.match(/<link[^>]*href=["']([^"']+)/i); link = m ? ent(m[1]) : ''; }
    const title = tag(b, 'title'), ts = Date.parse(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated'));
    if (!link || !title || !ts) continue;   // sem horário real, não entra
    let sum = tag(b, 'description'); if (sum.startsWith(title)) sum = sum.slice(title.length).trim(); if (sum.length > 220) sum = sum.slice(0, 217).replace(/\s\S*$/, '') + '…';
    const cats = [...b.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => limpa(m[1])).join(' ');
    out.push({ src, tipo, lang, title, link: link.replace(/\?(utm_|traffic_source)[^#]*$/, ''), key: canon(link), ts, sum, cats });
  }
  return out;
}

// é sobre série, filme, cinema ou streaming? (fontes gerais passam por aqui; novela e reality ficam de fora)
const RX_ASSUNTO = /\b(s[ée]ries?|filmes?|cinemas?|longa-metragem|curta-metragem|streaming|streamings?|netflix|globoplay|prime video|amazon prime|disney\s?\+|disney plus|hbo|max original|apple tv|paramount\s?\+|star\s?\+|crunchyroll|mubi|temporadas?|epis[óo]dios?|trailers?|teaser|estreias?|estreou|estrear[áa]?|bilheterias?|elenco|oscar|emmy|globo de ouro|golden globes?|marvel|pixar|dreamworks|warner bros|universal pictures|sony pictures|lionsgate|a24|anime|doramas?|k-drama|miniss[ée]rie|document[áa]rio|docuss[ée]rie|spin-?off|sequ[êe]ncia|remake|reboot|premi[èe]re|sitcom|box office|season|episode|film|movie|showrunner)\b/i;
const RX_FORA = /\b(novela|reality|bbb|big brother brasil|a fazenda|casamento às cegas|dança dos famosos|the voice|domingão|mais você|encontro com)\b/i;
export function ehSeriesFilmes(i) {
  if (i.tipo === 'omelete') return /\/(filmes|series-tv|mangas-animes)\//.test(i.link) || (/\/korea\//.test(i.link) && /dorama|k-drama|s[ée]rie|filme/i.test(i.title));
  if (i.tipo === 'dedicada') return !/\/(music|musica|música)\//i.test(i.link);
  const txt = i.title + ' ' + (i.cats || '');
  return RX_ASSUNTO.test(txt) && !RX_FORA.test(i.title);
}

// plataforma citada no título ou no resumo (só se estiver escrito; nada deduzido)
const PLAT = [['Netflix', /netflix/i], ['Prime Video', /prime video|amazon prime/i], ['Disney+', /disney\s?(\+|plus)/i], ['HBO Max', /\bhbo\b|\bmax original|\bhbo max/i], ['Globoplay', /globoplay/i], ['Apple TV+', /apple tv/i], ['Paramount+', /paramount\s?\+/i], ['Crunchyroll', /crunchyroll/i], ['Cinema', /\bcinemas?\b|bilheteria|box office|nos cinemas/i]];
export const plataformas = (t) => PLAT.filter(([, r]) => r.test(t)).map(([n]) => n);

// ---- mesmo fato (títulos em português, já traduzidos): 3+ palavras em comum (60% do menor e 35% do maior) e um nome próprio em comum, até 18 h
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma para por com que se ao à após apos diz disse sobre mais nova novo novos novas primeira segunda temporada serie série filme filmes series séries como quem porque onde quando veja assista saiba confira aqui todos todas pela pelo pelos pelas isso esta este essa esse sera será entre ainda depois antes tudo seus suas sobre the of to in and for on is at by with from what when how'.split(' '));
const words = (t) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
const ents = (t) => new Set((String(t).match(/(?<!^)(?<![.:!?]\s)\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]{2,}/g) || []).map((w) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export function mesmo(a, b) {
  if (a.src === b.src || Math.abs(a.ts - b.ts) > 18 * 3600e3) return false;
  a._w = a._w || words(a.title); b._w = b._w || words(b.title); a._e = a._e || ents(a.title); b._e = b._e || ents(b.title);
  let c = 0; for (const w of a._w) if (b._w.has(w)) c++;
  if (c < 3 || c / Math.min(a._w.size, b._w.size) < 0.6 || c / Math.max(a._w.size, b._w.size) < 0.35) return false;   // mais estrito: assunto parecido (ex.: outra matéria sobre o mesmo ator) não conta como 2ª fonte
  let nomeComum = false; for (const e of a._e) if (b._e.has(e)) { nomeComum = true; break; } if (!nomeComum) return false;
  // e pelo menos 1 palavra comum que NÃO é nome próprio (o fato, não só a pessoa): evita juntar matérias diferentes sobre o mesmo ator
  for (const w of a._w) if (b._w.has(w) && !a._e.has(w) && !b._e.has(w) && !NOMES_TITULO(a, w) && !NOMES_TITULO(b, w)) return true; return false;
}
const NOMES_TITULO = (x, w) => { x._n = x._n || new Set((String(x.title).match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]{2,}/g) || []).map((y) => y.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))); return x._n.has(w); };
// agrupa: cada fato vira 1 item (o mais antigo é o principal) com grp = outros veículos; n = veículos diferentes (domínios)
export function agrupar(itens) {
  const L = [...itens].sort((a, b) => a.ts - b.ts), usados = new Set(), out = [];
  for (const i of L) {
    if (usados.has(i)) continue; usados.add(i);
    const grp = []; for (const j of L) if (!usados.has(j) && mesmo(i, j) && !grp.some((g) => g.src === j.src)) { grp.push(j); usados.add(j); }
    // matéria republicada (mesmo título em outro site, ex.: Terra republica o Estadão) conta 1 vez só: não é 2ª fonte
    const tit = new Map(); for (const x of [i, ...grp]) { const k = normTit(x.orig || x.title); if (!tit.has(k)) tit.set(k, x.src); else x.republicada = tit.get(k); }
    const n = new Set([i, ...grp].filter((x) => !x.republicada).map((x) => dominio(x.link) || x.src)).size;
    out.push({ ...i, grp, n });
  }
  return out;
}

const normTit = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const idNoticia = (link) => createHash('sha1').update(link).digest('hex').slice(0, 12);
export const tituloPt = (i) => i.title;

// item público (series.json): tudo o que a página e o painel mostram, sem nada inventado
export function vista(i, { N, agora, google }) {
  const confirmado = i.n >= 2, alegado = alegaExclusivo(i.title, i.orig, ...i.grp.map((g) => g.title), ...i.grp.map((g) => g.orig));
  const p = confirmado ? primeiro([i, ...i.grp]) : null;
  const pot = notaPotencial({ titulo: i.title, resumo: i.sum, veiculos: [i.src, ...i.grp.map((g) => g.src)], ts: Math.min(i.ts, ...i.grp.map((g) => g.ts).filter(Boolean)), agora });   // 📊 nota de potencial (17/11)
  const v = { id: idNoticia(i.link), titulo: i.title, veiculo: i.src, link: i.link, publicado: brIso(i.ts), fontes: i.n, confirmado, pot: { nota: pot.nota, faixa: pot.faixa, provisoria: pot.provisoria, rotulo: pot.rotulo, motivo: pot.motivo },
    emApuracao: confirmado ? undefined : true, resumo: i.sum || undefined, plataformas: plataformas(i.title + ' ' + (i.sum || '')),
    tambemEm: i.grp.slice(0, 4).map((g) => ({ veiculo: g.src, titulo: g.title, link: g.link, publicado: brIso(g.ts), republicadaDe: g.republicada || undefined })) };
  if (i.orig) { v.original = i.orig; v.traduzido = 'Traduzido do ' + i.lang; }
  if (alegado && !confirmado) v.selo = selo({ veiculo: i.src, N, agora, google });
  if (confirmado) { v.primeiro = { veiculo: p.veiculo, hora: p.hora }; if (alegado) v.exclusivoConfirmado = true; }
  return v;
}

// botões ntfy (máx. 3): 2+ fontes = Sim, publicar / Ver notícia / Não; 1 fonte = Ver notícia / Em apuração
export function botoes(i, { CMD, ASS, SRV = 'https://ntfy.sh', pagina }) {
  const ver = { action: 'view', label: 'Ver notícia', url: i.link, clear: false };
  if (i.n < 2 || !CMD || !ASS) return [ver, { action: 'view', label: i.n < 2 ? '🔎 Em apuração' : 'Abrir Séries', url: pagina, clear: false }];
  const id = idNoticia(i.link), sig = createHmac('sha256', ASS).update(id).digest('hex').slice(0, 32), fontes = i.n;
  const fsig = createHmac('sha256', ASS).update(id + '|fontes=' + fontes).digest('hex').slice(0, 32);
  const alegado = alegaExclusivo(i.title, i.orig, ...i.grp.map((g) => g.title), ...i.grp.map((g) => g.orig));
  const p = primeiro([i, ...i.grp]);
  const texto = [i.title, 'Veículo: ' + i.src + ' · ' + brIso(i.ts).replace('T', ' ') + ' (Brasília)', i.sum ? String(i.sum).slice(0, 280) : ''].filter(Boolean).join('\n').slice(0, 500);
  const links = i.grp.map((g) => g.link).filter((l) => l && l !== i.link).slice(0, 2).join('\n');
  const base = { id, sig, titulo: String(i.title).slice(0, 160) };
  const pt = notaPotencial({ titulo: i.title, resumo: i.sum, veiculos: [i.src, ...i.grp.map((g) => g.src)], ts: Math.min(i.ts, ...i.grp.map((g) => g.ts).filter(Boolean)), agora: Date.now() });   // a nota viaja no pedido (aprende com o resultado do post)
  return [
    { action: 'http', label: '✅ Sim, publicar', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'publicar', ...base, fontes, fsig, nota: pt.nota, faixa: pt.faixa, link: i.link, links, texto, origem: 'series', ...campoSelo(ASS, id, { p, fontes, alegado }) }), clear: true },
    ver,
    { action: 'http', label: 'Não', url: SRV + '/' + CMD, method: 'POST', body: JSON.stringify({ acao: 'recusar', ...base }), clear: true },
  ];
}

// linha do resumo
export const linha = (i) => '• ' + i.title + ' (' + i.src + ', ' + hhmm(i.ts) + (i.n >= 2 ? ', ' + i.n + ' veículos ✅' : ', 1 fonte 🔎') + ')';
// partes de até 3.300 bytes (o ntfy aceita 4.096 bytes de texto)
export function partes(linhas, lim = 3300) { const P = []; let a = [], t = 0; for (const l of linhas) { const b = Buffer.byteLength(l) + 1; if (a.length && t + b > lim) { P.push(a); a = []; t = 0; } a.push(l); t += b; } if (a.length) P.push(a); return P; }

// canal Fenix Séries: <tópico Música>-series (sem segredo novo; a ponte do agente deriva igual)
const TOPICO_OK = /^[-_A-Za-z0-9]{1,64}$/;
export const topicoSeries = (musica) => { const t = String(musica || '') + '-series'; return musica && TOPICO_OK.test(t) ? t : ''; };
export const avisoSeries = (servidor, musica) => {
  const t = topicoSeries(musica); if (!t) return null; const host = String(servidor || 'https://ntfy.sh').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return { title: 'Fênix: assine o canal Séries e Filmes', priority: 4, tags: ['clapper'],
    message: 'Novo canal com as notícias de séries, filmes e streaming (Netflix, Prime Video, Disney+, HBO Max, Globoplay e cinema), com o selo ⭐ Possível exclusivo quando o próprio site diz que é exclusivo.\n' +
      'Toque no botão "Assinar Séries e Filmes" logo abaixo. O app ntfy abre e pede para confirmar: toque em Inscrever-se.\n' +
      'Se o botão não abrir (ou no iPhone): no app ntfy toque em + e digite o mesmo nome do canal Fenix Musica com -series no final.',
    actions: [{ action: 'view', label: 'Assinar Séries e Filmes', url: 'ntfy://' + host + '/' + t + '?display=Fenix+Series+e+Filmes', clear: false }] };
};
export { alegaExclusivo, primeiro, hhmm };
