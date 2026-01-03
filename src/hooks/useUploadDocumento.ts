import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TipoDocumento = Database['public']['Enums']['tipo_documento'];

interface UploadDocumentoData {
  associado_id: string;
  veiculo_id?: string;
  tipo: TipoDocumento;
  file: File;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Formato não suportado. Use JPG, PNG ou PDF.' };
  }
  
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'O arquivo excede o limite de 10MB.' };
  }
  
  return { valid: true };
}

async function uploadToStorage(
  file: File,
  associadoId: string,
  tipo: TipoDocumento
): Promise<string> {
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${associadoId}/${tipo}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  const { data, error } = await supabase.storage
    .from('documentos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    console.error('Storage upload error:', error);
    throw new Error('Erro ao enviar arquivo para o storage.');
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('documentos')
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}

export function useUploadDocumento() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UploadDocumentoData) => {
      // Validate file
      const validation = validateFile(data.file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      // Upload to storage
      const arquivoUrl = await uploadToStorage(data.file, data.associado_id, data.tipo);
      
      // Insert document record
      const { data: documento, error } = await supabase
        .from('documentos')
        .insert({
          associado_id: data.associado_id,
          veiculo_id: data.veiculo_id || null,
          tipo: data.tipo,
          arquivo_url: arquivoUrl,
          nome_arquivo: data.file.name,
          tamanho_bytes: data.file.size,
          status: 'pendente',
        })
        .select()
        .single();
      
      if (error) {
        console.error('Database insert error:', error);
        throw new Error('Erro ao registrar documento no banco de dados.');
      }
      
      return documento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-queue'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-stats'] });
    },
  });
}
