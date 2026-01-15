import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================
export interface DocumentoSolicitado {
  id: string;
  associado_id: string;
  contrato_id: string | null;
  tipo_documento: string;
  descricao: string | null;
  status: 'pendente' | 'enviado' | 'aprovado' | 'reprovado';
  solicitado_por: string | null;
  solicitado_em: string;
  enviado_em: string | null;
  documento_id: string | null;
  observacao_solicitacao: string | null;
  observacao_cliente: string | null;
  created_at: string;
  updated_at: string;
}

// Labels para tipos de documentos (valores do ENUM tipo_documento)
export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  'cnh': 'CNH - Carteira Nacional de Habilitação',
  'crlv': 'CRLV - Documento do Veículo',
  'comprovante_residencia': 'Comprovante de Residência',
  'foto_frontal_veiculo': 'Foto do Veículo - Frente',
  'foto_traseira_veiculo': 'Foto do Veículo - Traseira',
  'foto_lateral_esquerda': 'Foto do Veículo - Lateral Esquerda',
  'foto_lateral_direita': 'Foto do Veículo - Lateral Direita',
  'foto_painel': 'Foto do Painel',
  'foto_hodometro': 'Foto do Hodômetro',
  'outro': 'Outro Documento',
};

// Tipos válidos do enum (para validação)
export type TipoDocumentoEnum = 
  | 'cnh' 
  | 'crlv' 
  | 'comprovante_residencia' 
  | 'foto_frontal_veiculo' 
  | 'foto_traseira_veiculo' 
  | 'foto_lateral_esquerda' 
  | 'foto_lateral_direita' 
  | 'foto_painel' 
  | 'foto_hodometro' 
  | 'outro';

export function formatTipoDocumento(tipo: string): string {
  return TIPO_DOCUMENTO_LABELS[tipo] || tipo;
}

// Mapear tipos solicitados para tipos do enum
export function mapTipoSolicitadoParaEnum(tipoSolicitado: string): TipoDocumentoEnum {
  const mapping: Record<string, TipoDocumentoEnum> = {
    'cnh': 'cnh',
    'crlv': 'crlv',
    'comprovante_residencia': 'comprovante_residencia',
    'fotos_veiculo': 'foto_frontal_veiculo', // Mapear para um tipo específico
    'selfie_documento': 'outro',
    'foto_veiculo_frente': 'foto_frontal_veiculo',
    'foto_veiculo_traseira': 'foto_traseira_veiculo',
    'foto_veiculo_lateral_esquerda': 'foto_lateral_esquerda',
    'foto_veiculo_lateral_direita': 'foto_lateral_direita',
    'foto_veiculo_painel': 'foto_painel',
    // Tipos do enum
    'foto_frontal_veiculo': 'foto_frontal_veiculo',
    'foto_traseira_veiculo': 'foto_traseira_veiculo',
    'foto_lateral_esquerda': 'foto_lateral_esquerda',
    'foto_lateral_direita': 'foto_lateral_direita',
    'foto_painel': 'foto_painel',
    'foto_hodometro': 'foto_hodometro',
    'outro': 'outro',
  };
  return mapping[tipoSolicitado] || 'outro';
}

// ============================================
// QUERY: Buscar documentos solicitados pendentes
// ============================================
export function useDocumentosSolicitadosPendentes(associadoId?: string) {
  return useQuery({
    queryKey: ['docs-solicitados-pendentes', associadoId],
    queryFn: async (): Promise<DocumentoSolicitado[]> => {
      if (!associadoId) return [];

      const { data, error } = await supabase
        .from('documentos_solicitados')
        .select('*')
        .eq('associado_id', associadoId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar docs solicitados:', error);
        throw error;
      }

      return (data || []) as DocumentoSolicitado[];
    },
    enabled: !!associadoId,
  });
}

