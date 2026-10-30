import fs from 'node:fs';
const TOPIC = process.env.NTFY_TOPIC; if (!TOPIC) { console.error('sem NTFY_TOPIC'); process.exit(1); }
const FEEDS = [
 ['g1','https://g1.globo.com/rss/g1/'],['Folha','https://feeds.folha.uol.com.br/emcimadahora/rss091.xml'],
 ['BBC Brasil','https://feeds.bbci.co.uk/portuguese/rss.xml'],['Poder360','https://www.poder360.com.br/feed/'],
 ['Agência Brasil','https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'],['DW Brasil','https://rss.dw.com/rdf/rss-br-all'],
 ['Le Monde','https://www.lemonde.fr/rss/une.xml'],['El País','https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada'],
 ['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml'],['The Verge','https://www.theverge.com/rss/index.xml'],
 ['TechCrunch','https://techcrunch.com/feed/'],['Tecnoblog','https://tecnoblog.net/feed/']];
const TECH = new Set(['The Verge','TechCrunch','Tecnoblog']);
const STATE = 'notificadas.json';
const canon = u => u.trim().split('#')[0].split('?')[0].replace(/\/$/, '');
const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n)).trim();
const tag = (b,n) => { const m = b.match(new RegExp('<'+n+'[^>]*>([\\s\\S]*?)</'+n+'>','i')); return m ? dec(m[1]) : ''; };
const br = d => { const t = new Date(d); if (isNaN(t)) return ''; return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(t).replace(' ',' ') + ' (Brasília)'; };
async function ler([src,url]) {
  try {
    const r = await fetch(url,{headers:{'user-agent':'Mozilla/5.0 JornalVisaoDaFenix/1.0'},signal:AbortSignal.timeout(20000)});
    const x = await r.text(); const out = [];
    for (const b of x.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || []) {
      let link = tag(b,'link'); if (!link) { const m = b.match(/<link[^>]*href=["']([^"']+)/i); link = m ? m[1] : ''; }
      const title = tag(b,'title'); const pub = tag(b,'pubDate') || tag(b,'published') || tag(b,'updated') || tag(b,'dc:date');
      if (link && title) out.push({src,title,link,key:canon(link),pub,ts:Date.parse(pub)||0});
    }
    return out.slice(0,30);
  } catch (e) { console.log('falhou', src, e.message); return []; }
}
const post = (title, body, click, tags) => fetch('https://ntfy.sh/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:TOPIC,title,message:body,click,tags})}).then(r=>{if(!r.ok) throw new Error('ntfy '+r.status)});
const seed = !fs.existsSync(STATE);
const state = seed ? {vistos:[]} : JSON.parse(fs.readFileSync(STATE,'utf8'));
const vistos = new Set(state.vistos);
const itens = (await Promise.all(FEEDS.map(ler))).flat();
const novos = []; const ja = new Set();
for (const i of itens) { if (vistos.has(i.key) || ja.has(i.key)) continue; ja.add(i.key); novos.push(i); }
novos.sort((a,b)=>b.ts-a.ts);
console.log('itens', itens.length, 'novos', novos.length, seed ? '(primeira execução: só registra)' : '');
if (seed) await post('Jornal Visão da Fênix','Notificações ativadas. A partir de agora cada notícia nova chega aqui, das 07:00 às 22:45 (Brasília).','https://jessyferrari.github.io/jornal-visao-da-fenix/',['newspaper']);
else {
  // só notícias recentes (até 6h) para não despejar itens antigos de feeds que mudam a ordem
  const recentes = novos.filter(i => !i.ts || Date.now()-i.ts < 6*3600e3);
  for (const i of recentes.slice(0,5)) await post(i.title, i.src+' · '+(br(i.pub)||'horário não informado'), i.link, [TECH.has(i.src)?'computer':'newspaper', i.src.replace(/\s/g,'_')]);
  const extra = recentes.slice(5);
  if (extra.length) await post('+'+extra.length+' notícias novas no Jornal', extra.slice(0,12).map(i=>'• '+i.title+' ('+i.src+')').join('\n'), 'https://jessyferrari.github.io/jornal-visao-da-fenix/', ['newspaper']);
}
const todos = [...novos.map(i=>i.key), ...state.vistos].slice(0,5000);
fs.writeFileSync(STATE, JSON.stringify({atualizado:new Date().toISOString(), vistos:todos}, null, 0));
