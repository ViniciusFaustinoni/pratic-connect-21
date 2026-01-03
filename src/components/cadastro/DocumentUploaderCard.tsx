import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileUp, Check, X, Eye, RefreshCw, Loader2, FileText, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPOS_DOCUMENTO_CONFIG, type DocumentoInfo } from './DocumentUploader';
import type { Database } from '@/integrations/supabase/types';

type TipoDocumento = Database['public']['Enums']['tipo_documento'];

interface TipoDocumentoConfig {
  label: string;
  obrigatorio: boolean;
  categoria: 'pessoal' | 'veiculo';
  icone: typeof FileText | typeof Camera;
  descricao: string;
}

interface DocumentUploaderCardProps {
  tipo: TipoDocumento;
  config: TipoDocumentoConfig;
  documento?: DocumentoInfo;
  isUploading: boolean;
  readOnly: boolean;
  onFileSelect: (tipo: TipoDocumento, file: File) => void;
  onView: (doc: DocumentoInfo) => void;
}

const statusConfig = {
  pendente: {
    borderClass: 'border-yellow-400',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950/20',
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    texto: 'Pendente',
  },
  em_analise: {
    borderClass: 'border-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    texto: 'Em Análise',
  },
  aprovado: {
    borderClass: 'border-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/20',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    texto: 'Aprovado',
  },
  reprovado: {
    borderClass: 'border-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/20',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    texto: 'Reprovado',
  },
  expirado: {
    borderClass: 'border-gray-400',
    bgClass: 'bg-gray-50 dark:bg-gray-950/20',
    badgeClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    texto: 'Expirado',
  },
};

export function DocumentUploaderCard({
  tipo,
  config,
  documento,
  isUploading,
  readOnly,
  onFileSelect,
  onView,
}: DocumentUploaderCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icone = config.icone;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-primary', 'bg-primary/5');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
    if (!readOnly && e.dataTransfer.files?.[0]) {
      onFileSelect(tipo, e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (!readOnly) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onFileSelect(tipo, e.target.files[0]);
      e.target.value = ''; // Reset para permitir re-seleção do mesmo arquivo
    }
  };

  // Estado: Enviando
  if (isUploading) {
    return (
      <Card className="border-2 border-primary bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center p-4 h-48">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <Progress value={50} className="h-2 w-full mt-4" />
          <p className="text-sm font-medium text-primary mt-2">Enviando...</p>
          <p className="text-xs text-muted-foreground mt-1">{config.label}</p>
        </CardContent>
      </Card>
    );
  }

  // Estado: Com documento
  if (documento) {
    const status = statusConfig[documento.status];

    return (
      <Card className={cn('border-2 overflow-hidden', status.borderClass, status.bgClass)}>
        <CardContent className="p-0 h-48 flex flex-col">
          {/* Thumbnail */}
          <div className="relative flex-1 min-h-0">
            {documento.arquivo_url.toLowerCase().endsWith('.pdf') ? (
              <div className="h-full flex items-center justify-center bg-muted">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={documento.arquivo_url}
                alt={config.label}
                className="w-full h-full object-cover"
              />
            )}
            {documento.status === 'aprovado' && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                <Check className="h-10 w-10 text-green-600" />
              </div>
            )}
            {documento.status === 'reprovado' && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                <X className="h-10 w-10 text-red-600" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={cn('text-xs', status.badgeClass)}>
                {status.texto}
              </Badge>
            </div>

            {documento.status === 'reprovado' && documento.motivo_reprovacao && (
              <p className="text-xs text-red-600 dark:text-red-400 line-clamp-1">
                {documento.motivo_reprovacao}
              </p>
            )}

            <p className="text-xs font-medium line-clamp-1">
              {config.label}
              {config.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </p>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => onView(documento)}
              >
                <Eye className="h-3 w-3 mr-1" />
                Ver
              </Button>
              {!readOnly && documento.status !== 'aprovado' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={handleClick}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {documento.status === 'reprovado' ? 'Novo' : 'Trocar'}
                </Button>
              )}
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>
    );
  }

  // Estado: Vazio
  return (
    <Card
      className={cn(
        'border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer',
        readOnly && 'cursor-not-allowed opacity-60'
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center p-4 h-48 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <FileUp className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Clique ou arraste</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou PDF até 10MB</p>
        <p className="text-xs font-medium mt-3">
          {config.label}
          {config.obrigatorio && <span className="text-red-500 ml-1">*</span>}
        </p>
        <p className="text-xs text-muted-foreground">{config.descricao}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
