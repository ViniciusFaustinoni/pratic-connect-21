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

export interface FileEntry {
  id: string;
  file: File;
  tipo: TipoDocumento | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface UploadMultipleData {
  associado_id: string;
  veiculo_id?: string;
  files: FileEntry[];
  onProgress?: (current: number, total: number, fileId: string, status: 'uploading' | 'success' | 'error', error?: string) => void;
}

interface UploadMultipleResult {
  success: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
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

async function uploadSingleDocument(data: UploadDocumentoData): Promise<void> {
  // Validate file
  const validation = validateFile(data.file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Upload to storage
  const arquivoUrl = await uploadToStorage(data.file, data.associado_id, data.tipo);
  
  // Insert document record
  const { error } = await supabase
    .from('documentos')
    .insert({
      associado_id: data.associado_id,
      veiculo_id: data.veiculo_id || null,
      tipo: data.tipo,
      arquivo_url: arquivoUrl,
      nome_arquivo: data.file.name,
      tamanho_bytes: data.file.size,
      status: 'pendente',
    });
  
  if (error) {
    console.error('Database insert error:', error);
    throw new Error('Erro ao registrar documento no banco de dados.');
  }
}

export function useUploadDocumento() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UploadDocumentoData) => {
      await uploadSingleDocument(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-queue'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-stats'] });
    },
  });
}

export function useUploadMultipleDocumentos() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ associado_id, veiculo_id, files, onProgress }: UploadMultipleData): Promise<UploadMultipleResult> => {
      const results: UploadMultipleResult = {
        success: 0,
        failed: 0,
        results: [],
      };
      
      const total = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const fileEntry = files[i];
        
        if (!fileEntry.tipo) {
          results.failed++;
          results.results.push({ id: fileEntry.id, success: false, error: 'Tipo não definido' });
          onProgress?.(i + 1, total, fileEntry.id, 'error', 'Tipo não definido');
          continue;
        }
        
        onProgress?.(i, total, fileEntry.id, 'uploading');
        
        try {
          await uploadSingleDocument({
            associado_id,
            veiculo_id,
            tipo: fileEntry.tipo,
            file: fileEntry.file,
          });
          
          results.success++;
          results.results.push({ id: fileEntry.id, success: true });
          onProgress?.(i + 1, total, fileEntry.id, 'success');
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          results.results.push({ id: fileEntry.id, success: false, error: errorMessage });
          onProgress?.(i + 1, total, fileEntry.id, 'error', errorMessage);
        }
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-queue'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-stats'] });
    },
  });
}
