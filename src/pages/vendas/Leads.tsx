import { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Phone, Mail, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead, type OrigemLead } from '@/types/database';

// Dados simulados
const mockLeads = [
  {
    id: '1',
    nome: 'João Silva',
    telefone: '(11) 99999-1234',
    email: 'joao@email.com',
    veiculo_marca: 'Honda',
    veiculo_modelo: 'Civic',
    veiculo_ano: 2022,
    veiculo_placa: 'ABC-1234',
    veiculo_fipe: 95000,
    origem: 'indicacao' as OrigemLead,
    etapa: 'cotacao_enviada' as EtapaLead,
    vendedor: 'Carlos Vendedor',
    created_at: '2024-01-15T10:00:00',
  },
  {
    id: '2',
    nome: 'Maria Santos',
    telefone: '(11) 98888-5678',
    email: 'maria@email.com',
    veiculo_marca: 'Toyota',
    veiculo_modelo: 'Corolla',
    veiculo_ano: 2021,
    veiculo_placa: 'DEF-5678',
    veiculo_fipe: 105000,
    origem: 'site' as OrigemLead,
    etapa: 'contato_inicial' as EtapaLead,
    vendedor: 'Ana Vendedora',
    created_at: '2024-01-14T14:30:00',
  },
  {
    id: '3',
    nome: 'Pedro Oliveira',
    telefone: '(11) 97777-9012',
    email: 'pedro@email.com',
    veiculo_marca: 'Hyundai',
    veiculo_modelo: 'HB20',
    veiculo_ano: 2023,
    veiculo_placa: 'GHI-9012',
    veiculo_fipe: 75000,
    origem: 'facebook' as OrigemLead,
    etapa: 'novo' as EtapaLead,
    vendedor: 'Carlos Vendedor',
    created_at: '2024-01-15T08:00:00',
  },
  {
    id: '4',
    nome: 'Ana Costa',
    telefone: '(11) 96666-3456',
    email: 'ana@email.com',
    veiculo_marca: 'Chevrolet',
    veiculo_modelo: 'Onix',
    veiculo_ano: 2022,
    veiculo_placa: 'JKL-3456',
    veiculo_fipe: 68000,
    origem: 'instagram' as OrigemLead,
    etapa: 'negociacao' as EtapaLead,
    vendedor: 'Ana Vendedora',
    created_at: '2024-01-13T16:00:00',
  },
  {
    id: '5',
    nome: 'Carlos Lima',
    telefone: '(11) 95555-7890',
    email: 'carlos@email.com',
    veiculo_marca: 'Volkswagen',
    veiculo_modelo: 'Polo',
    veiculo_ano: 2021,
    veiculo_placa: 'MNO-7890',
    veiculo_fipe: 72000,
    origem: 'telefone' as OrigemLead,
    etapa: 'apresentacao' as EtapaLead,
    vendedor: 'Carlos Vendedor',
    created_at: '2024-01-12T11:00:00',
  },
];

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
  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string>('all');
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const filteredLeads = mockLeads.filter((lead) => {
    const matchesSearch =
      lead.nome.toLowerCase().includes(search.toLowerCase()) ||
      lead.telefone.includes(search) ||
      lead.veiculo_modelo.toLowerCase().includes(search.toLowerCase());
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
        <Button className="gap-2">
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
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
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
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ORIGEM_LABELS[lead.origem]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={etapaColors[lead.etapa]}>
                        {ETAPA_LABELS[lead.etapa]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{lead.vendedor}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(lead.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Criar cotação</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Marcar como perdido
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {etapas.slice(0, 5).map((etapa) => {
            const leadsInEtapa = mockLeads.filter((l) => l.etapa === etapa);
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
                    >
                      <CardContent className="p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {lead.nome.charAt(0)}
                          </div>
                          <span className="font-medium">{lead.nome}</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3" />
                            {lead.veiculo_marca} {lead.veiculo_modelo}
                          </div>
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
    </div>
  );
}
