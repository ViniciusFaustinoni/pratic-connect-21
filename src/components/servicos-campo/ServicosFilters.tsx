import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TIPO_SERVICO_LABELS, STATUS_SERVICO_LABELS,
  type TipoServico, type StatusServico,
} from '@/hooks/useServicos';
import {
  FASE_JORNADA_LABELS,
  type ServicosCampoFilters,
  type OrigemTecnico,
  type FaseJornada,
} from '@/hooks/useServicosCampoUnificado';

const TIPOS_DISPONIVEIS: TipoServico[] = [
  'instalacao', 'revistoria', 'vistoria_entrada', 'vistoria_saida',
  'vistoria_sinistro', 'vistoria_periodica', 'vistoria_manutencao', 'vistoria_retirada',
];

const STATUS_GROUPS: Array<{ label: string; statuses: StatusServico[] }> = [
  { label: 'Pré-Execução', statuses: ['pendente', 'agendada'] },
  { label: 'Em Campo', statuses: ['em_rota', 'em_andamento'] },
  { label: 'Pós-Execução', statuses: ['em_analise', 'concluida', 'aprovada', 'aprovada_ressalvas', 'reprovada'] },
  { label: 'Exceções', statuses: ['nao_compareceu', 'reagendada', 'cancelada'] },
];

interface ServicosFiltersProps {
  filters: ServicosCampoFilters;
  onChange: (next: ServicosCampoFilters) => void;
  onClear: () => void;
}

export function ServicosFilters({ filters, onChange, onClear }: ServicosFiltersProps) {
  const tiposSel = filters.tipos || [];
  const statusesSel = filters.statuses || [];

  const toggleTipo = (t: TipoServico) => {
    const next = tiposSel.includes(t)
      ? tiposSel.filter((x) => x !== t)
      : [...tiposSel, t];
    onChange({ ...filters, tipos: next.length === 0 ? undefined : next });
  };

  const toggleStatus = (s: StatusServico) => {
    const next = statusesSel.includes(s)
      ? statusesSel.filter((x) => x !== s)
      : [...statusesSel, s];
    onChange({ ...filters, statuses: next.length === 0 ? undefined : next });
  };

  const hasActiveFilters =
    !!filters.search ||
    (filters.tipos && filters.tipos.length > 0) ||
    (filters.statuses && filters.statuses.length > 0) ||
    (filters.origemTecnico && filters.origemTecnico !== 'todos') ||
    (filters.faseJornada && filters.faseJornada !== 'todos') ||
    !!filters.cidade ||
    !!filters.uf;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar nome, placa, protocolo, IMEI..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Tipo */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-3.5 w-3.5" />
            Tipo
            {tiposSel.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{tiposSel.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-2" align="start">
          <Label className="text-xs font-semibold text-muted-foreground">TIPOS DE SERVIÇO</Label>
          {TIPOS_DISPONIVEIS.map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded"
            >
              <Checkbox checked={tiposSel.includes(t)} onCheckedChange={() => toggleTipo(t)} />
              {TIPO_SERVICO_LABELS[t]}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Status */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-3.5 w-3.5" />
            Status
            {statusesSel.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{statusesSel.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 space-y-3 max-h-[400px] overflow-y-auto" align="start">
          {STATUS_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {group.label.toUpperCase()}
              </Label>
              {group.statuses.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded"
                >
                  <Checkbox checked={statusesSel.includes(s)} onCheckedChange={() => toggleStatus(s)} />
                  {STATUS_SERVICO_LABELS[s]}
                </label>
              ))}
            </div>
          ))}
        </PopoverContent>
      </Popover>

      {/* Fase da Jornada */}
      <Select
        value={filters.faseJornada || 'todos'}
        onValueChange={(v) => onChange({ ...filters, faseJornada: v as FaseJornada | 'todos' })}
      >
        <SelectTrigger className="w-[240px] h-9">
          <SelectValue placeholder="Fase da Jornada" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas as fases</SelectItem>
          {(Object.keys(FASE_JORNADA_LABELS) as FaseJornada[]).map((k) => (
            <SelectItem key={k} value={k}>{FASE_JORNADA_LABELS[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Origem */}
      <Select
        value={filters.origemTecnico || 'todos'}
        onValueChange={(v) => onChange({ ...filters, origemTecnico: v as OrigemTecnico })}
      >
        <SelectTrigger className="w-[170px] h-9">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas as origens</SelectItem>
          <SelectItem value="interno">Técnico Interno</SelectItem>
          <SelectItem value="prestador">Prestador Externo</SelectItem>
        </SelectContent>
      </Select>

      {/* Cidade */}
      <Input
        placeholder="Cidade"
        value={filters.cidade || ''}
        onChange={(e) => onChange({ ...filters, cidade: e.target.value })}
        className="w-[140px] h-9"
      />

      {/* UF */}
      <Input
        placeholder="UF"
        value={filters.uf || ''}
        onChange={(e) => onChange({ ...filters, uf: e.target.value.toUpperCase() })}
        className="w-[70px] h-9 uppercase"
        maxLength={2}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
