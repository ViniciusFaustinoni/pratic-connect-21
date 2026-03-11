import { useCallback, useState } from 'react';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X,
  Eye,
  Car,
  User,
  Home,
  FileSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';


export type TipoDocumentoDetectado = 'cnh' | 'rg' | 'crlv' | 'comprovante_residencia' | 'outro';

export interface OcrResultadoUnificado {
  tipo_detectado: TipoDocumentoDetectado;
  sucesso: boolean;
  dados: Record<string, string | null>;
  legivel: boolean;
  valido: boolean;
  sugestao: 'aprovar' | 'reprovar' | 'revisar';
  motivo: string;
  confianca: number;
}

export interface DocumentoUnificado {
  id: string;
  arquivo_url: string;
  arquivo_nome: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  tipo_detectado?: TipoDocumentoDetectado;
  ocr?: OcrResultadoUnificado;
  error?: string;
}

interface UnifiedDocumentUploaderProps {
  cotacaoId?: string;
  contratoId?: string;
  veiculoId?: string; // ID do veículo para atualização automática de CRLV
  onDocumentsChange: (docs: DocumentoUnificado[]) => void;
  onOcrDataExtracted: (dados: Record<string, string>, tipoDocumento?: string) => void;
  cpfEsperado?: string;
  nomeEsperado?: string;
}

const tipoLabels: Record<TipoDocumentoDetectado, { label: string; icon: typeof FileText }> = {
  cnh: { label: 'CNH', icon: User },
  rg: { label: 'RG', icon: User },
  crlv: { label: 'CRLV', icon: Car },
  comprovante_residencia: { label: 'Comprovante de Residência', icon: Home },
  outro: { label: 'Documento', icon: FileText },
};

const documentosEsperados = [
  { tipo: 'cnh' as const, label: 'CNH ou RG', alternativa: 'rg' as const },
  { tipo: 'comprovante_residencia' as const, label: 'Comprovante de Residência' },
  { tipo: 'crlv' as const, label: 'CRLV do Veículo' },
];

const MIME_TYPE_MAP: Record<string, string> = {
  'jfif': 'image/jpeg',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'gif': 'image/gif',
  'heic': 'image/heic',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'pdf': 'application/pdf',
};

