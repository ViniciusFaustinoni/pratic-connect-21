/**
 * Renderiza o corpo do template substituindo as variáveis pelos valores fornecidos.
 * Variáveis suportadas: {{nome_cliente}}, {{motivo_suspensao}}, {{data}}.
 */
export function renderTemplateEmailSuspensao(
  corpo: string,
  vars: { nome_cliente?: string; motivo_suspensao?: string; data?: string },
): string {
  return corpo
    .replace(/\{\{\s*nome_cliente\s*\}\}/g, vars.nome_cliente ?? '')
    .replace(/\{\{\s*motivo_suspensao\s*\}\}/g, vars.motivo_suspensao ?? '')
    .replace(/\{\{\s*data\s*\}\}/g, vars.data ?? '');
}

export const VARIAVEIS_TEMPLATE = [
  { code: '{{nome_cliente}}', label: 'Nome do cliente' },
  { code: '{{motivo_suspensao}}', label: 'Motivo da suspensão' },
  { code: '{{data}}', label: 'Data' },
] as const;

export const PREVIEW_EXEMPLO = {
  nome_cliente: 'Maria Souza',
  motivo_suspensao: 'Inadimplência da mensalidade de maio',
  data: new Date().toLocaleDateString('pt-BR'),
};
