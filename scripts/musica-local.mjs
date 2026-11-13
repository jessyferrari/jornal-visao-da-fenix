// Localização real de cada notícia de música: cidade + UF (ou cidade + país).
// Nunca inventa: só aceita cidade que aparece no texto real da matéria (título, linha de abertura,
// dados estruturados schema.org, corpo) ou em nome de casa de show/bairro conhecido.
// Links do Google Notícias são trocados pelo link real do veículo por caminhos públicos:
// RSS do próprio veículo, busca pública do WordPress (wp-json) do veículo e RSS público do Bing Notícias.
// Não usa login, cookie, nem endpoint interno do Google; matéria com paywall é pulada.
import fs from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; JornalVisaoDaFenix/1.0; +https://jessyferrari.github.io/jornal-visao-da-fenix/)', 'accept-language': 'pt-BR,pt;q=0.9' };
const DIR = new URL('.', import.meta.url).pathname;
const sem = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const ent = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;|&#8212;/g, '-').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const txt = s => ent(String(s || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// ===== gazetteer: 5.571 municípios (IBGE) =====
const MUN = JSON.parse(fs.readFileSync(DIR + 'municipios.json', 'utf8')).municipios;
const POR_NOME = new Map(); for (const [n, uf, cap, ddd] of MUN) { const k = sem(n); if (!POR_NOME.has(k)) POR_NOME.set(k, []); POR_NOME.get(k).push({ nome: n, uf, cap: !!cap, ddd }); }
// apelidos usados na imprensa -> município oficial do IBGE
for (const [ap, nome, uf] of [['buzios', 'Armação dos Búzios', 'RJ'], ['sampa', 'São Paulo', 'SP'], ['floripa', 'Florianópolis', 'SC'], ['bh', 'Belo Horizonte', 'MG'], ['parati', 'Paraty', 'RJ'], ['sao joao del-rei', 'São João del-Rei', 'MG']]) POR_NOME.set(ap, [{ nome, uf, cap: false, ddd: 0, alias: true }]);
// cidades grandes que valem mesmo sem preposição/UF (além das capitais)
const GRANDES = new Set(['campinas', 'guarulhos', 'santos', 'niteroi', 'sao goncalo', 'duque de caxias', 'nova iguacu', 'osasco', 'sorocaba', 'ribeirao preto', 'sao bernardo do campo', 'santo andre', 'jundiai', 'uberlandia', 'juiz de fora', 'londrina', 'joinville', 'caxias do sul', 'feira de santana', 'campina grande', 'petropolis', 'cabo frio', 'volta redonda', 'campos dos goytacazes', 'pelotas', 'maringa', 'ilheus', 'petrolina', 'caruaru', 'olinda', 'mossoro', 'montes claros', 'sao jose dos campos', 'piracicaba', 'bauru', 'franca', 'limeira', 'taubate', 'mogi das cruzes', 'praia grande', 'sao vicente', 'guaruja', 'ubatuba', 'caraguatatuba', 'macae', 'angra dos reis', 'paraty', 'buzios', 'armacao dos buzios', 'nilopolis', 'sao joao de meriti', 'belford roxo', 'mage', 'itaborai', 'marica', 'blumenau', 'balneario camboriu', 'foz do iguacu', 'ponta grossa', 'vitoria da conquista', 'porto seguro', 'lauro de freitas', 'camacari', 'betim', 'contagem', 'ipatinga', 'governador valadares', 'uberaba', 'anapolis', 'aparecida de goiania', 'imperatriz', 'santarem', 'maraba', 'parintins', 'juazeiro do norte', 'sobral', 'crato', 'garanhuns', 'arapiraca', 'vila velha', 'serra', 'cariacica', 'guarapari', 'cachoeiro de itapemirim', 'dourados', 'rondonopolis', 'chapeco', 'criciuma', 'itajai', 'novo hamburgo', 'canoas', 'santa maria', 'passo fundo', 'gramado', 'buzios', 'sampa', 'floripa', 'bh', 'armacao dos buzios']);
// nomes de município que também são palavra comum ou nome de pessoa: só valem com UF ao lado ou "cidade de X"
const COMUNS = new Set(['natal', 'vitoria', 'esperanca', 'bonito', 'paraiso', 'alegre', 'central', 'cruz', 'formosa', 'gloria', 'saudade', 'liberdade', 'marilia', 'iracema', 'valenca', 'barra', 'serra', 'feliz', 'pinheiro', 'oliveira', 'cardoso', 'barbosa', 'andrade', 'sousa', 'souza', 'cristal', 'colorado', 'caridade', 'harmonia', 'uniao', 'progresso', 'boa vista', 'america', 'brasil', 'mundo novo', 'planalto', 'aurora', 'vera', 'ouro', 'prata', 'diamante', 'jardim', 'triunfo', 'vitoria', 'cascavel', 'ipanema', 'tijuca', 'flores', 'rosario', 'mirador', 'lagoa', 'palmeira', 'palmeiras', 'patos', 'pedras', 'campo grande', 'bom jesus', 'santa cecilia', 'belem', 'gaucha', 'sertao', 'luz', 'pe', 'cha', 'rio branco', 'monte alegre', 'sao francisco', 'santa rita', 'santo antonio', 'sao jose', 'sao joao', 'sao pedro', 'sao paulo das missoes', 'sao bento', 'divino', 'senador', 'presidente', 'governador', 'mesquita', 'nova', 'vale', 'sul brasil', 'lindoia', 'joia', 'tupa', 'luzia', 'iguape', 'amparo', 'turvo', 'mar', 'macuco', 'quatis', 'paty']);
// bairros e casas de show -> cidade (texto real cita o lugar)
const LUGARES = [
  // São Paulo capital
  [/\b(vila madalena|grajau|tatuape|bixiga|bela vista|barra funda|anhembi|itaquera|capao redondo|santa cecilia|perdizes|pompeia|vila mariana|mooca|penha de franca|casa verde|vila matilde|brasilandia|campo limpo|parelheiros|cidade tiradentes|guaianases|jabaquara|santana de sao paulo|pinheiros|consolacao|liberdade em sao paulo|avenida paulista|centro de sao paulo|zona (leste|norte|sul|oeste) de sao paulo|zona (leste|norte|sul|oeste) de sp|vale do anhangabau|parque ibirapuera|ibirapuera|largo da batata)\b/, 'São Paulo', 'SP'],
  [/\b(casa de francisca|espaco unimed|allianz parque|tokio marine hall|vibra sao paulo|audio club|bourbon street|centro cultural olido|galeria olido|sesc pompeia|sesc belenzinho|sesc vila mariana|sesc 24 de maio|sesc pinheiros|sesc consolacao|sesc santo amaro|sesc itaquera|sesc interlagos|sesc ipiranga|theatro municipal de sao paulo|teatro bradesco|teatro renault|neo quimica arena|morumbis|estadio do morumbi|arena anhembi|sambodromo do anhembi|terra sp|carioca club|samba da vela|comunidade samba da maria zelia|vila maria)\b/, 'São Paulo', 'SP'],
  // Rio de Janeiro capital
  [/\b(madureira|sapucai|marques de sapucai|pedra do sal|cacique de ramos|renascenca clube|oswaldo cruz|copacabana|ipanema|leblon|tijuca|vila isabel|jacarepagua|barra da tijuca|recreio dos bandeirantes|meier|bangu|campo grande \(rj\)|lapa carioca|arcos da lapa|centro do rio|zona (norte|sul|oeste) do rio|ilha do governador|praca maua|boulevard olimpico|cidade do samba|parque madureira|parkjacarepagua|park jacarepagua|engenho de dentro|realengo|irajá|iraja|penha circular|ramos|olaria|santa teresa|gloria \(rj\)|botafogo|flamengo \(bairro\)|laranjeiras|praca xv)\b/, 'Rio de Janeiro', 'RJ'],
  [/\b(vivo rio|qualistage|circo voador|fundicao progresso|cidade das artes|jeunesse arena|farmasi arena|theatro municipal do rio|teatro riachuelo rio|maracana|engenhao|nilton santos|beco do rato|trapiche gamboa|bip bip|clube renascenca)\b/, 'Rio de Janeiro', 'RJ'],
  [/\b(mineirinho|mineirao|praca da estacao)\b/, 'Belo Horizonte', 'MG'], [/\b(arena fonte nova|concha acustica|teatro castro alves|pelourinho|rio vermelho em salvador)\b/, 'Salvador', 'BA'],
  [/\b(classic hall|marco zero do recife)\b/, 'Recife', 'PE'], [/\b(arena da amazonia|teatro amazonas)\b/, 'Manaus', 'AM'], [/\b(mane garrincha|arena bsb|clube do choro)\b/, 'Brasília', 'DF'], [/\b(baixo augusta|d-?edge sp|d-?edge sao paulo|club d-?edge)\b/, 'São Paulo', 'SP'], [/\b(beira-?rio|gasometro)\b/, 'Porto Alegre', 'RS'],
  [/\b(pepsi on stage|auditorio araujo vianna)\b/, 'Porto Alegre', 'RS'], [/\b(pedreira paulo leminski|opera de arame)\b/, 'Curitiba', 'PR'],
];
// escolas de samba: indicam a cidade da escola, mas valem menos que "em <cidade>" (a escola pode se apresentar em outro lugar)
const ESCOLAS = [[/\b(vai-?vai|mancha verde|gavioes da fiel|rosas de ouro|mocidade alegre|imperio de casa verde|tom maior|academicos do tatuape|x-?9 paulistana|dragoes da real|aguia de ouro|camisa verde e branco|nene de vila matilde)\b/, 'São Paulo', 'SP'], [/\b(mangueira|portela|salgueiro|imperatriz leopoldinense|mocidade independente|unidos da tijuca|paraiso do tuiuti|sao clemente|estacio de sa|uniao da ilha)\b/, 'Rio de Janeiro', 'RJ'], [/\b(beija-?flor)\b/, 'Nilópolis', 'RJ'], [/\b(grande rio)\b(?! do (sul|norte))/, 'Duque de Caxias', 'RJ'], [/\bviradouro\b/, 'Niterói', 'RJ']];
// exterior: cidade -> país (e país sozinho)
const FORA = [
  [/\blas vegas\b/, 'Las Vegas', 'EUA'], [/\b(nova york|new york|nyc|brooklyn|manhattan)\b/, 'Nova York', 'EUA'], [/\b(los angeles)\b/, 'Los Angeles', 'EUA'], [/\bmiami\b/, 'Miami', 'EUA'], [/\b(chicago)\b/, 'Chicago', 'EUA'], [/\b(nashville)\b/, 'Nashville', 'EUA'], [/\b(atlanta)\b/, 'Atlanta', 'EUA'], [/\b(houston)\b/, 'Houston', 'EUA'], [/\b(boston)\b/, 'Boston', 'EUA'], [/\b(san francisco)\b/, 'San Francisco', 'EUA'],
  [/\b(lisboa|lisbon)\b/, 'Lisboa', 'Portugal'], [/\b(porto, portugal|cidade do porto)\b/, 'Porto', 'Portugal'], [/\b(londres|london)\b/, 'Londres', 'Reino Unido'], [/\b(manchester)\b/, 'Manchester', 'Reino Unido'], [/\b(paris)\b/, 'Paris', 'França'], [/\b(berlim|berlin)\b/, 'Berlim', 'Alemanha'], [/\b(madri|madrid)\b/, 'Madri', 'Espanha'], [/\b(barcelona)\b/, 'Barcelona', 'Espanha'], [/\b(ibiza)\b/, 'Ibiza', 'Espanha'], [/\b(amsterda|amsterdam)\b/, 'Amsterdã', 'Holanda'], [/\b(roma|rome)\b/, 'Roma', 'Itália'], [/\b(milao|milan)\b/, 'Milão', 'Itália'],
  [/\b(toquio|tokyo|asakusa)\b|浅草|東京/, 'Tóquio', 'Japão'], [/\b(osaka)\b|大阪/, 'Osaka', 'Japão'], [/\b(kobe)\b|神戸/, 'Kobe', 'Japão'], [/\b(nagoya)\b|名古屋/, 'Nagoya', 'Japão'], [/\b(yokohama)\b|横浜/, 'Yokohama', 'Japão'],
  [/\b(buenos aires)\b/, 'Buenos Aires', 'Argentina'], [/\b(montevideu|montevideo)\b/, 'Montevidéu', 'Uruguai'], [/\b(santiago do chile|santiago de chile)\b/, 'Santiago', 'Chile'], [/\b(cidade do mexico|mexico city)\b/, 'Cidade do México', 'México'], [/\b(havana)\b/, 'Havana', 'Cuba'], [/\b(luanda)\b/, 'Luanda', 'Angola'], [/\b(maputo)\b/, 'Maputo', 'Moçambique'], [/\b(praia, cabo verde)\b/, 'Praia', 'Cabo Verde'], [/\b(toronto)\b/, 'Toronto', 'Canadá'], [/\b(montreal)\b/, 'Montreal', 'Canadá'], [/\b(sydney)\b/, 'Sydney', 'Austrália'], [/\b(lagos)\b(?= ,? ?nig| \(nig)/, 'Lagos', 'Nigéria'], [/\b(johannesburg|joanesburgo)\b/, 'Joanesburgo', 'África do Sul'],
];
const PAISES = [[/\b(portugal|portugues(es)?)\b/, 'Portugal'], [/\b(japao|japan|japones(a|es)?)\b|サンバ/, 'Japão'], [/\b(estados unidos|eua|usa|united states)\b/, 'EUA'], [/\b(reino unido|inglaterra|england|uk)\b/, 'Reino Unido'], [/\b(franca|france)\b/, 'França'], [/\b(alemanha|germany)\b/, 'Alemanha'], [/\b(espanha|spain)\b/, 'Espanha'], [/\b(italia|italy)\b/, 'Itália'], [/\b(argentina)\b/, 'Argentina'], [/\b(angola)\b/, 'Angola'], [/\b(mocambique)\b/, 'Moçambique'], [/\b(cabo verde)\b/, 'Cabo Verde'], [/\b(mexico)\b/, 'México'], [/\b(canada)\b/, 'Canadá'], [/\b(africa do sul|south africa)\b/, 'África do Sul'], [/\b(nigeria)\b/, 'Nigéria'], [/\b(holanda|netherlands)\b/, 'Holanda'], [/\b(cuba)\b/, 'Cuba'], [/\b(colombia)\b/, 'Colômbia'], [/\b(australia)\b/, 'Austrália'], [/\b(coreia do sul|south korea)\b/, 'Coreia do Sul'], [/\b(suica|switzerland)\b/, 'Suíça'], [/\b(suecia|sweden)\b/, 'Suécia'], [/\b(belgica|belgium)\b/, 'Bélgica'], [/\b(irlanda|ireland)\b/, 'Irlanda'], [/\b(chile)\b/, 'Chile'], [/\b(peru)\b(?! de)/, 'Peru'], [/\b(uganda)\b/, 'Uganda'], [/\b(venezuela)\b/, 'Venezuela'], [/\b(uruguai|uruguay)\b/, 'Uruguai'], [/\b(paraguai|paraguay)\b/, 'Paraguai'], [/\b(china)\b/, 'China'], [/\b(india)\b/, 'Índia'], [/\b(israel)\b/, 'Israel'], [/\b(dubai|emirados)\b/, 'Emirados Árabes']];
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const INSTIT = /(municipal|prefeitura|c[aâ]mara|cidade|munic[ií]pio|secretaria|governo|festival|carnaval|teatro|sesc|universidade|regi[aã]o|zona|centro|porto|praia|arena|escola|samba|r[eé]veillon|festa|feira|orquestra|bloco|estado|interior|litoral|capital|baixada|grande|tv|r[aá]dio|jornal|di[aá]rio|gazeta|correio|folha|tribuna|portal|not[ií]cias|agenda|virada|semana|anivers[aá]rio)$/i;
const PREP = /(?:^|\s)(em|no|na|de|da|do|a|à|ao|para|pela|pelo|cidade de|municipio de|capital|interior de|litoral de)\s*$/i;

// procura municípios num trecho de texto (texto original, com maiúsculas)
function cidadesNoTexto(t, peso, origem, out) {
  if (!t) return;
  const re = /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]+(?:\s+(?:(?:de|da|do|dos|das|d'|e)\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]+){0,4})/g; let m;
  while ((m = re.exec(t))) {
    const seq = m[1]; const depois = t.slice(m.index + seq.length, m.index + seq.length + 8); const antes = t.slice(Math.max(0, m.index - 20), m.index);
    const ufM = depois.match(/^\s*(?:[-–/,(]\s*|\s)([A-Z]{2})\b/); const ufTxt = ufM && UFS.has(ufM[1]) ? ufM[1] : null;
    // tenta a sequência inteira e também o fim dela ("Festival em Cabo Frio" -> "Cabo Frio")
    // nome de escola de samba ("Salgueiro", "Imperatriz Leopoldinense") não é o município homônimo
    if (ESCOLAS.some(([re]) => re.test(sem(seq))) && !ufTxt) continue;
    const palavras = seq.split(/\s+/); let achou = null;
    for (let a = 0; a < palavras.length && !achou; a++) { const cand = palavras.slice(a).join(' '); const k = sem(cand); const lista = POR_NOME.get(k); if (!lista) continue;
      if (a > 0) { const con = palavras[a - 1]; const umaPalavra = !cand.includes(' ');
        if (!/^(de|da|do|dos|das)$/i.test(con)) { if (!ufTxt) continue; }
        // "Chiquinho dos Santos" é nome de pessoa; "Prefeitura de Santos" é cidade
        else if (umaPalavra && !ufTxt && !INSTIT.test(palavras.slice(0, a - 1).join(' '))) continue; }
      achou = { cand, k, lista, ini: a === 0 ? antes : palavras.slice(0, a).join(' ') + ' ' };
    }
    // começo da sequência ("Manaus Matheus Pessanha" -> "Manaus"): só para capital ou cidade grande
    for (let b = palavras.length - 1; b >= 1 && !achou; b--) { const cand = palavras.slice(0, b).join(' '); const k = sem(cand); const lista = POR_NOME.get(k); if (!lista || COMUNS.has(k)) continue; if (!(GRANDES.has(k) || lista.some(c => c.cap)) || !PREP.test(antes)) continue; achou = { cand, k, lista, ini: antes }; }
    if (!achou) continue; const { k, lista } = achou;
    const prep = PREP.test(achou.ini) || /^(em|no|na)$/i.test(palavras[palavras.length - achou.cand.split(/\s+/).length - 1] || '');
    let esc = null, forca = 0;
    if (ufTxt) { esc = lista.find(c => c.uf === ufTxt); if (esc) forca = 3; }
    if (!esc) { if (COMUNS.has(k)) { if (!/cidade de\s*$|municipio de\s*$/i.test(achou.ini)) continue; }
      const caps = lista.filter(c => c.cap); if (caps.length === 1) { esc = caps[0]; forca = 2; } else if (lista.length === 1 && (GRANDES.has(k) || prep || k.includes(' '))) { esc = lista[0]; forca = GRANDES.has(k) ? 2 : prep ? 1.5 : 1; }
      if (esc && /(?:^|\s)(em|no|na|a|à|ao)\s*$/i.test(achou.ini)) forca = Math.max(forca, 2.5); else if (lista.length > 1 && GRANDES.has(k)) { esc = lista.sort((a, b) => b.ddd - a.ddd)[0]; forca = 1; } }
    if (!esc) continue;
    if (achou.ini && INSTIT.test(achou.ini.trim().replace(/\s+(de|da|do|dos|das)$/i, ''))) forca = Math.max(forca, 3);
    out.push({ cidade: esc.nome, uf: esc.uf, pais: 'Brasil', peso: peso * forca, origem: origem + (ufTxt ? ' (com UF)' : ''), pos: m.index });
  }
  // "no Rio" / "do Rio" = Rio de Janeiro (quando não é nome de rio)
  const rr = /\b(no|do|ao|pelo) Rio\b(?! (de Janeiro|Grande|Branco|Negro|Verde|Claro|Preto|S[aã]o Francisco|Tiet[eê]|Amazonas|Doce|Paran[aá]|de Contas|Pardo|Vermelho|Tapaj[oó]s|Xingu|Madeira))/.exec(t);
  if (rr) out.push({ cidade: 'Rio de Janeiro', uf: 'RJ', pais: 'Brasil', peso: peso * 1.5, origem: origem + ' ("' + rr[0] + '")', pos: rr.index });
  const s = sem(t);
  for (const [re, c, uf] of LUGARES) { const mm = s.match(re); if (mm) out.push({ cidade: c, uf, pais: 'Brasil', peso: peso * 2, origem: origem + ' (lugar: ' + mm[0] + ')', pos: mm.index }); }
  for (const [re, c, uf] of ESCOLAS) { const mm = s.match(re); if (mm) out.push({ cidade: c, uf, pais: 'Brasil', peso: peso * 1.3, origem: origem + ' (escola de samba: ' + mm[0] + ')', pos: mm.index }); }
  for (const [re, c, p] of FORA) { const mm = s.match(re) || t.match(re); if (mm) out.push({ cidade: c, uf: '', pais: p, peso: peso * 2, origem: origem + ' (' + mm[0] + ')', pos: mm.index }); }
}
const ESTADOS = [['acre', 'AC'], ['alagoas', 'AL'], ['amapa', 'AP'], ['amazonas', 'AM'], ['bahia', 'BA'], ['ceara', 'CE'], ['distrito federal', 'DF'], ['espirito santo', 'ES'], ['goias', 'GO'], ['maranhao', 'MA'], ['mato grosso do sul', 'MS'], ['mato grosso', 'MT'], ['minas gerais', 'MG'], ['paraiba', 'PB'], ['parana', 'PR'], ['pernambuco', 'PE'], ['piaui', 'PI'], ['rio grande do norte', 'RN'], ['rio grande do sul', 'RS'], ['rondonia', 'RO'], ['roraima', 'RR'], ['santa catarina', 'SC'], ['sergipe', 'SE'], ['tocantins', 'TO'], ['estado de sao paulo', 'SP'], ['estado do rio', 'RJ'], ['interior paulista', 'SP'], ['interior de sao paulo', 'SP'], ['litoral paulista', 'SP'], ['estado do para', 'PA']];
function estadoNoTexto(t) { const s = ' ' + sem(t) + ' '; for (const [n, uf] of ESTADOS) { const m = s.match(new RegExp('\\b(n[oa]s?|d[oa]s?|em|para|pelo|pela)\\s+' + n + '\\b')); if (m) return { uf, pista: m[0].trim() }; } const m = String(t).match(/\b(?:no|na|do|da|de|em)\s+(SP|RJ|ES|BA|MG|PR|SC|RS|PE|CE|PA|AM|GO|MT|MS|PB|RN|AL|SE|PI|MA|TO|RO|AC|AP|RR|DF)\b/); return m ? { uf: m[1], pista: m[0] } : null; }
function paisNoTexto(t) { const s = sem(t); for (const [re, p] of PAISES) { const m = s.match(re) || String(t).match(re); if (m) return { pais: p, pista: m[0] }; } return null; }

// ===== resolver link do Google Notícias para o link real do veículo =====
const simil0 = (a, b) => { const A = new Set(sem(a).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2)), B = new Set(sem(b).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2)); if (!A.size || !B.size) return 0; let c = 0; for (const w of A) if (B.has(w)) c++; return c / Math.max(A.size, B.size); };
const simil = (cand, alvo) => { const W = s => sem(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2); const A = W(alvo), B = new Set(W(cand)); if (!A.length || !B.size || B.size > A.length * 2.5 + 4) return 0; return A.filter(w => B.has(w)).length / A.length; };
async function busca(url, ms = 10000, max = 700000) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status);
  const ct = r.headers.get('content-type') || ''; const rd = r.body.getReader(); const ch = []; let n = 0; while (n < max) { const { done, value } = await rd.read(); if (done) break; ch.push(value); n += value.length; } try { await rd.cancel(); } catch {}
  const buf = Buffer.concat(ch); const cs = (ct.match(/charset=([^;]+)/i) || buf.subarray(0, 400).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let x; try { x = new TextDecoder(cs.trim().toLowerCase()).decode(buf); } catch { x = buf.toString('utf8'); } return { x, url: r.url, ct };
}
const feedsDom = new Map(); const homes = new Map(); const smaps = new Map();
const home = dom => { if (!homes.has(dom)) homes.set(dom, busca('https://' + dom + '/', 9000, 2500000)); return homes.get(dom); };
const sitemaps = dom => { if (!smaps.has(dom)) smaps.set(dom, (async () => { const out = []; let lista = [];
  try { const { x } = await busca('https://' + dom + '/robots.txt', 6000); lista = [...x.matchAll(/^sitemap:\s*(\S+)/gim)].map(m => m[1]); } catch {}
  for (const p of ['/news-sitemap.xml', '/sitemap-news.xml', '/sitemap_news.xml']) lista.push('https://' + dom + p); if (!lista.length) lista.push('https://' + dom + '/sitemap.xml');
  for (const sm of [...new Set(lista)].slice(0, 6)) { try { const { x } = await busca(sm, 8000, 3000000);
      if (/<sitemapindex/i.test(x)) { const filhos = [...x.matchAll(/<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>(?:[\s\S]*?<lastmod>([\s\S]*?)<\/lastmod>)?[\s\S]*?<\/sitemap>/g)].map(m => ({ u: ent(m[1]).trim(), d: m[2] || '' }));
        const rec = filhos.filter(f => /news|post|noticia|materia|artigo|2026/i.test(f.u)).sort((a, b) => (b.d || b.u).localeCompare(a.d || a.u)).slice(0, 2); out.push(...rec.map(f => f.u)); }
      else if (/<urlset/i.test(x)) out.push(sm); } catch {} if (out.length >= 3) break; }
  return [...new Set(out)].slice(0, 3); })()); return smaps.get(dom); };
async function feedDoVeiculo(dom) {
  if (feedsDom.has(dom)) return feedsDom.get(dom);
  const p = (async () => { for (const path of ['/feed/', '/rss', '/feed', '/rss.xml']) { try { const { x } = await busca('https://' + dom + path, 8000, 1500000); if (!/<(item|entry)[\s>]/.test(x)) continue;
    return (x.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) || []).map(b => { const t = (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]; let l = (b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || (b.match(/<link[^>]*href=["']([^"']+)/i) || [])[1]; const c = (b.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) || b.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]; return { t: txt(t), l: ent(l || '').trim(), c: c || '' }; }); } catch {} } return []; })();
  feedsDom.set(dom, p); return p;
}
async function resolver(i) {
  // 1) RSS do próprio veículo
  if (i.dom && !/google|instagram|facebook|youtube/.test(i.dom)) {
    const f = await feedDoVeiculo(i.dom); const b = f.map(e => ({ e, s: simil(e.t, i.title) })).sort((a, b) => b.s - a.s)[0];
    if (b && b.s >= 0.7 && /^https?:/.test(b.e.l)) return { link: b.e.l, html: b.e.c && b.e.c.length > 400 ? b.e.c : '', via: 'RSS do veículo' };
    // 2) busca pública do WordPress do veículo
    try { const q = i.title.split(/\s+/).slice(0, 8).join(' ');
      const { x } = await busca('https://' + i.dom + '/wp-json/wp/v2/posts?per_page=5&_fields=link,title,content&search=' + encodeURIComponent(q), 9000, 3000000);
      const arr = JSON.parse(x); const best = arr.map(p => ({ p, s: simil(txt(p.title && p.title.rendered), i.title) })).sort((a, b) => b.s - a.s)[0];
      if (best && best.s >= 0.7) return { link: best.p.link, html: (best.p.content && best.p.content.rendered) || '', via: 'busca WordPress do veículo' };
    } catch {}
  }
  // 2b) feed de busca do WordPress (?s=...&feed=rss2), público
  if (i.dom && !/google|instagram|facebook|youtube|youtu\.be/.test(i.dom)) { try { const { x } = await busca('https://' + i.dom + '/?feed=rss2&s=' + encodeURIComponent(i.title.split(/\s+/).slice(0, 8).join(' ')), 9000, 3000000);
    for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const t = txt((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const l = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim(); const c = (b.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || [])[1] || ''; if (simil(t, i.title) >= 0.8 && /^https?:/.test(l)) return { link: l, html: c.length > 400 ? c : '', via: 'busca WordPress do veículo' }; } } catch {} }
  // 3) RSS público do Bing Notícias com o título exato
  try { const { x } = await busca('https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent('"' + i.title.slice(0, 120) + '"'), 9000);
    for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const t = txt((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const l = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''); if (simil(t, i.title) < 0.7) continue;
      let real = l; try { real = new URL(l).searchParams.get('url') || l; } catch {} if (/^https?:/.test(real) && !/bing\.com/.test(real)) return { link: real, html: '', via: 'Bing Notícias (título exato)' }; }
  } catch {}
  // 5) página inicial do veículo: link cujo texto ou endereço bate com o título
  const slugSim = u => { try { return simil(decodeURIComponent(new URL(u).pathname).replace(/[-_/]+/g, ' ').replace(/\.\w+$/, ''), i.title); } catch { return 0; } };
  if (i.dom && !/google|instagram|facebook|youtube|youtu\.be/.test(i.dom)) {
    try { const { x, url: base } = await home(i.dom);
      for (const m of x.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,600}?)<\/a>/gi)) { let u; try { u = new URL(ent(m[1]), base).href; } catch { continue; } const t = txt(m[2]);
        if ((t.length > 20 && simil(t, i.title) >= 0.8) || slugSim(u) >= 0.75) return { link: u, html: '', via: 'página inicial do veículo' }; } } catch {}
    // 6) sitemaps públicos do veículo (robots.txt -> sitemap de notícias / posts mais recentes)
    try { for (const sm of await sitemaps(i.dom)) { const { x } = await busca(sm, 9000, 4000000);
        for (const b of x.match(/<url>[\s\S]*?<\/url>/g) || []) { const loc = ent((b.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1] || '').trim(); const nt = txt((b.match(/<news:title>([\s\S]*?)<\/news:title>/) || [])[1] || '');
          if ((nt && simil(nt, i.title) >= 0.8) || slugSim(loc) >= 0.75) return { link: loc, html: '', via: 'sitemap do veículo' }; } } } catch {}
  }
  // 3b) Bing Notícias com as palavras do título (sem aspas), aceita só título equivalente
  try { const { x } = await busca('https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent(i.title.slice(0, 120)), 9000);
    for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const t = txt((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const l = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''); if (simil(t, i.title) < 0.85) continue;
      let real = l; try { real = new URL(l).searchParams.get('url') || l; } catch {} if (/^https?:/.test(real) && !/bing\.com/.test(real)) return { link: real, html: '', via: 'Bing Notícias (título exato)' }; } } catch {}
  // 4) RSS público da busca web do Bing com o título exato (aceita só se o título bater e o domínio for o do veículo)
  try { const { x } = await busca('https://www.bing.com/search?format=rss&q=' + encodeURIComponent('"' + i.title.slice(0, 110) + '"'), 9000);
    for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const t = txt((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const l = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim(); let h = ''; try { h = new URL(l).hostname.replace(/^www\./, ''); } catch {}
      if (simil(t, i.title) >= 0.8 && h && (!i.dom || h.endsWith(i.dom.replace(/^www\./, '')) || i.dom.endsWith(h))) return { link: l, html: '', via: 'Bing busca web (título exato)' }; } } catch {}
  return null;
}

// ===== ler a matéria e achar a cidade =====
const PAYWALL_DOM = /(^|\.)(folha\.uol\.com\.br|estadao\.com\.br|oglobo\.globo\.com|valor\.globo\.com|nytimes\.com|ft\.com|wsj\.com|economist\.com|bloomberg\.com|veja\.abril\.com\.br|jota\.info)$/;
function lerPagina(html) {
  const ld = []; for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { ld.push(JSON.parse(m[1].trim())); } catch {} }
  const flat = []; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); flat.push(o); if (o['@graph']) walk(o['@graph']); };
  ld.forEach(walk);
  const art = flat.find(o => /NewsArticle|Article|BlogPosting|ReportageNewsArticle/i.test([].concat(o['@type'] || []).join(' ')));
  const pago = flat.some(o => o.isAccessibleForFree === false || o.isAccessibleForFree === 'False' || o.isAccessibleForFree === 'false');
  // só o local DO FATO: contentLocation da matéria e location de Evento. locationCreated (onde a redação fica) e endereço do veículo não contam
  const locs = []; for (const o of flat) { const tipo = [].concat(o['@type'] || []).join(' '); const ks = /Event/i.test(tipo) ? ['location'] : /Article|BlogPosting/i.test(tipo) ? ['contentLocation'] : []; for (const k of ks) { const v = o[k]; for (const L of [].concat(v || [])) { if (!L) continue; const a = L.address || {}; const s = [L.name, typeof a === 'string' ? a : [a.streetAddress, a.addressLocality, a.addressRegion, a.addressCountry && (a.addressCountry.name || a.addressCountry)].filter(Boolean).join(', ')].filter(Boolean).join(' - '); if (s) locs.push(s); } } }
  const meta = []; for (const k of ['og:locality', 'geo.placename', 'geo.region', 'ICBM']) { const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']+)', 'i')); if (m) meta.push(ent(m[1])); }
  let corpo = art && typeof art.articleBody === 'string' ? art.articleBody : '';
  let paras = [];
  if (corpo.length > 200) paras = corpo.split(/\n+|(?<=\.)\s{2,}/).map(s => s.trim()).filter(Boolean);
  else { const pz = z => [...z.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => txt(m[1])).filter(p => p.length > 40 && !/leia tamb[eé]m|veja tamb[eé]m|siga o|inscreva-se|newsletter|cookies|todos os direitos/i.test(p)); const zona = (html.match(/<article[\s\S]*?<\/article>/i) || [html])[0]; paras = pz(zona); if (paras.length < 3) paras = pz(html); if (false) paras = [...zona.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => txt(m[1])).filter(p => p.length > 40 && !/leia tamb[eé]m|veja tamb[eé]m|siga o|inscreva-se|newsletter|cookies|todos os direitos/i.test(p)); }
  const desc = (html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]*content=["']([^"']+)/i) || [])[1];
  return { pago, locs, meta, paras: paras.slice(0, 18), desc: desc ? ent(desc) : '' };
}
function decidir(cands) {
  if (!cands.length) return null; const soma = new Map();
  // cada trecho (título, parágrafo 1, parágrafo 2...) conta uma vez por cidade: biografia citada várias vezes não vence o local do fato
  const porTrecho = new Map(); for (const c of cands) { const k = c.cidade + '|' + c.uf + '|' + c.pais + '|' + c.origem.replace(/ \(.*$/, ''); const o = porTrecho.get(k); if (!o || c.peso > o.peso) porTrecho.set(k, c); }
  for (const c of porTrecho.values()) { const k = c.cidade + '|' + c.uf + '|' + c.pais; const s = soma.get(k) || { ...c, total: 0, origens: [] }; s.total += c.peso; s.origens.push(c.origem); s.pos = Math.min(s.pos, c.pos); soma.set(k, s); }
  const ord = [...soma.values()].sort((a, b) => b.total - a.total || a.pos - b.pos); return ord[0].total >= 2 ? ord[0] : null;
}
function datelineDe(p) { const m = String(p || '').match(/^\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{2,40}|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ']+(?: (?:de|do|da|dos|das) [A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ']+| [A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ']+){0,3})(?:\s*\(([A-Z]{2})\)|\/([A-Z]{2}))?\s*[-–—]\s/); if (!m) return ''; const nome = m[1].trim(); const fix = nome === nome.toUpperCase() ? nome.toLowerCase().replace(/(^|\s)(\S)/g, (a, b, c) => b + (/(de|do|da|dos|das)/.test(c + a.slice(2)) ? c : c.toUpperCase())) : nome; return fix + ((m[2] || m[3]) ? ' - ' + (m[2] || m[3]) : ''); }

// ===== cache e execução =====
const CF = 'musica-locais.json'; let CACHE = {}; try { CACHE = JSON.parse(fs.readFileSync(CF, 'utf8')); } catch {}
export async function localizarTodos(itens, { prazoMs = 6 * 60e3, paralelo = 8 } = {}) {
  const t0 = Date.now(); const est = { titulo: 0, cache: 0, rssVeiculo: 0, wordpress: 0, bing: 0, bingWeb: 0, homeVeiculo: 0, sitemap: 0, direto: 0, materia: 0, jsonld: 0, abertura: 0, corpo: 0, semLink: 0, paywall: 0, erro: 0, loginWall: 0, semCidadeNoTexto: 0, fila: 0 };
  // 1) título e resumo do próprio item
  const expo = (t, out) => { for (const m of String(t || '').matchAll(/\b(?:Expo|Festa de |Feira de )([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ÿ]{4,})\b/g)) { const k = sem(m[1]); const l = POR_NOME.get(k); if (l && l.length === 1 && !COMUNS.has(k)) out.push({ cidade: l[0].nome, uf: l[0].uf, pais: 'Brasil', peso: 6, origem: 'título ("' + m[0] + '")', pos: m.index }); } };
  for (const i of itens) { const c = []; expo(i.title, c); cidadesNoTexto(i.title, 3, 'título', c); cidadesNoTexto(i.sum, 1.5, 'resumo', c); const d = decidir(c); if (d) { Object.assign(i, { localScore: d.total + 2, cidade: d.cidade, uf: d.uf, pais: d.pais, localComo: 'título/resumo: ' + d.origens.slice(0, 2).join('; ') }); est.titulo++; } }
  // 2) matéria real para quem ainda não tem cidade
  const fila = itens.filter(i => !i.cidade); let idx = 0;
  const um = async i => {
    const ck = i.link; if (CACHE[ck] && Date.now() - CACHE[ck].t < 7 * 86400e3) { Object.assign(i, CACHE[ck].r); est.cache++; if (i.cidade) est.materia++; return; }
    if (Date.now() - t0 > prazoMs) { i.semCidadeMotivo = 'fila: será lida na próxima rodada (limite de tempo)'; est.fila++; return; }
    const r = {}; let link = i.link, html = '', via = '';
    try {
      if (/instagram\.com|facebook\.com|tiktok\.com/.test(i.dom)) { r.semCidadeMotivo = 'rede social que exige login (' + i.dom + ')'; est.loginWall++; }
      else {
        if (/news\.google\.com/.test(link)) { const z = await resolver(i); if (z) { link = z.link; html = z.html; via = z.via; est[{ 'RSS do veículo': 'rssVeiculo', 'busca WordPress do veículo': 'wordpress', 'Bing Notícias (título exato)': 'bing', 'Bing busca web (título exato)': 'bingWeb', 'página inicial do veículo': 'homeVeiculo', 'sitemap do veículo': 'sitemap' }[z.via]]++; } else { r.semCidadeMotivo = 'link do Google Notícias sem caminho público para o link real (RSS do veículo, WordPress e Bing não acharam)'; est.semLink++; } }
        else { via = 'link direto'; est.direto++; }
        if (!r.semCidadeMotivo) {
          r.linkReal = link; let host = ''; try { host = new URL(link).hostname.replace(/^www\./, ''); } catch {}
          if (PAYWALL_DOM.test(host)) { r.semCidadeMotivo = 'veículo com paywall (' + host + '), não lido'; est.paywall++; }
          else {
            let pg = { pago: false, locs: [], meta: [], paras: [], desc: '' };
            if (!html || html.length < 600) { const b = await busca(link, 10000); pg = lerPagina(b.x); } else { pg.paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => txt(m[1])).filter(p => p.length > 40).slice(0, 18); if (!pg.paras.length) pg.paras = [txt(html).slice(0, 3000)]; }
            if (pg.pago) { r.semCidadeMotivo = 'matéria marcada como paga (isAccessibleForFree=false), não lida'; est.paywall++; }
            else {
              const c = []; for (const L of pg.locs) cidadesNoTexto(L, 5, 'schema.org', c); for (const M of pg.meta) cidadesNoTexto(M, 4, 'meta geo', c);
              const dl = datelineDe(pg.paras[0]); if (dl) cidadesNoTexto(dl, 5, 'linha de abertura "' + dl + '"', c);
              pg.paras.slice(0, 3).forEach((p, n) => cidadesNoTexto(p, [3, 2, 1.5][n], 'parágrafo ' + (n + 1), c)); cidadesNoTexto(pg.desc, 2, 'descrição da página', c);
              pg.paras.slice(3).forEach((p, n) => cidadesNoTexto(p, 0.7, 'parágrafo ' + (n + 4), c));
              const d = decidir(c);
              if (d) { Object.assign(r, { localScore: d.total, cidade: d.cidade, uf: d.uf, pais: d.pais, localComo: 'matéria (' + via + '): ' + d.origens.slice(0, 2).join('; ') }); est.materia++; if (d.origens.some(o => /schema/.test(o))) est.jsonld++; else if (d.origens.some(o => /abertura|parágrafo 1|descri/.test(o))) est.abertura++; else est.corpo++; }
              else { const todo = [pg.desc, ...pg.paras].join(' '); const p = paisNoTexto(i.title + ' ' + todo);
                if (p && p.pais !== 'Brasil' && !/\b(brasil|brasileir)/i.test(i.title)) Object.assign(r, { pais: p.pais, localComo: 'matéria (' + via + '): país citado "' + p.pista + '", cidade não citada' });
                const est2 = estadoNoTexto(i.title + ' ' + [pg.desc, ...pg.paras.slice(0, 4)].join(' ')); if (est2) Object.assign(r, { ufSoh: est2.uf, ufPista: est2.pista });
                r.semCidadeMotivo = pg.paras.length ? 'matéria lida (' + pg.paras.length + ' parágrafos, ' + via + '), nenhuma cidade citada no texto' : 'página lida, mas sem texto de matéria acessível (' + via + ')'; r.nacional = pg.paras.length > 0; est.semCidadeNoTexto++; }
            }
          }
        }
      }
    } catch (e) { r.semCidadeMotivo = 'erro ao abrir a matéria: ' + e.message; est.erro++; }
    Object.assign(i, r); if (!/^fila|^erro/.test(r.semCidadeMotivo || '')) CACHE[ck] = { t: Date.now(), r };
  };
  await Promise.all(Array.from({ length: paralelo }, async () => { while (idx < fila.length) await um(fila[idx++]); }));
  // 3) MESMO FATO em outro veículo com link direto (Bing Notícias, público): quando a matéria original não abre
  //    (link do Google sem caminho público, paywall, 403, página sem texto), lê a matéria irmã e usa a cidade dela
  est.irmaTentou = 0; est.irmaAchou = 0;
  const fila2 = itens.filter(i => !i.cidade && !(i.pais && i.pais !== 'Brasil') && /Google Not|paywall|paga|HTTP 4|sem texto|login/.test(i.semCidadeMotivo || '')); let idx2 = 0;
  const limpo = t => String(t || '').replace(/\s+[·|–—-]\s+[^·|–—-]{2,40}$/, '').replace(/ · News ⟋ RA$/, '').trim();
  const irma = async i => {
    if (Date.now() - t0 > prazoMs + 90e3) return; const ck = 'S|' + i.link; let sib = CACHE[ck] && Date.now() - CACHE[ck].t < 3 * 86400e3 ? CACHE[ck].r : null;
    if (!sib) { sib = { lista: [] }; est.irmaTentou++;
      try { const tt = limpo(i.title); const { x } = await busca('https://www.bing.com/news/search?format=rss&setlang=pt-br&q=' + encodeURIComponent(tt.slice(0, 110)), 9000);
        for (const b of x.match(/<item>[\s\S]*?<\/item>/g) || []) { const t = txt((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]); const l = ent((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''); let real = l; try { real = new URL(l).searchParams.get('url') || l; } catch {}
          let h = ''; try { h = new URL(real).hostname.replace(/^www\./, ''); } catch { continue; }
          if (!h || /bing\.com|google\./.test(h) || PAYWALL_DOM.test(h) || (i.dom && h.endsWith(i.dom.replace(/^www\./, '')))) continue;
          const sc = Math.max(simil(t, tt), simil(tt, t)); if (sc >= 0.5) sib.lista.push({ t, l: real, h, sc }); }
        sib.lista = sib.lista.sort((a, b) => b.sc - a.sc).slice(0, 2); } catch {}
      CACHE[ck] = { t: Date.now(), r: sib }; }
    for (const s2 of sib.lista) { const ps = { title: s2.t, sum: '', link: s2.l, dom: s2.h }; await um(ps);
      if (ps.cidade && (ps.localScore || 0) >= 4 && /título|schema|abertura|parágrafo [12]\b|descri/.test(ps.localComo || '')) { Object.assign(i, { cidade: ps.cidade, uf: ps.uf, pais: ps.pais, localScore: ps.localScore, irma: { veiculo: s2.h, link: s2.l, titulo: s2.t }, localComo: 'mesmo fato em ' + s2.h + ' (achado no Bing Notícias): ' + (ps.localComo || '').replace(/^matéria \([^)]*\): /, '') }); est.irmaAchou++; return; } }
  };
  await Promise.all(Array.from({ length: 6 }, async () => { while (idx2 < fila2.length) await irma(fila2[idx2++]); }));
  for (const [k, v] of Object.entries(CACHE)) if (Date.now() - v.t > 7 * 86400e3) delete CACHE[k];
  fs.writeFileSync(CF, JSON.stringify(CACHE)); est.ms = Date.now() - t0; return est;
}
// ===== link real (direto no veículo) para TODOS os itens do Google Notícias, inclusive os já localizados pelo título =====
// mesmas rotas públicas do resolver (RSS do veículo, WordPress, Bing Notícias, página inicial, sitemap); cache de 7 dias
export async function linksReais(itens, { prazoMs = 3 * 60e3, paralelo = 8 } = {}) {
  const t0 = Date.now(); const est = { jaTinha: 0, cache: 0, achou: 0, naoAchou: 0, fila: 0 };
  const fila = itens.filter(i => /news\.google\.com/.test(i.link) && !i.linkReal); est.jaTinha = itens.filter(i => i.linkReal).length; let idx = 0;
  const um = async i => {
    const ck = 'L|' + i.link; const c = CACHE[ck];
    if (c && Date.now() - c.t < 7 * 86400e3) { est.cache++; if (c.r.linkReal) { i.linkReal = c.r.linkReal; i.linkVia = c.r.via; } return; }
    if (Date.now() - t0 > prazoMs) { est.fila++; return; }
    let z = null; try { z = await resolver(i); } catch {}
    if (z) { i.linkReal = z.link; i.linkVia = z.via; est.achou++; } else est.naoAchou++;
    CACHE[ck] = { t: Date.now(), r: z ? { linkReal: z.link, via: z.via } : {} };
  };
  await Promise.all(Array.from({ length: paralelo }, async () => { while (idx < fila.length) await um(fila[idx++]); }));
  fs.writeFileSync(CF, JSON.stringify(CACHE)); est.ms = Date.now() - t0; return est;
}
// cidade no nome do veículo regional (ex.: juicysantos.com.br, curitibacult.com.br): só capitais e cidades grandes, só domínio .br
export function cidadeDoVeiculo(dom) { if (!/\.br$/.test(dom || '')) return null; const base = sem(dom.replace(/^www\./, '').split('.')[0]).replace(/[^a-z]/g, '');
  let best = null; for (const [k, lista] of POR_NOME) { if (k.length < 5 || k.includes(' ') && false) continue; const kk = k.replace(/[^a-z]/g, ''); if (kk.length < 5 || !base.includes(kk)) continue; const c = lista.find(x => x.cap) || (GRANDES.has(k) ? lista[0] : null); if (c && (!best || kk.length > best.kk.length)) best = { ...c, kk }; }
  if (!best && /diariodorio|riodejaneiro/.test(base)) best = { nome: 'Rio de Janeiro', uf: 'RJ' };
  // município inteiro no domínio (ex.: diaadiaarapongas.com.br): nome único no IBGE, 7+ letras, não é palavra comum
  if (!best) { for (const [k, lista] of POR_NOME) { const kk = k.replace(/[^a-z]/g, ''); if (kk.length < 7 || lista.length !== 1 || COMUNS.has(k) || lista[0].alias) continue; if (base.includes(kk) && (!best || kk.length > best.kk.length)) best = { ...lista[0], kk }; } }
  // sede conhecida de veículos regionais cujo nome não traz a cidade
  if (!best) { const SEDE = { 'midiamax.com.br': ['Campo Grande', 'MS'], 'portalcorreio.com.br': ['João Pessoa', 'PB'], 'jornalpequeno.com.br': ['São Luís', 'MA'], 'paraibaonline.com.br': ['Campina Grande', 'PB'], 'wscom.com.br': ['João Pessoa', 'PB'], 'clickpb.com.br': ['João Pessoa', 'PB'] }; const d = dom.replace(/^www\./, ''); if (SEDE[d]) best = { nome: SEDE[d][0], uf: SEDE[d][1] }; }
  return best; }
// órgão público (ex.: al.ce.gov.br -> Ceará) e câmara municipal portuguesa (cm-lagos.pt -> Lagos, Portugal)
export function localDoOrgao(dom) { const d = String(dom || '').replace(/^www\./, ''); let m = d.match(/(?:^|\.)([a-z]{2})\.gov\.br$/); if (m && UFS.has(m[1].toUpperCase())) return { uf: m[1].toUpperCase(), pista: d };
  m = d.match(/^cm-([a-z-]+)\.pt$/); if (m) return { cidade: m[1].replace(/-/g, ' ').replace(/(^|\s)\S/g, x => x.toUpperCase()), pais: 'Portugal', pista: d }; return null; }
export { cidadesNoTexto, decidir, paisNoTexto, estadoNoTexto };