export function UnifiedDocumentUploader({
  cotacaoId,
  contratoId,
  veiculoId,
  onDocumentsChange,
  onOcrDataExtracted,
  cpfEsperado,
  nomeEsperado,
}: UnifiedDocumentUploaderProps) {
  const [documents, setDocuments] = useState<DocumentoUnificado[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processFile = useCallback(async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'jfif', 'bmp', 'gif', 'heic'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast.error('Formato não suportado. Use JPG, PNG ou PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const entityId = contratoId || cotacaoId;
    const originalFileName = file.name;
    
    const newDoc: DocumentoUnificado = {
      id: tempId,
      arquivo_url: URL.createObjectURL(file),
      arquivo_nome: originalFileName,
      status: 'uploading',
    };

    setDocuments(prev => {
      const updated = [...prev, newDoc];
      onDocumentsChange(updated);
      return updated;
    });

    try {
      const fileToUpload = file;
      const finalFileName = originalFileName;

      // 1. Upload para storage
      // Usar cliente e bucket público para cotações (cliente não autenticado) ou bucket de contratos (autenticado)
      const isPublicFlow = cotacaoId && !contratoId;
      const supabaseClient = isPublicFlow ? publicSupabase : supabase;
      const bucketName = isPublicFlow ? 'cotacoes-docs' : 'contratos-documentos';
      
      const timestamp = Date.now();
      const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${entityId}/documentos/${timestamp}_${sanitizedFileName}`;

      const fileExt = sanitizedFileName.split('.').pop()?.toLowerCase() || '';
      const contentType = MIME_TYPE_MAP[fileExt] || file.type || 'application/octet-stream';

      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from(bucketName)
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError, {
          fileName: sanitizedFileName,
          contentType,
          fileSize: fileToUpload.size,
          bucket: bucketName,
        });
        throw new Error('Erro ao enviar arquivo para o storage.');
      }

      // 2. Obter URL pública
      const { data: urlData } = supabaseClient.storage
        .from(bucketName)
        .getPublicUrl(uploadData.path);

      const arquivoUrl = urlData.publicUrl;

      // Atualizar status para processando
      setDocuments(prev => {
        const updated = prev.map(d => 
          d.id === tempId ? { ...d, arquivo_url: arquivoUrl, status: 'processing' as const } : d
        );
        onDocumentsChange(updated);
        return updated;
      });

      // 3. Chamar OCR para detectar tipo e extrair dados (usar cliente apropriado)
      const ocrClient = cotacaoId && !contratoId ? publicSupabase : supabase;
      const { data: ocrData, error: ocrError } = await ocrClient.functions.invoke('document-ocr', {
        body: { url: arquivoUrl, cpfEsperado, nomeEsperado }
      });

      if (ocrError) {
        console.error('OCR error details:', ocrError);
        // Tentar extrair mensagem mais específica do erro
        const errorMessage = ocrError.context?.message || ocrError.message || 'Erro ao processar documento com IA';
        throw new Error(errorMessage);
      }

      const ocrResult = ocrData as OcrResultadoUnificado;

      // 4. Inserir no banco com tipo detectado (usar cliente apropriado)
      const { data: docData, error: insertError } = await supabaseClient
        .from('contratos_documentos')
        .insert({
          contrato_id: contratoId || null,
          cotacao_id: cotacaoId || null,
          tipo: ocrResult.tipo_detectado || 'outro',
          arquivo_url: arquivoUrl,
          arquivo_nome: originalFileName, // Keep original name for reference
          status: ocrResult.sugestao === 'aprovar' ? 'aprovado' : 'pendente',
          ocr_resultado: ocrResult as any,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
      }

      // 5. Atualizar documento com resultado
      const successDoc: DocumentoUnificado = {
        id: docData?.id || tempId,
        arquivo_url: arquivoUrl,
        arquivo_nome: originalFileName,
        status: 'success',
        tipo_detectado: ocrResult.tipo_detectado,
        ocr: ocrResult,
      };

      setDocuments(prev => {
        const updated = prev.map(d => d.id === tempId ? successDoc : d);
        onDocumentsChange(updated);
        return updated;
      });

      // 6. Notificar dados extraídos
      if (ocrResult.sucesso && ocrResult.dados) {
        console.log('[OCR] Tipo detectado:', ocrResult.tipo_detectado);
        console.log('[OCR] Dados extraídos brutos:', ocrResult.dados);
        
        const dadosLimpos: Record<string, string> = {};
        Object.entries(ocrResult.dados).forEach(([key, value]) => {
          if (value) dadosLimpos[key] = value;
        });
        
        console.log('[OCR] Dados limpos para mapeamento:', dadosLimpos);
        onOcrDataExtracted(dadosLimpos, ocrResult.tipo_detectado);
        
        // NOVO: Se for CRLV e temos veiculoId, atualizar renavam/chassi automaticamente
        if (ocrResult.tipo_detectado === 'crlv' && veiculoId) {
          const updateData: Record<string, string> = {};
          
          // Mapear campos do OCR para o veículo
          if (dadosLimpos.renavam) updateData.renavam = dadosLimpos.renavam;
          if (dadosLimpos.chassi) updateData.chassi = dadosLimpos.chassi;
          
          if (Object.keys(updateData).length > 0) {
            console.log('[OCR] Atualizando veículo com dados do CRLV:', updateData);
            
            const { error: updateError } = await supabase
              .from('veiculos')
              .update(updateData)
              .eq('id', veiculoId);
            
            if (updateError) {
              console.error('[OCR] Erro ao atualizar veículo:', updateError);
            } else {
              toast.success('Dados do veículo atualizados automaticamente', {
                description: `${Object.keys(updateData).join(' e ').toUpperCase()} extraídos do CRLV`,
              });
            }
          }
        }
      }

      toast.success(`${tipoLabels[ocrResult.tipo_detectado]?.label || 'Documento'} identificado com sucesso!`);

    } catch (error: any) {
      console.error('Upload error:', error);
      setDocuments(prev => {
        const updated = prev.map(d => 
          d.id === tempId ? { ...d, status: 'error' as const, error: error.message } : d
        );
        onDocumentsChange(updated);
        return updated;
      });
      toast.error(error.message || 'Erro ao processar documento');
    }
  }, [cotacaoId, contratoId, veiculoId, onDocumentsChange, onOcrDataExtracted, cpfEsperado, nomeEsperado]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    
    for (const file of Array.from(files)) {
      await processFile(file);
    }
    
    setIsProcessing(false);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const removeDocument = useCallback(async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    // Se foi salvo no banco, deletar
    if (!docId.startsWith('temp-')) {
      try {
        await supabase.from('contratos_documentos').delete().eq('id', docId);
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }

    setDocuments(prev => {
      const updated = prev.filter(d => d.id !== docId);
      onDocumentsChange(updated);
      return updated;
    });
  }, [documents, onDocumentsChange]);

  // Verificar documentos faltantes
  const tiposIdentificados = documents
    .filter(d => d.status === 'success' && d.tipo_detectado)
    .map(d => d.tipo_detectado!);

  const documentosFaltantes = documentosEsperados.filter(esperado => {
    if (esperado.alternativa) {
      return !tiposIdentificados.includes(esperado.tipo) && !tiposIdentificados.includes(esperado.alternativa);
    }
    return !tiposIdentificados.includes(esperado.tipo);
  });

  const documentosCompletos = documentosFaltantes.length === 0;
  const uploadingCount = documents.filter(d => d.status === 'uploading' || d.status === 'processing').length;

  return (
    <div className="space-y-4">
      {/* Header com status */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Documentos
        </h3>
        {documentosCompletos ? (
          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Documentação completa
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {documentosFaltantes.length} documento(s) faltando
          </Badge>
        )}
      </div>

      {/* Área de upload unificada */}
      <Card
        className={cn(
          "border-2 border-dashed transition-all cursor-pointer",
          isDragOver && "border-primary bg-primary/5",
          "hover:border-primary/50 hover:bg-muted/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-8">
          <label className="flex flex-col items-center gap-4 cursor-pointer text-center">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center",
              "bg-primary/10"
            )}>
              <Upload className={cn(
                "h-8 w-8",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            
            <div>
              <p className="font-medium text-lg">
                Arraste todos os documentos aqui
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou clique para selecionar
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Badge variant="secondary">CNH</Badge>
              <Badge variant="secondary">RG</Badge>
              <Badge variant="secondary">CRLV</Badge>
              <Badge variant="secondary">Comprovante de Residência</Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              A IA detectará automaticamente cada tipo de documento
            </p>

            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </CardContent>
      </Card>

      {/* Progress durante processamento */}
      {uploadingCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Processando {uploadingCount} documento(s)...</span>
          </div>
          <Progress value={undefined} className="h-1" />
        </div>
      )}

      {/* Lista de documentos identificados */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Documentos Identificados:</h4>
          <div className="grid gap-2">
            {documents.map((doc) => {
              const tipoInfo = doc.tipo_detectado ? tipoLabels[doc.tipo_detectado] : tipoLabels.outro;
              const Icon = tipoInfo.icon;
              
              return (
                <Card key={doc.id} className={cn(
                  "relative overflow-hidden transition-all",
                  doc.status === 'uploading' && "border-blue-500/50 bg-blue-500/5",
                  doc.status === 'processing' && "border-amber-500/50 bg-amber-500/5",
                  doc.status === 'success' && "border-green-500/50 bg-green-500/5",
                  doc.status === 'error' && "border-red-500/50 bg-red-500/5"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                        doc.status === 'uploading' && "bg-blue-500/20",
                        doc.status === 'processing' && "bg-amber-500/20",
                        doc.status === 'success' && "bg-green-500/20",
                        doc.status === 'error' && "bg-red-500/20"
                      )}>
                        {doc.status === 'uploading' ? (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        ) : doc.status === 'processing' ? (
                          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                        ) : doc.status === 'success' ? (
                          <Icon className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm">
                            {doc.status === 'success' && doc.tipo_detectado 
                              ? tipoInfo.label 
                              : doc.status === 'processing'
                                ? 'Analisando...'
                                : doc.status === 'uploading'
                                  ? 'Enviando...'
                                  : 'Erro'
                            }
                          </p>
                          {doc.ocr?.confianca && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(doc.ocr.confianca * 100)}% confiança
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.arquivo_nome}
                        </p>
                        
                        {doc.status === 'processing' && (
                          <p className="text-xs text-amber-600 mt-1">Detectando tipo e extraindo dados...</p>
                        )}
                        
                        {doc.status === 'success' && doc.ocr?.dados && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {Object.entries(doc.ocr.dados).slice(0, 3).map(([key, value]) => {
                              if (!value) return null;
                              const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return (
                                <span key={key} className="mr-3">
                                  <span className="font-medium">{label}:</span> {value}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        
                        {doc.status === 'error' && (
                          <p className="text-xs text-red-600 mt-1">{doc.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {doc.status === 'success' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(doc.arquivo_url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDocument(doc.id)}
                          disabled={doc.status === 'uploading' || doc.status === 'processing'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Documentos faltantes */}
      {documentosFaltantes.length > 0 && documents.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Documentos faltando:
          </p>
          <ul className="mt-2 space-y-1">
            {documentosFaltantes.map((doc, i) => (
              <li key={i} className="text-sm text-amber-600 dark:text-amber-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {doc.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formatos aceitos: JPG, PNG, PDF (máx. 10MB por arquivo). 
        Envie todos os documentos de uma vez - a IA identificará cada um automaticamente.
      </p>
    </div>
  );
}
