// Agenda semanal de shows e rodas de samba/pagode por cidade.
// Fontes públicas, sem login: (1) as próprias notícias (data do evento escrita no título/resumo, cidade já localizada),
// (2) busca pública do Bing Notícias por agenda de roda de samba/pagode, (3) vitrine pública da Bilheteria Digital
// (página do evento traz local, cidade/UF e data no og:title/og:description). Nada de API interna de bilheteria.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)', 'accept-language': 'pt-BR,pt;q=0.9' };
const sem = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const ent = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const txt = s => ent(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const DIAS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
// data de Brasília (UTC-3) como objeto {a,m,d}
const brDia = ts => { const d = new Date(ts - 3 * 3600e3); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() }; };
const iso = (a, m, d) => a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
const soma = (o, n) => { const t = Date.UTC(o.a, o.m - 1, o.d) + n * 86400e3; const d = new Date(t); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() }; };
// acha a data do evento num texto, relativa à data de publicação
export function dataDoEvento(texto, tsPub) {
  const s = sem(texto); const p = brDia(tsPub); let m;
  if ((m = s.match(/\b(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/))) { const mes = MESES[m[2]]; let a = p.a; if (mes < p.m - 1) a++; return { data: iso(a, mes, +m[1]), pista: m[0] }; }
  if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})\b(?!\/\d)/)) && +m[2] >= 1 && +m[2] <= 12 && +m[1] <= 31) { let a = p.a; if (+m[2] < p.m - 1) a++; return { data: iso(a, +m[2], +m[1]), pista: m[0] }; }
  if ((m = s.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?,? \((\d{1,2})\)/))) { const d = +m[2]; let o = { ...p }; o.m = d < p.d - 7 ? p.m + 1 : p.m; if (o.m > 12) { o.m = 1; o.a++; } return { data: iso(o.a, o.m, d), pista: m[0] }; }
  if ((m = s.match(/\b(?:neste|nesta|proximo|proxima|este|esta)\s+(domingo|segunda|terca|quarta|quinta|sexta|sabado)/))) { const alvo = DIAS[m[1]]; const n = (alvo - p.w + 7) % 7; const o = soma(p, n); return { data: iso(o.a, o.m, o.d), pista: m[0] }; }
  if ((m = s.match(/\b(neste|este|proximo) fim de semana\b/))) { const n = (6 - p.w + 7) % 7; const o = soma(p, n); return { data: iso(o.a, o.m, o.d), pista: m[0] }; }
  if ((m = s.match(/\b(amanha)\b/))) { const o = soma(p, 1); return { data: iso(o.a, o.m, o.d), pista: m[0] }; }
  if ((m = s.match(/\b(hoje|nesta noite|esta noite)\b/))) return { data: iso(p.a, p.m, p.d), pista: m[0] };
  return null;
}
const EVENTO = /\b(roda de samba|samba de mesa|show|apresenta|se apresenta|festa|festival|feijoada|pagode|samba|baile|ensaio|bloco|tributo|homenagem)\b/i;
async function abre(url, ms = 12000) { const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
// vitrine pública da Bilheteria Digital: eventos de samba/pagode e a página de cada um
async function bilheteria(ART, localizar) {
  const st = { ok: false, eventos: 0, erro: '' }; const out = [];
  try { const links = new Set(); for (const u of ['https://www.bilheteriadigital.com/', 'https://www.bilheteriadigital.com/busca?q=samba', 'https://www.bilheteriadigital.com/busca?q=pagode']) { try { const x = await abre(u); for (const m of x.matchAll(/https:\/\/www\.bilheteriadigital\.com\/([a-z0-9-]{8,})/g)) if (/samba|pagode|roda|pagodeira/.test(m[1]) || ART.test(m[1].replace(/-/g, ' '))) links.add(m[0]); st.ok = true; } catch {} }
    for (const l of [...links].slice(0, 15)) { try { const x = await abre(l); const og = ent((x.match(/<meta[^>]+og:title[^>]+content="([^"]+)"/) || [])[1] || '').replace(/^Bilheteria Digital \| /, ''); const ds = ent((x.match(/<meta[^>]+og:description[^>]+content="([^"]+)"/) || [])[1] || '');
        const cu = og.match(/\s([A-ZÀ-Ú][\wÀ-ÿ' ]+?)\s*-\s*([A-Z]{2})\s*$/); const d = dataDoEvento(ds + ' ' + l.replace(/-/g, ' '), Date.now()); const lugar = (ds.match(/Local:\s*([^📌🕑📅]+)/) || [])[1];
        if (d) { let cid = ''; if (cu && localizar) { const w = cu[1].trim().split(/\s+/); for (let n = 1; n <= Math.min(4, w.length) && !cid; n++) { const c = localizar('em ' + w.slice(-n).join(' ') + ' - ' + cu[2]); if (c && c.uf === cu[2]) cid = c.cidade; } }
        out.push({ titulo: og.replace(/\s*-\s*[^-]+-\s*[A-Z]{2}$/, '').trim() || og, data: d.data, pista: d.pista, cidade: cid, uf: cu ? cu[2] : '', local: lugar ? lugar.trim() : '', link: l, fonte: 'Bilheteria Digital (página pública do evento)' }); st.eventos++; } } catch {} } } catch (e) { st.erro = e.message; }
  return { st, out };
}
// busca pública do Bing Notícias por agenda (anúncios de roda de samba/pagode com data)
async function bingAgenda() { const out = []; const st = { ok: 0, itens: 0 };
  for (const q of ['roda de samba neste sábado', 'roda de samba neste domingo', 'pagode neste fim de semana show', 'samba de mesa agenda', 'feijoada com samba neste sábado']) { try { const x = await abre('https://www.bing.com/news/search?format=rss&setlang=pt-br&q=' + encodeURIComponent(q)); st.ok++;
      for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const t = txt((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const ds = txt((b.match(/<description>([\s\S]*?)<\/description>/) || [])[1]); const l = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''); let real = l; try { real = new URL(l).searchParams.get('url') || l; } catch {} const pd = Date.parse((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '') || Date.now(); const src = txt((b.match(/<News:Source>([\s\S]*?)<\/News:Source>/i) || [])[1]);
        if (Date.now() - pd < 10 * 86400e3) { out.push({ title: t, sum: ds, link: real, ts: pd, veic: src || (() => { try { return new URL(real).hostname.replace(/^www\./, ''); } catch { return ''; } })() }); st.itens++; } } } catch {} }
  return { st, out };
}
// monta a agenda: itens = notícias já localizadas (com cidade); cidadesNoTexto/decidir vêm do localizador
export async function montarAgenda(itens, { agora = Date.now(), ART = /$^/, localizar } = {}) {
  const hoje = brDia(agora); const hojeIso = iso(hoje.a, hoje.m, hoje.d); const fim7 = soma(hoje, 7); const fim7Iso = iso(fim7.a, fim7.m, fim7.d); const fim30 = soma(hoje, 30); const fim30Iso = iso(fim30.a, fim30.m, fim30.d);
  const ev = []; const est = { noticias: 0, bing: 0, bilheteria: 0 };
  const add = (e) => { if (!e.data || e.data < hojeIso || e.data > fim30Iso) return; const k = sem(e.titulo).replace(/[^a-z0-9]/g, '').slice(0, 40) + e.data; const W = t => new Set(sem(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !/^(neste|nesta|sabado|domingo|sexta|feira|show|samba|pagode|roda|para|como|com|gratis|gratuita|gratuito|novembro|dezembro|janeiro|leva|terá|tera|celebra|comanda|ingressos|comprar)$/.test(w)));
    const wn = W(e.titulo); if (ev.some(x => x.k === k || (x.data === e.data && x.cidade === e.cidade && [...wn].filter(w => x.w.has(w)).length >= 2))) return; ev.push({ ...e, k, w: wn }); };
  for (const i of itens) { if (!(i.setor === 'samba' || i.setor === 'pagode')) continue; const t = (i.tituloPt || i.title) + ' . ' + (i.sum || ''); if (!EVENTO.test(t)) continue; const d = dataDoEvento(t, i.ts); if (!d || !i.cidade) continue;
    add({ titulo: i.tituloPt || i.title, data: d.data, pista: d.pista, cidade: i.cidade, uf: i.pais === 'Brasil' ? i.uf : i.pais, local: '', link: i.link, fonte: i.veic + ' (notícia)' }); est.noticias++; }
  const bg = await bingAgenda(); est.bingConsultas = bg.st.ok;
  for (const i of bg.out) { const t = i.title + ' . ' + i.sum; if (!/samba|pagode/i.test(t)) continue; const d = dataDoEvento(t, i.ts); if (!d) continue; const c = localizar ? localizar(i.title + ' . ' + i.sum) : null; if (!c) continue;
    add({ titulo: i.title, data: d.data, pista: d.pista, cidade: c.cidade, uf: c.pais === 'Brasil' ? c.uf : c.pais, local: '', link: i.link, fonte: i.veic + ' (Bing Notícias)' }); est.bing++; }
  const bi = await bilheteria(ART, localizar); est.bilheteriaOk = bi.st.ok; for (const e of bi.out) { add(e); est.bilheteria++; }
  const fmt = e => ({ data: e.data, quando: e.pista, titulo: e.titulo, cidade: e.cidade ? e.cidade + (e.uf ? ', ' + e.uf : '') : 'cidade não informada', local: e.local || undefined, link: e.link, fonte: e.fonte });
  const porCidade = arr => { const m = {}; for (const e of arr.sort((a, b) => a.data.localeCompare(b.data))) { const c = e.cidade ? e.cidade + (e.uf ? ', ' + e.uf : '') : 'cidade não informada'; (m[c] = m[c] || []).push(fmt(e)); } return Object.entries(m).sort((a, b) => b[1].length - a[1].length).map(([cidade, eventos]) => ({ cidade, eventos })); };
  return { de: hojeIso, ate: fim7Iso, semana: porCidade(ev.filter(e => e.data <= fim7Iso)), proximas: porCidade(ev.filter(e => e.data > fim7Iso)), est };
}
