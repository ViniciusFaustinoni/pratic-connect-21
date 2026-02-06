import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import { 
  MOTIVO_MANUTENCAO_LABELS, 
  LOCAL_TIPO_LABELS,
  type MotivoManutencao,
  type LocalTipoManutencao,
  type ManutencaoFiltros as FiltrosType,
} from '@/types/vistoriaManutencao';
import { STATUS_SERVICO_LABELS, type StatusServico } from '@/hooks/useServicos';

interface ManutencaoFiltrosProps {
  filtros: FiltrosType;
  onFiltrosChange: (filtros: FiltrosType) => void;
}

const STATUS_MANUTENCAO: StatusServico[] = [
  'pendente',
  'agendada',
  'em_rota',
  'em_andamento',
  'concluida',
  'cancelada',
  'reagendada',
];

export function ManutencaoFiltros({ filtros, onFiltrosChange }: ManutencaoFiltrosProps) {
  const [localBusca, setLocalBusca] = useState(filtros.busca || '');

  const handleBuscaSubmit = () => {
    onFiltrosChange({ ...filtros, busca: localBusca || undefined });
  };

  const handleClearFiltros = () => {
    setLocalBusca('');
    onFiltrosChange({});
  };

  const temFiltrosAtivos = Boolean(
    filtros.busca || 
    filtros.status || 
    filtros.motivo || 
    filtros.localTipo || 
    filtros.protecaoSuspensa
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:flex-wrap">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por associado, placa, rastreador..."
          value={localBusca}
          onChange={(e) => setLocalBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBuscaSubmit()}
          className="pl-9 pr-10"
        />
        {localBusca && (
          <button
            onClick={() => {
              setLocalBusca('');
              onFiltrosChange({ ...filtros, busca: undefined });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status */}
      <Select
        value={filtros.status as string || 'all'}
        onValueChange={(value) => 
          onFiltrosChange({ 
            ...filtros, 
            status: value === 'all' ? undefined : value 
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {STATUS_MANUTENCAO.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_SERVICO_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Motivo */}
      <Select
        value={filtros.motivo as string || 'all'}
        onValueChange={(value) => 
          onFiltrosChange({ 
            ...filtros, 
            motivo: value === 'all' ? undefined : value as MotivoManutencao 
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Motivo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos motivos</SelectItem>
          {Object.entries(MOTIVO_MANUTENCAO_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Local Tipo */}
      <Select
        value={filtros.localTipo as string || 'all'}
        onValueChange={(value) => 
          onFiltrosChange({ 
            ...filtros, 
            localTipo: value === 'all' ? undefined : value as LocalTipoManutencao 
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Local" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos locais</SelectItem>
          {Object.entries(LOCAL_TIPO_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Proteção Suspensa */}
      <Select
        value={filtros.protecaoSuspensa === undefined ? 'all' : filtros.protecaoSuspensa ? 'true' : 'false'}
        onValueChange={(value) => 
          onFiltrosChange({ 
            ...filtros, 
            protecaoSuspensa: value === 'all' ? undefined : value === 'true' 
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Proteção" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="true">Suspensa</SelectItem>
          <SelectItem value="false">Ativa</SelectItem>
        </SelectContent>
      </Select>

      {/* Limpar Filtros */}
      {temFiltrosAtivos && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFiltros}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
