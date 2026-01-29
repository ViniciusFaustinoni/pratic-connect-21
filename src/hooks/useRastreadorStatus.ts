import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RastreadorStatusData {
  plataforma: string;
  configurado: boolean;
  teste_sucesso: boolean;
  testado_em: string | null;
  teste_mensagem: string | null;
}

export function useRastreadorStatus() {
  return useQuery({
    queryKey: ['rastreadores-status'],
    queryFn: async (): Promise<RastreadorStatusData[]> => {
      // Buscar plataformas
      const { data: plataformas, error: platError } = await supabase
        .from('rastreadores_config_plataformas')
        .select('id, plataforma, nome_exibicao');

      if (platError) throw platError;

      // Buscar credenciais
      const { data: credenciais, error: credError } = await supabase
        .from('rastreadores_credenciais')
        .select('plataforma_id, configurado, teste_sucesso, testado_em, teste_mensagem');

      if (credError) {
        // Tabela pode não existir, retornar status padrão
        return plataformas?.map(p => ({
          plataforma: p.plataforma,
          configurado: false,
          teste_sucesso: false,
          testado_em: null,
          teste_mensagem: null,
        })) || [];
      }

      // Mapear credenciais para plataformas
      return plataformas?.map(p => {
        const cred = credenciais?.find(c => c.plataforma_id === p.id);
        return {
          plataforma: p.plataforma,
          configurado: cred?.configurado || false,
          teste_sucesso: cred?.teste_sucesso || false,
          testado_em: cred?.testado_em || null,
          teste_mensagem: cred?.teste_mensagem || null,
        };
      }) || [];
    },
    refetchInterval: 30000, // Atualizar a cada 30s
  });
}

export function useRastreadorPlataformaStatus(plataformaCodigo: string) {
  const { data: allStatus } = useRastreadorStatus();
  return allStatus?.find(s => s.plataforma === plataformaCodigo);
}
