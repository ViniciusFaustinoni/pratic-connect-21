import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Image, File, Clock, SkipForward } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TIPO_DOCUMENTO_LABELS, 
  STATUS_DOCUMENTO_LABELS,
  TIPO_DOCUMENTO_COLORS,
  STATUS_DOCUMENTO_COLORS,
  type TipoDocumento, 
  type StatusDocumento 
} from '@/types/database';
import type { DocumentoWithFullRelations } from '@/hooks/useDocumentosQueue';

interface DocumentoCardProps {
  documento: DocumentoWithFullRelations;
  onAnalyze: (id: string) => void;
  onSkip?: (id: string) => void;
}

export function DocumentoCard({ documento, onAnalyze, onSkip }: DocumentoCardProps) {
  const isImage = documento.arquivo_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = documento.arquivo_url?.match(/\.pdf$/i);
  
  const tipoColor = TIPO_DOCUMENTO_COLORS[documento.tipo as TipoDocumento] || 'bg-gray-100 text-gray-800';
  const statusColor = STATUS_DOCUMENTO_COLORS[documento.status as StatusDocumento] || 'bg-gray-100 text-gray-800';
  
  const timeAgo = formatDistanceToNow(new Date(documento.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted">
          {isImage ? (
            <img
              src={documento.arquivo_url}
              alt={documento.nome_arquivo}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : isPdf ? (
            <div className="flex h-full w-full items-center justify-center">
              <File className="h-16 w-16 text-muted-foreground" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          
          {/* Badge do tipo */}
          <Badge className={`absolute left-2 top-2 ${tipoColor}`}>
            {TIPO_DOCUMENTO_LABELS[documento.tipo as TipoDocumento]}
          </Badge>
        </div>

        {/* Info */}
        <div className="space-y-3 p-4">
          {/* Nome do associado */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {documento.associados?.nome?.charAt(0) || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {documento.associados?.nome || 'Associado desconhecido'}
              </p>
              <p className="text-sm text-muted-foreground">
                {documento.veiculos?.placa || '—'}
              </p>
            </div>
          </div>

          {/* Data e Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Enviado {timeAgo}</span>
            </div>
            <Badge variant="secondary" className={statusColor}>
              {STATUS_DOCUMENTO_LABELS[documento.status as StatusDocumento]}
            </Badge>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={() => onAnalyze(documento.id)}
            >
              Analisar
            </Button>
            {onSkip && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => onSkip(documento.id)}
                title="Pular"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
