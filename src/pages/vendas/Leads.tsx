import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Phone, Car, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { useLeads, useUpdateLead } from '@/hooks/useLeads';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { toast } from 'sonner';

const etapaColors: Record<EtapaLead, string> = {
  novo: 'bg-[hsl(var(--etapa-novo))] text-white',
  contato_inicial: 'bg-[hsl(var(--etapa-contato))] text-white',
  apresentacao: 'bg-[hsl(var(--etapa-apresentacao))] text-white',
  cotacao_enviada: 'bg-[hsl(var(--etapa-cotacao))] text-white',
  negociacao: 'bg-[hsl(var(--etapa-negociacao))] text-white',
  ganho: 'bg-[hsl(var(--etapa-ganho))] text-white',
  perdido: 'bg-[hsl(var(--etapa-perdido))] text-white',
};

const etapas: EtapaLead[] = [
  'novo',
  'contato_inicial',
  'apresentacao',
  'cotacao_enviada',
  'negociacao',
  'ganho',
  'perdido',
];

export default function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string>('all');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();

  const { data: leads, isLoading } = useLeads();
  const updateLead = useUpdateLead();

  const filteredLeads = (leads || []).filter((lead) => {
    const matchesSearch =
      lead.nome.toLowerCase().includes(search.toLowerCase()) ||
      lead.telefone.includes(search) ||
      (lead.veiculo_modelo?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesEtapa = etapaFilter === 'all' || lead.etapa === etapaFilter;
    return matchesSearch && matchesEtapa;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleCreateCotacao = (leadId: string) => {
    setSelectedLeadId(leadId);
    setShowCotacaoForm(true);
  };

  const handleMarkAsLost = async (leadId: string) => {
    try {
      await updateLead.mutateAsync({ id: leadId, etapa: 'perdido' });
      toast.success('Lead marcado como perdido');
    } catch (error) {
      toast.error('Erro ao atualizar lead');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e acompanhe o funil de vendas
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowLeadForm(true)}>
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou veículo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={etapaFilter} onValueChange={setEtapaFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {etapas.map((etapa) => (
              <SelectItem key={etapa} value={etapa}>
                {ETAPA_LABELS[etapa]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'kanban')}>
          <TabsList>
            <TabsTrigger value="table">Lista</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {lead.nome.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{lead.nome}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.veiculo_marca ? (
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm">
                                {lead.veiculo_marca} {lead.veiculo_modelo}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lead.veiculo_ano} • {formatCurrency(lead.veiculo_fipe)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ORIGEM_LABELS[lead.origem]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={etapaColors[lead.etapa]}>
                          {ETAPA_LABELS[lead.etapa]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vendas/leads/${lead.id}`);
                            }}>
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleCreateCotacao(lead.id);
                            }}>
                              Criar cotação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsLost(lead.id);
                              }}
                            >
                              Marcar como perdido
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {etapas.slice(0, 5).map((etapa) => {
            const leadsInEtapa = filteredLeads.filter((l) => l.etapa === etapa);
            return (
              <div key={etapa} className="flex flex-col rounded-lg bg-muted/50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={etapaColors[etapa]}>{ETAPA_LABELS[etapa]}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {leadsInEtapa.length}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {leadsInEtapa.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                    >
                      <CardContent className="p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {lead.nome.charAt(0)}
                          </div>
                          <span className="font-medium">{lead.nome}</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {lead.veiculo_marca && (
                            <div className="flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {lead.veiculo_marca} {lead.veiculo_modelo}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.telefone}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <LeadFormDialog open={showLeadForm} onOpenChange={setShowLeadForm} />
      <CotacaoFormDialog 
        open={showCotacaoForm} 
        onOpenChange={setShowCotacaoForm} 
        leadId={selectedLeadId}
      />
    </div>
  );
}
