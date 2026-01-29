import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, MapPin, Radio, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAcionarRouboFurto } from "@/hooks/useAcionamentoRoubo";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AcionarRecuperacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistro: {
    id: string;
    protocolo: string;
    tipo: string;
    veiculo_id: string;
  };
  veiculo: {
    placa: string;
    marca: string;
    modelo: string;
  };
  onSuccess?: () => void;
}

export function AcionarRecuperacaoModal({
  open,
  onOpenChange,
  sinistro,
  veiculo,
  onSuccess,
}: AcionarRecuperacaoModalProps) {
  const [observacoes, setObservacoes] = useState("");
  const [modoRastreamento, setModoRastreamento] = useState<'intensivo' | 'emergencia'>('intensivo');
  const [confirmado, setConfirmado] = useState(false);
  const [resultado, setResultado] = useState<{
    success: boolean;
    protocolo?: string;
    mensagem?: string;
  } | null>(null);

  const { mutate: acionar, isPending } = useAcionarRouboFurto();

  const handleAcionar = () => {
    if (!confirmado) {
      setConfirmado(true);
      return;
    }

    acionar(
      {
        veiculo_id: sinistro.veiculo_id,
        sinistro_id: sinistro.id,
        tipo_origem: 'sinistro',
        observacoes: observacoes || `Acionamento via sinistro ${sinistro.protocolo}`,
        modo_rastreamento: modoRastreamento,
      },
      {
        onSuccess: (data) => {
          setResultado({
            success: true,
            protocolo: data.protocolo_externo,
            mensagem: data.mensagem,
          });
          onSuccess?.();
        },
        onError: (error) => {
          setResultado({
            success: false,
            mensagem: error.message,
          });
        },
      }
    );
  };

  const handleClose = () => {
    if (!isPending) {
      setConfirmado(false);
      setResultado(null);
      setObservacoes("");
      onOpenChange(false);
    }
  };

  // Tela de resultado
  if (resultado) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultado.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Acionamento Realizado
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Erro no Acionamento
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {resultado.success && resultado.protocolo && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Protocolo Externo</p>
                <p className="text-2xl font-bold">{resultado.protocolo}</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {resultado.mensagem}
            </p>

            {resultado.success && (
              <Alert>
                <Radio className="h-4 w-4" />
                <AlertDescription>
                  O rastreamento intensivo foi ativado. A central de monitoramento já foi notificada.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Acionar Recuperação de Veículo
          </DialogTitle>
          <DialogDescription>
            Esta ação irá acionar a central de rastreamento para iniciar o processo de recuperação do veículo.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Info do veículo */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{veiculo.placa}</span>
              <span className="text-muted-foreground">
                {veiculo.marca} {veiculo.modelo}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sinistro: {sinistro.protocolo} ({sinistro.tipo})
            </p>
          </div>

          {/* Modo de rastreamento */}
          <div className="space-y-3">
            <Label>Modo de Rastreamento</Label>
            <RadioGroup
              value={modoRastreamento}
              onValueChange={(v) => setModoRastreamento(v as 'intensivo' | 'emergencia')}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted">
                <RadioGroupItem value="intensivo" id="intensivo" />
                <Label htmlFor="intensivo" className="cursor-pointer flex-1">
                  <span className="font-medium">Intensivo</span>
                  <p className="text-xs text-muted-foreground">Atualização a cada 30 segundos</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted border-red-200 bg-red-50/50">
                <RadioGroupItem value="emergencia" id="emergencia" />
                <Label htmlFor="emergencia" className="cursor-pointer flex-1">
                  <span className="font-medium text-red-600">Emergência</span>
                  <p className="text-xs text-muted-foreground">Tempo real (prioridade máxima)</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais para a central de rastreamento..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Confirmação */}
          {confirmado && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Confirma o acionamento?</strong> Esta ação irá:
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>Enviar alerta prioritário para a central</li>
                  <li>Ativar rastreamento {modoRastreamento === 'emergencia' ? 'em tempo real' : 'intensivo'}</li>
                  <li>Notificar equipe de monitoramento</li>
                  <li>Registrar no histórico do sinistro</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleAcionar}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Acionando...
              </>
            ) : confirmado ? (
              "Confirmar Acionamento"
            ) : (
              "Acionar Recuperação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
