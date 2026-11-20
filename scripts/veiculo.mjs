// Mesmo veículo nunca confirma a si mesmo (20/11): "g1" x "G1", "www.eldoradofm.com.br" x "eldoradofm.com.br" e m./amp./mobile.
// do mesmo endereço contam como UM veículo só. Marcas do mesmo grupo (ge.globo.com x g1.globo.com, Folha x UOL) contam separadas. Sites que hospedam muitos veículos
// (Google Notícias, YouTube, Instagram, X, TikTok, Facebook, blogspot, wordpress.com, medium, substack...) ficam pelo endereço inteiro.
export const sem = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const SUF2 = new Set(['com.br', 'net.br', 'org.br', 'gov.br', 'art.br', 'blog.br', 'jor.br', 'tv.br', 'esp.br', 'ind.br', 'inf.br', 'rec.br', 'tur.br', 'eco.br', 'mus.br', 'co.uk', 'org.uk', 'com.au', 'com.ar', 'com.mx', 'co.jp', 'com.pt', 'co.nz', 'co.za', 'com.co', 'com.es', 'com.uy', 'com.pe', 'com.ve', 'co.in']);
const HOSPEDA = /(^|\.)(google\.com|youtube\.com|youtu\.be|instagram\.com|x\.com|twitter\.com|tiktok\.com|facebook\.com|threads\.net|t\.co|feedburner\.com|blogspot\.com|wordpress\.com|medium\.com|substack\.com|msn\.com|yahoo\.com|wixsite\.com|github\.io|netlify\.app|linktr\.ee)$/;
const limpaHost = (h) => sem(h).replace(/:\d+$/, '').replace(/\.$/, '').replace(/^(?:(?:www\d?|m|amp|mobile)\.)+/, '');
/** domínio do veículo: sem www./m./amp., sem subdomínio (ge.globo.com -> globo.com); site que hospeda muitos veículos fica inteiro */
export function dominioVeiculo(u) {
  let h = String(u || '').trim(); if (!h) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(h)) { try { h = new URL(h).hostname; } catch { return ''; } }
  h = limpaHost(h); if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return '';
  return h;   // 20/11 (decisão da Jessyca): marcas do mesmo grupo (ge.globo.com x g1.globo.com, folha.uol x uol) contam SEPARADAS
}
// chave de um host: sem o final público (.com.br, .com, .co.uk...) e sem pontos (eldoradofm.com.br -> eldoradofm; g1.globo.com -> g1globo)
const chaveHost = (h) => { const p = h.split('.'); return p.slice(0, SUF2.has(p.slice(-2).join('.')) ? -2 : -1).join(''); };
/** chave para comparar veículos: aceita nome ("G1", "Folha de S.Paulo"), domínio ou link */
export function chaveVeiculo(v) {
  const s = String(v || '').trim(); if (!s) return '';
  const d = !/\s/.test(s) && /\.[a-z]{2,}(\/|$)/i.test(s) ? dominioVeiculo(s) : '';
  if (d) return HOSPEDA.test(d) ? d : chaveHost(d);
  return sem(s).replace(/[^a-z0-9]/g, '');
}
export const mesmoVeiculo = (a, b) => { const x = chaveVeiculo(a); return !!x && x === chaveVeiculo(b); };
/** nomes de veículos sem repetir o mesmo veículo (fica o 1º nome de cada um) */
export function veiculosDistintos(lista) { const m = new Map(); for (const v of lista) { const k = chaveVeiculo(v) || v; if (!m.has(k)) m.set(k, v); } return [...m.values()]; }
/** chave do veículo de um item { link?, src?, veic?, dom? }: domínio do link quando é site próprio; senão o nome */
export function veiculoDe(x) {
  if (!x) return ''; if (x._vk !== undefined && x._vkDe === (x.link || '') + '|' + (x.src || x.veic || x.dom || '')) return x._vk;
  const d = dominioVeiculo(x.link), k = d && !HOSPEDA.test(d) ? chaveHost(d) : chaveVeiculo(x.src || x.veic || x.dom);
  try { Object.defineProperty(x, '_vk', { value: k, writable: true, configurable: true, enumerable: false }); Object.defineProperty(x, '_vkDe', { value: (x.link || '') + '|' + (x.src || x.veic || x.dom || ''), writable: true, configurable: true, enumerable: false }); } catch {}
  return k;
}
