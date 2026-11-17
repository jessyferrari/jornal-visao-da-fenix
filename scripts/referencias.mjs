// Referências (17/11, pedido B): o que perfis sérios do Brasil e de fora publicaram, com link e hora, sempre como "fulano publicou".
// Rotas só legítimas e gratuitas: RSS oficial do canal no YouTube e RSS oficial do site. Sem raspagem, sem login, sem API paga.
// Canal pelo endereço público (@...): o RSS oficial é descoberto pelo anúncio da própria página (<link rel="alternate" type="application/rss+xml">,
// padrão RSS autodiscovery), uma vez, e fica guardado em referencias-estado.json; depois só o RSS oficial é lido.
// Instagram, X e TikTok de terceiros não têm rota grátis e legítima: ficam listados com o que precisaria.
// Uso: node scripts/referencias.mjs [--agora 2026-11-17T12:00-03:00]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const AGORA = arg('--agora') ? Date.parse(arg('--agora')) : Date.now();
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7' };
const LISTA = JSON.parse(fs.readFileSync(new URL('./referencias.json', import.meta.url), 'utf8'));
const EF = 'referencias-estado.json'; let E = { canais: {} }; try { E = { canais: {}, ...JSON.parse(fs.readFileSync(EF, 'utf8')) }; } catch {}
const JANELA = 72 * 3600e3, POR_PERFIL = 5;
export const PRECISA = {
  Instagram: 'sem rota grátis: o Instagram de terceiros só sai pela API oficial da Meta, que libera só contas que você administra',
  X: 'sem rota grátis: só com a API paga do X (não aprovada)',
  TikTok: 'sem rota grátis: o TikTok não tem RSS oficial',
};

// O YouTube não entrega o anúncio do RSS ao robô do GitHub; sem o ID oficial (UC...), a rota fica fora, com o passo para ativar.
export const SEM_ID = (yt) => 'canal sem ID confirmado: o YouTube não entrega o RSS pelo endereço ' + yt + ' ao robô. Para ativar: abra youtube.com/' + yt.replace(/^@?/, '@') + ', toque em "mais" na descrição do canal, depois em "Compartilhar canal" e "Copiar ID do canal" (começa com UC), e me mande o ID';
const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** o RSS declarou o canal esperado? (ID errado responde com outro nome: falha e nada é publicado) */
export const confere = (esperado, canal) => !esperado || sem(canal).includes(sem(esperado));
const ent = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const tag = (b, t) => { const m = b.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>', 'i')); return m ? ent(m[1]) : ''; };
const brIso = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 16);

async function busca(url, ms = 12000) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!r.ok) { await r.body?.cancel().catch(() => {}); throw new Error('HTTP ' + r.status); }
  return await r.text();
}

