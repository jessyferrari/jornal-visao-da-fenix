// 🎯 Melhor formato (17/11): o jornal estuda cada notícia e diz se o post rende mais como Imagem, Carrossel ou Vídeo.
// Sem IA e sem custo: pesa o que a notícia é (fato rápido, assunto para explicar, cena em movimento), quantos veículos
// cobrem, o tamanho do resumo e de onde vem o link. O agente recebe a sugestão no "Sim, publicar" (campo sugerido) e
// marca ⭐ nela; ela continua livre para escolher outro formato no celular.
export const FORMATOS = { imagem: '🖼️ Imagem', carrossel: '🎠 Carrossel', video: '🎬 Vídeo' };
const VIDEO = /\b(v[ií]deos?|assista|gols?|golaço|lance|ao vivo|trailer|teaser|clipe|videoclipe|show|turn[eê]|entrevista|discurso|flagra|momento em que|viraliza|viralizou|dan[cç]a|coreografia|performance|apresenta[cç][aã]o|bastidores|cena|cenas|estreia|p[eê]nalti|defesa|ultrapassagem|largada|p[oó]dio|chegada)\b/i;
const EXPLICA = /\b(entenda|o que se sabe|o que muda|o que [eé]|como funciona|como fica|quem [eé]|quem s[aã]o|ranking|lista|cronologia|linha do tempo|passo a passo|veja (os|as|quem|o que|como)|perguntas e respostas|tudo sobre|raio-x|bastidores da|regras|calend[aá]rio|agenda|escala[cç][aã]o|convocad[oa]s?|indicad[oa]s|vencedores|resultado[s]? d[oa]s|comparativo|antes e depois)\b/i;
const LISTA_NUM = /\b\d{1,2} (coisas|motivos|dicas|fatos|pontos|nomes|filmes|s[eé]ries|jogadores|curiosidades|mudan[cç]as|perguntas|li[cç][oõ]es|sinais|erros|segredos|destinos|artistas|m[uú]sicas|livros)\b/i;
const DECISAO = /\b(aprova|aprovad[oa]|san[cç]ão|sanciona|lei|projeto de lei|reforma|imposto|tarifa|taxa|juros|selic|infla[cç][aã]o|stf|julgamento|decis[aã]o|medida|regra|or[cç]amento|pacote|acordo)\b/i;
const RAPIDO = /\b(morre|morreu|morte|falece|faleceu|anuncia|anunciou|confirma|confirmou|renuncia|demitid[oa]|contratad[oa]|assina|assinou|nomead[oa]|eleit[oa]|vence|venceu|campe[aã]o|lan[cç]a|lan[cç]ou|presa?|preso|urgente)\b/i;
const LINK_VIDEO = /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com\/reel|vimeo\.com|globoplay|\/video[s]?\/|\/videos?-)/i;
const DELICADO = /\b(morre|morreu|morte|falece|faleceu|v[ií]tima|tragédia|trag[eé]dia|acidente|assassin|estupro|abuso|suic[ií]d)\w*/i;

export function estudarFormato(i = {}) {
  const t = [i.title || i.titulo || '', i.sum || i.texto || ''].join(' ');
  const links = [i.link, ...((i.grp || []).map((g) => g.link))].filter(Boolean).join(' ');
  const fontes = (i.cov && i.cov.n) || i.fontes || 1;
  const p = { imagem: 1, carrossel: 0, video: 0 }, por = { imagem: 'fato rápido, cabe numa imagem forte', carrossel: '', video: '' };
  if (VIDEO.test(t)) { p.video += 4; por.video = 'a notícia é uma cena: rende mais em movimento'; }
  if (LINK_VIDEO.test(links)) { p.video += 2; por.video = por.video || 'tem vídeo na fonte'; }
  if (EXPLICA.test(t)) { p.carrossel += 3; por.carrossel = 'assunto para explicar em partes'; }
  if (LISTA_NUM.test(t)) { p.carrossel += 3; por.carrossel = 'lista com vários itens: um por lâmina'; }
  if (DECISAO.test(t)) { p.carrossel += 2; por.carrossel = por.carrossel || 'decisão com impacto: vale explicar o que muda'; }
  if (fontes >= 4 && String(i.sum || '').length > 220) { p.carrossel += 1; por.carrossel = por.carrossel || 'muitos veículos e muito contexto'; }
  if (RAPIDO.test(t)) { p.imagem += 2; }
  if (DELICADO.test(t)) { p.video -= 2; p.imagem += 2; por.imagem = 'assunto delicado: imagem sóbria, com respeito'; }
  const ordem = ['imagem', 'carrossel', 'video'].sort((a, b) => p[b] - p[a]);
  const f = ordem[0];
  return { formato: f, rotulo: FORMATOS[f], motivo: por[f] || por.imagem, pontos: p };
}
export const linhaFormato = (s) => (s ? '🎯 Melhor formato: ' + s.rotulo + ' · ' + s.motivo : '');
export const iconeFormato = (s) => (s ? s.rotulo.split(' ')[0] : '');
