// Gera a imagem de compartilhamento (og) da edição e atualiza as meta tags do index.html.
// Só manchete real da edição (edicao.json). Renderiza com Chrome headless (gratuito no Actions).
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const B = 'https://jessyferrari.github.io/jornal-visao-da-fenix/';
const E = JSON.parse(fs.readFileSync('edicao.json', 'utf8'));
const pt = E.stories.filter(s => !s.lang || s.tr).sort((a, b) => (b.score || 0) - (a.score || 0));
const top = pt[0];
const [d, h] = E.updated.split('T'); const [Y, M, D] = d.split('-').map(Number);
const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dia = dias[new Date(Date.UTC(Y, M - 1, D, 12)).getUTCDay()];
const dataLonga = `${dia}, ${D} de ${meses[M - 1]} de ${Y}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const key = crypto.createHash('sha1').update(JSON.stringify([d, h, top && top.title, top && top.src])).digest('hex').slice(0, 10);
const ST = 'og/estado.json'; let st = {}; try { st = JSON.parse(fs.readFileSync(ST, 'utf8')); } catch {}
const font = f => 'data:font/ttf;base64,' + fs.readFileSync('og/fonts/' + f).toString('base64');
const logo = 'data:image/png;base64,' + fs.readFileSync('og/logo.png').toString('base64');
const css = `@font-face{font-family:PF;src:url(${font('Playfair.ttf')});font-weight:400 900}
@font-face{font-family:PF;font-style:italic;src:url(${font('Playfair-Italic.ttf')});font-weight:400 900}
@font-face{font-family:IN;src:url(${font('Inter.ttf')});font-weight:100 900}
*{margin:0;box-sizing:border-box}html,body{background:#0B0B0D}
.c{position:relative;overflow:hidden;background:radial-gradient(120% 90% at 18% 40%,#1d1710 0%,#0f0d0b 45%,#0B0B0D 100%);color:#F3EBDD;font-family:IN}
.f1{position:absolute;inset:22px;border:1.5px solid #B8923F}.f2{position:absolute;inset:30px;border:.75px solid rgba(184,146,63,.55)}
.k{font-family:IN;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:#C9A55A}
.n{font-family:PF;font-weight:600;color:#F6EEDF;letter-spacing:-.01em;line-height:1}
.s{font-family:PF;font-style:italic;color:#D9CBB0}
.r{height:1px;background:linear-gradient(90deg,#C9A55A,rgba(201,165,90,.15))}
.m{font-size:13px}.hl{font-family:PF;font-weight:700;color:#F6EEDF;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.src{font-family:IN;font-weight:500;color:#B9AC95}`;
const manchete = (fs1, lines) => top ? `<div class="k" style="font-size:14px;margin-bottom:12px">Manchete da edição</div>
<div class="hl" style="font-size:${fs1}px;line-height:1.18;-webkit-line-clamp:${lines}">${esc(top.title)}</div>
<div class="src" style="font-size:16px;margin-top:12px">${esc(top.src)} · publicado ${esc(top.pub.slice(11, 16))} (Brasília)</div>` : '';
const wide = `<div class="c" style="width:1200px;height:630px"><div class="f1"></div><div class="f2"></div>
<div style="position:absolute;left:70px;top:0;bottom:0;width:330px;display:flex;align-items:center;justify-content:center"><img src="${logo}" style="width:300px;height:auto"></div>
<div style="position:absolute;left:432px;top:84px;bottom:84px;width:1px;background:linear-gradient(#0000,#B8923F,#0000)"></div>
<div style="position:absolute;left:478px;right:72px;top:70px">
<div class="k" style="font-size:17px">Jornal</div>
<div class="n" style="font-size:78px;margin-top:8px">Visão da Fênix</div>
<div class="s" style="font-size:27px;margin-top:12px">Brasil e o mundo, com fonte e hora exata.</div>
<div class="r" style="margin:24px 0 14px"></div>
<div class="k" style="font-size:13px;letter-spacing:.22em;color:#B9AC95">Edição de ${esc(dataLonga)} · ${esc(h)} Brasília</div>
<div style="margin-top:28px">${manchete(31, 3)}</div></div></div>`;
const sq = `<div class="c" style="width:1200px;height:1200px"><div class="f1"></div><div class="f2"></div>
<div style="position:absolute;left:90px;right:90px;top:96px;text-align:center">
<img src="${logo}" style="width:330px;height:auto">
<div class="k" style="font-size:22px;margin-top:34px">Jornal</div>
<div class="n" style="font-size:112px;margin-top:10px">Visão da Fênix</div>
<div class="s" style="font-size:38px;margin-top:16px">Brasil e o mundo, com fonte e hora exata.</div>
<div class="r" style="margin:40px auto 18px;width:70%;background:linear-gradient(90deg,#0000,#C9A55A,#0000)"></div>
<div class="k" style="font-size:17px;letter-spacing:.22em;color:#B9AC95">Edição de ${esc(dataLonga)} · ${esc(h)} Brasília</div>
<div style="margin-top:44px;text-align:center">${manchete(44, 3)}</div></div></div>`;
const out = [['og.jpg', wide, 1200, 630], ['og-quadrado.jpg', sq, 1200, 1200]];
if (st.key !== key || !fs.existsSync('og.jpg') || process.argv.includes('--forcar')) {
  const { chromium } = await import(process.env.PW || 'playwright-core');
  const exe = process.env.CHROME || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const br = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const [f, body, w, hh] of out) {
    const p = await br.newPage({ viewport: { width: w, height: hh }, deviceScaleFactor: 1 });
    await p.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
    let q = 92; let buf; do { buf = await p.screenshot({ type: 'jpeg', quality: q, clip: { x: 0, y: 0, width: w, height: hh } }); q -= 6; } while (buf.length > 280000 && q > 60);
    fs.writeFileSync(f, buf); console.log('og', f, w + 'x' + hh, buf.length, 'bytes'); await p.close();
  }
  await br.close(); st = { key, gerado: E.updated }; fs.writeFileSync(ST, JSON.stringify(st));
} else console.log('og sem mudança');
// meta tags
const v = st.key;
const title = 'Jornal Visão da Fênix | Brasil e o mundo, com fonte e hora exata';
const desc = `Edição de ${dataLonga}, ${h} (Brasília).` + (top ? ` Manchete: ${top.title} (${top.src}).` : '') + ' Brasil, mundo, negócios e tecnologia, cada notícia com fonte e hora de publicação.';
const alt = 'Jornal Visão da Fênix, monograma OS dourado, edição de ' + dataLonga + (top ? '. Manchete: ' + top.title : '');
const meta = `<!--og-->
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0B0B0D">
<link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website"><meta property="og:site_name" content="Jornal Visão da Fênix"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${B}">
<meta property="og:image" content="${B}og.jpg?v=${v}"><meta property="og:image:secure_url" content="${B}og.jpg?v=${v}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(alt)}">
<meta property="og:image" content="${B}og-quadrado.jpg?v=${v}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="1200"><meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${B}og.jpg?v=${v}"><meta name="twitter:image:alt" content="${esc(alt)}">
<!--/og-->`;
let html = fs.readFileSync('index.html', 'utf8');
if (html.includes('<!--og-->')) html = html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, meta);
else html = html.replace(/<meta name="description"[^>]*>/, '').replace(/<meta name="theme-color"[^>]*>/, '').replace(/<link rel="icon"[^>]*>/, '').replace(/<meta (?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g, '').replace(/(<link rel="canonical"[^>]*>)/, '$1\n' + meta);
html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>').replace(/"primaryImageOfPage": ?"[^"]*"/, `"primaryImageOfPage": "${B}og.jpg?v=${v}"`).replace(/"logo": ?"[^"]*"/, `"logo": "${B}icon-512.png"`);
fs.writeFileSync('index.html', html);
