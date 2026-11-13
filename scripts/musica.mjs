// Protótipo do setor MÚSICA do Jornal Visão da Fênix (Samba > Samba e Pagode > Música geral).
// Só fontes públicas (RSS, páginas públicas, APIs abertas). Sem login, sem cookie, sem chave paga.
// Uso: node scripts/musica.mjs [--sem-push]   (push só com NTFY_TOPIC_MUSICA e sem --sem-push)
import fs from 'node:fs';
import { localizarTodos, cidadeDoVeiculo, estadoNoTexto, linksReais, localDoOrgao, paisNoTexto } from './musica-local.mjs';
const T0 = Date.now();
// Tópico ntfy SÓ da música (segredo NTFY_TOPIC_MUSICA). Nunca usa o NTFY_TOPIC do jornal: as notificações atuais seguem iguais.
const TOPIC = process.argv.includes('--sem-push') ? '' : (process.env.NTFY_TOPIC_MUSICA || '');
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)' };
const gn = (q, hl = 'pt-BR', gl = 'BR', ceid = 'BR:pt-419') => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d') + `&hl=${hl}&gl=${gl}&ceid=${ceid}`;
const bing = q => 'https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent(q);
// [rótulo, url, setor padrão, tipo, dica de região]
const FONTES = [
  ['Google Notícias: samba em SP', gn('samba "São Paulo"'), 'samba', 'busca', 'sp'],
  ['Google Notícias: samba no RJ', gn('samba "Rio de Janeiro"'), 'samba', 'busca', 'rj'],
  ['Google Notícias: pagode em SP', gn('pagode "São Paulo"'), 'pagode', 'busca', 'sp'],
  ['Google Notícias: pagode no RJ', gn('pagode "Rio de Janeiro"'), 'pagode', 'busca', 'rj'],
  ['Google Notícias: DJs', gn('DJ set OR "música eletrônica" OR "DJ brasileiro"'), 'geral', 'busca'],
  ['Google Notícias: cultura e editais', gn('edital música OR "Lei Paulo Gustavo" OR "Lei Rouanet" música OR "Aldir Blanc" música'), 'geral', 'busca'],
  ['Google Notícias: DJs (EUA)', gn('DJ new album OR festival lineup', 'en-US', 'US', 'US:en'), 'geral', 'busca', 'int'],
  ['Google Notícias: roda de samba', gn('"roda de samba"'), 'samba', 'busca'],
  ['Google Notícias: samba de mesa', gn('"samba de mesa" OR "samba de raiz"'), 'samba', 'busca'],
  ['Google Notícias: sambista', gn('sambista OR "escola de samba" OR "grupo de samba"'), 'samba', 'busca'],
  ['Google Notícias: samba (Portugal)', gn('samba', 'pt-PT', 'PT', 'PT:pt-150'), 'samba', 'busca', 'int'],
  ['Google Notícias: samba (EUA)', gn('"samba" brazilian music', 'en-US', 'US', 'US:en'), 'samba', 'busca', 'int'],
  ['Google Notícias: samba (Japão)', gn('サンバ', 'ja', 'JP', 'JP:ja'), 'samba', 'busca', 'int'],
  ['Google Notícias: pagode', gn('pagode show OR pagodeiro OR "grupo de pagode"'), 'pagode', 'busca'],
  ['Google Notícias: música lançamento', gn('lança single OR "novo álbum" OR "turnê" cantor'), 'geral', 'busca'],
  ['Bing Notícias: roda de samba', bing('"roda de samba"'), 'samba', 'busca'],
  ['Bing Notícias: pagode', bing('pagode grupo show'), 'pagode', 'busca'],
  ['Abramus', 'https://www.abramus.org.br/feed/', 'geral', 'setor'],
  ['Ecad', 'https://www.ecad.org.br/feed/', 'geral', 'setor'],
  ['Rolling Stone Brasil', 'https://rollingstone.com.br/feed/', 'geral', 'site'],
  ['Tenho Mais Discos Que Amigos', 'https://www.tenhomaisdiscosqueamigos.com/feed/', 'geral', 'site'],
  ['O Dia', 'https://odia.ig.com.br/rss.xml', 'geral', 'site', 'rj'],
  ['The Rio Times', 'https://www.riotimesonline.com/feed/', 'geral', 'site'],
  ['Reddit r/samba', 'https://www.reddit.com/r/samba/new/.rss', 'samba', 'social'],
  // portais grandes: lidos só para saber se o fato já "estourou" (tira o selo Quente)
  ['g1 Pop & Arte', 'https://g1.globo.com/rss/g1/pop-arte/', 'geral', 'grande'],
  ['Terra Música', 'https://www.terra.com.br/diversao/musica/rss.xml', 'geral', 'grande'],
  ['Hugo Gloss', 'https://hugogloss.uol.com.br/feed/', 'geral', 'grande'],
];
// canais do YouTube (RSS público por canal). Mapa vem dos perfis que ela segue; aqui só 2 de amostra.
const YT = [['Fundo de Quintal (YouTube)', 'UC38LGuulzvTrpd-YAifOPBw'], ['Thiaguinho (YouTube)', 'UClqmzNx7-xd-5_MzdSotYKw']];
for (const [n, id] of YT) FONTES.push([n, 'https://www.youtube.com/feeds/videos.xml?channel_id=' + id, 'samba', 'social']);
// Grandes portais: se o fato aparecer em qualquer um deles, deixa de ser Quente
const GRANDES = /(^|\.)(globo\.com|g1\.globo|uol\.com\.br|terra\.com\.br|folha\.uol|estadao\.com\.br|cnnbrasil\.com\.br|r7\.com|metropoles\.com|hugogloss|oglobo|extra\.globo|gshow|caras\.com\.br|quem\.globo|purepeople|ig\.com\.br|band\.uol|sbt\.com\.br|correiobraziliense|veja\.abril|exame\.com|nytimes|bbc\.)/i;
const GRANDES_NOME = /^(g1|gshow|globo|o globo|extra|uol|terra|folha|estad[aã]o|cnn brasil|r7|metr[oó]poles|hugo gloss|caras|quem|purepeople|ig|band|sbt|correio braziliense|veja|exame|bbc|the new york times)\b/i;
const SAMBA = /\bsamba|sambista|roda de samba|samba de mesa|samba de raiz|escola de samba|partido[- ]alto|cavaquinho|pandeiro|fundo de quintal|zeca pagodinho|arlindo|beth carvalho|martinho da vila|paulinho da viola|alcione|diogo nogueira|xande|sombrinha|mumuzinho|サンバ/i;
const PAGODE = /\bpagode|pagodeiro|thiaguinho|ferrugem|sorriso maroto|menos [ée] mais|pique novo|turma do pagode|belo\b|dilsinho|péricles|pericles|exaltasamba|raça negra|harmonia do samba|grupo revelação|suel/i;
const FORA = /adidas|t[eê]nis|sneaker|shoe|sapato|cal[cç]ado|nike|samba og|samba xlg|linux|smb|samba server|cupom|desconto/i;
const MUSICA = /m[uú]sica|cantor|cantora|banda|show|turn[eê]|[aá]lbum|single|clipe|dj\b|festival|grammy|rap|funk|sertanej|rock|pop\b|mpb|forr[oó]|ax[eé]|samba|pagode|lan[cç]a|ecad|abramus|direitos autorais|compositor|music|concert|song|tour/i;
const ent = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const txt = s => ent(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); return m ? txt(m[1]) : ''; };
const brIso = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T');
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const STATUS = [];
async function ler([rot, url, setor, tipo, dica = '']) {
  const st = { rot, tipo, ok: false, itens: 0 }; STATUS.push(st);
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const x = await r.text(); const out = [];
    for (const b of (x.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || []).slice(0, 60)) {
      let title = tag(b, 'title'); let link = tag(b, 'link'); if (!/^https?:/.test(link)) { const m = b.match(/<link[^>]*href=["']([^"']+)/i); link = m ? ent(m[1]) : ''; }
      const ts = Date.parse(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')); if (!title || !link || !ts) continue;
      // Google Notícias: o veículo real vem em <source url="...">Nome</source> e no fim do título
      let veic = rot, dom = host(link); const sm = b.match(/<source[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i);
      if (sm) { veic = txt(sm[2]); dom = host(ent(sm[1])); title = title.replace(new RegExp('\\s+-\\s+' + veic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), ''); }
      const bs = b.match(/<news:Source>([\s\S]*?)<\/news:Source>/i); if (bs) { veic = txt(bs[1]); }
      if (/bing\.com\/news\/apiclick/.test(link)) { try { const real = new URL(link).searchParams.get('url'); if (real) { link = real; dom = host(real); } } catch {} }
      if (tipo === 'social' && /youtube/.test(url)) veic = rot.replace(' (YouTube)', '') + ' no YouTube';
      out.push({ title, link, ts, veic, dom, rot, tipo, dica, setor0: setor, sum: tag(b, 'description').slice(0, 240) || tag(b, 'media:description').slice(0, 240) });
    }
    st.ok = true; st.itens = out.length; return out;
  } catch (e) { st.erro = e.message; return []; }
}
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma para por com que se ao à após diz sobre mais seu sua the of to in and for on is at by with from samba pagode show novo nova'.split(' '));
const pal = t => new Set(t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
// nome próprio em comum é obrigatório (evita juntar dois blocos diferentes que só dividem 'Carnaval 2027')
const GENERICO = new Set('carnaval samba pagode grupo especial festival show brasil bloco escola grammy latino premio musica cantor cantora album single'.split(' '));
const ents = t => new Set((t.match(/(?<!^)(?<![.:!?]\s)\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]{3,}/g) || []).map(w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).filter(w => !GENERICO.has(w)));
const mesmo = (a, b) => { if (a.dom && a.dom === b.dom) return false; let c = 0; for (const w of a.w) if (b.w.has(w)) c++; if (c < 3 || c / Math.min(a.w.size, b.w.size) < 0.5) return false; if (/[\u3040-\u30ff]/.test(a.title)) return true; for (const e of a.e) if (b.e.has(e)) return true; return false; };
// mesma cidade + mesmo assunto com palavras diferentes ("apreende" x "encontra"): junta se 4+ palavras em comum
const mesmo2 = (a, b) => { const la = a.uf || a.ufSoh, lb = b.uf || b.ufSoh; if (!la || la !== lb || (a.dom && a.dom === b.dom)) return false; let c = 0; for (const w of a.w) if (b.w.has(w)) c++; return c >= 4 && c / Math.min(a.w.size, b.w.size) >= 0.5; };

// ===== REGIÃO: SP, RJ, Resto do Brasil, Internacional =====
const sem = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const R_SP = [/\bsao paulo\b(?! futebol)/, /\bpaulist(a|ano|ana|anos|anas)\b/, /\bgrande sp\b/, /\babc paulista\b/, /\b(em|de|para) santos\b/, /\bcampinas\b/, /\bguarulhos\b/, /\bosasco\b/, /\bsorocaba\b/, /\bribeirao preto\b/, /\bsao bernardo\b/, /\bsanto andre\b/, /\bjundiai\b/, /\bvila madalena\b/, /\bgrajau\b/, /\btatuape\b/, /\bbixiga\b/, /\bbarra funda\b/, /\banhembi\b/, /\bitaquera\b/, /\bcapao redondo\b/, /\bcasa de francisca\b/, /\bvai-?vai\b/, /\bmancha verde\b/, /\bgavioes da fiel\b/, /\brosas de ouro\b/, /\bmocidade alegre\b/, /\bimperio de casa verde\b/, /\btom maior\b/, /\bx-?9 paulistana\b/, /\bdragoes da real\b/, /\baguia de ouro\b/, /\bcamisa verde e branco\b/, /\bsamba da vela\b/, /\bmaria zelia\b/, /\bzona (leste|norte|sul|oeste) de sao paulo\b/, /\bbaixada santista\b/, /\bsanta cecilia\b/, /\bcaraguatatuba\b/, /\blitoral norte de sp\b/, /\bubatuba\b/, /\bperdizes\b/, /\bpompeia\b/, /\bvila mariana\b/, /\bmooca\b/, /\bbras\b(?! de)/, /\bpenha\b/];
const R_RJ = [/\brio de janeiro\b/, /\bcariocas?\b/, /\bniteroi\b/, /\bsao goncalo\b/, /\bduque de caxias\b/, /\bnova iguacu\b/, /\bnilopolis\b/, /\bmadureira\b/, /\bsapucai\b/, /\bpedra do sal\b/, /\bcacique de ramos\b/, /\brenascenca clube\b/, /\boswaldo cruz\b/, /\bmangueira\b/, /\bportela\b/, /\bsalgueiro\b/, /\bbeija-?flor\b/, /\bvila isabel\b/, /\bimperatriz leopoldinense\b/, /\bgrande rio\b/, /\bviradouro\b/, /\bmocidade independente\b/, /\bunidos da tijuca\b/, /\btuiuti\b/, /\bcopacabana\b/, /\bipanema\b/, /\btijuca\b/, /\bbaixada fluminense\b/, /\bzona (norte|sul|oeste) do rio\b/, /\bcidade do samba\b/, /\bjacarepagua\b/, /\bsao pedro da aldeia\b/, /\bbuzios\b/, /\bcabo frio\b/, /\bpetropolis\b/, /\bvolta redonda\b/, /\bcampos dos goytacazes\b/, /\bmacae\b/, /\bbarra da tijuca\b/, /\brecreio\b/, /\bmeier\b/, /\bbangu\b/, /\bcampo grande \(rj\)/];
const R_BR = [/\bbahia\b/, /\bbaian[oa]s?\b/, /\bsalvador\b/, /\brecife\b/, /\bpernambuc/, /\bolinda\b/, /\bminas gerais\b/, /\bmineir[oa]s?\b/, /\bbelo horizonte\b/, /\bcuritiba\b/, /\bparana\b/, /\bporto alegre\b/, /\brio grande do (sul|norte)\b/, /\bgauch[oa]s?\b/, /\bflorianopolis\b/, /\bsanta catarina\b/, /\bbrasilia\b/, /\bdistrito federal\b/, /\bgoias\b/, /\bgoiania\b/, /\bfortaleza\b/, /\bceara\b/, /\bsao luis\b/, /\bmaranhao\b/, /\bbelem\b/, /\bmanaus\b/, /\bamazonas\b/, /\bjoao pessoa\b/, /\bparaiba\b/, /\bnatal\b(?! de)/, /\bmaceio\b/, /\balagoas\b/, /\baracaju\b/, /\bsergipe\b/, /\bteresina\b/, /\bpiaui\b/, /\bespirito santo\b/, /\bcapixaba/, /\bcampo grande\b/, /\bmato grosso\b/, /\bcuiaba\b/, /\bporto velho\b/, /\bmacapa\b/, /\btocantins\b/, /\buberlandia\b/, /\bjuiz de fora\b/, /\blondrina\b/, /\bnordest/, /\bvitoria da conquista\b/, /\bfeira de santana\b/, /\bpelotas\b/, /\bmineirinho\b/, /\bleopoldina\b/, /\bcaxias do sul\b/, /\bjoinville\b/, /\bmaringa\b/, /\bcampina grande\b/, /\bpetrolina\b/, /\bilheus\b/, /\bmontes claros\b/];
const R_INT = [/\bportugal\b/, /\blisboa\b/, /\bjapao\b/, /\btoquio\b/, /\btokyo\b/, /\basakusa\b/, /\bestados unidos\b/, /\beua\b/, /\bnova york\b/, /\bnew york\b/, /\blos angeles\b/, /\bmiami\b/, /\blas vegas\b/, /\blondres\b/, /\blondon\b/, /\bparis\b/, /\bfranca\b/, /\balemanha\b/, /\bberlim\b/, /\beuropa\b/, /\bargentina\b/, /\bbuenos aires\b/, /\bangola\b/, /\bluanda\b/, /\bmocambique\b/, /\bcabo verde\b/, /\bmexico\b/, /\bespanha\b/, /\bitalia\b/, /\bcanada\b/, /\baustralia\b/, /\bjapan\b/, /\buk\b/, /\bnetherlands\b/, /\bholanda\b/, /\bcuba\b/, /\bcolombia\b/];
// localidade da fonte (peso 1): veículos claramente regionais
const DOM_REG = { 'odia.ig.com.br': 'rj', 'juicysantos.com.br': 'sp', 'jornaldaparaiba.com.br': 'br', 'bahianoticias.com.br': 'br', 'oimparcial.com.br': 'br', 'diariodoscampos.com.br': 'br', 'dgabc.com.br': 'sp', 'riotimesonline.com': '' };
const NOME_REG = [[/grande abc|diario de s\.? ?paulo|sp ?agora|prefeitura de sao paulo|agora sp/i, 'sp'], [/^o dia$|extra online|prefeitura do rio|jornal do brasil|diario do rio|riotur/i, 'rj'], [/bahia|paraiba|pernambuco|minas|parana|goias|ceara|maranhao|para$|amazonas|alagoas|sergipe|piaui|espirito santo|sim noticias|mural do parana|imparcial|joao pessoa/i, 'br']];
const NOMES = { sp: 'SP', rj: 'RJ', br: 'Brasil', int: 'Internacional' };
function regiao(i) {
  const t = ' ' + sem(i.title + ' ' + i.sum) + ' ', tt = ' ' + sem(i.title) + ' ', orig = i.title + ' ' + i.sum;
  const pt = { sp: 0, rj: 0, br: 0, int: 0 }, pos = { sp: 1e9, rj: 1e9, br: 1e9, int: 1e9 }, motivos = [];
  const marca = (k, lista) => { for (const re of lista) { const m = t.match(re); if (m) { pt[k] += tt.match(re) ? 3 : 2; pos[k] = Math.min(pos[k], m.index); motivos.push(NOMES[k] + ': ' + m[0].trim()); } } };
  marca('sp', R_SP); marca('rj', R_RJ); marca('br', R_BR); marca('int', R_INT);
  if (/\bSP\b/.test(orig)) { pt.sp += 2; motivos.push('SP: sigla SP'); }
  if (/\bRJ\b/.test(orig)) { pt.rj += 2; motivos.push('RJ: sigla RJ'); }
  if (/\b(no|do|ao|pelo) Rio\b(?! (Grande|Branco|Negro|Verde|Claro|Preto|S[aã]o Francisco|Tiet[eê]|Amazonas|Doce|Paran[aá]))/.test(orig)) { pt.rj += 2; motivos.push('RJ: "no/do Rio"'); }
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(orig)) { pt.int += 3; motivos.push('Internacional: texto em japonês'); }
  const dr = DOM_REG[i.dom] ?? (NOME_REG.find(([re]) => re.test(sem(i.veic))) || [])[1];
  if (dr) { pt[dr] += 1; motivos.push(NOMES[dr] + ': fonte ' + (i.dom || i.veic)); }
  // dica da busca: só desempata quando o texto não diz o local; a dica 'int' só vale para veículo de fora (.br ou nome com Brasil não conta)
  const BR_DOM = /\.br$|globo\.com$|instagram\.com$|youtube\.com$|metropoles\.com$|r7\.com$|srzd\.com$/;
  const dicaOk = i.dica && (i.dica !== 'int' || (/Portugal/.test(i.rot) ? /\.pt$/.test(i.dom) : (!BR_DOM.test(i.dom) && !/brasil|brazil/i.test(i.veic))));
  if (dicaOk) { pt[i.dica] += i.dica === 'int' ? 2 : 0.5; motivos.push(NOMES[i.dica] + ': busca ' + i.rot.replace('Google Notícias: ', '')); }
  // fonte estrangeira (domínio fora do .br e sem dica) conta como internacional fraco
    const ord = Object.entries(pt).sort((a, b) => (b[1] - a[1]) || (pos[a[0]] - pos[b[0]]));
  const [top, sc] = ord[0];
  i.regiaoMotivo = motivos.slice(0, 4).join('; ') || 'sem local no texto, padrão Brasil';
  i.regiaoAmbigua = sc > 0 && ord[1][1] === sc;
  i.regiaoIncerta = sc < 1;
  if (sc < 1) i.regiaoMotivo = 'sem local no texto, padrão Brasil' + (motivos.length ? ' (' + motivos.join('; ') + ')' : '');
  return sc < 1 ? 'br' : top;
}
const agora = Date.now();
let itens = (await Promise.all(FONTES.map(ler))).flat().filter(i => agora - i.ts < 48 * 3600e3 && i.ts <= agora + 5 * 60e3 && !/^[＜<]画像/.test(i.title));
// dedupe por link e por (veículo + título)
const vistoK = new Set(); itens = itens.filter(i => { const k = i.link.split('?')[0] + '|' + (i.veic + i.title).toLowerCase(); const k2 = (i.veic + '|' + i.title).toLowerCase(); if (vistoK.has(k) || vistoK.has(k2)) return false; vistoK.add(k); vistoK.add(k2); return true; });
for (const i of itens) {
  const blob = i.title + ' ' + i.sum; i.w = pal(i.title); i.e = ents(i.title);
  i.grande = i.tipo === 'grande' || GRANDES.test(i.dom) || GRANDES_NOME.test(i.veic);
  i.setor = FORA.test(blob) ? null : SAMBA.test(blob) ? 'samba' : PAGODE.test(blob) ? 'pagode' : MUSICA.test(blob) ? 'geral' : null;
  if (i.setor === 'samba' && PAGODE.test(blob) && !/roda de samba|samba de mesa|samba de raiz|escola de samba/i.test(blob)) i.setor = 'pagode';
  if (i.setor) { i.reg = regiao(i); i.cat = /\bdjs?\b|eletr[oô]nica|techno|house music|rave/i.test(blob) ? 'DJ' : /edital|lei paulo gustavo|rouanet|aldir blanc|minist[eé]rio da cultura|secretaria de cultura|patrim[oô]nio|museu|teatro|cultura\b/i.test(blob) ? 'Cultura' : 'Música'; }
}
const mus = itens.filter(i => i.setor);
// agrupa o mesmo fato (veículos diferentes)
// ===== CIDADE de cada notícia (texto real: título, matéria, schema.org, bairros e casas de show) =====
const semCidadeAntes = mus.filter(i => i.regiaoIncerta).length;
const EST = await localizarTodos(mus);
const LINKS = await linksReais(mus);
const NUF = { SP: 'sp', RJ: 'rj' };
for (const i of mus) {
  if (/news\.google\.com/.test(i.link)) i.linkGoogle = i.link;
  if (i.linkReal) i.link = i.linkReal;
  if (i.cidade || (i.pais && i.pais !== 'Brasil')) {
    i.reg = i.pais && i.pais !== 'Brasil' ? 'int' : (NUF[i.uf] || 'br'); i.regiaoIncerta = false; i.regiaoMotivo = 'cidade: ' + (i.localComo || '');
  }
  // artista brasileiro em evento lá fora (ex.: Grammy Latino em Las Vegas): cidade = onde aconteceu, região = Internacional, com selo
  if (i.reg === 'int' && /brasileir|brasil\b|leci|anitta|zeca|xande|thiaguinho|p[eé]ricles|ferrugem|sorriso maroto|ludmilla|iza\b|seu jorge|emicida|liniker/i.test(i.title + ' ' + i.sum)) i.brasileiroFora = true;
  if (i.cidade) i.e.add(sem(i.cidade));
}
for (const i of mus) if (!i.cidade && !(i.pais && i.pais !== 'Brasil')) { const e = estadoNoTexto(i.title + ' ' + i.sum); if (e) { i.ufSoh = e.uf; i.ufPista = e.pista; } }
for (const i of mus) { i.grp = mus.filter(j => j !== i && (mesmo(i, j) || mesmo2(i, j))); }
// mesmo fato contado por outro veículo que cita a cidade: usa a cidade desse texto real
for (const i of mus) if (!i.cidade) { const g = i.grp.filter(j => j.cidade && (j.localScore || 0) >= 3).sort((x, y) => (y.localScore || 0) - (x.localScore || 0))[0]; if (g) { Object.assign(i, { cidade: g.cidade, uf: g.uf, pais: g.pais, localComo: 'mesmo fato em ' + g.veic + ': ' + g.localComo, reg: g.reg, regiaoIncerta: false, regiaoMotivo: 'cidade herdada de ' + g.veic }); EST.mesmoFato = (EST.mesmoFato || 0) + 1; } }
// consenso do mesmo fato: se 2+ outros veículos dão a mesma cidade pelo título/abertura e este item só achou cidade no meio do texto, vale a do fato
for (const i of mus) { const fortes = i.grp.filter(j => j.cidade && (j.localScore || 0) >= 4); if (fortes.length < 2) continue; const cnt = {}; for (const j of fortes) cnt[j.cidade + '|' + j.uf + '|' + j.pais] = (cnt[j.cidade + '|' + j.uf + '|' + j.pais] || 0) + 1;
  const [top, n] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; const [c, uf, pais] = top.split('|');
  if (n >= 2 && c !== i.cidade && !/^título/.test(i.localComo || '')) { const g = fortes.find(j => j.cidade === c); Object.assign(i, { cidade: c, uf, pais, localComo: 'consenso de ' + n + ' veículos do mesmo fato (ex.: ' + g.veic + ': ' + g.localComo + ')' }); i.reg = pais !== 'Brasil' ? 'int' : (NUF[uf] || 'br'); EST.consenso = (EST.consenso || 0) + 1; } }
// estado citado no texto (sem cidade): mostra o estado
const NOME_UF = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };
for (const i of mus) if (!i.cidade && !(i.pais && i.pais !== 'Brasil')) { const e = i.ufSoh ? { uf: i.ufSoh, pista: i.ufPista } : estadoNoTexto(i.title + ' ' + i.sum); if (e) { i.ufSoh = e.uf; i.reg = NUF[e.uf] || 'br'; i.regiaoIncerta = false; i.localComo = 'estado citado no texto: "' + e.pista + '"'; EST.estado = (EST.estado || 0) + 1; } }
// país citado no título (sem cidade): ex.: "vive na Suíça"
for (const i of mus) if (!i.cidade && !i.ufSoh && !i.pais) { const p = paisNoTexto(i.title); if (p && p.pais !== 'Brasil') { Object.assign(i, { pais: p.pais, reg: 'int', regiaoIncerta: false, localComo: /[\u3040-\u30ff\u4e00-\u9fff]/.test(p.pista) ? 'título escrito em japonês (cidade não citada)' : 'país citado no título: "' + p.pista + '"' }); EST.paisTitulo = (EST.paisTitulo || 0) + 1; } }
// órgão público / câmara municipal (o próprio site é do lugar): al.ce.gov.br -> Ceará; cm-lagos.pt -> Lagos, Portugal
for (const i of mus) if (!i.cidade && !i.ufSoh && !(i.pais && i.pais !== 'Brasil')) { const o = localDoOrgao(i.dom); if (!o) continue; if (o.cidade) Object.assign(i, { cidade: o.cidade, uf: '', pais: o.pais, reg: 'int', regiaoIncerta: false, localComo: 'site oficial do município (' + o.pista + ')' }); else { i.ufSoh = o.uf; i.reg = NUF[o.uf] || 'br'; i.regiaoIncerta = false; i.localComo = 'site oficial do estado (' + o.pista + ')'; } EST.orgao = (EST.orgao || 0) + 1; }
// lançamento, história, análise e afins: não é fato de uma cidade (marcado como tal, sem inventar cidade)
const SEMLUGAR = /\b(lan[cç]a(m|r)?|lan[cç]amento|novo (single|[aá]lbum|ep|clipe)|single|[aá]lbum|\bep\b|clipe|videoclipe|lyric video|playlist|hist[oó]ria|como surgiu|an[aá]lise|ranking|os \w+ melhores|mais tocad|anuncia (turn[eê]|lineup|line-up)|unveils|announces|launches|release|o que muda|tend[eê]ncias)\b/i;
for (const i of mus) if (!i.cidade && !i.ufSoh && !(i.pais && i.pais !== 'Brasil') && !i.nacional && SEMLUGAR.test(i.title)) { i.semLugar = true; }
// cidade no nome do veículo regional (só quando a matéria não cita cidade nenhuma): marcado como tal
for (const i of mus) if (!i.cidade && !i.ufSoh && !(i.pais && i.pais !== 'Brasil')) { const v = cidadeDoVeiculo(i.dom); if (v) { Object.assign(i, { cidade: v.nome, uf: v.uf, pais: 'Brasil', veiculoRegional: true, semLugar: false, localComo: 'cidade do veículo regional (' + i.dom + '); a matéria não cita a cidade' }); i.reg = NUF[v.uf] || 'br'; i.regiaoIncerta = false; EST.veiculoRegional = (EST.veiculoRegional || 0) + 1; } }
for (const i of mus) i.local = i.cidade ? i.cidade + ', ' + (i.pais === 'Brasil' ? i.uf : i.pais) : (i.pais && i.pais !== 'Brasil') ? i.pais + ' (cidade não citada)' : i.ufSoh ? NOME_UF[i.ufSoh] + ' (estado; cidade não citada)' : (i.reg === 'int' && i.nacional) ? 'Exterior (cidade não citada)' : i.nacional ? (i.setor === 'geral' ? 'Assunto geral (sem cidade)' : 'Nacional (sem cidade)') : i.semLugar ? 'Lançamento/assunto sem cidade (pelo título; matéria não aberta)' : 'cidade não identificada';
for (const i of mus) if (i.veiculoRegional) i.local += ' (pelo veículo)';
// sem local no próprio texto: herda a região de outro veículo que deu o mesmo fato e diz o local
for (const i of mus) if (i.regiaoIncerta) { const g = i.grp.find(j => !j.regiaoIncerta); if (g) { i.reg = g.reg; i.regiaoIncerta = false; i.regiaoMotivo = NOMES[g.reg] + ': herdado de ' + g.veic + ' (' + g.regiaoMotivo.split(';')[0] + ')'; } }
// primeira vez que o jornal viu cada fato (estado salvo entre rodadas)
const EF = 'musica-estado.json'; let E = { vistos: {}, notificadas: [] }; try { E = { vistos: {}, notificadas: [], ...JSON.parse(fs.readFileSync(EF, 'utf8')) }; } catch {}
const chave = i => [...i.w].sort().slice(0, 6).join('-');
for (const i of mus) {
  const k = chave(i); const ks = [k, ...i.grp.map(chave)]; const ja = ks.map(x => E.vistos[x]).filter(Boolean);
  i.primeiro = ja.length ? Math.min(...ja) : agora; for (const x of ks) E.vistos[x] = i.primeiro;
  const doms = new Set([i.dom || i.veic, ...i.grp.map(g => g.dom || g.veic)]);
  i.fontes = doms.size; i.emGrande = i.grande || i.grp.some(g => g.grande);
  // QUENTE: fato recente (até 12 h), ainda em nenhum portal grande, visto em fontes menores/sociais
  i.quente = !i.emGrande && agora - i.ts < 12 * 3600e3;
  i.confirmado = i.fontes >= 2;
}
const direto = i => !/news\.google\.com/.test(i.link);
// mesmo fato em vários veículos: o representante preferido é o que tem link direto (abre a matéria sem passar pelo Google)
// ===== tradução de títulos estrangeiros (mesmo método do robo.mjs: gtx do Google, depois MyMemory; cache em musica-traducoes.json) =====
const TRF = 'musica-traducoes.json'; let TRC = {}; try { TRC = JSON.parse(fs.readFileSync(TRF, 'utf8')); } catch {}
const UAT = { 'user-agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0)' }; const TRE = { gtx: 0, mym: 0, cache: 0, falhou: 0 };
const PT = /\b(de|do|da|dos|das|em|no|na|com|para|pelo|pela|que|um|uma|é|são|não|ao|aos|seu|sua|nova|novo)\b|[ãõç]/i;
const lingua = t => /[\u3040-\u30ff\u4e00-\u9fff]/.test(t) ? 'ja' : /[\uac00-\ud7af]/.test(t) ? 'ko' : (t.match(/\b(de|do|da|em|com|para|que|uma|não|são|ao)\b|[ãõç]/gi) || []).length >= 1 ? '' : /\b(the|and|of|with|for|to|its|new|announces|unveils|launches|release|festival's)\b/i.test(t) ? 'en' : /\b(el|los|las|y|con|del|nuevo|su|por)\b/i.test(t) ? 'es' : /\b(le|les|des|avec|et|du|nouvel)\b/i.test(t) ? 'fr' : /\b(il|gli|della|con|nuovo)\b/i.test(t) ? 'it' : '';
const NOME_LING = { ja: 'japonês', ko: 'coreano', en: 'inglês', es: 'espanhol', fr: 'francês', it: 'italiano' };
async function gtxT(q, sl) { const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=pt&dt=t&q=' + encodeURIComponent(q), { headers: UAT, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('gtx ' + r.status); const j = await r.json(); return j[0].map(x => x[0]).join(''); }
async function mymT(q, sl) { const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=' + sl + '|pt-BR', { signal: AbortSignal.timeout(12000) }); const j = await r.json(); if (j.responseStatus != 200 || j.quotaFinished) throw new Error('mymemory ' + j.responseStatus); return String(j.responseData.translatedText || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'); }
async function traduzT(q, sl) { const k = sl + ':' + q; if (TRC[k]) { TRC[k].t = Date.now(); TRE.cache++; return TRC[k].v; } for (const [n, f] of [['gtx', gtxT], ['mym', mymT]]) { try { const out = (await f(q, sl)).trim(); if (out && out.toLowerCase() !== q.toLowerCase() && !/MYMEMORY WARNING|QUERY LENGTH/i.test(out)) { TRE[n]++; TRC[k] = { v: out, t: Date.now() }; return out; } } catch {} } TRE.falhou++; return ''; }
const aTraduzir = mus.filter(i => lingua(i.title)); for (const i of aTraduzir) i.lingua = lingua(i.title);
for (let x = 0; x < aTraduzir.length; x += 4) await Promise.all(aTraduzir.slice(x, x + 4).map(async i => { const tr = await traduzT(i.title, i.lingua); if (tr) { i.tituloPt = tr; i.traduzido = 'traduzido do ' + NOME_LING[i.lingua]; } }));
for (const [k, v] of Object.entries(TRC)) if (Date.now() - (v.t || 0) > 14 * 86400e3) delete TRC[k];
fs.writeFileSync(TRF, JSON.stringify(TRC));
const tit = i => i.tituloPt || i.title;
const ord = (a, b) => (b.confirmado - a.confirmado) || (b.fontes - a.fontes) || (direto(b) - direto(a)) || (b.ts - a.ts);
const so1 = arr => { const s = new Set(); return arr.filter(i => { const k = chave(i); if (s.has(k) || i.grp.some(g => s.has(chave(g)))) return false; s.add(k); return true; }); };
const vista = i => ({ local: i.local, localComo: i.localComo || undefined, semCidadeMotivo: i.cidade ? undefined : i.semCidadeMotivo, brasileiroFora: i.brasileiroFora || undefined, titulo: tit(i), tituloOriginal: i.tituloPt ? i.title : undefined, traduzido: i.traduzido, link: i.link, veiculo: i.veic, dominio: i.dom, publicado: brIso(new Date(i.ts)), primeiroVisto: brIso(new Date(i.primeiro)), fontes: i.fontes, confirmado: i.confirmado, quente: i.quente, regiao: i.reg, regiaoMotivo: i.regiaoMotivo, regiaoAmbigua: i.regiaoAmbigua || undefined, localIncerto: i.regiaoIncerta || undefined, categoria: i.cat, linkDireto: direto(i) || undefined, linkAlternativo: direto(i) ? undefined : (i.grp.find(direto) ? { veiculo: i.grp.find(direto).veic, link: i.grp.find(direto).link } : undefined), tambemEm: i.grp.filter((g, n, a) => a.findIndex(x => x.veic === g.veic) === n).slice(0, 4).map(g => ({ veiculo: g.veic, titulo: tit(g), link: g.link })), via: i.rot });
const samba = so1(mus.filter(i => i.setor === 'samba').sort(ord));
const jaSamba = new Set(samba.flatMap(i => [chave(i), ...i.grp.map(chave)]));
const pagode = so1(mus.filter(i => i.setor === 'pagode' && !jaSamba.has(chave(i)) && !i.grp.some(g => jaSamba.has(chave(g)))).sort((a, b) => (b.quente - a.quente) || (b.fontes - a.fontes) || (direto(b) - direto(a)) || (b.ts - a.ts)));
const jaSetor = new Set([...samba, ...pagode].flatMap(i => [chave(i), ...i.grp.map(chave)]));
const geral = so1(mus.filter(i => i.setor === 'geral' && !jaSetor.has(chave(i)) && !i.grp.some(g => jaSetor.has(chave(g)))).sort(ord));
const REG = ['sp', 'rj', 'br', 'int'];
const porReg = (arr, n = 15) => Object.fromEntries(REG.map(r => { const a = arr.filter(i => i.reg === r); const lo = x => x.slice().sort((p, q) => (!!p.regiaoIncerta - !!q.regiaoIncerta)); return [r, { nome: NOMES[r], quentes: lo(a.filter(i => i.quente)).slice(0, 10).map(vista), itens: lo(a.filter(i => !i.quente)).slice(0, n).map(vista) }]; }));
const saida = {
  atualizado: brIso(new Date(agora)),
  ordem: ['samba', 'sambaPagode', 'geral'], regioes: NOMES,
  setores: {
    samba: { nome: 'Samba', regioes: porReg(samba) },
    sambaPagode: { nome: 'Samba e Pagode', regioes: porReg(pagode) },
    geral: { nome: 'Música geral, DJs e cultura', brasil: geral.filter(i => i.reg !== 'int').slice(0, 30).map(vista), fora: geral.filter(i => i.reg === 'int').slice(0, 20).map(vista) },
  },
};
saida.auditoriaLocal = { semCidade: mus.filter(i => i.local === 'cidade não identificada').map(i => ({ titulo: i.title, veiculo: i.veic, dominio: i.dom, motivo: i.semCidadeMotivo || '' })), nacional: mus.filter(i => /sem cidade\)$/.test(i.local) && !/estado/.test(i.local)).map(i => ({ titulo: i.title, veiculo: i.veic, motivo: i.semCidadeMotivo || '' })) };
fs.writeFileSync('musica.json', JSON.stringify(saida, null, 1));
for (const [k, t] of Object.entries(E.vistos)) if (agora - t > 7 * 86400e3) delete E.vistos[k];
// ===== push (tópico separado da música): Quente + confirmado em 2 fontes, organizado por setor e região =====
// título: "🔥 Samba Quente SP" / "🔥 Pagode Quente RJ" / "🎧 DJ Brasil" ; tags ntfy: setor e região (filtráveis no app)
const NOTIF0 = E.notificadas.slice(); const ja = new Set(E.notificadas);
const cand = [
  ...samba.filter(i => i.quente && i.confirmado).map(i => ({ i, p: 4, t: '🔥 Samba Quente ' + NOMES[i.reg], tags: ['fire', 'samba', i.reg] })),
  ...pagode.filter(i => i.quente && i.confirmado).map(i => ({ i, p: 4, t: '🔥 Pagode Quente ' + NOMES[i.reg], tags: ['fire', 'pagode', i.reg] })),
  ...geral.filter(i => i.quente && i.confirmado).map(i => ({ i, p: 3, t: (i.cat === 'DJ' ? '🎧 DJ ' : i.cat === 'Cultura' ? '🎭 Cultura ' : '🎵 Música ') + (i.reg === 'int' ? 'Fora' : 'Brasil'), tags: ['musical_note', i.cat.toLowerCase(), i.reg === 'int' ? 'fora' : 'brasil'] })),
].filter(c => !ja.has(chave(c.i)));
const PRI = { sp: 0, rj: 1, br: 2, int: 3 };
// cidade no título da notificação (ex.: "🔥 Samba Quente RJ · Cabo Frio, RJ"); sem cidade, mostra o que se sabe (estado, país)
const ondeCurto = i => i.cidade ? i.cidade + ', ' + (i.pais === 'Brasil' ? i.uf : i.pais) : (i.pais && i.pais !== 'Brasil') ? i.pais : i.ufSoh ? NOME_UF[i.ufSoh] : '';
for (const c of cand) { const o = ondeCurto(c.i); if (o) c.t += ' · ' + o; }
const fila = cand.sort((a, b) => (b.p - a.p) || (PRI[a.i.reg] - PRI[b.i.reg]));
const envia = async m => { if (TOPIC) { const r = await fetch('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: TOPIC, ...m }) }); console.log('push', r.status, m.title); } else console.log('[push simulado]', m.title, '|', m.message.replace(/\n/g, ' / '), '| tags', m.tags.join(',')); };
for (const c of fila.slice(0, 6)) {
  const i = c.i; await envia({ title: c.t, message: tit(i) + (i.traduzido ? ' (' + i.traduzido + ')' : '') + '\n📍 ' + i.local + '\n' + i.veic + ' · ' + brIso(new Date(i.ts)).slice(11) + ' (Brasília)' + (i.grp.length ? ' · também em ' + [...new Set(i.grp.map(g => g.veic))].slice(0, 2).join(', ') : ''), click: i.link, priority: c.p, tags: c.tags });
  E.notificadas.unshift(chave(i));
}
if (fila.length > 6) { await envia({ title: '🎵 +' + (fila.length - 6) + ' de música', message: fila.slice(6, 16).map(c => '• ' + c.t.replace(/^\S+ /, '') + ': ' + tit(c.i)).join('\n'), click: 'https://jessyferrari.github.io/jornal-visao-da-fenix/musica.html', priority: 2, tags: ['musical_note'] }); for (const c of fila.slice(6)) E.notificadas.unshift(chave(c.i)); }
E.notificadas = E.notificadas.slice(0, 2000);
if (!TOPIC) E.notificadas = NOTIF0; // simulação (--sem-push) não marca nada como notificado
fs.writeFileSync(EF, JSON.stringify(E));
console.log('LOCAL antes (sem cidade, só pelo título):', semCidadeAntes, 'de', mus.length);
console.log('LOCAL métodos:', JSON.stringify(EST));
console.log('TRADUÇÃO:', JSON.stringify(TRE), '| títulos estrangeiros', aTraduzir.length, '| traduzidos', aTraduzir.filter(i => i.tituloPt).length);
console.log('LINKS diretos:', JSON.stringify(LINKS), '| com link direto', mus.filter(direto).length, 'de', mus.length, '| ainda pelo Google Notícias', mus.filter(i => !direto(i)).length);
const fim = { cidadeNoTexto: mus.filter(i => i.cidade && !i.veiculoRegional).length, cidadePeloVeiculo: mus.filter(i => i.veiculoRegional).length, estadoSoh: mus.filter(i => !i.cidade && i.ufSoh).length, exteriorSemCidade: mus.filter(i => /^Exterior/.test(i.local)).length, paisSoh: mus.filter(i => !i.cidade && i.pais && i.pais !== 'Brasil').length, nacional: mus.filter(i => i.local === 'Nacional (sem cidade)').length, assuntoGeral: mus.filter(i => i.local === 'Assunto geral (sem cidade)').length, lancamentoSemCidade: mus.filter(i => /^Lançamento/.test(i.local)).length, irma: mus.filter(i => i.irma).length, orgao: mus.filter(i => /site oficial/.test(i.localComo || '')).length, naoIdent: mus.filter(i => i.local === 'cidade não identificada').length };
console.log('LOCAL depois:', JSON.stringify(fim), 'de', mus.length, '| tempo total', ((Date.now() - T0) / 1000).toFixed(1) + ' s');
console.log('fontes ok', STATUS.filter(s => s.ok).length, 'de', STATUS.length, '| itens 48h', itens.length, '| de música', mus.length);
for (const s of STATUS) console.log(' ', s.ok ? 'ok ' : 'ERR', String(s.itens).padStart(3), s.tipo.padEnd(6), s.rot, s.erro || '');
const cont = arr => REG.map(r => NOMES[r] + ' ' + arr.filter(i => i.reg === r).length + ' (quentes ' + arr.filter(i => i.reg === r && i.quente).length + ')').join(' | ');
console.log('SAMBA          ', cont(samba)); console.log('SAMBA E PAGODE ', cont(pagode)); console.log('GERAL          ', 'Brasil ' + geral.filter(i => i.reg !== 'int').length + ' | Fora ' + geral.filter(i => i.reg === 'int').length + ' | DJ ' + geral.filter(i => i.cat === 'DJ').length + ' | Cultura ' + geral.filter(i => i.cat === 'Cultura').length);
console.log('região ambígua', mus.filter(i => i.regiaoAmbigua).length, '| sem local (padrão Brasil)', mus.filter(i => i.regiaoIncerta).length);
console.log('samba', samba.length, '(quentes', samba.filter(i => i.quente).length, ', quentes confirmados', samba.filter(i => i.quente && i.confirmado).length, ') | samba e pagode', pagode.length, '| geral', geral.length);
