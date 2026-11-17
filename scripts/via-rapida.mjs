// ⚡ Via rápida (17/11): entre uma edição e outra (~5 min), olha só as fontes que mais publicam a cada ~90 s.
// Se aparecer matéria nova, encerra a espera na hora e a próxima edição completa começa já (ela é quem notifica, com todas as regras).
// Não envia nada ao celular, não grava nada: só decide se adianta a próxima rodada. Pedido condicional (ETag/Last-Modified) para não pesar nas fontes.
// Limite honesto: g1 e ge têm cache de CDN de 10 min (max-age=600), então lá a novidade pode chegar com até 10 min de atraso de qualquer jeito.
import { lerFeed } from './series-regras.mjs';
export const RAPIDAS = [
  ['g1', 'https://g1.globo.com/rss/g1/'], ['ge', 'https://ge.globo.com/rss/ge/'], ['Gshow', 'https://gshow.globo.com/rss/gshow/'],
  ['CNN Brasil', 'https://www.cnnbrasil.com.br/feed/'], ['Folha de S.Paulo', 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml'],
  ['Lance!', 'https://www.lance.com.br/sitemap-news.xml'], ['Deadline', 'https://deadline.com/feed/'], ['Variety', 'https://variety.com/feed/'],
  ['Contigo', 'https://contigo.com.br/feed'], ['Notícias da TV', 'https://noticiasdatv.uol.com.br/feed'], ['Hugo Gloss', 'https://hugogloss.uol.com.br/feed/'],
  ['Pipoca Moderna', 'https://pipocamoderna.com.br/feed/'], ['Omelete', 'https://www.omelete.com.br/sitemap-news.xml'],
];
const UA = 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://github.com)';
export async function viaRapida({ fontes = RAPIDAS, totalSeg = 180, voltaSeg = 90, buscar = fetch, dormir = (ms) => new Promise((r) => setTimeout(r, ms)), agora = () => Date.now(), log = console.log } = {}) {
  const cab = new Map(), vistos = new Set(), inicio = agora();
  const ler = async ([n, u], base) => {
    try {
      const h = { 'User-Agent': UA }, c = cab.get(u) || {}; if (c.etag) h['If-None-Match'] = c.etag; if (c.lm) h['If-Modified-Since'] = c.lm;
      const r = await buscar(u, { headers: h, signal: AbortSignal.timeout(15000) });
      if (r.status === 304) return { n, novos: [], status: 304 };
      if (!r.ok) return { n, novos: [], status: r.status };
      cab.set(u, { etag: r.headers.get('etag'), lm: r.headers.get('last-modified') });
      const it = lerFeed(await r.text(), [n, u, 'g', '']); const novos = [];
      for (const i of it) { if (!vistos.has(i.link)) { vistos.add(i.link); if (!base && agora() - i.ts < 60 * 60e3 && i.ts <= agora() + 300e3) novos.push(i); } }
      return { n, novos, status: r.status };
    } catch (e) { return { n, novos: [], status: 'erro' }; }
  };
  const b = await Promise.all(fontes.map((f) => ler(f, true)));
  log('via rápida: base com', vistos.size, 'matérias de', b.filter((x) => x.status === 200).length + '/' + fontes.length, 'fontes rápidas');
  let volta = 0;
  while ((agora() - inicio) / 1000 + voltaSeg <= totalSeg + 5) {
    await dormir(voltaSeg * 1000); volta++;
    const r = await Promise.all(fontes.map((f) => ler(f, false))); const nov = r.flatMap((x) => x.novos);
    const s304 = r.filter((x) => x.status === 304).length;
    if (nov.length) { log('via rápida: volta', volta, '(' + Math.round((agora() - inicio) / 1000) + ' s):', nov.length, 'matéria(s) nova(s), ex.:', nov[0].src || nov[0].veiculo || '', '-', String(nov[0].title || '').slice(0, 90), '-> adianta a próxima edição'); return { novidade: true, volta, novos: nov.length }; }
    log('via rápida: volta', volta, '(' + Math.round((agora() - inicio) / 1000) + ' s): nada novo (' + s304 + ' fontes responderam "sem mudança")');
  }
  return { novidade: false, volta, novos: 0 };
}
if (import.meta.url === 'file://' + process.argv[1]) {
  await viaRapida({ totalSeg: +(process.env.VIA_RAPIDA_SEG || 180), voltaSeg: +(process.env.VIA_RAPIDA_VOLTA || 90) });
}
