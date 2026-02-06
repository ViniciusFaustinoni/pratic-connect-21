import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Calendar, AlertTriangle, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface BlacklistInfo {
  id: string;
  motivo: string;
  tipo_reprovacao: string;
  created_at: string;
}

interface PlacaBlacklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  info: BlacklistInfo | null;
}

const TIPO_LABELS: Record<string, { label: string; variant: 'destructive' | 'default' }> = {
  vistoria_reprovada: { label: 'Vistoria Reprovada', variant: 'destructive' },
  proposta_reprovada: { label: 'Proposta Reprovada', variant: 'destructive' },
};

export function PlacaBlacklistModal({ open, onOpenChange, placa, info }: PlacaBlacklistModalProps) {
  if (!info) return null;

  const tipoInfo = TIPO_LABELS[info.tipo_reprovacao] || { 
    label: 'Bloqueado', 
    variant: 'destructive' as const 
  };

  const dataFormatada = info.created_at 
    ? format(new Date(info.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Data não informada';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-destructive/50">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Veículo Bloqueado
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <span className="font-mono font-semibold text-lg text-foreground">
              {placa}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Alerta principal */}
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Este veículo está na lista de bloqueio
              </p>
              <p className="text-sm text-muted-foreground">
                Não é possível realizar cotações para este veículo.
              </p>
            </div>
          </div>

          {/* Detalhes do bloqueio */}
          <div className="space-y-3">
            {/* Tipo de reprovação */}
            <div className="flex items-center gap-2">
              <Badge variant={tipoInfo.variant} className="gap-1">
                <Ban className="h-3 w-3" />
                {tipoInfo.label}
              </Badge>
            </div>

            {/* Motivo */}
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Motivo do bloqueio</p>
                <p className="text-sm font-medium">{info.motivo}</p>
              </div>
            </div>

            {/* Data de inclusão */}
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Bloqueado em</p>
                <p className="text-sm font-medium">{dataFormatada}</p>
              </div>
            </div>
          </div>

          {/* Instrução */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground text-center">
              Em caso de dúvidas, entre em contato com a <strong>Diretoria</strong> para verificar a situação deste veículo.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction className="w-full">
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
