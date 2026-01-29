import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Lock, Unlock, AlertTriangle, Car, User, Radio } from 'lucide-react';

interface ComandoRastreadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoComando: 'bloquear' | 'desbloquear';
  rastreador: {
    id: string;
    codigo: string;
    plataforma: string;
  };
  veiculo?: {
    placa: string;
    marca?: string;
    modelo?: string;
  } | null;
  associado?: {
    nome: string;
  } | null;
  onConfirm: (motivo: string) => Promise<void>;
  isLoading?: boolean;
  origem?: 'monitoramento' | 'sinistro' | 'assistencia' | 'diretoria';
}

export function ComandoRastreadorDialog({
  open,
  onOpenChange,
  tipoComando,
  rastreador,
  veiculo,
  associado,
  onConfirm,
  isLoading = false,
  origem = 'monitoramento',
}: ComandoRastreadorDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);

  const isBloqueio = tipoComando === 'bloquear';
  const Icon = isBloqueio ? Lock : Unlock;

  const handleConfirm = async () => {
    if (!motivo.trim() || !confirmado) return;
    
    await onConfirm(motivo.trim());
    
    // Limpar estado após confirmação
    setMotivo('');
    setConfirmado(false);
  };

  const handleClose = () => {
    setMotivo('');
    setConfirmado(false);
    onOpenChange(false);
  };

  const canSubmit = motivo.trim().length >= 10 && confirmado && !isLoading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${isBloqueio ? 'text-destructive' : 'text-green-600'}`} />
            {isBloqueio ? 'Bloquear Veículo' : 'Desbloquear Veículo'}
          </DialogTitle>
          <DialogDescription>
            {isBloqueio 
              ? 'O veículo será bloqueado remotamente. Esta ação será registrada para auditoria.'
              : 'O veículo será desbloqueado remotamente. Esta ação será registrada para auditoria.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados do Veículo */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Rastreador:</span>
              <span className="font-medium">{rastreador.codigo}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {rastreador.plataforma}
              </Badge>
            </div>

            {veiculo && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Veículo:</span>
                <span className="font-semibold">{veiculo.placa}</span>
                {veiculo.marca && veiculo.modelo && (
                  <span className="text-muted-foreground">
                    ({veiculo.marca} {veiculo.modelo})
                  </span>
                )}
              </div>
            )}

            {associado && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Associado:</span>
                <span className="font-medium">{associado.nome}</span>
              </div>
            )}
          </div>

          {/* Alerta de Aviso */}
          <Alert variant={isBloqueio ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              {isBloqueio 
                ? 'O bloqueio impede a partida do veículo. Use apenas em situações autorizadas como roubo/furto ou inadimplência.'
                : 'Certifique-se de que a situação que originou o bloqueio foi resolvida antes de desbloquear.'
              }
            </AlertDescription>
          </Alert>

          {/* Campo de Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo"
              placeholder={isBloqueio 
                ? 'Ex: Sinistro de roubo confirmado. Protocolo #123456'
                : 'Ex: Veículo recuperado. Sinistro encerrado.'
              }
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 10 caracteres. O motivo será registrado para auditoria.
            </p>
          </div>

          {/* Checkbox de Confirmação */}
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="confirmacao"
              checked={confirmado}
              onCheckedChange={(checked) => setConfirmado(checked === true)}
            />
            <Label 
              htmlFor="confirmacao" 
              className="text-sm font-normal leading-tight cursor-pointer"
            >
              {isBloqueio 
                ? 'Confirmo que estou autorizado a bloquear este veículo e que a ação é necessária.'
                : 'Confirmo que estou autorizado a desbloquear este veículo e que a situação foi resolvida.'
              }
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant={isBloqueio ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Icon className="mr-2 h-4 w-4" />
                {isBloqueio ? 'Bloquear Veículo' : 'Desbloquear Veículo'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
