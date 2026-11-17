// Notícias de música simuladas para teste-musica-offline.mjs (sem rede): Google Notícias e Bing devolvem 3 itens; o resto, 404.
const agora = new Date();
const item = (t, src, url, min) => `<item><title>${t} - ${src}</title><link>https://news.google.com/rss/articles/${encodeURIComponent(url)}</link><pubDate>${new Date(agora - min * 60e3).toUTCString()}</pubDate><source url="https://${url.split('/')[0]}">${src}</source><description>${t}</description></item>`;
const rss = '<rss><channel><title>t</title>' + [
  item('Zeca Pagodinho anuncia show gratuito em São Paulo no Ibirapuera', 'g1', 'g1.globo.com/sp/zeca', 30),
  item('Zeca Pagodinho anuncia show gratuito em São Paulo no Ibirapuera neste domingo', 'Folha de S.Paulo', 'www1.folha.uol.com.br/zeca', 40),
  item('Roda de samba reúne 5 mil pessoas no Rio de Janeiro', 'O Dia', 'odia.ig.com.br/roda', 20)].join('') + '</channel></rss>';
globalThis.fetch = async (u) => { const s = String(u); if (/news\.google\.com\/rss\/search|bing\.com\/news\/search\?format=rss/.test(s)) return new Response(rss, { status: 200, headers: { 'content-type': 'application/rss+xml' } }); return new Response('', { status: 404 }); };
