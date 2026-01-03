import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAnaliseDocumento, useDocumento } from '@/hooks/useDocumentos';
import { TIPO_DOCUMENTO_LABELS, STATUS_DOCUMENTO_LABELS, type TipoDocumento, type StatusDocumento } from '@/types/database';
import { toast } from 'sonner';

interface DocumentoAnaliseDialogProps {
  documentoId: string;
  open: boolean;
  onClose: () => void;
}

export function DocumentoAnaliseDialog({
  documentoId,
  open,
  onClose,
}: DocumentoAnaliseDialogProps) {
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [action, setAction] = useState<'aprovar' | 'reprovar' | null>(null);

  const { data: documento, isLoading } = useDocumento(documentoId);
  const analise = useAnaliseDocumento();

  const handleAnalise = async (status: 'aprovado' | 'reprovado') => {
    if (status === 'reprovado' && !motivoReprovacao.trim()) {
      toast.error('Informe o motivo da reprovação');
      return;
    }

    setAction(status === 'aprovado' ? 'aprovar' : 'reprovar');

    try {
      await analise.mutateAsync({
        id: documentoId,
        status,
        motivo_reprovacao: status === 'reprovado' ? motivoReprovacao : undefined,
      });

      toast.success(
        status === 'aprovado' 
          ? 'Documento aprovado com sucesso' 
          : 'Documento reprovado'
      );
      onClose();
    } catch (error) {
      toast.error('Erro ao analisar documento');
    } finally {
      setAction(null);
    }
  };

  const statusColors: Record<StatusDocumento, string> = {
    pendente: 'bg-yellow-500 text-white',
    em_analise: 'bg-blue-500 text-white',
    aprovado: 'bg-green-500 text-white',
    reprovado: 'bg-destructive text-destructive-foreground',
    expirado: 'bg-gray-500 text-white',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Analisar Documento</DialogTitle>
          <DialogDescription>
            Revise o documento e aprove ou reprove conforme necessário.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : documento ? (
          <div className="space-y-4">
            {/* Info do documento */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <Badge variant="outline">
                  {TIPO_DOCUMENTO_LABELS[documento.tipo as TipoDocumento]}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Status Atual</p>
                <Badge className={statusColors[documento.status as StatusDocumento]}>
                  {STATUS_DOCUMENTO_LABELS[documento.status as StatusDocumento]}
                </Badge>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Arquivo</p>
                <p className="font-mono text-xs">{documento.nome_arquivo}</p>
              </div>
            </div>

            {/* Link para visualizar */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open(documento.arquivo_url, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Visualizar Documento
            </Button>

            {/* Motivo de reprovação */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da reprovação (obrigatório se reprovar)</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da reprovação..."
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovacao(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Documento não encontrado
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAnalise('reprovado')}
            disabled={analise.isPending || !documento}
          >
            {action === 'reprovar' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <XCircle className="mr-2 h-4 w-4" />
            Reprovar
          </Button>
          <Button
            onClick={() => handleAnalise('aprovado')}
            disabled={analise.isPending || !documento}
          >
            {action === 'aprovar' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle className="mr-2 h-4 w-4" />
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
