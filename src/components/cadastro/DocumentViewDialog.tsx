import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FileText } from 'lucide-react';
import { TIPOS_DOCUMENTO_CONFIG, type DocumentoInfo } from './DocumentUploader';
import { cn } from '@/lib/utils';

interface DocumentViewDialogProps {
  documento: DocumentoInfo | null;
  onClose: () => void;
}

const statusConfig = {
  pendente: {
    badgeClass: 'bg-yellow-100 text-yellow-800',
    texto: 'Pendente',
  },
  em_analise: {
    badgeClass: 'bg-blue-100 text-blue-800',
    texto: 'Em Análise',
  },
  aprovado: {
    badgeClass: 'bg-green-100 text-green-800',
    texto: 'Aprovado',
  },
  reprovado: {
    badgeClass: 'bg-red-100 text-red-800',
    texto: 'Reprovado',
  },
  expirado: {
    badgeClass: 'bg-gray-100 text-gray-800',
    texto: 'Expirado',
  },
};

export function DocumentViewDialog({ documento, onClose }: DocumentViewDialogProps) {
  if (!documento) return null;

  const isPdf = documento.arquivo_url.toLowerCase().endsWith('.pdf');
  const tipoLabel = TIPOS_DOCUMENTO_CONFIG[documento.tipo]?.label || documento.tipo;
  const status = statusConfig[documento.status];

  return (
    <Dialog open={!!documento} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{tipoLabel}</DialogTitle>
            <Badge className={cn('text-xs', status.badgeClass)}>
              {status.texto}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {isPdf ? (
            <object
              data={documento.arquivo_url}
              type="application/pdf"
              className="w-full h-[60vh] rounded-lg border"
            >
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(documento.arquivo_url)}&embedded=true`}
                className="w-full h-[60vh] rounded-lg border-0"
                title="Documento PDF"
              />
            </object>
          ) : (
            <img
              src={documento.arquivo_url}
              alt={tipoLabel}
              className="max-h-[60vh] max-w-full object-contain rounded-lg"
            />
          )}

          {documento.status === 'reprovado' && documento.motivo_reprovacao && (
            <div className="mt-4 w-full p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Motivo da reprovação:</span>
              </div>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {documento.motivo_reprovacao}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
