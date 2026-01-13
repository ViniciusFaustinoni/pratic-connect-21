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
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  useUploadDocumentoContrato, 
  type TipoDocumentoContrato,
  type OcrResultado 
} from '@/hooks/useContratoDocumentos';

interface UploadedDocument {
  id: string;
  tipo: TipoDocumentoContrato;
  arquivo_url: string;
  arquivo_nome: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  ocr?: OcrResultado;
  error?: string;
}

interface DocumentUploaderProps {
  cotacaoId?: string;
  contratoId?: string;
  onDocumentsChange: (docs: UploadedDocument[]) => void;
  onOcrDataExtracted: (dados: Record<string, string>) => void;
  initialDocuments?: UploadedDocument[];
}

const tipoConfig: Record<TipoDocumentoContrato, { 
  label: string; 
  descricao: string; 
  icon: typeof FileText;
  obrigatorio: boolean;
}> = {
  crlv: { 
    label: 'CRLV do Veículo', 
    descricao: 'Documento de licenciamento do veículo',
    icon: Car,
    obrigatorio: true,
  },
  cnh: { 
    label: 'CNH', 
    descricao: 'Carteira Nacional de Habilitação',
    icon: User,
    obrigatorio: true,
  },
  rg: { 
    label: 'RG', 
    descricao: 'Documento de identidade (alternativa à CNH)',
    icon: User,
    obrigatorio: false,
  },
  comprovante_residencia: { 
    label: 'Comprovante de Residência', 
    descricao: 'Conta de luz, água ou telefone',
    icon: Home,
    obrigatorio: true,
  },
};

export function DocumentUploader({
  cotacaoId,
  contratoId,
  onDocumentsChange,
  onOcrDataExtracted,
  initialDocuments = [],
}: DocumentUploaderProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>(initialDocuments);
  const [dragOver, setDragOver] = useState<TipoDocumentoContrato | null>(null);
  
  const uploadMutation = useUploadDocumentoContrato();

  const handleFileSelect = useCallback(async (
    file: File, 
    tipo: TipoDocumentoContrato
  ) => {
    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return;
    }

    // Validar tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newDoc: UploadedDocument = {
      id: tempId,
      tipo,
      arquivo_url: URL.createObjectURL(file),
      arquivo_nome: file.name,
      status: 'uploading',
    };

    setDocuments(prev => {
      // Remover documento anterior do mesmo tipo
      const filtered = prev.filter(d => d.tipo !== tipo);
      return [...filtered, newDoc];
    });

    try {
      const result = await uploadMutation.mutateAsync({
        file,
        tipo,
        cotacaoId,
        contratoId,
      });

      const successDoc: UploadedDocument = {
        id: result.documento.id,
        tipo,
        arquivo_url: result.documento.arquivo_url,
        arquivo_nome: result.documento.arquivo_nome || file.name,
        status: 'success',
        ocr: result.ocr,
      };

      setDocuments(prev => {
        const updated = prev.map(d => d.id === tempId ? successDoc : d);
        onDocumentsChange(updated);
        return updated;
      });

      // Extrair dados do OCR se disponível
      if (result.ocr.sucesso && result.ocr.dados) {
        onOcrDataExtracted(result.ocr.dados as Record<string, string>);
      }
    } catch (error: any) {
      setDocuments(prev => 
        prev.map(d => d.id === tempId ? { ...d, status: 'error', error: error.message } : d)
      );
    }
  }, [cotacaoId, contratoId, uploadMutation, onDocumentsChange, onOcrDataExtracted]);

  const handleDrop = useCallback((
    e: React.DragEvent<HTMLDivElement>, 
    tipo: TipoDocumentoContrato
  ) => {
    e.preventDefault();
    setDragOver(null);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0], tipo);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((
    e: React.DragEvent<HTMLDivElement>, 
    tipo: TipoDocumentoContrato
  ) => {
    e.preventDefault();
    setDragOver(tipo);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const removeDocument = useCallback((tipo: TipoDocumentoContrato) => {
    setDocuments(prev => {
      const updated = prev.filter(d => d.tipo !== tipo);
      onDocumentsChange(updated);
      return updated;
    });
  }, [onDocumentsChange]);

  const getDocumentForTipo = (tipo: TipoDocumentoContrato) => {
    return documents.find(d => d.tipo === tipo);
  };

  const renderDropzone = (tipo: TipoDocumentoContrato) => {
    const config = tipoConfig[tipo];
    const doc = getDocumentForTipo(tipo);
    const Icon = config.icon;
    const isDragOver = dragOver === tipo;

    if (doc) {
      return (
        <Card className={cn(
          "relative overflow-hidden transition-all",
          doc.status === 'uploading' && "border-blue-500 bg-blue-500/5",
          doc.status === 'success' && "border-green-500 bg-green-500/5",
          doc.status === 'error' && "border-red-500 bg-red-500/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                doc.status === 'uploading' && "bg-blue-500/20",
                doc.status === 'success' && "bg-green-500/20",
                doc.status === 'error' && "bg-red-500/20"
              )}>
                {doc.status === 'uploading' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : doc.status === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{config.label}</p>
                  {config.obrigatorio && (
                    <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.arquivo_nome}
                </p>
                
                {doc.status === 'uploading' && (
                  <p className="text-xs text-blue-600 mt-1">Processando com IA...</p>
                )}
                
                {doc.status === 'success' && doc.ocr?.sucesso && (
                  <div className="mt-2 text-xs">
                    <p className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Documento lido com sucesso
                      {doc.ocr.confianca && (
                        <span className="text-muted-foreground">
                          ({Math.round(doc.ocr.confianca * 100)}% confiança)
                        </span>
                      )}
                    </p>
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
                  onClick={() => removeDocument(tipo)}
                  disabled={doc.status === 'uploading'}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        className={cn(
          "border-2 border-dashed transition-all cursor-pointer",
          isDragOver && "border-primary bg-primary/5",
          "hover:border-primary/50 hover:bg-muted/50"
        )}
        onDrop={(e) => handleDrop(e, tipo)}
        onDragOver={(e) => handleDragOver(e, tipo)}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              "bg-muted"
            )}>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{config.label}</p>
                {config.obrigatorio && (
                  <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{config.descricao}</p>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span className="text-xs">Upload</span>
            </div>

            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, tipo);
                e.target.value = '';
              }}
            />
          </label>
        </CardContent>
      </Card>
    );
  };

  // Verificar se documentos obrigatórios estão completos
  const documentosObrigatorios: TipoDocumentoContrato[] = ['crlv', 'comprovante_residencia'];
  const temCnhOuRg = documents.some(d => (d.tipo === 'cnh' || d.tipo === 'rg') && d.status === 'success');
  const crlvOk = documents.some(d => d.tipo === 'crlv' && d.status === 'success');
  const comprovanteOk = documents.some(d => d.tipo === 'comprovante_residencia' && d.status === 'success');
  const todosCompletos = temCnhOuRg && crlvOk && comprovanteOk;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Documentos para o Contrato</h3>
        {todosCompletos ? (
          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Documentação completa
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Envie os documentos obrigatórios
          </Badge>
        )}
      </div>

      <div className="grid gap-3">
        {renderDropzone('crlv')}
        {renderDropzone('cnh')}
        {!getDocumentForTipo('cnh') && renderDropzone('rg')}
        {renderDropzone('comprovante_residencia')}
      </div>

      <p className="text-xs text-muted-foreground">
        Formatos aceitos: JPG, PNG, PDF (máx. 10MB). 
        A IA irá ler os documentos e preencher automaticamente os campos.
      </p>
    </div>
  );
}
