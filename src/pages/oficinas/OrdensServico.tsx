import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ClipboardList, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { OSFormDialog } from '@/components/oficinas/OSFormDialog';
import { STATUS_ORDEM_SERVICO_LABELS, STATUS_ORDEM_SERVICO_COLORS, type StatusOrdemServico } from '@/types/database';

export default function OrdensServico() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusOrdemServico | 'todos'>('todos');
  const [formOpen, setFormOpen] = useState(false);

  const { data: ordensServico, isLoading } = useOrdensServico({
    search: search || undefined,
    status: statusFilter === 'todos' ? undefined : statusFilter,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground">Gerencie as OS de oficinas</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova OS
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusOrdemServico | 'todos')}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_ORDEM_SERVICO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48 p-6" />
            </Card>
          ))}
        </div>
      ) : ordensServico?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Nenhuma OS encontrada</p>
            <p className="text-muted-foreground">Crie uma ordem de serviço para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ordensServico?.map((os) => (
            <Card
              key={os.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/oficinas/ordens/${os.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{os.numero}</h3>
                    <p className="text-sm text-muted-foreground">
                      {os.associado?.nome}
                    </p>
                  </div>
                  <Badge className={STATUS_ORDEM_SERVICO_COLORS[os.status]}>
                    {STATUS_ORDEM_SERVICO_LABELS[os.status]}
                  </Badge>
                </div>

                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{os.oficina?.nome_fantasia || os.oficina?.razao_social}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(os.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-sm text-muted-foreground">Orçamento</span>
                  <span className="font-semibold">{formatCurrency(os.valor_orcamento)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OSFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
