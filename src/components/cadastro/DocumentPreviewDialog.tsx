import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { TIPOS_DOCUMENTO_CONFIG } from './DocumentUploader';
import type { Database } from '@/integrations/supabase/types';

type TipoDocumento = Database['public']['Enums']['tipo_documento'];

interface DocumentPreviewDialogProps {
  file: File | null;
  tipo: TipoDocumento | null;
  onClose: () => void;
  onConfirm: () => void;
  isUploading: boolean;
}

export function DocumentPreviewDialog({
  file,
  tipo,
  onClose,
  onConfirm,
  isUploading,
}: DocumentPreviewDialogProps) {
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const isPdf = file?.type === 'application/pdf';
  const tipoLabel = tipo ? TIPOS_DOCUMENTO_CONFIG[tipo]?.label : '';
  const fileSize = file ? (file.size / 1024 / 1024).toFixed(2) : '0';

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirmar envio - {tipoLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {isPdf ? (
            <div className="h-64 w-full flex items-center justify-center bg-muted rounded-lg">
              <FileText className="h-20 w-20 text-muted-foreground" />
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-96 max-w-full object-contain rounded-lg"
            />
          ) : null}

          <div className="mt-4 text-center">
            <p className="font-medium">{file?.name}</p>
            <p className="text-sm text-muted-foreground">{fileSize} MB</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Confirmar Envio'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
