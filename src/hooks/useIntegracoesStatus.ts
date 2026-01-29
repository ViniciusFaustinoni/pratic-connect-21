import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRastreadorStatus } from './useRastreadorStatus';

interface SecretsStatus {
  asaas: { configurado: boolean; ambiente?: string };
  autentique: { configurado: boolean };
  email: { configurado: boolean };
  whatsapp: { api_configurada: boolean; url_configurada?: boolean };
  openai: { configurado: boolean };
}

export interface IntegracoesStatus {
  asaas: { configurado: boolean; ambiente?: string };
  autentique: { configurado: boolean };
  email: { configurado: boolean };
  whatsapp: { configurado: boolean; conectado: boolean };
  openai: { configurado: boolean };
  softruck: { configurado: boolean; testado: boolean; testado_em: string | null };
  rede_veiculos: { configurado: boolean; testado: boolean; testado_em: string | null };
  isLoading: boolean;
  refetch: () => void;
}

export function useIntegracoesStatus(): IntegracoesStatus {
  // Buscar status dos secrets via edge function
  const secretsQuery = useQuery({
    queryKey: ['integracoes-secrets'],
    queryFn: async (): Promise<SecretsStatus | null> => {
      const { data, error } = await supabase.functions.invoke('integracoes-verificar-secrets');
      
      if (error) {
        console.error('[useIntegracoesStatus] Erro ao verificar secrets:', error);
        return null;
      }
      
      return data?.status || null;
    },
    refetchInterval: 60000, // Atualizar a cada 1 min
    staleTime: 30000,
  });

  // Buscar status da instância WhatsApp (conexão ativa)
  const whatsappQuery = useQuery({
    queryKey: ['whatsapp-instancia-status'],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('whatsapp_instancias')
        .select('status')
        .eq('principal', true)
        .maybeSingle();
      
      if (error) {
        console.error('[useIntegracoesStatus] Erro ao verificar WhatsApp:', error);
        return false;
      }
      
      return data?.status === 'open';
    },
    refetchInterval: 30000, // Atualizar a cada 30s
  });

  // Buscar status dos rastreadores (já existente)
  const { data: rastreadores, refetch: refetchRastreadores } = useRastreadorStatus();

  const softruck = rastreadores?.find(r => r.plataforma === 'softruck');
  const redeVeiculos = rastreadores?.find(r => r.plataforma === 'rede_veiculos');

  const refetch = () => {
    secretsQuery.refetch();
    whatsappQuery.refetch();
    refetchRastreadores();
  };

  return {
    asaas: { 
      configurado: secretsQuery.data?.asaas?.configurado || false,
      ambiente: secretsQuery.data?.asaas?.ambiente
    },
    autentique: { 
      configurado: secretsQuery.data?.autentique?.configurado || false 
    },
    email: { 
      configurado: secretsQuery.data?.email?.configurado || false 
    },
    whatsapp: { 
      configurado: secretsQuery.data?.whatsapp?.api_configurada || false,
      conectado: whatsappQuery.data || false 
    },
    openai: {
      configurado: secretsQuery.data?.openai?.configurado || false
    },
    softruck: {
      configurado: softruck?.configurado || false,
      testado: softruck?.teste_sucesso || false,
      testado_em: softruck?.testado_em || null
    },
    rede_veiculos: {
      configurado: redeVeiculos?.configurado || false,
      testado: redeVeiculos?.teste_sucesso || false,
      testado_em: redeVeiculos?.testado_em || null
    },
    isLoading: secretsQuery.isLoading || whatsappQuery.isLoading,
    refetch,
  };
}
