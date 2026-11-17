// 17/11: o rótulo de cada notícia é o do site que o link abre. Sem rede: fetch falso.
// 1) o Bing acha a mesma manchete no próprio veículo e numa cópia: fica o próprio veículo;
// 2) só existe a cópia em outro site: o link é da cópia e o rótulo vira o site real (nunca "Gshow" apontando para outro site).
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
process.chdir(mkdtempSync(join(tmpdir(), 'rotulo-')));   // o cache musica-locais.json fica numa pasta temporária
const TIT = 'Anitta conquista seu primeiro Grammy Latino com o álbum Equilibrivm';
let itensBing = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  if (/bing\.com\/news\/search\?format=rss/.test(u)) {
    const xml = '<rss><channel>' + itensBing.map(l => `<item><title>${TIT}</title><link>https://www.bing.com/news/apiclick.aspx?url=${encodeURIComponent(l)}</link></item>`).join('') + '</channel></rss>';
    return new Response(xml, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  }
  return new Response('', { status: 404 });
};
const { linksReais } = await import(new URL('./musica-local.mjs', import.meta.url));
const { rotuloReal } = await import(new URL('./musica-regras.mjs', import.meta.url));
const item = (n) => ({ link: 'https://news.google.com/rss/articles/teste' + n, title: TIT, veic: 'Gshow', dom: 'gshow.globo.com' });
let ok = 0;

itensBing = ['https://agendadopoder.com.br/anitta-grammy/', 'https://gshow.globo.com/musica/anitta-grammy.ghtml'];
const a = item(1); await linksReais([a], { prazoMs: 30000, paralelo: 1 }); rotuloReal(a);
assert.equal(a.link, 'https://gshow.globo.com/musica/anitta-grammy.ghtml'); assert.equal(a.veic, 'Gshow'); console.log('ok 1 o próprio veículo vence a cópia: Gshow com link do Gshow'); ok++;

itensBing = ['https://agendadopoder.com.br/anitta-grammy/'];
const b = item(2); await linksReais([b], { prazoMs: 30000, paralelo: 1 }); rotuloReal(b);
assert.equal(b.link, 'https://agendadopoder.com.br/anitta-grammy/'); assert.equal(b.veic, 'agendadopoder.com.br'); assert.equal(b.veicGoogle, 'Gshow'); assert.equal(b.dom, 'agendadopoder.com.br');
console.log('ok 2 só a cópia existe: rótulo agendadopoder.com.br, Gshow guardado em veicGoogle'); ok++;

const c = rotuloReal({ link: 'x', linkReal: 'https://www.folha.uol.com.br/ilustrada/a.shtml', veic: 'Folha', dom: 'folha.uol.com.br' });
assert.equal(c.veic, 'Folha'); console.log('ok 3 link do próprio veículo (com www) mantém o nome'); ok++;
console.log('TODOS OS TESTES PASSARAM: ' + ok);
