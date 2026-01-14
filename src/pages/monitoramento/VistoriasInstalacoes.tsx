import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Clock, Calendar, Truck, CheckCircle, Search, Plus, MoreHorizontal,
  Camera, Wrench, RefreshCw, Image, MapPin, XCircle, Eye, Pencil,
  User, Navigation, Filter, AlertTriangle, ChevronLeft, ChevronRight, Home
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Vistoria {
  id: string;
  tipo: 'autovistoria' | 'instalacao' | 'reinstalacao';
  data: string;
  hora: string;
  periodo: string;
  cliente: string;
  veiculo: string;
  placa: string;
  valorFipe: number;
  rastreadorInstalado: boolean;
  endereco: string;
  gps?: { lat: number; lng: number };
  instalador?: string;
  status: string;
  fotos?: string[];
  fotosIncompletas?: boolean;
  motivoReprovacao?: string;
  viaApp: boolean;
}

const mockVistorias: Vistoria[] = [
  {
    id: '1',
    tipo: 'autovistoria',
    data: '2026-01-15',
    hora: '14:32',
    periodo: 'tarde',
    cliente: 'João Silva',
    veiculo: 'VW Gol 1.0 2020',
    placa: 'ABC-1234',
    valorFipe: 45000,
    rastreadorInstalado: false,
    endereco: 'Rua das Flores, 123 - São Paulo',
    gps: { lat: -23.5505, lng: -46.6333 },
    status: 'concluida',
    fotos: ['frente.jpg', 'traseira.jpg', 'lateral_esq.jpg', 'lateral_dir.jpg', 'painel.jpg'],
    viaApp: true
  },
  {
    id: '2',
    tipo: 'autovistoria',
    data: '2026-01-15',
    hora: '10:15',
    periodo: 'manhã',
    cliente: 'Maria Santos',
    veiculo: 'Fiat Mobi 2022',
    placa: 'DEF-5678',
    valorFipe: 28000,
    rastreadorInstalado: false,
    endereco: 'Av. Brasil, 456 - São Paulo',
    gps: { lat: -23.5489, lng: -46.6388 },
    status: 'concluida',
    fotos: ['frente.jpg', 'traseira.jpg', 'lateral_esq.jpg', 'lateral_dir.jpg', 'painel.jpg'],
    viaApp: true
  },
  {
    id: '3',
    tipo: 'instalacao',
    data: '2026-01-16',
    hora: '09:00',
    periodo: 'manhã',
    cliente: 'Pedro Costa',
    veiculo: 'Honda Civic 2023',
    placa: 'GHI-9012',
    valorFipe: 120000,
    rastreadorInstalado: false,
    endereco: 'Rua Central, 789 - Campinas',
    instalador: 'Pedro Técnico',
    status: 'agendada',
    viaApp: false
  },
  {
    id: '4',
    tipo: 'autovistoria',
    data: '2026-01-15',
    hora: '16:45',
    periodo: 'tarde',
    cliente: 'Ana Souza',
    veiculo: 'Toyota Corolla 2024',
    placa: 'JKL-3456',
    valorFipe: 150000,
    rastreadorInstalado: false,
    endereco: 'Av. Paulista, 1000 - São Paulo',
    gps: { lat: -23.5614, lng: -46.6558 },
    status: 'pendente',
    fotos: ['frente.jpg', 'traseira.jpg'],
    fotosIncompletas: true,
    viaApp: true
  },
  {
    id: '5',
    tipo: 'instalacao',
    data: '2026-01-15',
    hora: '14:00',
    periodo: 'tarde',
    cliente: 'Lucas Ferreira',
    veiculo: 'Jeep Compass 2023',
    placa: 'MNO-7890',
    valorFipe: 180000,
    rastreadorInstalado: true,
    endereco: 'Rua Augusta, 500 - São Paulo',
    instalador: 'Maria Técnica',
    status: 'concluida',
    viaApp: false
  },
  {
    id: '6',
    tipo: 'autovistoria',
    data: '2026-01-14',
    hora: '11:20',
    periodo: 'manhã',
    cliente: 'Carla Oliveira',
    veiculo: 'Renault Kwid 2021',
    placa: 'PQR-1122',
    valorFipe: 35000,
    rastreadorInstalado: false,
    endereco: 'Rua das Palmeiras, 200 - Santo André',
    gps: { lat: -23.6737, lng: -46.5432 },
    status: 'aprovada',
    fotos: ['frente.jpg', 'traseira.jpg', 'lateral_esq.jpg', 'lateral_dir.jpg', 'painel.jpg', 'motor.jpg'],
    viaApp: true
  },
  {
    id: '7',
    tipo: 'instalacao',
    data: '2026-01-15',
    hora: '11:00',
    periodo: 'manhã',
    cliente: 'Roberto Almeida',
    veiculo: 'Volkswagen T-Cross 2024',
    placa: 'STU-3344',
    valorFipe: 140000,
    rastreadorInstalado: false,
    endereco: 'Av. Ipiranga, 800 - São Paulo',
    instalador: 'João Técnico',
    status: 'em_rota',
    viaApp: false
  },
  {
    id: '8',
    tipo: 'autovistoria',
    data: '2026-01-15',
    hora: '09:05',
    periodo: 'manhã',
    cliente: 'Fernanda Lima',
    veiculo: 'Hyundai HB20 2020',
    placa: 'VWX-5566',
    valorFipe: 52000,
    rastreadorInstalado: false,
    endereco: 'Rua Oscar Freire, 300 - São Paulo',
    gps: { lat: -23.5629, lng: -46.6720 },
    status: 'reprovada',
    motivoReprovacao: 'Fotos escuras, placa ilegível',
    fotos: ['frente.jpg', 'traseira.jpg', 'lateral_esq.jpg'],
    viaApp: true
  }
];

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  em_rota: { label: 'Em Rota', className: 'bg-purple-100 text-purple-800' },
  em_andamento: { label: 'Em Andamento', className: 'bg-orange-100 text-orange-800' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-800' },
  aprovada: { label: 'Aprovada', className: 'bg-emerald-100 text-emerald-800' },
  reprovada: { label: 'Reprovada', className: 'bg-red-100 text-red-800' },
  reagendada: { label: 'Reagendada', className: 'bg-gray-100 text-gray-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
};

export default function VistoriasInstalacoes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [periodoFilter, setPeriodoFilter] = useState('todos');
  const [instaladorFilter, setInstaladorFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filtrar por tab
  const filteredByTab = mockVistorias.filter(item => {
    if (activeTab === 'todas') return true;
    if (activeTab === 'autovistorias') return item.tipo === 'autovistoria';
    if (activeTab === 'instalacoes') return item.tipo === 'instalacao' || item.tipo === 'reinstalacao';
    return true;
  });

  // Contadores para cards e tabs
  const autovistorasPendentes = mockVistorias.filter(v => v.tipo === 'autovistoria' && v.status === 'pendente').length;
  const instalacoesAgendadas = mockVistorias.filter(v => (v.tipo === 'instalacao' || v.tipo === 'reinstalacao') && v.status === 'agendada').length;
  const emAndamento = mockVistorias.filter(v => v.status === 'em_rota' || v.status === 'em_andamento').length;
  const concluidasHoje = mockVistorias.filter(v => v.status === 'concluida' && v.data === '2026-01-15').length;

  const totalAutovistorias = mockVistorias.filter(v => v.tipo === 'autovistoria').length;
  const totalInstalacoes = mockVistorias.filter(v => v.tipo === 'instalacao' || v.tipo === 'reinstalacao').length;

  // Paginação
  const totalItems = filteredByTab.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredByTab.slice(startIndex, startIndex + itemsPerPage);

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'autovistoria':
        return (
          <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
            <Camera className="h-3 w-3" />
            Autovistoria
          </Badge>
        );
      case 'instalacao':
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            Instalação
          </Badge>
        );
      case 'reinstalacao':
        return (
          <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Reinstalação
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRastreadorBadge = (item: Vistoria) => {
    if (item.rastreadorInstalado) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Instalado
        </Badge>
      );
    }
    if (item.valorFipe > 30000) {
      return <Badge className="bg-red-100 text-red-800">Obrigatório</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-600">Não necessário</Badge>;
  };

  const needsTrackerInstallation = (item: Vistoria) => {
    return item.tipo === 'autovistoria' && 
           item.status === 'aprovada' && 
           item.valorFipe > 30000 && 
           !item.rastreadorInstalado;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <span>/</span>
          <span>Monitoramento</span>
          <span>/</span>
          <span className="text-foreground font-medium">Vistoria/Instalação</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vistoria/Instalação</h1>
            <p className="text-muted-foreground">Gerencie vistorias e instalações de rastreadores</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => navigate('/monitoramento/instalacoes/agendar')}>
            <Plus className="mr-2 h-4 w-4" />
            Agendar Instalação
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{autovistorasPendentes}</p>
                  <p className="text-sm font-medium text-amber-800">Autovistorias Pendentes</p>
                  <p className="text-xs text-amber-600">Aguardando aprovação</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{instalacoesAgendadas}</p>
                  <p className="text-sm font-medium text-blue-800">Instalações Agendadas</p>
                  <p className="text-xs text-blue-600">Para os próximos dias</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{emAndamento}</p>
                  <p className="text-sm font-medium text-purple-800">Em Andamento</p>
                  <p className="text-xs text-purple-600">Técnico em rota</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{concluidasHoje}</p>
                  <p className="text-sm font-medium text-green-800">Concluídas Hoje</p>
                  <p className="text-xs text-green-600">Finalizadas hoje</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Filtro Rápido */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="todas" className="gap-2">
              Todas
              <Badge variant="secondary" className="ml-1">{mockVistorias.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="autovistorias" className="gap-2">
              Autovistorias
              <Badge variant="secondary" className="ml-1">{totalAutovistorias}</Badge>
            </TabsTrigger>
            <TabsTrigger value="instalacoes" className="gap-2">
              Instalações
              <Badge variant="secondary" className="ml-1">{totalInstalacoes}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="agendada">Agendada</SelectItem>
              <SelectItem value="em_rota">Em Rota</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="aprovada">Aprovada</SelectItem>
              <SelectItem value="reprovada">Reprovada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="amanha">Amanhã</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
            </SelectContent>
          </Select>

          <Select value={instaladorFilter} onValueChange={setInstaladorFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Instalador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="joao">João Técnico</SelectItem>
              <SelectItem value="pedro">Pedro Instalador</SelectItem>
              <SelectItem value="maria">Maria Técnica</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros Avançados
          </Button>
        </div>

        {/* Tabela */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Veículo/Placa</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Rastreador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(
                      item.status === 'reprovada' && 'bg-red-50'
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {needsTrackerInstallation(item) && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Aguardando instalação de rastreador
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {getTipoBadge(item.tipo)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{formatDate(item.data)}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.hora ? item.hora : item.periodo}
                        </div>
                        {item.viaApp && item.tipo === 'autovistoria' && (
                          <div className="text-xs text-muted-foreground">via App</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.cliente}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{item.veiculo}</div>
                        <div className="text-sm text-muted-foreground">{item.placa}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(item.valorFipe)}</span>
                    </TableCell>
                    <TableCell>
                      {getRastreadorBadge(item)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.status === 'reprovada' && item.motivoReprovacao ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className={statusConfig[item.status]?.className || 'bg-gray-100 text-gray-800'}>
                                {statusConfig[item.status]?.label || item.status}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {item.motivoReprovacao}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge className={statusConfig[item.status]?.className || 'bg-gray-100 text-gray-800'}>
                            {statusConfig[item.status]?.label || item.status}
                          </Badge>
                        )}
                        {item.fotosIncompletas && (
                          <Badge variant="outline" className="text-xs">
                            Fotos incompletas
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {item.tipo === 'autovistoria' ? (
                            <>
                              <DropdownMenuItem>
                                <Image className="mr-2 h-4 w-4" />
                                Ver fotos
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MapPin className="mr-2 h-4 w-4" />
                                Ver localização GPS
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Aprovar vistoria
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <XCircle className="mr-2 h-4 w-4" />
                                Reprovar - solicitar novas fotos
                              </DropdownMenuItem>
                              {item.valorFipe > 30000 && (
                                <DropdownMenuItem>
                                  <Calendar className="mr-2 h-4 w-4" />
                                  Agendar instalação de rastreador
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalhes completos
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar agendamento
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <User className="mr-2 h-4 w-4" />
                                Atribuir instalador
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Navigation className="mr-2 h-4 w-4" />
                                Iniciar rota
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Marcar como concluída
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Calendar className="mr-2 h-4 w-4" />
                                Reagendar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Exibindo {startIndex + 1} a {Math.min(startIndex + itemsPerPage, totalItems)} de {totalItems} registros
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / página</SelectItem>
                <SelectItem value="25">25 / página</SelectItem>
                <SelectItem value="50">50 / página</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8"
                >
                  {page}
                </Button>
              ))}

              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
