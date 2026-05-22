import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Car, Bike, AlertTriangle } from 'lucide-react';
import type { BloqueioTipoVeiculo, TipoVeiculoResolvido } from '@/lib/veiculo/resolverTipoPorElegibilidade';

interface Props {
  open: boolean;
  bloqueio: BloqueioTipoVeiculo | null;
  onResolverManual: (tipo: TipoVeiculoResolvido) => void;
  onAbrirGestaoComercial?: () => void;
  onClose: () => void;
}

export function BloqueioTipoVeiculoModal({ open, bloqueio, onResolverManual, onAbrirGestaoComercial, onClose }: Props) {
  if (!bloqueio) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {bloqueio.tipo === 'ambiguo' ? 'Confirme o tipo do veículo' : 'Nenhuma linha elegível'}
          </DialogTitle>
          <DialogDescription>
            {bloqueio.tipo === 'ambiguo'
              ? 'Há planos compatíveis tanto para carro quanto para moto com os dados informados. Confirme manualmente qual é o tipo deste veículo — sua escolha será congelada na cotação.'
              : 'Nenhuma linha de produto está elegível para este veículo com os dados informados. Verifique os dados ou contate a Gestão Comercial.'}
          </DialogDescription>
        </DialogHeader>

        {bloqueio.tipo === 'ambiguo' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              onClick={() => onResolverManual('carro')}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-6 transition hover:border-primary hover:bg-primary/5"
            >
              <Car className="h-10 w-10 text-primary" />
              <span className="font-semibold">É um carro</span>
              <span className="text-xs text-muted-foreground">
                {bloqueio.candidatosCarro.length} plano(s) compatível(eis)
              </span>
            </button>

            <button
              type="button"
              onClick={() => onResolverManual('moto')}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-6 transition hover:border-primary hover:bg-primary/5"
            >
              <Bike className="h-10 w-10 text-primary" />
              <span className="font-semibold">É uma moto</span>
              <span className="text-xs text-muted-foreground">
                {bloqueio.candidatosMoto.length} plano(s) compatível(eis)
              </span>
            </button>
          </div>
        )}

        {bloqueio.tipo === 'nenhuma_linha' && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Voltar e revisar dados</Button>
            {onAbrirGestaoComercial && (
              <Button onClick={onAbrirGestaoComercial}>Abrir Gestão Comercial</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
