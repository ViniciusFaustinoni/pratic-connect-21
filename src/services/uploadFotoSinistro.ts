import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export type TipoFotoSinistro = 
  | 'dano_frente' 
  | 'dano_traseira' 
  | 'dano_lateral_esq'
  | 'dano_lateral_dir'
  | 'dano_interno'
  | 'local' 
  | 'terceiro'
  | 'documento' 
  | 'outro'
  | 'geral';

export interface UploadFotoParams {
  sinistroId: string;
  file: File | Blob;
  tipo?: TipoFotoSinistro;
}

export interface UploadFotoResult {
  foto_id: string;
  url_assinada: string;
  storage_path: string;
  tamanho_bytes: number;
  tipo: string;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;
const MAX_FOTOS_POR_SINISTRO = 10;
const FORMATOS_ACEITOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Valida o tipo de arquivo
 */
function validarFormato(file: File | Blob): boolean {
  if (file instanceof File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'heic' || ext === 'heif') return true;
  }
  return FORMATOS_ACEITOS.includes(file.type);
}

/**
 * Comprime e redimensiona imagem usando Canvas
 */
async function comprimirImagem(file: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Calcular novas dimensões mantendo proporção
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }
      
      // Criar canvas e desenhar imagem redimensionada
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível criar contexto do canvas'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Converter para JPEG com qualidade definida
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao converter imagem'));
          }
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };
    
    img.src = url;
  });
}

/**
 * Conta fotos existentes do sinistro
 */
async function contarFotosExistentes(sinistroId: string): Promise<number> {
  const { count, error } = await supabase
    .from('sinistro_fotos')
    .select('*', { count: 'exact', head: true })
    .eq('sinistro_id', sinistroId)
    .eq('status', 'ativo');
  
  if (error) {
    console.error('Erro ao contar fotos:', error);
    return 0;
  }
  
  return count || 0;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Faz upload de foto do sinistro com validação, compressão e registro no banco
 */
export async function uploadFotoSinistro({
  sinistroId,
  file,
  tipo = 'geral',
}: UploadFotoParams): Promise<UploadFotoResult> {
  // 1. Validar formato
  if (!validarFormato(file)) {
    throw new Error('Formato não suportado. Use JPG, PNG, HEIC ou WebP.');
  }
  
  // 2. Validar tamanho
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }
  
  // 3. Verificar limite de fotos
  const fotosExistentes = await contarFotosExistentes(sinistroId);
  if (fotosExistentes >= MAX_FOTOS_POR_SINISTRO) {
    throw new Error(`Limite de ${MAX_FOTOS_POR_SINISTRO} fotos por sinistro atingido.`);
  }
  
  // 4. Comprimir imagem
  let imagemFinal: Blob;
  try {
    imagemFinal = await comprimirImagem(file);
  } catch (error) {
    console.error('Erro na compressão:', error);
    // Se falhar compressão, usar arquivo original
    imagemFinal = file;
  }
  
  // 5. Gerar nome único
  const fotoId = crypto.randomUUID();
  const storagePath = `${sinistroId}/fotos/${fotoId}.jpg`;
  
  // 6. Upload para storage
  const { error: uploadError } = await supabase.storage
    .from('sinistros')
    .upload(storagePath, imagemFinal, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  
  if (uploadError) {
    throw new Error(`Erro no upload: ${uploadError.message}`);
  }
  
  // 7. Gerar URL assinada (válida por 1 hora)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('sinistros')
    .createSignedUrl(storagePath, 3600);
  
  if (signedError || !signedData?.signedUrl) {
    throw new Error('Erro ao gerar URL da foto');
  }
  
  // 8. Inserir registro no banco
  const { data: fotoRecord, error: insertError } = await supabase
    .from('sinistro_fotos')
    .insert({
      sinistro_id: sinistroId,
      tipo,
      storage_path: storagePath,
      nome_arquivo: file instanceof File ? file.name : `foto_${fotoId}.jpg`,
      tamanho_bytes: imagemFinal.size,
      status: 'ativo',
    })
    .select()
    .single();
  
  if (insertError) {
    // Rollback: excluir arquivo do storage
    await supabase.storage.from('sinistros').remove([storagePath]);
    throw new Error(`Erro ao salvar registro: ${insertError.message}`);
  }
  
  return {
    foto_id: fotoRecord.id,
    url_assinada: signedData.signedUrl,
    storage_path: storagePath,
    tamanho_bytes: imagemFinal.size,
    tipo,
  };
}

/**
 * Exclui foto do sinistro (storage + banco)
 */
export async function excluirFotoSinistro(fotoId: string, storagePath: string): Promise<void> {
  // 1. Excluir do storage
  const { error: storageError } = await supabase.storage
    .from('sinistros')
    .remove([storagePath]);
  
  if (storageError) {
    console.error('Erro ao excluir do storage:', storageError);
  }
  
  // 2. Excluir do banco
  const { error: dbError } = await supabase
    .from('sinistro_fotos')
    .delete()
    .eq('id', fotoId);
  
  if (dbError) {
    throw new Error(`Erro ao excluir foto: ${dbError.message}`);
  }
}

/**
 * Busca fotos do sinistro com URLs assinadas
 */
export async function buscarFotosComUrls(sinistroId: string): Promise<Array<{
  id: string;
  tipo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  created_at: string;
  url_assinada: string | null;
}>> {
  // 1. Buscar registros do banco
  const { data: fotos, error } = await supabase
    .from('sinistro_fotos')
    .select('*')
    .eq('sinistro_id', sinistroId)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  if (!fotos?.length) return [];
  
  // 2. Gerar URLs assinadas para cada foto
  const fotosComUrls = await Promise.all(
    fotos.map(async (foto) => {
      const { data } = await supabase.storage
        .from('sinistros')
        .createSignedUrl(foto.storage_path, 3600);
      
      return {
        id: foto.id,
        tipo: foto.tipo,
        storage_path: foto.storage_path,
        tamanho_bytes: foto.tamanho_bytes,
        created_at: foto.created_at || '',
        url_assinada: data?.signedUrl || null,
      };
    })
  );
  
  return fotosComUrls;
}
