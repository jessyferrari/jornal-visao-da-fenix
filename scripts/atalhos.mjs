// Barra de atalhos do jornal (index.html). Testada em scripts/teste-atalhos.mjs.
export function aplicarAtalhos(html) {
  // 20/11 (t328): os 6 atalhos (Games, Referências, Esportes, Séries, Em Alta, Música) ficavam empilhados em position:fixed por cima
  // das notícias, da busca e da paginação no celular. Agora formam uma barra própria no rodapé: o #root encolhe a altura da barra,
  // então nenhum atalho cobre conteúdo. Mesmas cores, fontes e bordas de antes (nenhum botão removido); no celular a fileira rola de lado.
  const PILL = 'flex:0 0 auto;font:600 14px/1 system-ui,sans-serif;padding:9px 13px;border-radius:22px;text-decoration:none;box-shadow:0 2px 6px #0005;white-space:nowrap;';
  const ATALHOS = [
    ['jf-games', 'games.html', 'background:#0d0b08;color:#d4af37;border:1.5px solid #d4af37;', '🎮 Games'],
    ['jf-emalta', 'emalta.html', 'background:#5fd38d;color:#111;', '🚀 Em Alta'],
    ['jf-musica', 'musica.html', 'background:#d4af37;color:#111;', '🎵 Música'],
    ['jf-series', 'series.html', 'background:#e0413a;color:#fff;', '🎬 Séries'],
    ['jf-esportes', 'esportes.html', 'background:#0d0b08;color:#d4af37;border:1.5px solid #d4af37;', '⚽ Esportes'],
    ['jf-referencias', 'referencias.html', 'background:#0d0b08;color:#d4af37;border:1.5px solid #d4af37;', '📚 Referências'],
  ];
  const CSS_ATALHOS = '<style id="jf-atalhos-css">:root{--jf-barra:56px}#root{height:calc(100% - var(--jf-barra) - 1px - env(safe-area-inset-bottom,0px))!important}#root>div.jf{height:100%!important}' +
    '#jf-atalhos{position:fixed;left:0;right:0;bottom:0;z-index:9999;height:var(--jf-barra);padding:0 10px env(safe-area-inset-bottom,0px);box-sizing:content-box;display:flex;align-items:center;gap:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;border-top:1px solid rgba(212,175,55,.35)}' +
    '#jf-atalhos::-webkit-scrollbar{display:none}#jf-atalhos>a:first-child{margin-left:auto}#jf-atalhos>a:last-child{margin-right:auto}' +
    'html[data-tema="escuro"] #jf-atalhos,#jf-atalhos{background:#0B0B0D}html[data-tema="claro"] #jf-atalhos{background:#F7F1E6}</style>';
  const NAV = '<nav id="jf-atalhos" aria-label="Seções do jornal">' + ATALHOS.map(([id, href, cor, txt]) => '<a id="' + id + '" href="' + href + '" style="' + PILL + cor + '">' + txt + '</a>').join('') + '</nav>';
  html = html.replace(/<style id="jf-atalhos-css">[\s\S]*?<\/style>/, '').replace(/<nav id="jf-atalhos"[\s\S]*?<\/nav>/, '');
  for (const [id] of ATALHOS) html = html.replace(new RegExp('<a id="' + id + '"[^>]*>[\\s\\S]*?<\\/a>'), '');
  html = html.replace(/<\/head>/, CSS_ATALHOS + '</head>').replace(/(<body[^>]*>)/, '$1' + NAV);
  return html;
}
