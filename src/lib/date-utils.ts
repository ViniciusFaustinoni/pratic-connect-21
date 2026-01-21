/**
 * Retorna a data atual no fuso horário de Brasília (America/Sao_Paulo)
 * Útil para garantir que comparações de "hoje" usem o timezone correto
 */
export function getHojeBrasilia(): Date {
  const now = new Date();
  const brasiliaString = now.toLocaleDateString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Converter "DD/MM/YYYY" para Date em meia-noite local
  const [dia, mes, ano] = brasiliaString.split('/');
  return new Date(Number(ano), Number(mes) - 1, Number(dia), 0, 0, 0, 0);
}
