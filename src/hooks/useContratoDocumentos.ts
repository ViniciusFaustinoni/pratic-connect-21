import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TipoDocumentoContrato = 'crlv' | 'cnh' | 'rg' | 'comprovante_residencia';

interface DocumentoContrato {
  id: string;
  contrato_id: string | null;
  cotacao_id: string | null;
  tipo: TipoDocumentoContrato;
  arquivo_url: string;
  arquivo_nome: string | null;
  ocr_resultado: OcrResultado | null;
  status: 'pendente' | 'processando' | 'aprovado' | 'reprovado';
  created_at: string;
  updated_at: string;
}

export interface OcrResultado {
  sucesso: boolean;
  dados?: {
    nome?: string;
    cpf?: string;
    rg?: string;
    data_nascimento?: string;
    endereco?: string;
    cep?: string;
    cidade?: string;
    uf?: string;
    placa?: string;
    renavam?: string;
    chassi?: string;
    marca?: string;
    modelo?: string;
    ano?: string;
    cor?: string;
    [key: string]: string | undefined;
  };
  tipo_detectado?: string;
  confianca?: number;
  erro?: string;
  validado_ocr?: boolean; // Flag que indica se documento passou na validação automática por IA
}

interface UploadDocumentoParams {
  file: File;
  tipo: TipoDocumentoContrato;
  contratoId?: string;
  cotacaoId?: string;
}

interface UploadResult {
  documento: DocumentoContrato;
  ocr: OcrResultado;
}

// Hook para upload e OCR de documento
export function useUploadDocumentoContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, tipo, contratoId, cotacaoId }: UploadDocumentoParams): Promise<UploadResult> => {
      if (!contratoId && !cotacaoId) {
        throw new Error('É necessário informar contratoId ou cotacaoId');
      }

      const entityId = contratoId || cotacaoId;
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${entityId}/${tipo}/${timestamp}_${sanitizedFileName}`;

      // 1. Upload para storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contratos-documentos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error('Erro ao enviar arquivo para o storage.');
      }

      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from('contratos-documentos')
        .getPublicUrl(uploadData.path);

      const arquivoUrl = urlData.publicUrl;

      // 3. Inserir registro no banco (status: processando)
      const { data: docData, error: insertError } = await supabase
        .from('contratos_documentos')
        .insert({
          contrato_id: contratoId || null,
          cotacao_id: cotacaoId || null,
          tipo,
          arquivo_url: arquivoUrl,
          arquivo_nome: file.name,
          status: 'processando',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error('Erro ao registrar documento no banco de dados.');
      }

      // 4. Chamar OCR via edge function
      let ocrResult: OcrResultado = { sucesso: false, erro: 'OCR não executado' };
      
      try {
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke('document-ocr', {
          body: { 
            url: arquivoUrl, 
            tipoEsperado: tipo,
            extrairDados: true
          }
        });

        if (ocrError) {
          console.error('OCR error:', ocrError);
          ocrResult = { sucesso: false, erro: ocrError.message };
        } else {
          ocrResult = ocrData as OcrResultado;
        }
      } catch (error: any) {
        console.error('OCR call failed:', error);
        ocrResult = { sucesso: false, erro: error?.message || 'Erro ao processar documento com IA' };
      }

      // 5. Atualizar documento com resultado do OCR
      // Status sempre 'pendente' - a aprovação é feita pelo analista ao aprovar a proposta
      // O resultado do OCR inclui flag 'validado_ocr' para indicar se passou na validação automática
      const ocrResultadoComValidacao = {
        ...ocrResult,
        validado_ocr: ocrResult.sucesso && ocrResult.confianca && ocrResult.confianca > 0.7,
      };

      await supabase
        .from('contratos_documentos')
        .update({
          ocr_resultado: ocrResultadoComValidacao as any,
          status: 'pendente',
        })
        .eq('id', docData.id);

      return {
        documento: {
          ...docData,
          ocr_resultado: ocrResultadoComValidacao,
          status: 'pendente',
        } as DocumentoContrato,
        ocr: ocrResultadoComValidacao,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-documentos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao processar documento');
    },
  });
}

// Hook para buscar documentos de um contrato/cotação
export function useDocumentosContrato(contratoId?: string, cotacaoId?: string) {
  return useQuery({
    queryKey: ['contratos-documentos', contratoId, cotacaoId],
    queryFn: async () => {
      let query = supabase
        .from('contratos_documentos')
        .select('*')
        .order('created_at', { ascending: true });

      if (contratoId) {
        query = query.eq('contrato_id', contratoId);
      } else if (cotacaoId) {
        query = query.eq('cotacao_id', cotacaoId);
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as DocumentoContrato[];
    },
    enabled: !!contratoId || !!cotacaoId,
  });
}

// Hook para excluir documento
export function useExcluirDocumentoContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentoId: string) => {
      // Buscar documento para pegar URL e excluir do storage
      const { data: doc } = await supabase
        .from('contratos_documentos')
        .select('arquivo_url')
        .eq('id', documentoId)
        .single();

      if (doc?.arquivo_url) {
        // Extrair path do arquivo da URL
        const urlParts = doc.arquivo_url.split('/contratos-documentos/');
        if (urlParts.length > 1) {
          await supabase.storage
            .from('contratos-documentos')
            .remove([urlParts[1]]);
        }
      }

      const { error } = await supabase
        .from('contratos_documentos')
        .delete()
        .eq('id', documentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-documentos'] });
      toast.success('Documento removido');
    },
    onError: () => {
      toast.error('Erro ao remover documento');
    },
  });
}

// Hook para atualizar status do documento
export function useAtualizarStatusDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      documentoId, 
      status 
    }: { 
      documentoId: string; 
      status: 'pendente' | 'aprovado' | 'reprovado' 
    }) => {
      const { error } = await supabase
        .from('contratos_documentos')
        .update({ status })
        .eq('id', documentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-documentos'] });
    },
  });
}
