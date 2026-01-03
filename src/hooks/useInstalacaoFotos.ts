import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type InstalacaoFoto = Tables<'instalacao_fotos'>;

export interface FotoTipo {
  tipo: string;
  label: string;
  obrigatoria: boolean;
}

export const FOTOS_INSTALACAO: FotoTipo[] = [
  { tipo: 'frente_veiculo', label: 'Frente do Veículo', obrigatoria: true },
  { tipo: 'traseira_veiculo', label: 'Traseira do Veículo', obrigatoria: true },
  { tipo: 'placa_veiculo', label: 'Placa do Veículo', obrigatoria: true },
  { tipo: 'local_rastreador', label: 'Local do Rastreador', obrigatoria: true },
  { tipo: 'hodometro', label: 'Hodômetro (KM)', obrigatoria: true },
  { tipo: 'lateral_esquerda', label: 'Lateral Esquerda', obrigatoria: false },
  { tipo: 'lateral_direita', label: 'Lateral Direita', obrigatoria: false },
  { tipo: 'avarias', label: 'Avarias Existentes', obrigatoria: false },
  { tipo: 'interior', label: 'Interior do Veículo', obrigatoria: false },
];

export function useInstalacaoFotos(instalacaoId: string | undefined) {
  return useQuery({
    queryKey: ['instalacao-fotos', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) throw new Error('ID não fornecido');

      const { data, error } = await supabase
        .from('instalacao_fotos')
        .select('*')
        .eq('instalacao_id', instalacaoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InstalacaoFoto[];
    },
    enabled: !!instalacaoId,
  });
}

export function useUploadInstalacaoFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instalacaoId,
      tipo,
      file,
    }: {
      instalacaoId: string;
      tipo: string;
      file: File;
    }) => {
      // 1. Upload para storage
      const fileName = `${instalacaoId}/${tipo}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('instalacoes')
        .upload(fileName, file, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from('instalacoes')
        .getPublicUrl(fileName);

      // 3. Salvar registro na tabela
      const { data, error } = await supabase
        .from('instalacao_fotos')
        .insert({
          instalacao_id: instalacaoId,
          tipo,
          arquivo_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instalacao-fotos', variables.instalacaoId] });
    },
  });
}

export function useDeleteInstalacaoFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, instalacaoId }: { id: string; instalacaoId: string }) => {
      const { error } = await supabase
        .from('instalacao_fotos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instalacao-fotos', variables.instalacaoId] });
    },
  });
}
