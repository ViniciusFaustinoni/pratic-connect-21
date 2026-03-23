import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { formatarMoeda } from '@/utils/format';
import { format } from 'date-fns';
import type { CCLancamento } from '@/hooks/useContaCorrenteVendedor';

interface Props {
  open: boolean;
  onClose: () => void;
  lancamento: CCLancamento | null;
  vendedorNome: string;
  onConfirm: (dados: { lancamentoId: string; motivo: string }) => void;
  isSaving?: boolean;
}

export function EstornoComissaoModal({ open, onClose, lancamento, vendedorNome, onConfirm, isSaving }: Props) {
  const [motivo, setMotivo] = useState('');

  if (!lancamento) return null;

  const motivoValido = motivo.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={() => { setMotivo(''); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Estornar Comissão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">Vendedor</p>
            <p className="font-medium">{vendedorNome}</p>
            <p className="text-sm text-muted-foreground mt-2">Descrição</p>
            <p className="text-sm">{lancamento.descricao}</p>
            <div className="flex justify-between mt-2">
              <div>
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="text-lg font-semibold text-green-600">{formatarMoeda(lancamento.valor_liquido)}</p>
              </div>
              {lancamento.data_pagamento && (
                <div>
                  <p className="text-sm text-muted-foreground">Data do pagamento</p>
                  <p className="text-sm font-medium">{format(new Date(lancamento.data_pagamento), 'dd/MM/yyyy')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo do estorno <span className="text-destructive">*</span></Label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do estorno (mínimo 10 caracteres)"
              rows={3}
            />
            {motivo.length > 0 && !motivoValido && (
              <p className="text-xs text-destructive">Mínimo de 10 caracteres ({motivo.trim().length}/10)</p>
            )}
          </div>

          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Esta ação não pode ser desfeita. O vendedor será notificado automaticamente com o motivo informado.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setMotivo(''); onClose(); }}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => { onConfirm({ lancamentoId: lancamento.id, motivo: motivo.trim() }); setMotivo(''); }}
            disabled={!motivoValido || isSaving}
          >
            Confirmar estorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