// ============================================
// QUERY: Buscar todos documentos solicitados (para analista)
// ============================================
export function useDocumentosSolicitadosPorContrato(contratoId?: string) {
  return useQuery({
    queryKey: ['docs-solicitados', contratoId],
    queryFn: async (): Promise<DocumentoSolicitado[]> => {
      if (!contratoId) return [];

      const { data, error } = await supabase
        .from('documentos_solicitados')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar docs solicitados:', error);
        throw error;
      }

      return (data || []) as DocumentoSolicitado[];
    },
    enabled: !!contratoId,
  });
}

// ============================================
// MUTATION: Cliente enviar documento
// ============================================
interface EnviarDocumentoParams {
  docSolicitadoId: string;
  associadoId: string;
  tipoDocumento: string;
  file: File;
  observacaoCliente?: string;
}

export function useEnviarDocumentoSolicitado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      docSolicitadoId,
      associadoId,
      tipoDocumento,
      file,
      observacaoCliente,
    }: EnviarDocumentoParams) => {
      // 1. Upload do arquivo para o Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${associadoId}/${tipoDocumento}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw new Error('Erro ao enviar arquivo. Tente novamente.');
      }

      // 2. Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);

      // 3. Mapear tipo para enum válido
      const tipoEnum = mapTipoSolicitadoParaEnum(tipoDocumento);

      // 4. Criar registro na tabela documentos
      const { data: novoDoc, error: docError } = await supabase
        .from('documentos')
        .insert({
          associado_id: associadoId,
          tipo: tipoEnum,
          arquivo_url: publicUrl,
          nome_arquivo: file.name,
          tamanho_bytes: file.size,
          status: 'pendente',
        })
        .select()
        .single();

      if (docError) {
        console.error('Erro ao criar documento:', docError);
        throw new Error('Erro ao registrar documento. Tente novamente.');
      }

      // 4. Atualizar documento_solicitado
      const { error: updateError } = await supabase
        .from('documentos_solicitados')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          documento_id: novoDoc.id,
          observacao_cliente: observacaoCliente || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', docSolicitadoId);

      if (updateError) {
        console.error('Erro ao atualizar doc solicitado:', updateError);
        throw updateError;
      }

      return { documentoId: novoDoc.id, publicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-solicitados-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['docs-solicitados'] });
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
    },
    onError: (error: Error) => {
      console.error('Erro ao enviar documento:', error);
      toast.error(error.message || 'Erro ao enviar documento');
    },
  });
}

// ============================================
// MUTATION: Verificar e atualizar status após envio de todos docs
// ============================================
export function useVerificarDocumentosCompletos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (associadoId: string) => {
      console.log('[useVerificarDocumentosCompletos] Verificando associado:', associadoId);
      
      // Verificar se ainda há documentos pendentes
      const { data: pendentes, error } = await supabase
        .from('documentos_solicitados')
        .select('id')
        .eq('associado_id', associadoId)
        .eq('status', 'pendente');

      if (error) {
        console.error('[useVerificarDocumentosCompletos] Erro ao buscar pendentes:', error);
        throw error;
      }

      console.log('[useVerificarDocumentosCompletos] Documentos pendentes:', pendentes?.length || 0);

      // Se não há mais pendentes, atualizar status do associado
      if (!pendentes || pendentes.length === 0) {
        console.log('[useVerificarDocumentosCompletos] Atualizando status para em_analise...');
        
        const { error: updateError, data: updateData } = await supabase
          .from('associados')
          .update({
            status: 'em_analise',
            updated_at: new Date().toISOString(),
          })
          .eq('id', associadoId)
          .select('id, status');

        if (updateError) {
          console.error('[useVerificarDocumentosCompletos] Erro ao atualizar status:', updateError);
          throw updateError;
        }

        // Verificar se o update realmente afetou alguma linha
        if (!updateData || updateData.length === 0) {
          console.warn('[useVerificarDocumentosCompletos] Nenhuma linha atualizada - verificar RLS');
        } else {
          console.log('[useVerificarDocumentosCompletos] Status atualizado:', updateData);
        }

        return { todosEnviados: true };
      }

      return { todosEnviados: false, pendentes: pendentes.length };
    },
    onSuccess: (result) => {
      if (result.todosEnviados) {
        toast.success('Todos os documentos foram enviados! Aguarde a análise.');
      }
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
    },
  });
}
