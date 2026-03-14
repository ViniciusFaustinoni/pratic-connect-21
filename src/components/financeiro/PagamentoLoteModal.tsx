import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatarMoeda } from '@/utils/format';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface Parcela {
  id: string;
  descricao: string;
  valor_bruto: number;
  valor_abatimento: number;
  valor_liquido: number;
  data_lancamento: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  vendedorNome: string;
  parcelas: Parcela[];
  isLoading: boolean;
  onConfirm: (data: { parcelaIds: string[]; dataPagamento: string; observacao?: string }) => void;
  isSaving: boolean;
}

export function PagamentoLoteModal({ open, onClose, vendedorNome, parcelas, isLoading, onConfirm, isSaving }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === parcelas.length) setSelected(new Set());
    else setSelected(new Set(parcelas.map(p => p.id)));
  };

  const selectedParcelas = parcelas.filter(p => selected.has(p.id));
  const totalLiquido = selectedParcelas.reduce((s, p) => s + p.valor_liquido, 0);

  const handleConfirm = () => {
    onConfirm({ parcelaIds: Array.from(selected), dataPagamento, observacao: observacao || undefined });
    setSelected(new Set());
    setObservacao('');
  };

  return (
    <Dialog open={open} onOpenChange={() => { setSelected(new Set()); setObservacao(''); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar pagamento — {vendedorNome}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : parcelas.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma parcela disponível para pagamento.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selected.size === parcelas.length && parcelas.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">Selecionar todas</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {parcelas.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.descricao}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Bruto: {formatarMoeda(p.valor_bruto)}</p>
                    {p.valor_abatimento > 0 && (
                      <p className="text-xs text-orange-500">Abatimento: -{formatarMoeda(p.valor_abatimento)}</p>
                    )}
                    <p className="text-sm font-semibold">Líquido: {formatarMoeda(p.valor_liquido)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-3 border-t">
              <div className="space-y-1">
                <Label>Data do Pagamento</Label>
                <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Observação (opcional)</Label>
                <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: PIX realizado às 14h" />
              </div>
            </div>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm font-medium">
            {selected.size > 0 && `Total líquido: ${formatarMoeda(totalLiquido)}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setSelected(new Set()); setObservacao(''); onClose(); }}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0 || !dataPagamento || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar pagamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
