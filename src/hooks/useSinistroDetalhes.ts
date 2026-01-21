import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Hook para histórico de status do sinistro
export function useSinistroHistorico(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['sinistro-historico', sinistroId],
    queryFn: async () => {
      if (!sinistroId) throw new Error('ID obrigatório');
      
      const { data, error } = await supabase
        .from('sinistro_historico')
        .select(`
          *,
          usuario:profiles(nome)
        `)
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!sinistroId,
  });
}

// Hook para documentos do sinistro
export function useSinistroDocumentos(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['sinistro-documentos', sinistroId],
    queryFn: async () => {
      if (!sinistroId) throw new Error('ID obrigatório');
      
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!sinistroId,
  });
}

// Hook para fotos do sinistro no storage
export function useSinistroFotos(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['sinistro-fotos', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return [];
      
      const { data, error } = await supabase.storage
        .from('sinistros')
        .list(`${sinistroId}/fotos`);
        
      if (error) {
        console.error('Erro ao buscar fotos:', error);
        return [];
      }
      
      return data?.map(file => ({
        ...file,
        url: supabase.storage.from('sinistros').getPublicUrl(`${sinistroId}/fotos/${file.name}`).data.publicUrl
      })) || [];
    },
    enabled: !!sinistroId,
  });
}

// Hook para mensagens do sinistro
export function useSinistroMensagens(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['sinistro-mensagens', sinistroId],
    queryFn: async () => {
      if (!sinistroId) throw new Error('ID obrigatório');
      
      const { data, error } = await supabase
        .from('sinistro_mensagens')
        .select(`
          *,
          remetente:profiles(nome)
        `)
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return data;
    },
    enabled: !!sinistroId,
    refetchInterval: 30000, // Polling a cada 30s
  });
}

// Mutation para enviar mensagem
export function useEnviarMensagemSinistro() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sinistroId, mensagem }: { sinistroId: string; mensagem: string }) => {
      const { data, error } = await supabase
        .from('sinistro_mensagens')
        .insert({
          sinistro_id: sinistroId,
          remetente_tipo: 'associado',
          mensagem,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sinistroId }) => {
      queryClient.invalidateQueries({ queryKey: ['sinistro-mensagens', sinistroId] });
    },
  });
}

// Mutation para upload de foto adicional
export function useUploadFotoSinistro() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sinistroId, file }: { sinistroId: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const path = `${sinistroId}/fotos/${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage
        .from('sinistros')
        .upload(path, file);
        
      if (error) throw error;
      return path;
    },
    onSuccess: (_, { sinistroId }) => {
      queryClient.invalidateQueries({ queryKey: ['sinistro-fotos', sinistroId] });
    },
  });
}

// Mutation para upload de documento
export function useUploadDocumentoSinistro() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      sinistroId, 
      file, 
      tipo 
    }: { 
      sinistroId: string; 
      file: File; 
      tipo: string;
    }) => {
      // Upload do arquivo
      const ext = file.name.split('.').pop();
      const path = `${sinistroId}/documentos/${tipo}_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('sinistros')
        .upload(path, file);
        
      if (uploadError) throw uploadError;
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('sinistros')
        .getPublicUrl(path);
      
      // Salvar registro do documento
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .insert({
          sinistro_id: sinistroId,
          tipo,
          nome_arquivo: file.name,
          arquivo_url: urlData.publicUrl,
          status: 'enviado',
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sinistroId }) => {
      queryClient.invalidateQueries({ queryKey: ['sinistro-documentos', sinistroId] });
    },
  });
}
