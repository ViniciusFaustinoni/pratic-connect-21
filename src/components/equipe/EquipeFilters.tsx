import { Search, Wrench, Navigation, Signal, SignalZero, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegioesAtendimento } from '@/hooks/useRegioesAtendimento';

interface EquipeFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusOperacionalFilter: string;
  onStatusOperacionalChange: (value: string) => void;
  regiaoFilter: string;
  onRegiaoChange: (value: string) => void;
}

export function EquipeFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOperacionalFilter,
  onStatusOperacionalChange,
  regiaoFilter,
  onRegiaoChange,
}: EquipeFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[280px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-muted/30 border-border/50 focus:bg-background"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[140px] bg-muted/30 border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="disponivel">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Disponível
              </span>
            </SelectItem>
            <SelectItem value="indisponivel">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Indisponível
              </span>
            </SelectItem>
            <SelectItem value="ferias">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Férias
              </span>
            </SelectItem>
            <SelectItem value="afastado">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                Afastado
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusOperacionalFilter} onValueChange={onStatusOperacionalChange}>
          <SelectTrigger className="w-[170px] bg-muted/30 border-border/50">
            <SelectValue placeholder="Operacional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Operacionais</SelectItem>
            <SelectItem value="em_andamento">
              <span className="flex items-center gap-2">
                <Wrench className="h-3 w-3 text-blue-500" />
                Realizando Tarefa
              </span>
            </SelectItem>
            <SelectItem value="em_rota">
              <span className="flex items-center gap-2">
                <Navigation className="h-3 w-3 text-purple-500" />
                Em Rota
              </span>
            </SelectItem>
            <SelectItem value="em_contato">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-3 w-3 text-amber-500" />
                Em Contato
              </span>
            </SelectItem>
            <SelectItem value="disponivel_operacional">
              <span className="flex items-center gap-2">
                <Signal className="h-3 w-3 text-emerald-500" />
                Aguardando Atribuição
              </span>
            </SelectItem>
            <SelectItem value="offline">
              <span className="flex items-center gap-2">
                <SignalZero className="h-3 w-3 text-muted-foreground" />
                Offline
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={regiaoFilter} onValueChange={onRegiaoChange}>
          <SelectTrigger className="w-[150px] bg-muted/30 border-border/50">
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Regiões</SelectItem>
            {REGIOES_ATENDIMENTO.map((regiao) => (
              <SelectItem key={regiao.value} value={regiao.value}>
                {regiao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
