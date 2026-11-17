// Nota de potencial de postagem (17/11, pedido A da Jessyca): de 0 a 100%, quanto vale ela postar sobre o assunto.
// Mede o potencial do ASSUNTO (não só a contagem de fontes) com 5 critérios reais, todos mostrados no motivo:
//   veículo  até 20: peso de quem publicou (portal grande do Brasil ou do mundo = 20; veículo com nome = 10; rede social ou desconhecido = 5)
//   repetição até 30: quantos veículos diferentes repetiram e com que velocidade (6 por veículo; +6 se 2 ou mais em até 3 h)
//   tema     até 25: tema forte (morte, prisão, lançamento, final, recorde, notícia nacional...) = 25; tema médio (show, trailer, anúncio...) = 12
//   pessoa   até 15: pessoa famosa citada no título (lista curada abaixo e as listas de cada seção)
//   frescor  até 10: minutos desde a primeira publicação (até 1 h = 10; até 6 h = 6; até 24 h = 3)
// Métricas do Instagram dela: o jornal é público e não guarda nada dela; o agente (reel-olimpia) cruza a nota com o resultado dos posts.
// Nunca inventa número: com 1 veículo só (repetição ainda não medível) ou sem horário, a nota sai PROVISÓRIA e nunca sobe a prioridade.
// Faixas na marca (preto e dourado): 90 a 100 "Não deixe de postar"; 70 a 89 "Vale postar"; abaixo de 70 "Opcional".

const palavra = (alt) => new RegExp('(?<![\\p{L}\\p{N}])(?:' + alt + ')(?![\\p{L}\\p{N}])', 'iu');   // fronteira de palavra que entende acento (\\b do JS não entende)
export const GRANDES = palavra('g1|ge|globo|o globo|gshow|globoplay|extra|uol|folha(?! d[oa]\\s)|estad[aã]o|cnn|bbc|reuters|associated press|ap|afp|the new york times|new york times|nyt|washington post|the guardian|el pa[ií]s|le monde|bloomberg|financial times|wall street journal|valor econ[oô]mico|exame|veja|metr[oó]poles|r7|record|sbt|band|terra|ig|hugo gloss|caras|quem|espn|lance|placar|marca|as\\.com|the athletic|variety|deadline|hollywood reporter|billboard|rolling stone|omelete|poder360|ag[eê]ncia brasil|correio braziliense|o tempo|zero hora|gzh|jornal nacional|fant[aá]stico');
const SOCIAL = /instagram|tiktok|x\.com|twitter|facebook|youtube|reddit|threads|kwai/i;

const FORTE = palavra('morre|morreu|morte|mortes|falece|faleceu|falecimento|luto|vel[oó]rio|assassin|preso|presa|pris[aã]o|detid[oa]|condenad[oa]|absolvid[oa]|indiciad[oa]|acidente|trag[eé]dia|desabamento|terremoto|tsunami|explos[aã]o|atentado|recorde|hist[oó]ric[oa]|in[eé]dit[oa]|campe[aã]o|campe[aã]|t[ií]tulo|final|finalista|decis[aã]o|vence|venceu|vit[oó]ria|eliminad[oa]|rebaixad[oa]|demitid[oa]|demiss[aã]o|renuncia|ren[uú]ncia|impeachment|elei[cç][aã]o|stf|supremo|presidente|lan[cç]amento|lan[cç]a|estreia|estreou|anuncia fim|separa[cç][aã]o|div[oó]rcio|grávida|gravidez|nasceu|casamento|pedido de casamento|confirmad[oa]|oficial|nacional|urgente|[uú]ltima hora|breaking|dies|died|death|arrested|record|champion|wins|won|final|premiere|launch|released?');
const MEDIO = palavra('show|turn[eê]|[aá]lbum|single|clipe|feat|parceria|trailer|teaser|temporada|epis[oó]dio|s[eé]rie|filme|bilheteria|contrato|contrata|transfer[eê]ncia|refor[cç]o|escala[cç][aã]o|jogo|partida|gol|pol[eê]mica|briga|treta|desabafa|rebate|anuncia|an[uú]ncio|novidade|pr[eê]mio|indicad[oa]|indica[cç][aã]o|festival|line-?up|ingressos?|esgota|alta|queda|d[oó]lar|bolsa|tour|album|trailer|season|signs?|deal');
// pessoas famosas (lista curada, ampla e sem preferência pessoal; cada seção pode somar a sua lista)
export const FAMOSOS = palavra('lula|bolsonaro|trump|biden|musk|zuckerberg|papa le[aã]o|papa francisco|neymar|vin[ií]cius j[uú]nior|vini jr|messi|cristiano ronaldo|cr7|mbapp[eé]|ancelotti|anitta|ludmilla|ivete sangalo|caetano veloso|gilberto gil|roberto carlos|xuxa|ang[eé]lica|luciano huck|faust[aã]o|silvio santos|virginia fonseca|zé felipe|ze felipe|wesley safad[aã]o|gusttavo lima|marília mendonça|mar[ií]lia mendon[cç]a|jorge e mateus|henrique e juliano|thiaguinho|p[eé]ricles|zeca pagodinho|alcione|seu jorge|iza|pabllo vittar|juliette|bruna marquezine|sasha meneghel|gisele b[uü]ndchen|ana maria braga|taylor swift|beyonc[eé]|rihanna|drake|bad bunny|shakira|lady gaga|billie eilish|the weeknd|kanye|kim kardashian|selena gomez|justin bieber|viola davis|zendaya|tom cruise|oprah|lebron|serena williams|hamilton|verstappen|joel jota|fl[aá]vio augusto|nathalia arcuri|primo rico|whindersson|casimiro');

