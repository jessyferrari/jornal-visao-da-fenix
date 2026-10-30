// Robô gratuito do Jornal Visão da Fênix: lê RSS reais, gera edicao.json/feed.xml/sitemap.xml e envia push ntfy.
import fs from 'node:fs';
const B = 'https://jessyferrari.github.io/jornal-visao-da-fenix/';
const TOPIC = process.env.NTFY_TOPIC || '';
// [fonte, url, seção padrão, idioma (vazio = português)]
const FEEDS = [
 ['g1','https://g1.globo.com/rss/g1/','br',''],['g1','https://g1.globo.com/rss/g1/economia/','neg',''],['g1','https://g1.globo.com/rss/g1/tecnologia/','tech',''],
 ['Folha de S.Paulo','https://feeds.folha.uol.com.br/emcimadahora/rss091.xml','br',''],['Folha de S.Paulo','https://feeds.folha.uol.com.br/mercado/rss091.xml','neg',''],['Folha de S.Paulo','https://feeds.folha.uol.com.br/mundo/rss091.xml','mundo',''],
 ['BBC News Brasil','https://feeds.bbci.co.uk/portuguese/rss.xml','mundo',''],['Poder360','https://www.poder360.com.br/feed/','br',''],
 ['Agência Brasil','https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml','br',''],['DW Brasil','https://rss.dw.com/rdf/rss-br-all','mundo',''],
 ['Le Monde','https://www.lemonde.fr/rss/une.xml','mundo','francês'],['El País','https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada','mundo','espanhol'],
 ['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml','mundo','inglês'],['The Verge','https://www.theverge.com/rss/index.xml','tech','inglês'],
 ['TechCrunch','https://techcrunch.com/feed/','tech','inglês'],['Tecnoblog','https://tecnoblog.net/feed/','tech',''],
 ['BBC News','https://feeds.bbci.co.uk/news/world/rss.xml','mundo','inglês'],['BBC News','https://feeds.bbci.co.uk/news/technology/rss.xml','tech','inglês'],
 ['Wired','https://www.wired.com/feed/rss','tech','inglês'],['Ars Technica','https://feeds.arstechnica.com/arstechnica/index','tech','inglês'],['Canaltech','https://canaltech.com.br/rss/','tech','']];
