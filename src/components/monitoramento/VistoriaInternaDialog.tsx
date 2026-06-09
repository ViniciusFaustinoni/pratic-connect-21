import { lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const InstaladorChecklist = lazy(() => import('@/pages/instalador/InstaladorChecklist'));
const ExecutarRetirada = lazy(() => import('@/pages/instalador/ExecutarRetirada'));

/**
 * Modal full-screen que embeda a MESMA tela do técnico (InstaladorChecklist /
 * ExecutarRetirada) para o Coordenador de Monitoramento executar a vistoria
 * internamente — sem redirecionar para o app do instalador.
 *
 * Não altera nada do fluxo: usa as mesmas etapas, hooks, mutations e triggers
 * DB. Ao fechar, invalida as filas do Monitoramento.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string | null;
}

function isRetirada(tipo: string | null | undefined) {
  return tipo === 'retirada_rastreador' || tipo === 'vistoria_retirada';
}

export function VistoriaInternaDialog({ open, onOpenChange, servicoId }: Props) {
  const qc = useQueryClient();

  // Descobre o tipo do serviço pra escolher a tela embedada.
  const { data: tipoServico, isLoading } = useQuery({
    queryKey: ['vistoria-interna-tipo-servico', servicoId],
    queryFn: async () => {
      if (!servicoId) return null;
      const { data, error } = await supabase
        .from('servicos')
        .select('tipo')
        .eq('id', servicoId)
        .maybeSingle();
      if (error) throw error;
      return data?.tipo as string | null;
    },
    enabled: !!servicoId && open,
    staleTime: 60_000,
  });

  const handleClose = () => {
    onOpenChange(false);
    // Atualiza as filas do Monitoramento, Serviços de Campo e Rastreadores
    qc.invalidateQueries({ queryKey: ['veiculos-suspensos-instalacao'] });
    qc.invalidateQueries({ queryKey: ['servicos-campo'] });
    qc.invalidateQueries({ queryKey: ['servicos'] });
    qc.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
    qc.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
    qc.invalidateQueries({ queryKey: ['servico-detalhe-aprovacao'] });
    qc.invalidateQueries({ queryKey: ['rastreadores'] });
    qc.invalidateQueries({ queryKey: ['rastreador-detalhe'] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className="max-w-none w-screen h-screen sm:rounded-none p-0 overflow-y-auto bg-slate-900 border-0 gap-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Vistoria Interna (Coordenador de Monitoramento)</DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="fixed top-3 right-3 z-[60] h-9 w-9 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-600"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </Button>
        {servicoId && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-white">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando…
            </div>
          }>
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-white">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando serviço…
              </div>
            ) : isRetirada(tipoServico) ? (
              <ExecutarRetirada servicoIdProp={servicoId} vistoriaInterna onClose={handleClose} />
            ) : (
              <InstaladorChecklist servicoIdProp={servicoId} vistoriaInterna onClose={handleClose} />
            )}
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
