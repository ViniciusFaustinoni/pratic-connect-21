import { Radio, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RastreadorCard } from './RastreadorCard';
import { type RastreadorWithRelations } from '@/hooks/useRastreadores';
import { AnimatePresence } from 'framer-motion';

interface RastreadorGridViewProps {
  rastreadores: RastreadorWithRelations[] | undefined;
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectOne: (id: string, checked: boolean) => void;
  onOpenDetails: (id: string) => void;
  onMaintenance: (rastreador: RastreadorWithRelations) => void;
  onWithdraw: (rastreador: RastreadorWithRelations) => void;
  onNewRastreador: () => void;
  getPlataformaLabel: (codigo: string) => string;
  onViewMap?: (rastreadorId: string) => void;
}

export function RastreadorGridView({
  rastreadores,
  isLoading,
  selectedIds,
  onSelectOne,
  onOpenDetails,
  onMaintenance,
  onWithdraw,
  onNewRastreador,
  getPlataformaLabel,
  onViewMap,
}: RastreadorGridViewProps) {
  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rastreadores || rastreadores.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Radio className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum rastreador</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre rastreadores para monitorar
          </p>
          <Button className="mt-4" onClick={onNewRastreador}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Rastreador
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {rastreadores.map((rastreador) => (
          <RastreadorCard
            key={rastreador.id}
            rastreador={rastreador}
            plataformaLabel={getPlataformaLabel(rastreador.plataforma)}
            isSelected={selectedIds.has(rastreador.id)}
            onSelect={
              rastreador.status === 'estoque'
                ? (checked) => onSelectOne(rastreador.id, checked)
                : undefined
            }
            onViewDetails={() => onOpenDetails(rastreador.id)}
            onMaintenance={
              rastreador.status === 'instalado'
                ? () => onMaintenance(rastreador)
                : undefined
            }
            onWithdraw={
              rastreador.status === 'instalado'
                ? () => onWithdraw(rastreador)
                : undefined
            }
            onViewMap={
              rastreador.status === 'instalado' && onViewMap
                ? () => onViewMap(rastreador.id)
                : undefined
            }
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
