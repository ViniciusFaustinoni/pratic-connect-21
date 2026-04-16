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

/**
 * Converte uma string "YYYY-MM-DD" (DATE puro do Postgres) em Date local
 * SEM aplicar conversão de timezone. Evita o bug de `new Date("2026-04-17")`
 * que é interpretado como UTC e desloca para o dia anterior em fusos negativos.
 *
 * Aceita também strings com hora ("YYYY-MM-DDTHH:mm..."): nesse caso usa
 * o `new Date()` padrão (que respeita o offset incluído).
 */
export function parseDataLocal(data?: string | null): Date | null {
  if (!data) return null;
  const apenasData = data.split('T')[0];
  const partes = apenasData.split('-');
  if (partes.length !== 3) {
    const fallback = new Date(data);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [ano, mes, dia] = partes.map(Number);
  if (!ano || !mes || !dia) return null;
  const d = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata uma data DATE pura ("YYYY-MM-DD") como "DD/MM/YYYY" sem timezone.
 */
export function formatDataAgendada(data?: string | null): string {
  const d = parseDataLocal(data);
  if (!d) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}
