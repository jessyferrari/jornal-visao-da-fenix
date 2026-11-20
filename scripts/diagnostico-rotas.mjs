// Diagnóstico (só leitura, sem conta, sem login, ritmo baixo): testa do GitHub Actions as rotas públicas de The Enemy, Voxel
// e do Instagram dos perfis da urgência. Imprime só código HTTP, tamanho, quantidade de itens e data mais recente. Nada é enviado.
// Uso: node scripts/diagnostico-rotas.mjs
const UA_BOT = 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)';
const UA_NAV = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const espera = (ms) => new Promise((z) => setTimeout(z, ms));
const br = (t) => t ? new Date(t - 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' (Brasília)' : '-';
async function testa(nome, url, { headers = {}, ua = UA_BOT } = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    const itens = (txt.match(/<(item|entry)[\s>]/gi) || []).length, urls = (txt.match(/<url>/gi) || []).length;
    const datas = [...txt.matchAll(/<(?:pubDate|published|updated|news:publication_date|lastmod)>([^<]+)</gi)].map((m) => Date.parse(m[1])).filter(Boolean);
    const igTs = [...txt.matchAll(/"taken_at(?:_timestamp)?":(\d{10})/g)].map((m) => +m[1] * 1000);
    const codes = new Set([...txt.matchAll(/"shortcode":"([\w-]+)"/g)].map((m) => m[1]));
    const max = Math.max(0, ...datas, ...igTs);
    const linha = { nome, status: r.status, final: r.url.replace(/\?.*/, '').slice(0, 90), bytes: txt.length, tipo: (r.headers.get('content-type') || '').split(';')[0], itens, urls, posts: codes.size, maisRecente: br(max), ms: Date.now() - t0, login: /login|accounts\/login/i.test(r.url) || undefined };
    console.log(JSON.stringify(linha));
    return { ...linha, txt };
  } catch (e) { const linha = { nome, erro: String(e.cause?.code || e.message || e).slice(0, 80), ms: Date.now() - t0 }; console.log(JSON.stringify(linha)); return linha; }
}
console.log('== The Enemy');
for (const u of ['https://www.theenemy.com.br/', 'https://www.theenemy.com.br/feed', 'https://www.theenemy.com.br/feed/', 'https://www.theenemy.com.br/rss', 'https://www.theenemy.com.br/rss.xml', 'https://www.theenemy.com.br/feed.xml',
  'https://www.theenemy.com.br/news-sitemap.xml', 'https://www.theenemy.com.br/sitemap-news.xml', 'https://www.theenemy.com.br/sitemap.xml', 'https://www.theenemy.com.br/sitemap_index.xml', 'https://www.theenemy.com.br/robots.txt',
  'https://theenemy.com.br/feed', 'https://www.theenemy.com.br/ultimas', 'https://www.theenemy.com.br/news'])
  { await testa('TheEnemy ' + u.replace('https://', ''), u); await testa('TheEnemy(nav) ' + u.replace('https://', ''), u, { ua: UA_NAV }); }
await testa('TheEnemy Google Notícias', 'https://news.google.com/rss/search?q=' + encodeURIComponent('site:theenemy.com.br when:2d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419');
await testa('TheEnemy Google Notícias (nome)', 'https://news.google.com/rss/search?q=' + encodeURIComponent('"The Enemy" when:2d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419');
console.log('== Voxel');
await testa('Voxel Arc', 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/tecmundo/voxel/?body=%7B%22layout%22%3A%22google-news%22%7D');
await testa('Voxel voxel.com.br/feed', 'https://www.voxel.com.br/feed');
console.log('== Instagram (sem conta, 1 leitura por rota e perfil, pausa de 4 s)');
const APP = '936619743392459';
for (const u of ['hugogloss', 'forbesbr', 'f1', 'cazetv']) {
  await testa('IG i.instagram web_profile_info ' + u, 'https://i.instagram.com/api/v1/users/web_profile_info/?username=' + u, { ua: UA_NAV, headers: { 'x-ig-app-id': APP, Accept: '*/*' } }); await espera(4000);
  await testa('IG www web_profile_info ' + u, 'https://www.instagram.com/api/v1/users/web_profile_info/?username=' + u, { ua: UA_NAV, headers: { 'x-ig-app-id': APP, 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.instagram.com/' + u + '/' } }); await espera(4000);
  await testa('IG perfil HTML ' + u, 'https://www.instagram.com/' + u + '/', { ua: UA_NAV }); await espera(4000);
  await testa('IG embed perfil ' + u, 'https://www.instagram.com/' + u + '/embed/', { ua: UA_NAV }); await espera(4000);
}
console.log('== Espelhos públicos (RSSHub)');
for (const h of ['rsshub.app', 'rsshub.rssforever.com', 'rsshub.ktachibana.party', 'rsshub.pseudoyu.com', 'hub.slarker.me', 'rsshub.woodland.cafe', 'rss.owo.nz', 'rsshub.henry.wang'])
  { await testa('RSSHub ' + h + ' instagram/user', 'https://' + h + '/instagram/user/hugogloss'); await testa('RSSHub ' + h + ' picuki', 'https://' + h + '/picuki/profile/hugogloss'); await espera(1500); }
console.log('== Espelhos de leitura (sites)');
for (const [n, u] of [['picuki', 'https://www.picuki.com/profile/hugogloss'], ['imginn', 'https://imginn.com/hugogloss/'], ['dumpor', 'https://dumpor.io/v/hugogloss'], ['pixwox', 'https://www.pixwox.com/profile/hugogloss/'], ['greatfon', 'https://greatfon.io/v/hugogloss'], ['inflact', 'https://inflact.com/profiles/instagram-viewer/hugogloss/']])
  { await testa('Espelho ' + n, u, { ua: UA_NAV }); await espera(1500); }
