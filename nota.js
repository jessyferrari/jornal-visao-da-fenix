/* Nota de potencial de postagem (17/11): selo preto e dourado no começo de cada notícia do jornal.
   Fora do app (não mexe no app.js): lê a nota de edicao.json (calculada pelo robô em scripts/potencial.mjs) e coloca o selo
   ao lado do botão "Virar post" de cada notícia. Nunca inventa número: a nota provisória aparece como provisória. */
(function () {
  var NOTAS = {};
  var COR = { 'nao-deixe': ['#d4af37', '#0d0b08', '#d4af37'], vale: ['#0d0b08', '#d4af37', '#d4af37'], opcional: ['#0d0b08', '#bfa775', '#5a5040'] };
  function selo(p) {
    var c = COR[p.faixa] || COR.opcional;
    var w = document.createElement('div'); w.className = 'jf-nota'; w.setAttribute('data-qa', 'nota');
    w.style.cssText = 'flex-basis:100%;display:flex;flex-direction:column;gap:3px;margin:2px 0 4px';
    var b = document.createElement('span');
    b.style.cssText = 'align-self:flex-start;font:700 13px/1.2 system-ui,sans-serif;letter-spacing:.02em;padding:5px 10px;border-radius:999px;border:1.5px solid ' + c[2] + ';background:' + c[0] + ';color:' + c[1];
    b.textContent = p.rotulo;
    var m = document.createElement('span');
    m.style.cssText = 'font:500 12px/1.35 system-ui,sans-serif;color:#bfa775';
    m.textContent = p.motivo;
    w.appendChild(b); w.appendChild(m); return w;
  }
  function aplicar() {
    var bs = document.querySelectorAll('[data-qa^="post-"]');
    for (var k = 0; k < bs.length; k++) {
      var bt = bs[k], id = bt.getAttribute('data-qa').slice(5), p = NOTAS[id], linha = bt.parentElement;
      if (!p || !linha || linha.querySelector('.jf-nota')) continue;
      linha.insertBefore(selo(p), linha.firstChild);
    }
  }
  fetch('edicao.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
    (d.stories || []).forEach(function (s) { if (s.pot) NOTAS[s.id] = s.pot; });
    aplicar(); new MutationObserver(aplicar).observe(document.body, { childList: true, subtree: true });
  }).catch(function () {});
})();
