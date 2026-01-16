import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadDocumentoParams {
  pdfBytes: Uint8Array;
  nomeArquivo: string;
  pasta?: string; // Ex: 'gerados', 'contratos/123', 'associados/456'
}

interface DocumentoArmazenado {
  path: string;
  url: string;
  tamanho: number;
}

export function useDocumentoStorage() {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Upload do documento para o Storage
  const uploadDocumento = async ({
    pdfBytes,
    nomeArquivo,
    pasta = 'gerados',
  }: UploadDocumentoParams): Promise<DocumentoArmazenado | null> => {
    try {
      setUploading(true);

      // Criar blob do PDF
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });

      // Gerar nome único com timestamp
      const timestamp = Date.now();
      const nomeSeguro = nomeArquivo.replace(/[^a-zA-Z0-9.-]/g, '_');
      const nomeUnico = `${pasta}/${timestamp}-${nomeSeguro}`;

      // Upload para o bucket 'documentos'
      const { data, error } = await supabase.storage
        .from('documentos')
        .upload(nomeUnico, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (error) throw error;

      // Obter URL pública (bucket é público)
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(data.path);

      toast.success('Documento salvo com sucesso!');

      return {
        path: data.path,
        url: urlData.publicUrl,
        tamanho: pdfBytes.length,
      };
    } catch (error: any) {
      console.error('Erro ao salvar documento:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Obter URL pública de um documento
  const obterUrlPublica = (path: string): string => {
    const { data } = supabase.storage
      .from('documentos')
      .getPublicUrl(path);
    
    return data.publicUrl;
  };

  // Download do documento
  const downloadDocumento = async (path: string, nomeArquivo?: string): Promise<boolean> => {
    try {
      setDownloading(true);

      const { data, error } = await supabase.storage
        .from('documentos')
        .download(path);

      if (error) throw error;

      // Criar link de download e disparar
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo || path.split('/').pop() || 'documento.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (error: any) {
      console.error('Erro ao baixar documento:', error);
      toast.error(`Erro ao baixar: ${error.message}`);
      return false;
    } finally {
      setDownloading(false);
    }
  };

  // Excluir documento do Storage
  const excluirDocumento = async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('documentos')
        .remove([path]);

      if (error) throw error;

      toast.success('Documento excluído');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir documento:', error);
      toast.error(`Erro ao excluir: ${error.message}`);
      return false;
    }
  };

  // Listar documentos de uma pasta
  const listarDocumentos = async (pasta: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .list(pasta, {
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      console.error('Erro ao listar documentos:', error);
      return [];
    }
  };

  return {
    uploadDocumento,
    obterUrlPublica,
    downloadDocumento,
    excluirDocumento,
    listarDocumentos,
    uploading,
    downloading,
  };
}
