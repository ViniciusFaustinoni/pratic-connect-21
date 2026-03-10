import React, { useState } from 'react';
import { AlertTriangle, Radio, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useMultaRastreador } from '@/hooks/useConteudosSistema';

export interface RastreadorVinculadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associado: { id: string; nome: string };
  rastreador: { id: string; codigo: string; plataforma: string | null };
  veiculo: { id: string; placa: string; marca: string | null; modelo: string | null };
  onConfirm: (acao: 'criar_retirada' | 'apenas_registrar') => Promise<void>;
  isLoading?: boolean;
}

export function RastreadorVinculadoModal({
  open,
  onOpenChange,
  associado,
  rastreador,
  veiculo,
  onConfirm,
  isLoading = false,
}: RastreadorVinculadoModalProps) {
  const [acao, setAcao] = useState<'criar_retirada' | 'apenas_registrar'>('criar_retirada');

  const handleConfirm = async () => {
    await onConfirm(acao);
  };

  const plataformaLabel = rastreador.plataforma === 'rede_veiculos' 
    ? 'Rede Veículos' 
    : rastreador.plataforma === 'softruck' 
      ? 'Softruck' 
      : rastreador.plataforma || 'Não definida';

  const veiculoDescricao = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'Veículo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Rastreador Vinculado
          </DialogTitle>
          <DialogDescription>
            Este associado possui um rastreador instalado que precisa ser devolvido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do rastreador e veículo */}
          <Alert className="bg-warning/10 border-warning/30">
            <Radio className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning-foreground">
              <div className="space-y-1">
                <div className="font-medium">
                  Rastreador: {rastreador.codigo}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {plataformaLabel}
                  </Badge>
                </div>
                <div className="text-sm">
                  Veículo: {veiculoDescricao} • <span className="font-mono">{veiculo.placa}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              O cancelamento só será finalizado após a <strong>devolução do rastreador</strong> ou 
              pagamento da <strong>multa de R$ 400,00</strong> conforme regulamento.
            </p>
          </div>

          {/* Opções de ação */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que deseja fazer?</Label>
            <RadioGroup
              value={acao}
              onValueChange={(value) => setAcao(value as 'criar_retirada' | 'apenas_registrar')}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="criar_retirada" id="criar_retirada" className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="criar_retirada" className="font-medium cursor-pointer">
                    Criar solicitação de retirada automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A solicitação vai para a fila do Monitoramento, que irá agendar a retirada.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="apenas_registrar" id="apenas_registrar" className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="apenas_registrar" className="font-medium cursor-pointer">
                    Apenas registrar cancelamento
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A pendência de rastreador será criada e o Monitoramento será alertado.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Prosseguir'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
