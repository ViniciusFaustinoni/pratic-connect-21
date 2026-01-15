import { useCallback, useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isPdf, convertPdfToImage, getPdfConvertedName } from '@/lib/pdfToImage';

interface LeadDocumentUploaderProps {
  leadId: string;
  onDataExtracted: (dados: { nome?: string; cpf?: string }) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export function LeadDocumentUploader({ leadId, onDataExtracted }: LeadDocumentUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{ nome?: string; cpf?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use JPG, PNG ou PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setStatus('uploading');
    setDocumentName(file.name);
    setErrorMessage(null);
    setExtractedData(null);

    try {
      let fileToUpload = file;
      let finalFileName = file.name;

      // Se for PDF, converter para imagem
      if (isPdf(file)) {
        setStatus('processing');
        toast.info('Convertendo PDF para imagem...');
        
        try {
          const imageBlob = await convertPdfToImage(file);
          finalFileName = getPdfConvertedName(file.name);
          fileToUpload = new File([imageBlob], finalFileName, { type: 'image/jpeg' });
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Erro ao converter PDF. Tente enviar como imagem JPG ou PNG.');
        }
      }

      // 1. Upload para storage
      const timestamp = Date.now();
      const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `leads/${leadId}/${timestamp}_${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contratos-documentos')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error('Erro ao enviar arquivo para o storage.');
      }

      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from('contratos-documentos')
        .getPublicUrl(uploadData.path);

      const arquivoUrl = urlData.publicUrl;

      // 3. Chamar OCR
      setStatus('processing');
      toast.info('Processando documento com IA...');

      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('document-ocr', {
        body: { url: arquivoUrl, tipoEsperado: 'cnh' }
      });

      if (ocrError) {
        throw new Error(ocrError.message || 'Erro ao processar documento com IA');
      }

      // 4. Extrair nome e CPF
      const dados = ocrData?.dados || ocrData;
      const extractedNome = dados?.nome || ocrData?.nome;
      const extractedCpf = dados?.cpf || ocrData?.cpf;

      if (!extractedNome && !extractedCpf) {
        throw new Error('Não foi possível extrair dados do documento. Verifique a qualidade da imagem.');
      }

      const result = {
        nome: extractedNome || undefined,
        cpf: extractedCpf?.replace(/\D/g, '') || undefined,
      };

      setExtractedData(result);
      setStatus('success');
      
      // Notificar o componente pai
      onDataExtracted(result);
      
      toast.success('Dados extraídos do documento!');

    } catch (error: any) {
      console.error('Upload/OCR error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Erro ao processar documento');
      toast.error(error.message || 'Erro ao processar documento');
    }
  }, [leadId, onDataExtracted]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
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

  const resetUploader = () => {
    setStatus('idle');
    setDocumentName(null);
    setExtractedData(null);
    setErrorMessage(null);
  };

  // Estado de sucesso - mostrar dados extraídos
  if (status === 'success' && extractedData) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-700">Documento processado!</p>
              <p className="text-xs text-muted-foreground truncate">{documentName}</p>
              <div className="mt-2 space-y-1 text-sm">
                {extractedData.nome && (
                  <p><span className="font-medium">Nome:</span> {extractedData.nome}</p>
                )}
                {extractedData.cpf && (
                  <p><span className="font-medium">CPF:</span> {extractedData.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
                )}
              </div>
              <button
                type="button"
                onClick={resetUploader}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Enviar outro documento
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado de erro
  if (status === 'error') {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-700">Erro no processamento</p>
              <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
              <button
                type="button"
                onClick={resetUploader}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado de processamento
  if (status === 'uploading' || status === 'processing') {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {status === 'uploading' ? 'Enviando documento...' : 'Processando com IA...'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{documentName}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado inicial - área de upload
  return (
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
      <CardContent className="p-4">
        <label className="flex items-center gap-4 cursor-pointer">
          <div className={cn(
            "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
            "bg-primary/10"
          )}>
            <Upload className={cn(
              "h-6 w-6",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium">
              Upload de Documento (CNH ou RG)
            </p>
            <p className="text-xs text-muted-foreground">
              Arraste ou clique para selecionar
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary">Preenchimento automático com IA</span>
            </div>
          </div>

          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">CNH</Badge>
            <Badge variant="secondary" className="text-xs">RG</Badge>
          </div>

          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              handleFileSelect(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}
