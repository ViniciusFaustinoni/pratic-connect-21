import { ArrowLeftRight, PlusCircle, Car } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface VeiculoAtivoInfo {
  associado_id: string;
  associado_nome: string;
  veiculo_placa: string;
  veiculo_modelo: string;
  veiculo_marca: string;
}

interface DialogTipoOperacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculoAtivo: VeiculoAtivoInfo;
  onSubstituicao: (associadoId: string) => void;
  onInclusao: () => void;
}

export function DialogTipoOperacao({
  open,
  onOpenChange,
  veiculoAtivo,
  onSubstituicao,
  onInclusao,
}: DialogTipoOperacaoProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Cliente já possui veículo ativo
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <strong>{veiculoAtivo.associado_nome}</strong> já possui um veículo ativo na Praticcar:
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {veiculoAtivo.veiculo_marca} {veiculoAtivo.veiculo_modelo}
                  </p>
                  <p className="text-muted-foreground">
                    Placa: <Badge variant="outline" className="text-xs uppercase">{veiculoAtivo.veiculo_placa}</Badge>
                  </p>
                </div>
              </div>
              <p className="text-sm">Este cliente deseja substituir o veículo atual ou incluir um segundo veículo?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onInclusao();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Incluir segundo veículo
          </Button>
          <Button
            onClick={() => {
              onSubstituicao(veiculoAtivo.associado_id);
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Substituir veículo
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
