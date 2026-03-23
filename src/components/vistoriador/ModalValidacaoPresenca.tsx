import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MapPin, AlertTriangle, WifiOff } from 'lucide-react';
import type { ResultadoValidacao } from '@/hooks/useValidacaoPresenca';

interface ModalValidacaoPresencaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  resultado: ResultadoValidacao | null;
  onConfirmarPresenca: () => void;
  onCancelar: () => void;
}

export function ModalValidacaoPresenca({
  open,
  onOpenChange,
  loading,
  resultado,
  onConfirmarPresenca,
  onCancelar,
}: ModalValidacaoPresencaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Verificação de Localização
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando sua localização...</p>
          </div>
        )}

        {!loading && resultado?.gpsIndisponivel && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Não foi possível verificar sua localização. O início foi registrado sem confirmação de presença.
            </AlertDescription>
          </Alert>
        )}

        {!loading && resultado && !resultado.gpsIndisponivel && !resultado.dentroDoRaio && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você está a <strong>{resultado.distancia?.toLocaleString('pt-BR')} metros</strong> do endereço do associado.
              </AlertDescription>
            </Alert>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={onConfirmarPresenca} className="w-full">
                Estou no local correto
              </Button>
              <Button variant="outline" onClick={onCancelar} className="w-full">
                Ainda estou a caminho
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
