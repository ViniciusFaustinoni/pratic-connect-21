import { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { IgnorarAvisoSGADialog } from '@/components/cotacao/IgnorarAvisoSGADialog';

interface VeiculoSGAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  /** Quando definido, exibe botão "Ignorar e Prosseguir" + diálogo de motivo */
  onIgnorarEProsseguir?: () => void;
  cpf?: string | null;
}

export function VeiculoSGAModal({
  open,
  onOpenChange,
  placa,
  onIgnorarEProsseguir,
  cpf,
}: VeiculoSGAModalProps) {
  const [showBypass, setShowBypass] = useState(false);

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md border-destructive/50">
          <AlertDialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Veículo já cadastrado no sistema
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <span className="font-mono font-semibold text-lg text-foreground">
                {placa?.toUpperCase()}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  Este veículo já existe no sistema Pratic / SGA
                </p>
                <p className="text-sm text-muted-foreground">
                  Não é recomendado realizar cotação para veículos que já estão cadastrados.
                  Se mesmo assim você precisa prosseguir, registre o motivo — ele será
                  enviado no campo <strong>observação</strong> do veículo no SGA.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="flex-1">Cancelar</AlertDialogCancel>
            {onIgnorarEProsseguir && (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setShowBypass(true)}
              >
                Ignorar e Prosseguir
              </Button>
            )}
            {!onIgnorarEProsseguir && (
              <AlertDialogAction className="flex-1">Entendido</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {onIgnorarEProsseguir && (
        <IgnorarAvisoSGADialog
          open={showBypass}
          onOpenChange={setShowBypass}
          aviso={{
            tipo: 'veiculo_existe_sga',
            titulo: 'Veículo já cadastrado no SGA',
            mensagem: `Placa ${placa?.toUpperCase()} já existe na base do SGA Hinova.`,
            placa,
            cpf: cpf ?? null,
          }}
          onConfirm={() => {
            onOpenChange(false);
            onIgnorarEProsseguir();
          }}
        />
      )}
    </>
  );
}
