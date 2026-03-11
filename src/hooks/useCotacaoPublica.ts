import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CotacaoPublicaData } from '@/types/cotacaoPublica';


// ============================================
// HOOK: Buscar cotação pública por token
// ============================================

export function useCotacaoPublica(token?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cotacao-publica', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');

      const { data, error } = await (supabase as any)
        .from('cotacoes_publicas')
        .select(`*, leads:lead_id (id, nome, telefone, email)`)
        .eq('token', token)
        .single();

      if (error) throw error;

      // Registrar visualização se for primeiro acesso
      if (data && data.status === 'aguardando') {
        await (supabase as any)
          .from('cotacoes_publicas')
          .update({ status: 'visualizado', visualizado_em: new Date().toISOString() })
          .eq('id', data.id);

        await (supabase as any).from('cotacoes_publicas_historico').insert({
          cotacao_id: data.id,
          acao: 'visualizado',
          detalhes: { primeiro_acesso: true },
        });

        data.status = 'visualizado';
        data.visualizado_em = new Date().toISOString();
      }

      return data as CotacaoPublicaData;
    },
    enabled: !!token,
    staleTime: 1000 * 60,
  });

  // Listener Realtime para atualizações automáticas
  useEffect(() => {
    if (!token || !query.data?.id) return;

    console.log('[useCotacaoPublica] Iniciando realtime para cotação:', query.data.id);

    const channel = supabase
      .channel(`cotacao-publica-${query.data.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cotacoes_publicas',
          filter: `id=eq.${query.data.id}`,
        },
        (payload) => {
          console.log('[useCotacaoPublica] Cotação atualizada via realtime:', payload);
          queryClient.invalidateQueries({ queryKey: ['cotacao-publica', token] });
        }
      )
      .subscribe((status) => {
        console.log('[useCotacaoPublica] Realtime status:', status);
      });

    return () => {
      console.log('[useCotacaoPublica] Removendo listener realtime');
      supabase.removeChannel(channel);
    };
  }, [token, query.data?.id, queryClient]);

  return query;
}

// ============================================
// HOOK: Atualizar cotação pública
// ============================================

interface AtualizarCotacaoParams {
  token: string;
  updates: Partial<CotacaoPublicaData>;
}

export function useAtualizarCotacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token, updates }: AtualizarCotacaoParams) => {
      const { data: cotacao, error: findError } = await (supabase as any)
        .from('cotacoes_publicas')
        .select('id')
        .eq('token', token)
        .single();

      if (findError || !cotacao) throw new Error('Cotação não encontrada');

      const { data, error } = await (supabase as any)
        .from('cotacoes_publicas')
        .update(updates)
        .eq('id', cotacao.id)
        .select()
        .single();

      if (error) throw error;

      if (updates.status) {
        await (supabase as any).from('cotacoes_publicas_historico').insert({
          cotacao_id: cotacao.id,
          acao: `status_${updates.status}`,
          detalhes: updates,
        });
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-publica', variables.token] });
    },
  });
}

// ============================================
// HOOK: Upload de documento
// ============================================

interface UploadDocumentoParams {
  cotacaoId: string;
  tipo: string;
  file: File;
}

export function useUploadDocumento() {
  return useMutation({
    mutationFn: async ({ cotacaoId, tipo, file }: UploadDocumentoParams) => {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `cotacoes/${cotacaoId}/${tipo}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('cotacoes-docs')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cotacoes-docs')
        .getPublicUrl(path);

      return { url: publicUrl, tipo };
    },
  });
}

// ============================================
// HOOK: Upload de foto de vistoria
// ============================================

interface UploadFotoVistoriaParams {
  cotacaoId: string;
  tipo: string;
  file: File;
  latitude?: number;
  longitude?: number;
}

export function useUploadFotoVistoria() {
  return useMutation({
    mutationFn: async ({ cotacaoId, tipo, file, latitude, longitude }: UploadFotoVistoriaParams) => {
      let fileToUpload = file;
      let fileName = file.name;

      // Converter PDF para imagem antes do upload
      if (isPdf(file)) {
        try {
          console.log('[useUploadFotoVistoria] Convertendo PDF para imagem...');
          const imageBlob = await convertPdfToImage(file);
          fileName = getPdfConvertedName(file.name);
          fileToUpload = new File([imageBlob], fileName, { type: 'image/jpeg' });
          console.log('[useUploadFotoVistoria] PDF convertido com sucesso');
        } catch (pdfError) {
          console.error('[useUploadFotoVistoria] Erro ao converter PDF:', pdfError);
          throw new Error('Erro ao converter PDF. Tente enviar como imagem JPG ou PNG.');
        }
      }

      const ext = fileName.split('.').pop() || 'jpg';
      const path = `cotacoes/${cotacaoId}/vistoria_${tipo}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('cotacoes-docs')
        .upload(path, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cotacoes-docs')
        .getPublicUrl(path);

      await (supabase as any).from('cotacoes_publicas_fotos').insert({
        cotacao_id: cotacaoId,
        tipo,
        url: publicUrl,
        latitude,
        longitude,
      });

      return { url: publicUrl, tipo, latitude, longitude };
    },
  });
}

// ============================================
// HOOK: Buscar fotos de vistoria
// ============================================

export function useFotosVistoria(cotacaoId?: string) {
  return useQuery({
    queryKey: ['fotos-vistoria', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return [];

      const { data, error } = await (supabase as any)
        .from('cotacoes_publicas_fotos')
        .select('*')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as { id: string; tipo: string; url: string }[];
    },
    enabled: !!cotacaoId,
  });
}

// ============================================
// HOOK: Criar cotação pública a partir de lead
// ============================================

interface CriarCotacaoPublicaParams {
  leadId: string;
  vendedorId?: string;
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoAno?: number;
  veiculoPlaca?: string;
  valorFipe?: number;
}

export function useCriarCotacaoPublica() {
  return useMutation({
    mutationFn: async (params: CriarCotacaoPublicaParams) => {
      const { data, error } = await (supabase as any)
        .from('cotacoes_publicas')
        .insert({
          lead_id: params.leadId,
          vendedor_id: params.vendedorId,
          veiculo_marca: params.veiculoMarca,
          veiculo_modelo: params.veiculoModelo,
          veiculo_ano: params.veiculoAno,
          veiculo_placa: params.veiculoPlaca,
          valor_fipe: params.valorFipe,
          status: 'aguardando',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}
