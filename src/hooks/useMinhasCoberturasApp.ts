import { useVeiculosApp } from './useAppAssociado';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para verificar as coberturas ativas do associado
 * Usado para controlar quais funcionalidades estão disponíveis no app
 * Agora considera inadimplência para suspender coberturas dinamicamente
 */
export function useMinhasCoberturas() {
  const { data: veiculos, isLoading } = useVeiculosApp();
  const { user } = useAuth();

  // Verificar se há cobranças vencidas (inadimplente)
  const { data: inadimplente = false } = useQuery({
    queryKey: ['app-inadimplencia', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('cobrancas')
        .select('id')
        .eq('associado_id', user.id)
        .in('status', ['vencido'])
        .limit(1);
      if (error) return false;
      return (data?.length || 0) > 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Considera o primeiro veículo (principal)
  const veiculo = veiculos?.[0];
  
  const temCoberturaRouboFurto = !inadimplente && (veiculo?.cobertura_roubo_furto || false);
  const temCoberturaTotal = !inadimplente && (veiculo?.cobertura_total || false);
  
  // Assistência 24h e rastreamento requerem cobertura total (instalação concluída)
  const podeAssistencia = temCoberturaTotal;
  const podeRastreamento = temCoberturaTotal && (veiculo?.rastreador_ativo || false);
  
  // Tipos de sinistro permitidos baseado na cobertura
  const tiposSinistroPermitidos: string[] = inadimplente
    ? []
    : temCoberturaTotal 
      ? ['colisao', 'roubo', 'furto', 'incendio', 'fenomeno_natural', 'vandalismo', 'outro']
      : ['roubo', 'furto'];
  
  return {
    isLoading,
    inadimplente,
    temCoberturaRouboFurto,
    temCoberturaTotal,
    podeAssistencia,
    podeRastreamento,
    tiposSinistroPermitidos,
    // Mensagem para exibir ao usuário quando cobertura é parcial
    mensagemCoberturaParcial: inadimplente
      ? 'Suas coberturas estão suspensas devido a inadimplência. Regularize sua situação para reativá-las.'
      : temCoberturaRouboFurto && !temCoberturaTotal
        ? 'Sua cobertura atual é apenas para roubo e furto. Após a instalação do rastreador, você terá Proteção 360º incluindo assistência 24h.'
        : null,
  };
}
