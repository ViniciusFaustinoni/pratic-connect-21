import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthResult {
  success: boolean;
  token: string;
  from_cache: boolean;
  expires_at: string;
  plataforma: {
    id: string;
    codigo: string;
    nome: string;
  };
  error?: string;
}

export function useRastreadorAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      plataforma_codigo, 
      force_refresh = false 
    }: { 
      plataforma_codigo: 'softruck' | 'rede_veiculos'; 
      force_refresh?: boolean;
    }): Promise<AuthResult> => {
      const { data, error } = await supabase.functions.invoke('rastreador-auth', {
        body: { plataforma_codigo, force_refresh },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data as AuthResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores-tokens'] });
      if (!data.from_cache) {
        toast.success(`Token ${data.plataforma.nome} obtido com sucesso`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao autenticar: ${error.message}`);
    },
  });
}

export function useTestarConexaoPlataforma() {
  return useMutation({
    mutationFn: async (plataforma_codigo: 'softruck' | 'rede_veiculos') => {
      const { data, error } = await supabase.functions.invoke('rastreador-auth', {
        body: { plataforma_codigo, force_refresh: true },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Conexão com ${data.plataforma.nome} estabelecida com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(`Falha na conexão: ${error.message}`);
    },
  });
}
