import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type IntegracaoTipo = 'hinova' | 'softruck' | 'rede_veiculos' | 'asaas' | 'autentique' | 'resend' | 'whatsapp';

interface CampoCredencial {
  nome: string;
  label: string;
  tipo: 'text' | 'password';
  obrigatorio: boolean;
}

interface IntegracaoSchema {
  campos: CampoCredencial[];
}

interface CredenciaisStatus {
  integracao: string;
  configurado: boolean;
  testado_em: string | null;
  teste_sucesso: boolean | null;
  teste_mensagem: string | null;
  updated_at: string | null;
}

interface UseIntegracaoCredenciaisOptions {
  integracao: IntegracaoTipo;
}

interface SalvarCredenciaisResponse {
  success: boolean;
  mensagem?: string;
  error?: string;
}

interface TestarConexaoResponse {
  success: boolean;
  mensagem?: string;
  error?: string;
}

export function useIntegracaoCredenciais({ integracao }: UseIntegracaoCredenciaisOptions) {
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);

  // Buscar schema de campos
  const schemaQuery = useQuery({
    queryKey: ['integracoes-schema'],
    queryFn: async (): Promise<Record<string, IntegracaoSchema>> => {
      const { data, error } = await supabase.functions.invoke('integracoes-credenciais', {
        method: 'GET',
        body: null,
      });

      // Tentar via query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://iyxdgmukrrdkffraptsx.supabase.co'}/functions/v1/integracoes-credenciais?schema=true`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.schema;
    },
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  // Buscar status da integração específica
  const statusQuery = useQuery({
    queryKey: ['integracao-credenciais-status', integracao],
    queryFn: async (): Promise<CredenciaisStatus | null> => {
      const response = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/integracoes-credenciais?integracao=${integracao}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data?.[0] || null;
    },
    refetchInterval: 30000,
  });

  // Mutation para salvar credenciais
  const salvarMutation = useMutation({
    mutationFn: async (credenciais: Record<string, string>): Promise<SalvarCredenciaisResponse> => {
      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/integracoes-credenciais',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            integracao,
            credenciais,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integracao-credenciais-status', integracao] });
      queryClient.invalidateQueries({ queryKey: ['integracoes-secrets'] });
      toast.success('Credenciais salvas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar credenciais: ${error.message}`);
    },
  });

  // Mutation para remover credenciais
  const removerMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/integracoes-credenciais?integracao=${integracao}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integracao-credenciais-status', integracao] });
      queryClient.invalidateQueries({ queryKey: ['integracoes-secrets'] });
      toast.success('Credenciais removidas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover credenciais: ${error.message}`);
    },
  });

  // Função para testar conexão (chama edge function específica de cada integração)
  const testar = async (credenciais?: Record<string, string>): Promise<TestarConexaoResponse> => {
    setIsTesting(true);
    
    try {
      let result: TestarConexaoResponse;

      // Mapear para função de teste específica
      switch (integracao) {
        case 'softruck':
        case 'rede_veiculos':
          // Usar função existente de teste de rastreadores
          const { data, error } = await supabase.functions.invoke('rastreador-testar-conexao', {
            body: { plataforma_codigo: integracao === 'rede_veiculos' ? 'rede_veiculos' : 'softruck' },
          });
          if (error) throw error;
          result = { success: data.success, mensagem: data.mensagem };
          break;

        case 'hinova':
          // Testar autenticação Hinova
          const hinovaResult = await supabase.functions.invoke('sga-hinova-sync', {
            body: { action: 'test_connection' },
          });
          result = { 
            success: !hinovaResult.error, 
            mensagem: hinovaResult.error ? hinovaResult.error.message : 'Conexão estabelecida com sucesso!' 
          };
          break;

        default:
          // Verificar se a integração está configurada (via secrets)
          const secretsResult = await supabase.functions.invoke('integracoes-verificar-secrets');
          const status = secretsResult.data?.status?.[integracao];
          result = { 
            success: status?.configurado || false, 
            mensagem: status?.configurado ? 'Integração configurada!' : 'Integração não configurada' 
          };
      }

      // Atualizar status de teste no banco
      if (result.success) {
        await fetch(
          'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/integracoes-credenciais',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              integracao,
              credenciais: credenciais || {},
              teste_sucesso: result.success,
              teste_mensagem: result.mensagem,
            }),
          }
        );
      }

      queryClient.invalidateQueries({ queryKey: ['integracao-credenciais-status', integracao] });

      if (result.success) {
        toast.success(result.mensagem || 'Conexão testada com sucesso!');
      } else {
        toast.error(result.mensagem || 'Falha no teste de conexão');
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao testar conexão';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setIsTesting(false);
    }
  };

  return {
    // Schema
    schema: schemaQuery.data?.[integracao] || null,
    isLoadingSchema: schemaQuery.isLoading,

    // Status
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    configurado: statusQuery.data?.configurado || false,

    // Ações
    salvar: salvarMutation.mutateAsync,
    isSaving: salvarMutation.isPending,

    remover: removerMutation.mutateAsync,
    isRemoving: removerMutation.isPending,

    testar,
    isTesting,

    // Refetch
    refetch: () => {
      statusQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['integracoes-secrets'] });
    },
  };
}

// Hook para buscar status de todas as integrações do banco
export function useTodasIntegracoesCredenciais() {
  return useQuery({
    queryKey: ['todas-integracoes-credenciais'],
    queryFn: async (): Promise<CredenciaisStatus[]> => {
      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/integracoes-credenciais',
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (!result.success) return [];
      return result.data || [];
    },
    staleTime: 30000,
  });
}
