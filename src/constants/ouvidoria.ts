// Setores disponíveis para elogio (ordem alfabética)
export const setoresElogio = [
  { value: 'assistencia_24h', label: 'Assistência 24h' },
  { value: 'cadastro', label: 'Cadastro' },
  { value: 'cobranca', label: 'Cobrança' },
  { value: 'consultor', label: 'Consultor(a)' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'monitoramento', label: 'Monitoramento' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'relacionamento', label: 'Relacionamento' },
] as const;

export type SetorElogioValue = typeof setoresElogio[number]['value'];