const PESO = { veiculo: 20, repeticao: 30, tema: 25, pessoa: 15, frescor: 10 };

/** x: { titulo, resumo?, veiculos: [nomes ou domínios dos veículos diferentes], ts: ms da 1ª publicação, agora: ms, famosos?: RegExp extra } */
export function notaPotencial(x) {
  const titulo = String(x.titulo || ''), texto = titulo + ' ' + String(x.resumo || '');
  const veiculos = [...new Set((x.veiculos || []).filter(Boolean).map(String))];
  const n = Math.max(1, veiculos.length || +x.fontes || 1);
  const agora = +x.agora || Date.now(), ts = +x.ts || 0, temHora = ts > 0 && ts <= agora + 5 * 60e3;
  const horas = temHora ? Math.max(0, (agora - ts) / 3600e3) : null;
  const c = {}; const motivo = [];
  // veículo: o maior peso entre os que publicaram
  const grande = veiculos.find(v => GRANDES.test(v)); const social = veiculos.length && veiculos.every(v => SOCIAL.test(v));
  c.veiculo = grande ? 20 : social ? 5 : veiculos.length ? 10 : 5;
  if (grande) motivo.push('veículo grande (' + grande + ')');
  // repetição e velocidade
  c.repeticao = Math.min(PESO.repeticao, 6 * n + (n >= 2 && horas !== null && horas <= 3 ? 6 : 0));
  if (n >= 2) motivo.push(n + ' veículos' + (horas !== null && horas <= 3 ? ' em ' + (horas < 1 ? Math.max(1, Math.round(horas * 60)) + ' min' : Math.round(horas) + ' h') : ''));
  // tema
  const mf = titulo.match(FORTE) || texto.match(FORTE), mm = !mf && (titulo.match(MEDIO) || texto.match(MEDIO));
  c.tema = mf ? PESO.tema : mm ? 12 : 0;
  if (mf) motivo.push('tema forte: ' + mf[0].toLowerCase()); else if (mm) motivo.push('tema: ' + mm[0].toLowerCase());
  // pessoa famosa
  const pf = titulo.match(FAMOSOS) || (x.famosos && titulo.match(x.famosos));
  c.pessoa = pf ? PESO.pessoa : 0; if (pf) motivo.push('pessoa famosa: ' + pf[0]);
  // frescor
  c.frescor = horas === null ? 0 : horas <= 1 ? 10 : horas <= 6 ? 6 : horas <= 24 ? 3 : 0;
  if (horas !== null && horas <= 1) motivo.push('acabou de sair');
  const nota = Math.max(0, Math.min(100, Math.round(Object.values(c).reduce((s, v) => s + v, 0))));
  const faltam = []; if (n < 2) faltam.push('só 1 veículo até agora'); if (!temHora) faltam.push('sem horário');
  const provisoria = faltam.length > 0;
  const faixa = nota >= 90 ? 'nao-deixe' : nota >= 70 ? 'vale' : 'opcional';
  const frase = { 'nao-deixe': 'não deixe de postar', vale: 'vale postar', opcional: 'opcional' }[faixa];
  const rotulo = (provisoria ? '⏳ ' : faixa === 'opcional' ? '' : '🔥 ') + nota + '%' + (provisoria ? ' provisória' : '') + ' · ' + frase;
  return { nota, faixa, provisoria, rotulo, motivo: (motivo.length ? motivo.slice(0, 4).join(' · ') : 'sem sinal forte ainda') + (provisoria ? ' · nota provisória: ' + faltam.join(', ') : ''), criterios: c };
}

/** prioridade do ntfy pela nota, poupando bateria: só 90%+ (e nunca a provisória) sobe para 4 (com som); o resto segue a base (2 = silencioso). */
export const prioridadeNota = (p, base = 2) => (p && !p.provisoria && p.nota >= 90 ? Math.max(base, 4) : base);
/** título do aviso com a nota na frente, bem visível */
export const tituloComNota = (p, titulo) => (p ? p.rotulo + ' | ' : '') + titulo;
