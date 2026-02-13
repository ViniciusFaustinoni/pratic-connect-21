import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Upload, CheckCircle2, FileText, Camera, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast, Toaster } from 'sonner';
import { useDropzone } from 'react-dropzone';

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';

const DOCUMENTO_LABELS: Record<string, string> = {
  bo: 'Boletim de Ocorrência (B.O.)',
  cnh: 'CNH do Condutor',
  crlv: 'CRLV do Veículo',
  laudo_tecnico: 'Laudo Técnico',
  orcamento_reparo: 'Orçamento de Reparo',
  comprovante_bancario: 'Comprovante Bancário',
  foto_dano_frontal: 'Foto do Dano - Frontal',
  foto_dano_traseiro: 'Foto do Dano - Traseiro',
  foto_dano_lateral_esquerda: 'Foto do Dano - Lateral Esquerda',
  foto_dano_lateral_direita: 'Foto do Dano - Lateral Direita',
  foto_local: 'Foto do Local do Acidente',
  foto_painel: 'Foto do Painel (Hodômetro)',
  outros: 'Outros',
};

const isFotoTipo = (tipo: string) => tipo.startsWith('foto_');

export default function UploadDocumentosSinistro() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  // Buscar sinistro pelo token
  const { data: sinistro, isLoading: loadingSinistro, error: sinistroError } = useQuery({
    queryKey: ['sinistro-upload-token', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await publicSupabase
        .from('sinistros')
        .select('id, protocolo, upload_token_expires_at')
        .eq('upload_token', token)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const tokenExpirado = sinistro?.upload_token_expires_at
    ? new Date(sinistro.upload_token_expires_at) < new Date()
    : false;

  // Buscar documentos pendentes
  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['sinistro-upload-documentos', sinistro?.id],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('sinistro_documentos')
        .select('id, tipo, nome_arquivo, status, arquivo_url')
        .eq('sinistro_id', sinistro!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistro?.id && !tokenExpirado,
  });

  const pendentes = documentos.filter(d => d.status === 'pendente');
  const enviados = documentos.filter(d => d.status !== 'pendente');
  const todosConcluidos = documentos.length > 0 && pendentes.length === 0;

  if (loadingSinistro || loadingDocs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sinistro || sinistroError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Link inválido</h2>
            <p className="text-muted-foreground">Este link de envio de documentos não é válido ou não existe.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenExpirado || todosConcluidos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Toaster />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Documentos enviados!</h2>
            <p className="text-muted-foreground">
              Todos os documentos do sinistro <strong>{sinistro.protocolo}</strong> foram recebidos com sucesso. 
              Nossa equipe já foi notificada e dará continuidade à análise.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Toaster />
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Envio de Documentos</h1>
          <p className="text-muted-foreground">
            Sinistro <strong>{sinistro.protocolo}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Envie os documentos solicitados abaixo para dar continuidade à análise.
          </p>
        </div>

        {/* Documentos pendentes */}
        {pendentes.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Pendentes ({pendentes.length})
            </h3>
            {pendentes.map(doc => (
              <DocumentoUploadCard
                key={doc.id}
                documento={doc}
                token={token!}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sinistro-upload-documentos'] })}
              />
            ))}
          </div>
        )}

        {/* Documentos já enviados */}
        {enviados.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Enviados ({enviados.length})
            </h3>
            {enviados.map(doc => (
              <Card key={doc.id} className="border-green-200 bg-green-50">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span className="text-sm font-medium text-green-800">
                    {DOCUMENTO_LABELS[doc.tipo] || doc.nome_arquivo}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Componente individual de upload por documento
function DocumentoUploadCard({
  documento,
  token,
  onSuccess,
}: {
  documento: any;
  token: string;
  onSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const isFoto = isFotoTipo(documento.tipo);
  const Icon = isFoto ? Camera : FileText;

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('documento_id', documento.id);
      formData.append('arquivo', file);

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/upload-documento-sinistro`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Erro ao enviar documento');
      }

      toast.success(result.message || 'Documento enviado!');
      onSuccess();
    } catch (err: any) {
      console.error('Erro upload:', err);
      toast.error(err.message || 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  }, [token, documento.id, onSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    accept: isFoto
      ? { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }
      : { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <Card>
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-sm">
            {DOCUMENTO_LABELS[documento.tipo] || documento.nome_arquivo}
          </span>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Enviando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isFoto ? 'Toque para tirar foto ou selecionar imagem' : 'Toque para selecionar arquivo'}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {isFoto ? 'JPG, PNG ou WebP' : 'PDF, JPG ou PNG'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
