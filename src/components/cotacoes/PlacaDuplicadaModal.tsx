import { format, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, User, FileText, Calendar, Info, Clock } from 'lucide-react';
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
import type { PlacaDuplicadaInfo } from '@/hooks/useVerificarPlaca';

interface PlacaDuplicadaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  info: PlacaDuplicadaInfo | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviada: { label: 'Enviada', variant: 'default' },
  aceita: { label: 'Aceita', variant: 'default' },
};

export function PlacaDuplicadaModal({
  open,
  onOpenChange,
  placa,
  info,
}: PlacaDuplicadaModalProps) {
  if (!info) return null;

  const formatarData = (dataStr: string) => {
    try {
      const data = new Date(dataStr);
      return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  const formatarPlaca = (placa: string) => {
    const limpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (limpa.length === 7) {
      return `${limpa.slice(0, 3)}-${limpa.slice(3)}`;
    }
    return limpa;
  };

  const statusInfo = STATUS_LABELS[info.status] || { label: info.status, variant: 'outline' as const };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Placa Já em Atendimento
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-4">
            <p className="text-base">
              A placa <span className="font-semibold text-foreground">{formatarPlaca(placa)}</span> já está vinculada a outro consultor e não pode ser utilizada para uma nova cotação no momento.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Consultor:</span>
                <span className="font-medium text-foreground">{info.vendedorNome}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cotação:</span>
                <span className="font-medium text-foreground">{info.numero}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cadastrada em:</span>
                <span className="font-medium text-foreground">{formatarData(info.createdAt)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Para atender este cliente, entre em contato com o consultor responsável.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