const canon = u => u.trim().split('#')[0].split('?')[0].replace(/\/$/, '');
const ent = s => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const dec = s => ent(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const tag = (b,n) => { const m = b.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i')); return m ? dec(m[1]) : ''; };
const raw = (b,n) => { const m = b.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>','i')); return m ? m[1] : ''; };
const brParts = d => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
const brIso = d => { const p = brParts(d); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
const fmtB = iso => iso.slice(8,10)+'/'+iso.slice(5,7)+', '+iso.slice(11,16)+' (Brasília)';
const secOf = (link, def) => /\/(economia|mercado|negocios|financas|poder-economia|seu-dinheiro|agronegocios)\//i.test(link) || /c-level\.folha/.test(link) ? 'neg' : /\/(tecnologia|tec|inovacao)\//i.test(link) ? 'tech' : def;
const UA = {'user-agent':'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +'+B+')'};
const FEEDST = [];
const BR_OUT = new Set(['g1','Folha de S.Paulo','Poder360','Agência Brasil','Canaltech','Tecnoblog']);
async function ler([src,url,sec,lang]) {
  const stt = { src, url, ok: false, itens: 0, lido: brIso(new Date()) }; FEEDST.push(stt);
  try {
    const r = await fetch(url,{headers:UA,signal:AbortSignal.timeout(20000)}); if (!r.ok) throw new Error('HTTP '+r.status);
    const buf = Buffer.from(await r.arrayBuffer()); const head = buf.subarray(0, 300).toString('latin1'); const cs = (/encoding=["']([^"']+)/i.exec(head) || (r.headers.get('content-type') || '').match(/charset=([^;]+)/i) || [])[1] || 'utf-8';
    let x; try { x = new TextDecoder(cs.trim().toLowerCase()).decode(buf); } catch { x = buf.toString('utf8'); } const out = [];
    for (const b of (x.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || []).slice(0,40)) {
      let link = tag(b,'link'); link = link.replace(/^.*\/\*(https?:)/, '$1'); if (!/^https?:/.test(link)) { const m = b.match(/<link[^>]*href=["']([^"']+)/i); link = m ? ent(m[1]) : ''; }
      const title = tag(b,'title'); const pubS = tag(b,'pubDate') || tag(b,'published') || tag(b,'dc:date') || tag(b,'updated');
      const ts = Date.parse(pubS); if (!link || !title || !ts) continue; // sem horário real, não entra
      let img = (b.match(/<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["'][^>]*>/i) || b.match(/<enclosure[^>]*url=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i) || [])[1] || '';
      
      if (/\.(mp4|mp3|m3u8)(\?|$)/i.test(img) || !/^https:\/\//.test(img)) img = '';
      let sum = tag(b,'description'); if (sum.startsWith(title)) sum = sum.slice(title.length).trim(); if (sum.length > 220) sum = sum.slice(0,217).replace(/\s\S*$/,'') + '…';
      out.push({src,title,link:link.replace(/\?(utm_|traffic_source|maca)[^#]*$/,''),key:canon(link),ts,pub:brIso(new Date(ts)),sec:secOf(link,sec),lang,img:ent(img),sum});
    }
    stt.ok = true; stt.itens = out.length; return out;
  } catch (e) { stt.erro = e.message; console.log('feed falhou:', src, url, e.message); return []; }
}
async function ogImage(url) {
  try { const r = await fetch(url,{headers:UA,signal:AbortSignal.timeout(8000)}); const t = (await r.text()).slice(0,200000);
    const m = t.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || t.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i); return m ? ent(m[1]) : ''; } catch { return ''; }
}
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma para por com que se ao à após diz sobre mais the of to in and for on is at by with from le la les des du et en el los las del y al'.split(' '));
const words = t => new Set(t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));

const now = Date.now();
const itens = (await Promise.all(FEEDS.map(ler))).flat().filter(i => i.ts <= now + 5*60e3);
// dedupe por URL canônica, mantendo o horário mais antigo (primeira publicação)
const map = new Map();
for (const i of itens) { const o = map.get(i.key); if (!o || i.ts < o.ts) map.set(i.key, o ? {...i, img: i.img || o.img} : i); }
let all = [...map.values()].filter(i => now - i.ts < 36*3600e3).sort((a,b) => b.ts - a.ts);
// variedade: no máximo 14 por fonte por seção
const cnt = {}; all = all.filter(i => { const k = i.src + i.sec; cnt[k] = (cnt[k] || 0) + 1; return cnt[k] <= 14; });
// ===== imagens em alta resolução: og:image/twitter:image da página + CDN no maior tamanho + largura real medida =====
const IF = 'imagens.json'; let IC = { og: {}, dim: {} }; try { IC = { og: {}, dim: {}, ...JSON.parse(fs.readFileSync(IF, 'utf8')) }; } catch {}
async function metaImgs(url) {
  if (url in IC.og) return IC.og[url];
  let out = [];
  try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) }); const t = (await r.text()).slice(0, 400000);
    for (const k of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) { const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']+)', 'i'), re2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']' + k + '["\']', 'i'); const m = t.match(re1) || t.match(re2); if (m) out.push(ent(m[1])); }
    out = [...new Set(out)].filter(u => /^https:\/\//.test(u)); IC.og[url] = out; } catch {}
  return out;
}
const up = u => !u ? '' : u.replace(/ichef\.bbci\.co\.uk\/(?:ace\/(?:standard|ws)|news)\/\d+\//, 'ichef.bbci.co.uk/ace/standard/1536/').replace(/-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))(\?|$)/i, '$1$2')
  .replace(/(static\.dw\.com\/image\/\d+)_\d+\.(jpe?g)/i, '$1_605.$2')
  .replace(/(img\.lemde\.fr\/\d{4}\/\d\d\/\d\d\/\d+\/\d+\/\d+\/\d+\/)(\d+)\/(\d+)\//, (m, a, w, h) => a + '1600/' + Math.round(1600 * h / w) + '/');
function dims(b) { // largura/altura pelos cabeçalhos (JPEG, PNG, GIF, WebP, AVIF)
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0x47 && b[1] === 0x49) return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') { const c = b.toString('ascii', 12, 16);
    if (c === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]; if (c === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; if (c === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; } }
  if (b[0] === 0xff && b[1] === 0xd8) { let o = 2; while (o + 9 < b.length) { if (b[o] !== 0xff) { o++; continue; } const m = b[o + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(o + 7), b.readUInt16BE(o + 5)]; o += 2 + b.readUInt16BE(o + 2); } }
  const i = b.indexOf('ispe'); if (i > 0) return [b.readUInt32BE(i + 8), b.readUInt32BE(i + 12)];
  return null;
}
async function probe(u) {
  if (u in IC.dim) return IC.dim[u];
  let w = 0;
  try { const r = await fetch(u, { headers: { ...UA, referer: B, range: 'bytes=0-131071' }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const corp = (r.headers.get('cross-origin-resource-policy') || '').toLowerCase();
    if ((r.status === 200 || r.status === 206) && corp !== 'same-origin' && corp !== 'same-site' && /^image\//.test(r.headers.get('content-type') || '')) {
      const rd = r.body.getReader(); const ch = []; let n = 0; while (n < 131072) { const { done, value } = await rd.read(); if (done) break; ch.push(value); n += value.length; } try { await rd.cancel(); } catch {}
      const d = dims(Buffer.concat(ch)); if (d && d[0] > 0) w = d[0]; } else { try { await r.body?.cancel(); } catch {} }
  } catch {}
  IC.dim[u] = w; return w;
}
const MINW = 600; const fila0 = all.slice(0, 220);
for (let x = 0; x < fila0.length; x += 12) await Promise.all(fila0.slice(x, x + 12).map(async i => {
  const cands = [...new Set([up(i.img), ...(await metaImgs(i.link)).map(up), i.img].filter(Boolean))];
  let best = '', bw = 0; for (const c of cands) { const w = await probe(c); if (w > bw) { best = c; bw = w; } if (bw >= 1500) break; }
  if (bw >= MINW) { i.img = best; i.imgW = bw; if (/ichef\.bbci\.co\.uk\/ace\/standard\/1536\//.test(best)) i.srcset = [800, 1024, 1536, 2048].map(z => best.replace('/1536/', '/' + z + '/') + ' ' + z + 'w').join(', '); } else { i.img = ''; }
}));
const usedL = new Set(fila0.map(i => i.link)), usedI = new Set(fila0.flatMap(i => [i.img, ...(IC.og[i.link] || []).map(up)]));
fs.writeFileSync(IF, JSON.stringify({ og: Object.fromEntries(Object.entries(IC.og).filter(([k]) => usedL.has(k))), dim: Object.fromEntries(Object.entries(IC.dim).filter(([k, v]) => usedI.has(k))) }));
console.log('imagens', fila0.filter(i => i.img).length, 'de', fila0.length, 'min', Math.min(...fila0.filter(i => i.img).map(i => i.imgW)));
// ===== tradução gratuita (gtx do Google, depois MyMemory), com cache em traducoes.json =====
const LC = { 'inglês': 'en', 'francês': 'fr', 'espanhol': 'es' };
const eng = {}; const TF = 'traducoes.json'; let cache = {}; try { cache = JSON.parse(fs.readFileSync(TF, 'utf8')); } catch {}
async function gtx(q, sl) { const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=pt&dt=t&q=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('gtx ' + r.status); const j = await r.json(); return j[0].map(x => x[0]).join(''); }
async function mym(q, sl) { const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=' + sl + '|pt-BR', { signal: AbortSignal.timeout(12000) }); const j = await r.json(); if (j.responseStatus != 200 || j.quotaFinished) throw new Error('mymemory ' + j.responseStatus); return ent(j.responseData.translatedText); }
async function traduz(q, sl) { const k = sl + ':' + q; if (cache[k]) return cache[k]; let out = ''; for (const f of [gtx, mym]) { try { out = (await f(q, sl)).trim(); if (out && out.toLowerCase() !== q.toLowerCase() && !/MYMEMORY WARNING|QUERY LENGTH/i.test(out)) { eng[f.name] = (eng[f.name] || 0) + 1; break; } out = ''; } catch (e) { out = ''; } } if (out) cache[k] = out; return out; }
let okT = 0, failT = 0; const fila = all.slice(0,220).filter(i => i.lang);
for (let x = 0; x < fila.length; x += 4) await Promise.all(fila.slice(x, x + 4).map(async i => { const tr = await traduz(i.title, LC[i.lang]); if (tr) { i.orig = i.title; i.title = tr; i.tr = 'Traduzido do ' + i.lang; okT++; } else failT++; if (i.sum) { const ts2 = await traduz(i.sum, LC[i.lang]); i.osum = i.sum; i.sum = ts2 || ''; } }));
const keep = new Set(fila.flatMap(i => [LC[i.lang] + ':' + (i.orig || i.title), LC[i.lang] + ':' + (i.osum || '')]));
fs.writeFileSync(TF, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([k]) => keep.has(k)))));
console.log('tradução ok', okT, 'falhou', failT, 'novas por serviço', JSON.stringify(eng));

// ===== agrupamento estrito do mesmo fato (títulos já traduzidos) =====
const ents = t => new Set((t.match(/(?<!^)(?<![.:!?]\s)\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]{3,}/g) || []).map(w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
for (const i of all) { i.w = words(i.title); i.e = ents(i.title); i.reg = BR_OUT.has(i.src) ? 'br' : 'ext'; }
const same = (a, b) => { if (a.src === b.src || Math.abs(a.ts - b.ts) > 12*3600e3) return false; let c = 0; for (const w of a.w) if (b.w.has(w)) c++; if (c < 3 || c / Math.min(a.w.size, b.w.size) < 0.5) return false; for (const e of a.e) if (b.e.has(e)) return true; return false; };
for (const i of all) { i.grp = all.filter(j => same(i, j)); const m = new Map(); for (const j of i.grp) if (!m.has(j.src)) m.set(j.src, j); i.grp = [...m.values()]; i.outros = i.grp.map(j => j.src); }
for (const i of all) {
  const ageH = Math.max(0, (now - i.ts) / 3600e3);
  i.score = +((1 + i.outros.length) * Math.pow(0.5, ageH / 6)).toFixed(3);   // corroboração com meia-vida de 6h
  i.urg = /urgente|última hora|ultima hora|breaking|^ao vivo/i.test(i.title) || (i.outros.length >= 1 && ageH < 1);
  i.heat = Math.min(3, i.outros.length + (i.urg ? 1 : 0));
  const srcs = [i, ...i.grp]; const br = [...new Set(srcs.filter(x => x.reg === 'br').map(x => x.src))], ext = [...new Set(srcs.filter(x => x.reg === 'ext').map(x => x.src))];
  i.cov = { n: br.length + ext.length, br, ext }; if (i.cov.n >= 2 && (!br.length || !ext.length)) i.cov.cego = !br.length ? 'Ponto cego: só a imprensa estrangeira cobriu' : 'Ponto cego: só a imprensa brasileira cobriu';
}
let PQ = {}; try { PQ = JSON.parse(fs.readFileSync('porque-importa.json', 'utf8')); } catch {}
const PQc = Object.fromEntries(Object.entries(PQ).filter(([k, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [canon(k), v.trim()]));
const ids = new Set();
const stories = all.slice(0,220).map(i => { let id = i.key.replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/gi,'-').slice(-40).toLowerCase(); while (ids.has(id)) id += 'x'; ids.add(id);
  const s = { id, sec: i.sec, src: i.src, title: i.title, sum: i.sum || ('Reportagem de ' + i.src + '.'), link: i.link, pub: i.pub };
  if (i.img) { s.img = i.img; s.imgW = i.imgW; if (i.srcset) s.srcset = i.srcset; } if (i.lang) s.lang = i.lang; if (i.tr) { s.tr = i.tr; s.orig = i.orig; } if (i.heat) { s.heat = i.heat; s.why = i.outros.length ? 'Também em ' + i.outros.slice(0,3).join(', ') : 'Última hora'; } s.score = i.score; s.cov = i.cov; if (PQc[i.key]) s.pq = PQc[i.key]; i.sid = id; return s; });
// Como o mundo viu: notícia de veículo brasileiro com o mesmo fato em veículos estrangeiros (traduzido)
const _mvSeen = new Set();
const mundoViu = all.filter(i => i.sid && i.reg === 'br').map(i => ({ id: i.sid, ext: i.grp.filter(j => j.reg === 'ext' && (!j.lang || j.tr) && (j.tr || j.title).toLowerCase().replace(/\W+/g, '') !== i.title.toLowerCase().replace(/\W+/g, '')).map(j => ({ src: j.src, title: j.title, orig: j.orig || '', tr: j.tr || '', link: j.link, pub: j.pub })) })).filter(x => x.ext.length).filter((x, _i, _a, k = x.ext.map(e => e.link).sort().join('|')) => _mvSeen.has(k) ? false : (_mvSeen.add(k), true)).slice(0, 24);
if (stories.length < 20) { console.log('poucas notícias lidas (' + stories.length + '), mantendo edição anterior'); process.exit(0); }

// ===== site: só grava se o conteúdo mudou =====
const sig = JSON.stringify(stories);  // muda score com o tempo; feeds só gravados junto
let prev = null; try { prev = JSON.parse(fs.readFileSync('edicao.json','utf8')); } catch {}
const changed = !prev || JSON.stringify(prev.stories) !== sig;
if (changed) {
  const updated = brIso(new Date(now));
  fs.writeFileSync('edicao.json', JSON.stringify({ updated, fontes: [...new Set(FEEDS.map(f => f[0]))], feeds: FEEDST.map(f => ({ ...f, regiao: BR_OUT.has(f.src) ? 'Brasil' : 'exterior' })), mundoViu, stories }));
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rfc = iso => new Date(iso + ':00-03:00').toUTCString();
  fs.writeFileSync('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Jornal Visão da Fênix</title><link>${B}</link><atom:link href="${B}feed.xml" rel="self" type="application/rss+xml"/><description>Curadoria de Brasil, mundo, negócios e tecnologia, com fonte e horário de publicação (Brasília).</description><language>pt-br</language><lastBuildDate>${rfc(updated)}</lastBuildDate>\n` +
    stories.slice(0,60).map(s => `<item><title>${esc(s.title)}</title><link>${esc(s.link)}</link><guid isPermaLink="true">${esc(s.link)}</guid><pubDate>${rfc(s.pub)}</pubDate><source url="${B}feed.xml">${esc(s.src)}</source><description>${esc(s.sum + ' Fonte: ' + s.src + ', ' + fmtB(s.pub) + '.')}</description></item>`).join('\n') + '\n</channel></rss>\n');
  fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${B}</loc><lastmod>${updated}:00-03:00</lastmod><changefreq>always</changefreq></url>\n<url><loc>${B}feed.xml</loc><lastmod>${updated}:00-03:00</lastmod></url>\n</urlset>\n`);
  if (fs.existsSync('index.html')) fs.writeFileSync('index.html', fs.readFileSync('index.html','utf8').replace(/"dateModified": ?"[^"]*"/, `"dateModified": "${updated}:00-03:00"`));
}
console.log('lidas', itens.length, 'na edição', stories.length, changed ? 'edição atualizada' : 'sem mudança');

// ===== notificações =====
if (!TOPIC) { console.log('sem NTFY_TOPIC, pulando push'); process.exit(0); }
const STATE = 'notificadas.json';
const seed = !fs.existsSync(STATE);
const st = seed ? { vistos: [] } : JSON.parse(fs.readFileSync(STATE,'utf8'));
const vistos = new Set(st.vistos);
const novos = all.filter(i => !vistos.has(i.key) && now - i.ts < 3*3600e3 && (!i.lang || i.tr)).sort((a,b) => (b.urg - a.urg) || (b.ts - a.ts));
const post = m => fetch('https://ntfy.sh/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:TOPIC,...m})}).then(r => { if (!r.ok) throw new Error('ntfy ' + r.status); });
const hojeBR = brIso(new Date(now)).slice(0, 10), horaBR = +brIso(new Date(now)).slice(11, 13);
if (!seed && horaBR === 7 && st.edicao1min !== hojeBR) {
  const top = [...all].filter(i => (!i.lang || i.tr) && now - i.ts < 18*3600e3).sort((a, b) => b.score - a.score); const vis = new Set(); const t5 = [];
  for (const i of top) { if (t5.length >= 5) break; if (vis.has(i.key) || i.grp.some(g => vis.has(g.key))) continue; vis.add(i.key); t5.push(i); }
  if (t5.length) { await post({ title: 'Edição de 1 minuto · ' + hojeBR.slice(8, 10) + '/' + hojeBR.slice(5, 7), message: t5.map((i, n) => (n + 1) + '. ' + i.title + ' (' + i.src + (i.cov.n > 1 ? ', ' + i.cov.n + ' veículos' : '') + ')').join('\n'), click: B, priority: 4, tags: ['sunrise', 'newspaper'] }); st.edicao1min = hojeBR; console.log('edição de 1 minuto enviada'); }
}
if (!seed) {
  for (const i of novos.slice(0,5)) await post({ title: (i.urg ? 'URGENTE · ' : '') + i.title, message: i.src + ' · ' + fmtB(i.pub) + (i.tr ? ' · ' + i.tr : '') + (i.outros.length ? ' · também em ' + i.outros.slice(0,3).join(', ') : ''), click: i.link, priority: i.urg ? 5 : 3, tags: [i.urg ? 'rotating_light' : (i.sec === 'tech' ? 'computer' : 'newspaper')] });
  const extra = novos.slice(5);
  if (extra.length) await post({ title: '+' + extra.length + ' notícias novas no Jornal', message: extra.slice(0,12).map(i => '• ' + i.title + ' (' + i.src + ', ' + i.pub.slice(11,16) + ')').join('\n'), click: B, priority: 2, tags: ['newspaper'] });
}
console.log('push enviados', seed ? 0 : Math.min(novos.length,5) + (novos.length > 5 ? 1 : 0), 'novos', novos.length);
fs.writeFileSync(STATE, JSON.stringify({ edicao1min: st.edicao1min, atualizado: new Date(now).toISOString(), vistos: [...all.map(i => i.key).filter(k => !vistos.has(k)), ...st.vistos].slice(0,6000) }));
