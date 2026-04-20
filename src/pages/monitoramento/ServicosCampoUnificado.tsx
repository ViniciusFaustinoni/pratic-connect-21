import { useState } from 'react';
import { ServicosMetricasCards } from '@/components/servicos-campo/ServicosMetricasCards';
import { ServicosFilters } from '@/components/servicos-campo/ServicosFilters';
import { ServicosTable } from '@/components/servicos-campo/ServicosTable';
import { ServicoDetailModal } from '@/components/servicos-campo/ServicoDetailModal';
import {
  useServicosCampoUnificado,
  type ServicosCampoFilters,
  type FaseServico,
} from '@/hooks/useServicosCampoUnificado';
import type { Servico } from '@/hooks/useServicos';

export default function ServicosCampoUnificado() {
  const [filters, setFilters] = useState<ServicosCampoFilters>({ fase: 'todos' });
  const [selected, setSelected] = useState<Servico | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { servicos, metricas, isLoading } = useServicosCampoUnificado(filters);

  const handleFaseClick = (fase: FaseServico | 'todos') => {
    setFilters((f) => ({ ...f, fase: f.fase === fase ? 'todos' : fase }));
  };

  const handleRowClick = (s: Servico) => {
    setSelected(s);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <ServicosMetricasCards
        metricas={metricas}
        faseAtiva={filters.fase}
        onFaseClick={handleFaseClick}
      />

      <ServicosFilters
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters({ fase: 'todos' })}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Mostrando <strong className="text-foreground">{servicos.length}</strong> serviço(s)
        </span>
      </div>

      <ServicosTable
        servicos={servicos}
        isLoading={isLoading}
        onRowClick={handleRowClick}
      />

      <ServicoDetailModal
        servico={selected}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
