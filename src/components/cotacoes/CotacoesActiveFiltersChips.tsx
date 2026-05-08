import { format } from 'date-fns';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ETAPA_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada — aguardando cliente',
  escolhendo_plano: 'Escolhendo plano',
  enviando_documentos: 'Enviando documentos',
  em_analise: 'Documentos em análise',
  assinando_contrato: 'Aguardando assinatura',
  pagando_taxa: 'Pagando taxa',
  agendando_vistoria: 'Agendando vistoria',
  concluido: 'Convertida em associado',
  perdida: 'Perdida / expirada',
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
};

export interface CotacoesActiveFiltersChipsProps {
  search: string;
  statusFilter: string;
  mesFilter: string;
  dataFilter: Date | undefined;
  consultorFilter: string;
  etapaFunilFilter: string;
  filtroOrfas: boolean;
  vendedores?: Array<{ user_id: string; nome: string }>;
  formatMesLabel: (m: string) => string;
  onClearSearch: () => void;
  onClearStatus: () => void;
  onClearMes: () => void;
  onClearData: () => void;
  onClearConsultor: () => void;
  onClearEtapa: () => void;
  onClearOrfas: () => void;
}

export function CotacoesActiveFiltersChips(props: CotacoesActiveFiltersChipsProps) {
  const {
    search, statusFilter, mesFilter, dataFilter, consultorFilter, etapaFunilFilter, filtroOrfas,
    vendedores, formatMesLabel,
    onClearSearch, onClearStatus, onClearMes, onClearData, onClearConsultor, onClearEtapa, onClearOrfas,
  } = props;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (search) chips.push({ key: 'search', label: `Busca: ${search}`, onRemove: onClearSearch });
  if (statusFilter !== 'all') chips.push({ key: 'status', label: `Status: ${STATUS_LABELS[statusFilter] ?? statusFilter}`, onRemove: onClearStatus });
  if (etapaFunilFilter !== 'all') chips.push({ key: 'etapa', label: `Etapa: ${ETAPA_LABELS[etapaFunilFilter] ?? etapaFunilFilter}`, onRemove: onClearEtapa });
  if (mesFilter !== 'all') chips.push({ key: 'mes', label: `Mês: ${formatMesLabel(mesFilter)}`, onRemove: onClearMes });
  if (dataFilter) chips.push({ key: 'data', label: `Data: ${format(dataFilter, 'dd/MM/yyyy')}`, onRemove: onClearData });
  if (consultorFilter !== 'all') {
    const v = vendedores?.find(x => x.user_id === consultorFilter);
    chips.push({ key: 'consultor', label: `Consultor: ${v?.nome ?? '...'}`, onRemove: onClearConsultor });
  }
  if (filtroOrfas) chips.push({ key: 'orfas', label: 'Sem Lead', onRemove: onClearOrfas });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2">
      {chips.map(chip => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 pl-2 py-0.5 text-[11px] font-normal bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remover filtro ${chip.label}`}
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
