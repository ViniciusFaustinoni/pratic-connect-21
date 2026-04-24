import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, ExternalLink, Search, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  useServicosAtribuidos,
  PeriodoFiltro,
  StatusFiltroServico,
  ServicoAtribuido,
} from '@/hooks/useServicosAtribuidos';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 'profissional' = lista do instalador clicado; 'todos_instaladores' = visão administrativa */
  modo: 'profissional' | 'todos_instaladores';
  profissionalId?: string | null;
  profissionalNome?: string;
}

const STATUS_BADGE: Record<string, string> = {
  agendada: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  em_rota: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  em_andamento: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  concluida: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  nao_compareceu: 'bg-red-500/10 text-red-500 border-red-500/20',
  reagendada: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada',
  em_rota: 'Em rota',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  nao_compareceu: 'Não compareceu',
  reagendada: 'Reagendada',
};

function getInitials(nome: string) {
  return nome
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function getServicoLink(s: ServicoAtribuido) {
  // Roteamento padrão por tipo
  if (s.tipo?.includes('vistoria')) return `/operacional/vistorias/${s.id}`;
  return `/operacional/instalacoes/${s.id}`;
}

export function ServicosAtribuidosModal({
  open,
  onOpenChange,
  modo,
  profissionalId,
  profissionalNome,
}: Props) {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');
  const [status, setStatus] = useState<StatusFiltroServico>('todos');
  const [search, setSearch] = useState('');

  const { data: servicos = [], isLoading } = useServicosAtribuidos({
    modo,
    profissionalId,
    periodo,
    status,
    search,
    enabled: open,
  });

  const agrupados = useMemo(() => {
    if (modo !== 'todos_instaladores') return null;
    const map: Record<string, { nome: string; itens: ServicoAtribuido[] }> = {};
    servicos.forEach(s => {
      const key = s.profissional_id || 'sem';
      if (!map[key]) map[key] = { nome: s.profissional_nome, itens: [] };
      map[key].itens.push(s);
    });
    return Object.entries(map).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  }, [servicos, modo]);

  const titulo =
    modo === 'profissional'
      ? `Serviços de ${profissionalNome || 'profissional'}`
      : 'Serviços atribuídos — visão monitoramento';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {modo === 'profissional'
              ? 'Todos os serviços atribuídos a este profissional.'
              : 'Todos os serviços atribuídos a qualquer instalador, agrupados por técnico.'}
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar associado, placa, técnico, cidade ou zona..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={periodo} onValueChange={(v: PeriodoFiltro) => setPeriodo(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="30dias">Últimos 30 dias</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v: StatusFiltroServico) => setStatus(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="agendada">Agendada</SelectItem>
              <SelectItem value="em_rota">Em rota</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="nao_compareceu">Não compareceu</SelectItem>
              <SelectItem value="reagendada">Reagendada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conteúdo */}
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : servicos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              Nenhum serviço encontrado para os filtros selecionados.
            </div>
          ) : modo === 'profissional' ? (
            <ListaServicos itens={servicos} mostrarTecnico={false} />
          ) : (
            <div className="space-y-6">
              {agrupados!.map(([key, grupo]) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {getInitials(grupo.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <h4 className="font-semibold text-sm">{grupo.nome}</h4>
                    <Badge variant="outline" className="text-xs">{grupo.itens.length}</Badge>
                  </div>
                  <ListaServicos itens={grupo.itens} mostrarTecnico={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListaServicos({ itens, mostrarTecnico }: { itens: ServicoAtribuido[]; mostrarTecnico: boolean }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Data/Hora</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Associado</th>
            <th className="px-3 py-2 font-medium">Veículo</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">Local</th>
            {mostrarTecnico && <th className="px-3 py-2 font-medium">Técnico</th>}
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {itens.map(s => (
            <tr key={s.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-3 py-2 whitespace-nowrap">
                {format(new Date(s.data_agendada + 'T00:00:00'), 'dd/MM/yyyy')}
                <span className="text-muted-foreground ml-1">
                  {s.hora_agendada || (s.periodo ? `· ${s.periodo}` : '')}
                </span>
              </td>
              <td className="px-3 py-2 capitalize">{s.tipo?.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2">{s.associado_nome || '—'}</td>
              <td className="px-3 py-2">
                {s.veiculo_placa ? (
                  <div>
                    <div className="font-medium">{s.veiculo_placa}</div>
                    {s.veiculo_descricao && (
                      <div className="text-muted-foreground text-[10px]">{s.veiculo_descricao}</div>
                    )}
                  </div>
                ) : '—'}
              </td>
              <td className="px-3 py-2 hidden md:table-cell">{s.localizacao_formatada || s.bairro || s.cidade || '—'}</td>
              {mostrarTecnico && <td className="px-3 py-2">{s.profissional_nome}</td>}
              <td className="px-3 py-2">
                <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[s.status] || '')}>
                  {STATUS_LABEL[s.status] || s.status}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <Link to={getServicoLink(s)}>
                    Abrir <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
