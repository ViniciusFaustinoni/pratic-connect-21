import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { OrcamentoReparo, OrcamentoItem } from '@/hooks/useOrcamentoReparo';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (observacao: string) => void;
  orcamento: OrcamentoReparo;
  itens: OrcamentoItem[];
  valorFipe?: number;
  saving?: boolean;
}

export function ConsolidarOrcamentoModal({ open, onClose, onConfirm, orcamento, itens, valorFipe, saving }: Props) {
  const [observacao, setObservacao] = useState('');
  const [confirmado, setConfirmado] = useState(false);

  const ativos = itens.filter(i => i.status !== 'cancelado');
  const cancelados = itens.filter(i => i.status === 'cancelado');
  const pecasAtivas = ativos.filter(i => i.tipo === 'peca');
  const pecasCanceladas = cancelados.filter(i => i.tipo === 'peca');
  const mdoAtivas = ativos.filter(i => i.tipo === 'mao_de_obra');
  const mdoCanceladas = cancelados.filter(i => i.tipo === 'mao_de_obra');

  const variacao = orcamento.valor_total - orcamento.valor_inicial_total;
  const variacaoPct = orcamento.valor_inicial_total > 0 ? (variacao / orcamento.valor_inicial_total) * 100 : 0;
  const pctFipe = valorFipe && valorFipe > 0 ? (orcamento.valor_total / valorFipe) * 100 : 0;
  const alertaFipe = pctFipe > 75;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setConfirmado(false); setObservacao(''); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Consolidar Orçamento — Custo Final do Reparo</DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="font-semibold text-sm">RESUMO DO ORÇAMENTO FINAL</p>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Peças:</span>
              <span className="font-medium">R$ {orcamento.valor_pecas?.toFixed(2)}</span>
            </div>
            <div className="text-xs text-muted-foreground ml-4">
              • {pecasAtivas.length} itens ativos • {pecasCanceladas.length} cancelados
            </div>

            <div className="flex justify-between">
              <span>Mão de Obra:</span>
              <span className="font-medium">R$ {orcamento.valor_mao_obra?.toFixed(2)}</span>
            </div>
            <div className="text-xs text-muted-foreground ml-4">
              • {mdoAtivas.length} serviços ativos • {mdoCanceladas.length} cancelados
            </div>

            <hr className="my-2" />

            <div className="flex justify-between font-bold text-base">
              <span>TOTAL FINAL:</span>
              <span>R$ {orcamento.valor_total?.toFixed(2)}</span>
            </div>

            {orcamento.valor_inicial_total > 0 && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Orçamento Original:</span>
                  <span>R$ {orcamento.valor_inicial_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Variação:</span>
                  <span className={variacao > 0 ? 'text-red-600 font-medium' : variacao < 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {variacao > 0 ? '+' : ''}R$ {variacao.toFixed(2)} ({variacaoPct > 0 ? '+' : ''}{variacaoPct.toFixed(1)}%)
                  </span>
                </div>
              </>
            )}

            {valorFipe && valorFipe > 0 && (
              <div className="flex justify-between text-xs">
                <span>Valor FIPE: R$ {valorFipe.toFixed(0)}</span>
                <span className={`flex items-center gap-1 ${alertaFipe ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                  {pctFipe.toFixed(1)}% {alertaFipe ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                </span>
              </div>
            )}
          </div>
        </div>

        {alertaFipe && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>ATENÇÃO:</strong> O custo do reparo ultrapassou 75% do valor FIPE.
              Este caso pode configurar Perda Total. A consolidação só é possível com autorização do diretor.
            </span>
          </div>
        )}

        <div>
          <Label>Observação final (opcional)</Label>
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Comentário sobre o custo final do reparo..." rows={2} />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Após consolidar, os valores não poderão mais ser editados. Apenas o diretor poderá fazer alterações.</span>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="confirma" checked={confirmado} onCheckedChange={(v) => setConfirmado(!!v)} />
          <Label htmlFor="confirma" className="text-sm cursor-pointer">
            Confirmo que os valores estão corretos e representam o custo real do reparo
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setConfirmado(false); setObservacao(''); }}>Cancelar</Button>
          <Button onClick={() => { onConfirm(observacao); setConfirmado(false); setObservacao(''); }} disabled={!confirmado || saving}>
            {saving ? 'Consolidando...' : 'Consolidar Orçamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