/** RSS 2.0 ou Atom (YouTube) -> [{ titulo, link, ts }] e o nome do canal/site que o próprio feed declara */
export function lerFeed(x) {
  const canal = tag((x.match(/<channel[\s\S]*?<item/i) || x.match(/<feed[\s\S]*?<entry/i) || [''])[0], 'title') || tag(x, 'title');
  const autor = tag((x.match(/<author>[\s\S]*?<\/author>/i) || [''])[0], 'name');
  const blocos = x.match(/<item[\s>][\s\S]*?<\/item>/gi) || x.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const itens = blocos.map((b) => {
    let link = tag(b, 'link'); const at = b.match(/<link[^>]*href=["']([^"']+)["']/i); if (!link && at) link = at[1];
    const d = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    return { titulo: tag(b, 'title'), link: ent(link), ts: Date.parse(d) || 0 };
  }).filter((i) => i.titulo && /^https?:\/\//.test(i.link));
  return { canal: autor || canal, itens };
}

/** anúncio do RSS oficial na página pública (RSS autodiscovery) */
export function anuncioRss(html, base) {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0]; if (!/rel=["']?alternate/i.test(t) || !/type=["']?application\/(rss|atom)\+xml/i.test(t)) continue;
    const h = t.match(/href=["']([^"']+)["']/i); if (h) { try { return new URL(h[1].replace(/&amp;/g, '&'), base).href; } catch {} }
  }
  return null;
}

async function feedDoCanal(yt) {
  if (/^UC[\w-]{22}$/.test(yt)) return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + yt;
  const c = E.canais[yt]; if (c && c.feed && AGORA - (c.t || 0) < 30 * 86400e3) return c.feed;
  const pagina = 'https://www.youtube.com/' + yt.replace(/^@?/, '@');
  let html; try { html = await busca(pagina, 12000); } catch { throw new Error(SEM_ID(yt)); } const f = anuncioRss(html.slice(0, 600000), pagina);
  if (!f || !/youtube\.com\/feeds\/videos\.xml\?channel_id=UC/.test(f)) throw new Error(SEM_ID(yt));
  E.canais[yt] = { feed: f, t: AGORA }; return f;
}

export async function coletar(lista = LISTA.perfis) {
  const perfis = [], itens = [];
  await Promise.all(lista.map(async (p) => {
    const rotas = [];
    const ler = async (tipo, origem, f) => {
      try { const url = await f(); const { canal, itens: l } = lerFeed(await busca(url));
        if (tipo === 'YouTube' && !confere(p.confere, canal)) throw new Error('o ID respondeu como "' + canal + '", que não é o canal esperado (' + p.confere + '); nada publicado');
        const novos = l.filter((i) => i.ts && AGORA - i.ts < JANELA && i.ts <= AGORA + 10 * 60e3).sort((a, b) => b.ts - a.ts).slice(0, POR_PERFIL);
        rotas.push({ tipo, origem, url, ok: true, canal, n: novos.length });
        for (const i of novos) itens.push({ quem: p.nome, nicho: p.nicho, pais: p.pais, rede: tipo, canal, titulo: i.titulo, link: i.link, publicado: brIso(i.ts), ts: i.ts,
          frase: p.nome + ' publicou' + (tipo === 'YouTube' ? ' no YouTube' : ' no site') });
      } catch (e) { rotas.push({ tipo, origem, ok: false, erro: String(e.message || e).slice(0, 400) }); }
    };
    const tarefas = [];
    if (p.youtube) tarefas.push(ler('YouTube', p.youtube, () => feedDoCanal(p.youtube)));
    for (const u of p.rss || []) tarefas.push(ler('site', u, async () => u));
    await Promise.all(tarefas);
    const semRota = (p.redes || []).map((r) => ({ rede: r, precisa: PRECISA[r] || 'sem rota grátis e legítima conhecida' }));
    if (!p.youtube && !(p.rss || []).length) semRota.unshift({ rede: 'YouTube e site', precisa: 'não achei canal oficial no YouTube nem RSS oficial do site; para incluir, preciso do endereço oficial do canal ou do site' });
    perfis.push({ nome: p.nome, tipo: p.tipo, nicho: p.nicho, pais: p.pais, rotas, ativo: rotas.some((r) => r.ok), semRota });
  }));
  itens.sort((a, b) => b.ts - a.ts);
  perfis.sort((a, b) => lista.findIndex((x) => x.nome === a.nome) - lista.findIndex((x) => x.nome === b.nome));
  return { perfis, itens };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {   // só quando rodado direto, nunca ao importar
  const { perfis, itens } = await coletar();
  const saida = { atualizado: brIso(AGORA), regra: 'Post de uma pessoa ou veículo é "fulano publicou", com link e hora. Nada aqui é afirmado pelo jornal.', perfis, itens: itens.slice(0, 200) };
  fs.writeFileSync('referencias.json', JSON.stringify(saida)); fs.writeFileSync(EF, JSON.stringify(E));
  console.log('REFERÊNCIAS: perfis', perfis.length, '| com rota ativa', perfis.filter((p) => p.ativo).length, '| itens (72 h)', itens.length);
  for (const p of perfis) console.log(' ', p.ativo ? 'ok ' : 'sem', p.nome, '|', p.rotas.map((r) => r.tipo + (r.ok ? ' ok (' + r.n + ', ' + (r.canal || '?') + ')' : ' falhou: ' + r.erro)).join(' · ') || 'sem rota');
}
