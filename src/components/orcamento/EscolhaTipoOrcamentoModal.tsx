import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (tipo: 'cotacao_separada' | 'pacote_fechado') => void;
  saving?: boolean;
}

const OPTIONS = [
  {
    value: 'cotacao_separada' as const,
    icon: ClipboardList,
    title: 'Cotação Separada',
    description: 'A Pratic cota peças e serviços individualmente. Cada peça é cotada com fornecedores diferentes. A oficina cobra apenas mão de obra.',
    pros: [
      'Maior controle sobre custo de cada item',
      'Pode comparar preços entre fornecedores',
      'Ideal para reparos grandes ou complexos',
    ],
    cons: ['Mais demorado — precisa cotar cada item'],
  },
  {
    value: 'pacote_fechado' as const,
    icon: Package,
    title: 'Pacote Fechado',
    description: 'A oficina assume tudo: peças + mão de obra. Valor único negociado diretamente com a oficina. A oficina se responsabiliza pela compra das peças.',
    pros: [
      'Mais rápido — um valor, uma negociação',
      'Menos gestão operacional para a Pratic',
      'Ideal para reparos simples ou oficinas parceiras',
    ],
    cons: ['Menos controle sobre o custo de cada peça'],
  },
];

export function EscolhaTipoOrcamentoModal({ open, onClose, onSelect, saving }: Props) {
  const [selected, setSelected] = useState<'cotacao_separada' | 'pacote_fechado' | null>(null);

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelected(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Como deseja orçar este reparo?</DialogTitle>
          <p className="text-sm text-muted-foreground">Escolha como o orçamento será estruturado. Esta escolha não poderá ser alterada depois.</p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={cn(
                  'text-left rounded-lg border-2 p-4 transition-all hover:shadow-md cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="font-semibold">{opt.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{opt.description}</p>
                <div className="space-y-1">
                  {opt.pros.map((p, i) => (
                    <p key={i} className="text-xs text-green-700">✅ {p}</p>
                  ))}
                  {opt.cons.map((c, i) => (
                    <p key={i} className="text-xs text-amber-700">⚠️ {c}</p>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setSelected(null); }}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || saving}>
            {saving ? 'Criando...' : 'Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
