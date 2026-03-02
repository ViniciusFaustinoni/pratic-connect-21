import { useVeiculosApp } from './useAppAssociado';

/**
 * Hook para verificar as coberturas ativas do associado
 * Usado para controlar quais funcionalidades estão disponíveis no app
 */
export function useMinhasCoberturas() {
  const { data: veiculos, isLoading } = useVeiculosApp();
  
  // Considera o primeiro veículo (principal)
  const veiculo = veiculos?.[0];
  
  const temCoberturaRouboFurto = veiculo?.cobertura_roubo_furto || false;
  const temCoberturaTotal = veiculo?.cobertura_total || false;
  
  // Assistência 24h e rastreamento requerem cobertura total (instalação concluída)
  const podeAssistencia = temCoberturaTotal;
  const podeRastreamento = temCoberturaTotal && (veiculo?.rastreador_ativo || false);
  
  // Tipos de sinistro permitidos baseado na cobertura
  const tiposSinistroPermitidos: string[] = temCoberturaTotal 
    ? ['colisao', 'roubo', 'furto', 'incendio', 'fenomeno_natural', 'vandalismo', 'outro']
    : ['roubo', 'furto'];
  
  return {
    isLoading,
    temCoberturaRouboFurto,
    temCoberturaTotal,
    podeAssistencia,
    podeRastreamento,
    tiposSinistroPermitidos,
    // Mensagem para exibir ao usuário quando cobertura é parcial
    mensagemCoberturaParcial: temCoberturaRouboFurto && !temCoberturaTotal
      ? 'Sua cobertura atual é apenas para roubo e furto. Após a instalação do rastreador, você terá Proteção 360º incluindo assistência 24h.'
      : null,
  };
}
