// Protótipo do setor MÚSICA do Jornal Visão da Fênix (Samba > Samba e Pagode > Música geral).
// Só fontes públicas (RSS, páginas públicas, APIs abertas). Sem login, sem cookie, sem chave paga.
// Uso: node scripts/musica.mjs [--sem-push]   (push só com NTFY_TOPIC e sem --sem-push)
import fs from 'node:fs';
const TOPIC = process.argv.includes('--sem-push') ? '' : (process.env.NTFY_TOPIC || '');
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)' };
const gn = (q, hl = 'pt-BR', gl = 'BR', ceid = 'BR:pt-419') => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d') + `&hl=${hl}&gl=${gl}&ceid=${ceid}`;
const bing = q => 'https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent(q);
// [rótulo, url, setor padrão, tipo]
const FONTES = [
  ['Google Notícias: roda de samba', gn('"roda de samba"'), 'samba', 'busca'],
  ['Google Notícias: samba de mesa', gn('"samba de mesa" OR "samba de raiz"'), 'samba', 'busca'],
  ['Google Notícias: sambista', gn('sambista OR "escola de samba" OR "grupo de samba"'), 'samba', 'busca'],
  ['Google Notícias: samba (Portugal)', gn('samba', 'pt-PT', 'PT', 'PT:pt-150'), 'samba', 'busca'],
  ['Google Notícias: samba (EUA)', gn('"samba" brazilian music', 'en-US', 'US', 'US:en'), 'samba', 'busca'],
  ['Google Notícias: samba (Japão)', gn('サンバ', 'ja', 'JP', 'JP:ja'), 'samba', 'busca'],
  ['Google Notícias: pagode', gn('pagode show OR pagodeiro OR "grupo de pagode"'), 'pagode', 'busca'],
  ['Google Notícias: música lançamento', gn('lança single OR "novo álbum" OR "turnê" cantor'), 'geral', 'busca'],
  ['Bing Notícias: roda de samba', bing('"roda de samba"'), 'samba', 'busca'],
  ['Bing Notícias: pagode', bing('pagode grupo show'), 'pagode', 'busca'],
  ['Abramus', 'https://www.abramus.org.br/feed/', 'geral', 'setor'],
  ['Ecad', 'https://www.ecad.org.br/feed/', 'geral', 'setor'],
  ['Rolling Stone Brasil', 'https://rollingstone.com.br/feed/', 'geral', 'site'],
  ['Tenho Mais Discos Que Amigos', 'https://www.tenhomaisdiscosqueamigos.com/feed/', 'geral', 'site'],
  ['O Dia', 'https://odia.ig.com.br/rss.xml', 'geral', 'site'],
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
async function ler([rot, url, setor, tipo]) {
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
      out.push({ title, link, ts, veic, dom, rot, tipo, setor0: setor, sum: tag(b, 'description').slice(0, 240) || tag(b, 'media:description').slice(0, 240) });
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

const agora = Date.now();
let itens = (await Promise.all(FONTES.map(ler))).flat().filter(i => agora - i.ts < 48 * 3600e3 && i.ts <= agora + 5 * 60e3);
// dedupe por link e por (veículo + título)
const vistoK = new Set(); itens = itens.filter(i => { const k = i.link.split('?')[0] + '|' + (i.veic + i.title).toLowerCase(); const k2 = (i.veic + '|' + i.title).toLowerCase(); if (vistoK.has(k) || vistoK.has(k2)) return false; vistoK.add(k); vistoK.add(k2); return true; });
for (const i of itens) {
  const blob = i.title + ' ' + i.sum; i.w = pal(i.title); i.e = ents(i.title);
  i.grande = i.tipo === 'grande' || GRANDES.test(i.dom) || GRANDES_NOME.test(i.veic);
  i.setor = FORA.test(blob) ? null : SAMBA.test(blob) ? 'samba' : PAGODE.test(blob) ? 'pagode' : MUSICA.test(blob) ? 'geral' : null;
  if (i.setor === 'samba' && PAGODE.test(blob) && !/roda de samba|samba de mesa|samba de raiz|escola de samba/i.test(blob)) i.setor = 'pagode';
}
const mus = itens.filter(i => i.setor);
// agrupa o mesmo fato (veículos diferentes)
for (const i of mus) { i.grp = mus.filter(j => j !== i && mesmo(i, j)); }
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
const ord = (a, b) => (b.confirmado - a.confirmado) || (b.fontes - a.fontes) || (b.ts - a.ts);
const so1 = arr => { const s = new Set(); return arr.filter(i => { const k = chave(i); if (s.has(k) || i.grp.some(g => s.has(chave(g)))) return false; s.add(k); return true; }); };
const vista = i => ({ titulo: i.title, link: i.link, veiculo: i.veic, dominio: i.dom, publicado: brIso(new Date(i.ts)), primeiroVisto: brIso(new Date(i.primeiro)), fontes: i.fontes, confirmado: i.confirmado, quente: i.quente, tambemEm: i.grp.filter((g, n, a) => a.findIndex(x => x.veic === g.veic) === n).slice(0, 4).map(g => ({ veiculo: g.veic, titulo: g.title, link: g.link })), via: i.rot });
const samba = so1(mus.filter(i => i.setor === 'samba').sort(ord));
const pagode = so1(mus.filter(i => i.setor === 'pagode' || i.setor === 'samba').sort((a, b) => (b.fontes - a.fontes) || (b.ts - a.ts)));
const geral = so1(mus.filter(i => i.setor === 'geral').sort(ord));
const saida = {
  atualizado: brIso(new Date(agora)),
  setores: {
    samba: { quentes: samba.filter(i => i.quente).slice(0, 10).map(vista), itens: samba.slice(0, 30).map(vista) },
    sambaPagode: { maisFalado: pagode.slice(0, 15).map(vista), quentes: pagode.filter(i => i.quente).slice(0, 10).map(vista) },
    geral: { itens: geral.slice(0, 30).map(vista) },
  },
};
fs.writeFileSync('musica.json', JSON.stringify(saida, null, 1));
// limpeza do estado: 7 dias
for (const [k, t] of Object.entries(E.vistos)) if (agora - t > 7 * 86400e3) delete E.vistos[k];
// ===== push: só Quente + confirmado em 2 fontes, no máximo 3 por rodada =====
const ja = new Set(E.notificadas); const pushes = samba.filter(i => i.quente && i.confirmado && !ja.has(chave(i))).slice(0, 3);
for (const i of pushes) {
  const m = { title: 'QUENTE · Samba · ' + i.title, message: i.veic + ' · ' + brIso(new Date(i.ts)).slice(11) + ' (Brasília) · também em ' + [...new Set(i.grp.map(g => g.veic))].slice(0, 2).join(', '), click: i.link, priority: 4, tags: ['fire', 'musical_note'] };
  if (TOPIC) { const r = await fetch('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: TOPIC, ...m }) }); console.log('push', r.status, m.title); }
  else console.log('[push simulado]', m.title, '|', m.message);
  E.notificadas.unshift(chave(i));
}
E.notificadas = E.notificadas.slice(0, 2000); fs.writeFileSync(EF, JSON.stringify(E));
console.log('fontes ok', STATUS.filter(s => s.ok).length, 'de', STATUS.length, '| itens 48h', itens.length, '| de música', mus.length);
for (const s of STATUS) console.log(' ', s.ok ? 'ok ' : 'ERR', String(s.itens).padStart(3), s.tipo.padEnd(6), s.rot, s.erro || '');
console.log('samba', samba.length, '(quentes', samba.filter(i => i.quente).length, ', quentes confirmados', samba.filter(i => i.quente && i.confirmado).length, ') | samba e pagode', pagode.length, '| geral', geral.length);
