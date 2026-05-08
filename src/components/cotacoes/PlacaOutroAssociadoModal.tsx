import { AlertTriangle, ArrowRightLeft, User } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import type { PlacaOutroAssociadoInfo } from '@/hooks/useVerificarPlacaOutroAssociado';
import { useNavigate } from 'react-router-dom';

interface PlacaOutroAssociadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  info: PlacaOutroAssociadoInfo | null;
}

export function PlacaOutroAssociadoModal({
  open,
  onOpenChange,
  placa,
  info,
}: PlacaOutroAssociadoModalProps) {
  const navigate = useNavigate();
  if (!info || !info.conflito) return null;

  const irParaTroca = () => {
    onOpenChange(false);
    if (info.associadoId) {
      navigate(`/cadastro/associados/${info.associadoId}`);
    } else {
      navigate('/cobranca/troca-titularidade');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Placa já pertence a outro associado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm">
              <p>
                A placa <strong>{placa.toUpperCase()}</strong> já está vinculada
                a outro associado em nossa base. Não é possível criar uma cotação
                de <strong>adesão</strong> para esse veículo.
              </p>

              <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{info.associadoNome}</span>
                  {info.status && (
                    <Badge variant="outline" className="text-xs">
                      {info.status}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  CPF: {info.cpfMascarado}
                </div>
              </div>

              <p className="text-muted-foreground">
                Se o veículo está sendo transferido para um novo titular, use o
                fluxo de <strong>Troca de Titularidade</strong>. Caso contrário,
                verifique se a placa foi digitada corretamente.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={irParaTroca} className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Iniciar Troca de Titularidade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
