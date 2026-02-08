import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  User, 
  Car, 
  Wrench, 
  Calendar,
  MapPin,
  RefreshCw, 
  ShieldOff,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  type VistoriaManutencao,
  LOCAL_TIPO_LABELS,
  type LocalTipoManutencao,
} from '@/types/vistoriaManutencao';
import { useReagendarPosAusencia, useCancelarVistoriaManutencao } from '@/hooks/useVistoriaManutencao';

interface TratarAusenciaModalProps {
  open: boolean;
  onClose: () => void;
  vistoria: VistoriaManutencao | null;
}

type AcaoAusencia = 'reagendar' | 'cancelar_suspender';

export function TratarAusenciaModal({ 
  open, 
  onClose,
  vistoria,
}: TratarAusenciaModalProps) {
  const [acao, setAcao] = useState<AcaoAusencia>('reagendar');
  const [observacao, setObservacao] = useState('');
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  const reagendarMutation = useReagendarPosAusencia();
  const cancelarMutation = useCancelarVistoriaManutencao();

  const isPending = reagendarMutation.isPending || cancelarMutation.isPending;

  const handleConfirmar = async () => {
    if (!vistoria) return;

    if (acao === 'reagendar') {
      await reagendarMutation.mutateAsync(vistoria.id);
      onClose();
    } else {
      // Mostrar confirmação antes de suspender proteção
      setShowConfirmacao(true);
    }
  };

  const handleConfirmarSuspensao = async () => {
    if (!vistoria) return;

    await cancelarMutation.mutateAsync({
      servicoId: vistoria.id,
      motivo: observacao || 'Cancelado após não comparecimento - proteção suspensa',
      suspenderProtecao: true,
    });
    
    setShowConfirmacao(false);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setAcao('reagendar');
      setObservacao('');
      onClose();
    }
  };

  if (!vistoria) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Associado Não Compareceu
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Alerta */}
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                O associado não compareceu à vistoria de manutenção agendada.
              </AlertDescription>
            </Alert>

            {/* Info do serviço */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{vistoria.associado?.nome || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>
                  {vistoria.veiculo?.marca} {vistoria.veiculo?.modelo} • {vistoria.veiculo?.placa}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{vistoria.rastreador?.codigo || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(new Date(vistoria.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {LOCAL_TIPO_LABELS[vistoria.local_tipo_manutencao as LocalTipoManutencao] || vistoria.local_tipo_manutencao}
                </span>
              </div>
            </div>

            {/* Seleção de ação */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">O que deseja fazer?</Label>
              <RadioGroup
                value={acao}
                onValueChange={(v) => setAcao(v as AcaoAusencia)}
                className="space-y-3"
              >
                {/* Reagendar */}
                <div 
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    acao === 'reagendar' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-border'
                  }`}
                  onClick={() => setAcao('reagendar')}
                >
                  <RadioGroupItem value="reagendar" id="reagendar" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="reagendar" className="font-medium cursor-pointer flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      Reagendar Manutenção
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agendar nova data para o associado
                    </p>
                  </div>
                </div>

                {/* Cancelar e Suspender */}
                <div 
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    acao === 'cancelar_suspender' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'
                  }`}
                  onClick={() => setAcao('cancelar_suspender')}
                >
                  <RadioGroupItem value="cancelar_suspender" id="cancelar_suspender" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="cancelar_suspender" className="font-medium cursor-pointer flex items-center gap-2">
                      <ShieldOff className="h-4 w-4 text-red-600" />
                      Cancelar e SUSPENDER Proteção
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Associado ficará SEM proteção contra roubo, furto e colisão até regularizar.
                    </p>
                    {acao === 'cancelar_suspender' && (
                      <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Esta ação notifica o associado.
                      </p>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <Label className="text-sm">Observação</Label>
              <Textarea
                placeholder="Observação opcional..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={isPending}
              variant={acao === 'cancelar_suspender' ? 'destructive' : 'default'}
              className="flex-1"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para suspensão */}
      <AlertDialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Confirmar Suspensão de Proteção?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá CANCELAR a manutenção e SUSPENDER as proteções do associado (roubo, furto e colisão) conforme regulamento 5.12.
              <br /><br />
              <strong>Esta ação é irreversível.</strong> O associado será notificado sobre a suspensão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelarMutation.isPending}>
              Não, voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarSuspensao}
              disabled={cancelarMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sim, suspender proteção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
