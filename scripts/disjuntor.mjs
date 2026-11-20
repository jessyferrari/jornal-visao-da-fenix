// Disjuntor do ntfy (20/11): em 20/11 às 09:18 (Brasília) o ntfy respondeu 429 com Retry-After longo e cada aviso levou ~5 min
// nas 5 tentativas; 3 avisos somaram 15 min, o job estourou os 16 min e a edição daquela rodada NÃO foi publicada (buraco de 22 min).
// Agora cada robô tem um prazo total para avisos (NTFY_PRAZO_MS, padrão 150 s) e, quando um aviso esgota as tentativas,
// o disjuntor abre: os avisos seguintes desta rodada não esperam, ficam como "não saiu" e voltam na próxima rodada (nada é marcado como avisado).
export const criarDisjuntor = ({ prazoMs = +(process.env.NTFY_PRAZO_MS || 150000), agora = () => Date.now() } = {}) => {
  const fim = agora() + prazoMs; let aberto = false;
  return {
    aberto: () => aberto || agora() >= fim,
    abrir: () => { aberto = true; },
    resta: () => Math.max(0, fim - agora()),
    /** espera limitada ao que resta do prazo */
    espera: (ms) => new Promise((z) => setTimeout(z, Math.max(0, Math.min(ms, fim - agora())))),
  };
};
