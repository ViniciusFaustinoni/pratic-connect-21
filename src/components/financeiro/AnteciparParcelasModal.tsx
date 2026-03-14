import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatarMoeda } from '@/utils/format';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Parcela {
  id: string;
  descricao: string;
  valor_bruto: number;
  valor_liquido: number;
  parcela_numero: number | null;
  parcela_total: number | null;
  data_lancamento: string;
  debito_volante_ref_id: string | null;
  categoria: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  vendedorNome: string;
  parcelas: Parcela[];
  isLoading: boolean;
  onConfirm: (ids: string[]) => void;
  isSaving: boolean;
}

export function AnteciparParcelasModal({ open, onClose, vendedorNome, parcelas, isLoading, onConfirm, isSaving }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const total = parcelas.filter(p => selected.has(p.id)).reduce((s, p) => s + p.valor_liquido, 0);

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={() => { setSelected(new Set()); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Antecipar comissões — {vendedorNome}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : parcelas.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma parcela pendente para antecipação.</p>
        ) : (
          <div className="space-y-2">
            {parcelas.map(p => {
              const hasVolante = !!p.debito_volante_ref_id;
              return (
                <div key={p.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.descricao}</p>
                    <p className="text-xs text-muted-foreground">Data prevista: {p.data_lancamento}</p>
                    {hasVolante && (
                      <Alert className="mt-1 py-1 px-2 border-orange-300 bg-orange-50">
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                        <AlertDescription className="text-xs text-orange-700">
                          Sujeita a abatimento de débito volante. O crédito líquido poderá ser menor.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatarMoeda(p.valor_liquido)}</p>
                    {p.valor_bruto === 0 && (
                      <Badge variant="outline" className="text-xs">(estimado)</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {selected.size > 0 && `${selected.size} parcela(s) selecionada(s) — Total: ${formatarMoeda(total)}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setSelected(new Set()); onClose(); }}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0 || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar antecipação
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
