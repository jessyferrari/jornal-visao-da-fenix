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
async function ler([src,url,sec,lang]) {
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
    return out;
  } catch (e) { console.log('feed falhou:', src, url, e.message); return []; }
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
// corroboração: mesmo assunto em outras fontes em até 3h => heat; última hora => urgente
for (const i of all) i.w = words(i.title);
for (const i of all) {
  const outros = new Set();
  for (const j of all) if (j.src !== i.src && Math.abs(j.ts - i.ts) < 3*3600e3) { let c = 0; for (const w of i.w) if (j.w.has(w)) c++; if (c >= 3) outros.add(j.src); }
  i.outros = [...outros];
  i.urg = /urgente|última hora|ultima hora|breaking|^ao vivo/i.test(i.title) || (i.outros.length >= 1 && now - i.ts < 3600e3);
  i.heat = Math.min(3, i.outros.length + (i.urg ? 1 : 0));
}
// variedade: no máximo 14 por fonte por seção
const cnt = {}; all = all.filter(i => { const k = i.src + i.sec; cnt[k] = (cnt[k] || 0) + 1; return cnt[k] <= 14; });
// imagens: og:image para os mais recentes sem imagem do RSS
const sem = all.slice(0,220).filter(i => !i.img);
await Promise.all(sem.map(async i => { i.img = await ogImage(i.link); }));
// descarta imagens que o navegador bloquearia (CORP same-origin, erro, não-imagem)
await Promise.all(all.slice(0,220).filter(i => i.img).map(async i => { try { const r = await fetch(i.img,{headers:{...UA,referer:B,range:'bytes=0-1023'},redirect:'manual',signal:AbortSignal.timeout(8000)}); const corp = (r.headers.get('cross-origin-resource-policy')||'').toLowerCase(); if ((r.status !== 200 && r.status !== 206) || corp === 'same-origin' || corp === 'same-site' || !/^image\//.test(r.headers.get('content-type')||'')) i.img = ''; try { await r.body?.cancel(); } catch {} } catch { i.img = ''; } }));
// ===== tradução gratuita (gtx do Google, depois MyMemory), com cache em traducoes.json =====
const LC = { 'inglês': 'en', 'francês': 'fr', 'espanhol': 'es' };
const eng = {}; const TF = 'traducoes.json'; let cache = {}; try { cache = JSON.parse(fs.readFileSync(TF, 'utf8')); } catch {}
async function gtx(q, sl) { const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=pt&dt=t&q=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('gtx ' + r.status); const j = await r.json(); return j[0].map(x => x[0]).join(''); }
async function mym(q, sl) { const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=' + sl + '|pt-BR', { signal: AbortSignal.timeout(12000) }); const j = await r.json(); if (j.responseStatus != 200 || j.quotaFinished) throw new Error('mymemory ' + j.responseStatus); return ent(j.responseData.translatedText); }
async function traduz(q, sl) { const k = sl + ':' + q; if (cache[k]) return cache[k]; let out = ''; for (const f of [gtx, mym]) { try { out = (await f(q, sl)).trim(); if (out && out.toLowerCase() !== q.toLowerCase() && !/MYMEMORY WARNING|QUERY LENGTH/i.test(out)) { eng[f.name] = (eng[f.name] || 0) + 1; break; } out = ''; } catch (e) { out = ''; } } if (out) cache[k] = out; return out; }
let okT = 0, failT = 0; const fila = all.slice(0,220).filter(i => i.lang);
for (let x = 0; x < fila.length; x += 4) await Promise.all(fila.slice(x, x + 4).map(async i => { const tr = await traduz(i.title, LC[i.lang]); if (tr) { i.orig = i.title; i.title = tr; i.tr = 'Traduzido do ' + i.lang; okT++; } else failT++; }));
const keep = new Set(fila.map(i => LC[i.lang] + ':' + (i.orig || i.title)));
fs.writeFileSync(TF, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([k]) => keep.has(k)))));
console.log('tradução ok', okT, 'falhou', failT, 'novas por serviço', JSON.stringify(eng));
const ids = new Set();
const stories = all.slice(0,220).map(i => { let id = i.key.replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/gi,'-').slice(-40).toLowerCase(); while (ids.has(id)) id += 'x'; ids.add(id);
  const s = { id, sec: i.sec, src: i.src, title: i.title, sum: i.sum || ('Reportagem de ' + i.src + '.'), link: i.link, pub: i.pub };
  if (i.img) s.img = i.img; if (i.lang) s.lang = i.lang; if (i.tr) { s.tr = i.tr; s.orig = i.orig; } if (i.heat) { s.heat = i.heat; s.why = i.outros.length ? 'Também em ' + i.outros.slice(0,3).join(', ') : 'Última hora'; } return s; });
if (stories.length < 20) { console.log('poucas notícias lidas (' + stories.length + '), mantendo edição anterior'); process.exit(0); }

// ===== site: só grava se o conteúdo mudou =====
const sig = JSON.stringify(stories);
let prev = null; try { prev = JSON.parse(fs.readFileSync('edicao.json','utf8')); } catch {}
const changed = !prev || JSON.stringify(prev.stories) !== sig;
if (changed) {
  const updated = brIso(new Date(now));
  fs.writeFileSync('edicao.json', JSON.stringify({ updated, fontes: [...new Set(FEEDS.map(f => f[0]))], stories }));
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
if (!seed) {
  for (const i of novos.slice(0,5)) await post({ title: (i.urg ? 'URGENTE · ' : '') + i.title, message: i.src + ' · ' + fmtB(i.pub) + (i.tr ? ' · ' + i.tr : '') + (i.outros.length ? ' · também em ' + i.outros.slice(0,3).join(', ') : ''), click: i.link, priority: i.urg ? 5 : 3, tags: [i.urg ? 'rotating_light' : (i.sec === 'tech' ? 'computer' : 'newspaper')] });
  const extra = novos.slice(5);
  if (extra.length) await post({ title: '+' + extra.length + ' notícias novas no Jornal', message: extra.slice(0,12).map(i => '• ' + i.title + ' (' + i.src + ', ' + i.pub.slice(11,16) + ')').join('\n'), click: B, priority: 2, tags: ['newspaper'] });
}
console.log('push enviados', seed ? 0 : Math.min(novos.length,5) + (novos.length > 5 ? 1 : 0), 'novos', novos.length);
fs.writeFileSync(STATE, JSON.stringify({ atualizado: new Date(now).toISOString(), vistos: [...all.map(i => i.key).filter(k => !vistos.has(k)), ...st.vistos].slice(0,6000) }));
