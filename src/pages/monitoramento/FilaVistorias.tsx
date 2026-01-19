import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, MoreHorizontal, Calendar, User, Car, MapPin, 
  Clock, Camera, CheckCircle, XCircle, Eye, CalendarDays,
  UserPlus, Send, RotateCcw, Trash2, Loader2, LinkIcon
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, 
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import { useVistorias, Vistoria } from '@/hooks/useVistorias';
import { REGIOES_ATENDIMENTO } from '@/types/monitoramento';
import { toast } from 'sonner';
import { 
  AgendarVistoriaModal, 
  VistoriaParaAgendar, 
  AgendarVistoriaFormData 
} from '@/components/monitoramento/AgendarVistoriaModal';
import { 
  AtribuirVistoriadorModal, 
  VistoriaParaAtribuir 
} from '@/components/monitoramento/AtribuirVistoriadorModal';

// ============================================
// TIPOS E CONSTANTES
// ============================================

type StatusVistoriaFila = 
  | 'pendente'
  | 'agendada'
  | 'em_rota'
  | 'em_andamento'
  | 'aguardando_analise'
  | 'auto_vistoria_pendente'
  | 'aprovada'
  | 'reprovada';

type TipoVistoria = 'presencial' | 'auto_vistoria' | 'ponto_fixo';

interface VistoriaFila {
  id: string;
  protocolo: string;
  cliente: string;
  clienteId: string;
  veiculo: string;
  placa: string;
  tipo: TipoVistoria;
  regiao: string;
  dataAgendada: string | null;
  vistoriador: string | null;
  vistoriadorId: string | null;
  status: StatusVistoriaFila;
  createdAt: string;
}

const STATUS_CONFIG: Record<StatusVistoriaFila, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  em_rota: { label: 'Em Rota', className: 'bg-orange-100 text-orange-800' },
  em_andamento: { label: 'Em Andamento', className: 'bg-yellow-100 text-yellow-800' },
  aguardando_analise: { label: 'Aguard. Análise', className: 'bg-purple-100 text-purple-800' },
  auto_vistoria_pendente: { label: 'Auto Vistoria', className: 'bg-cyan-100 text-cyan-800' },
  aprovada: { label: 'Aprovada', className: 'bg-green-100 text-green-800' },
  reprovada: { label: 'Reprovada', className: 'bg-red-100 text-red-800' },
};

const TIPO_CONFIG: Record<TipoVistoria, { label: string; className: string }> = {
  presencial: { label: 'Presencial', className: 'bg-indigo-100 text-indigo-800' },
  auto_vistoria: { label: 'Auto Vistoria', className: 'bg-teal-100 text-teal-800' },
  ponto_fixo: { label: 'Ponto Fixo', className: 'bg-amber-100 text-amber-800' },
};

// ============================================
// UTILITÁRIOS
// ============================================

const gerarProtocolo = (id: string, createdAt: string): string => {
  const ano = new Date(createdAt).getFullYear();
  const numero = id.slice(-5).toUpperCase();
  return `VIS-${ano}-${numero}`;
};

const mapStatus = (status: string, modalidade?: string): StatusVistoriaFila => {
  // Se for auto_vistoria e pendente
  if (modalidade === 'auto_vistoria' && (status === 'pendente' || status === 'em_analise')) {
    return 'auto_vistoria_pendente';
  }
  
  switch (status) {
    case 'pendente': return 'pendente';
    case 'agendada': return 'agendada';
    case 'em_analise': return 'aguardando_analise';
    case 'aprovada': return 'aprovada';
    case 'reprovada': return 'reprovada';
    default: return 'pendente';
  }
};

const mapTipo = (modalidade?: string): TipoVistoria => {
  switch (modalidade) {
    case 'auto_vistoria': return 'auto_vistoria';
    case 'ponto_fixo': return 'ponto_fixo';
    default: return 'presencial';
  }
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function FilaVistorias() {
  // Estados
  const [activeTab, setActiveTab] = useState('pendentes');
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [regiaoFilter, setRegiaoFilter] = useState('todas');
  const [dataFilter, setDataFilter] = useState<Date | undefined>();
  const [vistoriadorFilter, setVistoriadorFilter] = useState('todos');
  
  // Estado do modal de agendamento
  const [agendarModalOpen, setAgendarModalOpen] = useState(false);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<VistoriaParaAgendar | null>(null);
  
  // Estado do modal de atribuir vistoriador
  const [atribuirModalOpen, setAtribuirModalOpen] = useState(false);
  const [vistoriaParaAtribuir, setVistoriaParaAtribuir] = useState<VistoriaParaAtribuir | null>(null);

  // Dados
  const { data: vistoriasRaw, isLoading } = useVistorias({});

  // Transformar dados
  const vistorias: VistoriaFila[] = useMemo(() => {
    if (!vistoriasRaw) return [];

    return vistoriasRaw.map((v: Vistoria) => {
      const raw = v as any;
      const clienteNome = v.associado?.nome || v.veiculo?.associado?.nome || raw.cotacao?.nome_solicitante || 'Cliente não identificado';
      const clienteId = v.associado?.id || v.veiculo?.associado?.id || '';
      
      // Buscar dados do veículo: primeiro do veiculo vinculado, depois do associado, depois da cotação
      const veiculoInfo = v.veiculo 
        ? `${v.veiculo.marca || ''} ${v.veiculo.modelo || ''}`.trim() 
        : v.associado?.veiculos?.[0] 
          ? `${v.associado.veiculos[0].marca || ''} ${v.associado.veiculos[0].modelo || ''}`.trim()
          : raw.cotacao?.veiculo_marca && raw.cotacao?.veiculo_modelo
            ? `${raw.cotacao.veiculo_marca} ${raw.cotacao.veiculo_modelo}`.trim()
            : 'Veículo não informado';
      
      const placa = v.veiculo?.placa || v.associado?.veiculos?.[0]?.placa || raw.cotacao?.veiculo_placa || '---';
      
      // Usar endereco_bairro ou endereco_cidade como região
      const regiao = raw.endereco_bairro || raw.endereco_cidade || 'Não informada';

      return {
        id: v.id,
        protocolo: gerarProtocolo(v.id, v.created_at),
        cliente: clienteNome,
        clienteId,
        veiculo: veiculoInfo,
        placa,
        tipo: mapTipo(raw.modalidade),
        regiao,
        dataAgendada: v.data_agendada,
        vistoriador: v.vistoriador?.nome || null,
        vistoriadorId: v.vistoriador_id,
        status: mapStatus(v.status, raw.modalidade),
        createdAt: v.created_at,
      };
    });
  }, [vistoriasRaw]);

  // Lista de vistoriadores únicos
  const vistoriadores = useMemo(() => {
    const map = new Map<string, string>();
    vistorias.forEach(v => {
      if (v.vistoriadorId && v.vistoriador) {
        map.set(v.vistoriadorId, v.vistoriador);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [vistorias]);

  // Contadores por tab - Pendentes agora inclui 'pendente' + 'agendada'
  const contadores = useMemo(() => {
    const hoje = new Date().toDateString();
    return {
      pendentes: vistorias.filter(v => v.status === 'pendente' || v.status === 'agendada').length,
      emCampo: vistorias.filter(v => v.status === 'em_rota' || v.status === 'em_andamento').length,
      aguardandoAnalise: vistorias.filter(v => v.status === 'aguardando_analise').length,
      autoVistoria: vistorias.filter(v => v.status === 'auto_vistoria_pendente').length,
      concluidasHoje: vistorias.filter(v => 
        (v.status === 'aprovada' || v.status === 'reprovada') && 
        new Date(v.createdAt).toDateString() === hoje
      ).length,
    };
  }, [vistorias]);

  // Filtrar vistorias por tab - Pendentes agora inclui 'pendente' + 'agendada'
  const vistoriasFiltradas = useMemo(() => {
    let result = vistorias;

    // Filtrar por tab
    switch (activeTab) {
      case 'pendentes':
        // Consolidar pendentes e agendadas em uma única tab
        result = result.filter(v => v.status === 'pendente' || v.status === 'agendada');
        break;
      case 'em_campo':
        result = result.filter(v => v.status === 'em_rota' || v.status === 'em_andamento');
        break;
      case 'aguardando_analise':
        result = result.filter(v => v.status === 'aguardando_analise');
        break;
      case 'auto_vistoria':
        result = result.filter(v => v.status === 'auto_vistoria_pendente');
        break;
      case 'concluidas':
        result = result.filter(v => v.status === 'aprovada' || v.status === 'reprovada');
        break;
    }

    // Busca
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(v =>
        v.protocolo.toLowerCase().includes(searchLower) ||
        v.cliente.toLowerCase().includes(searchLower) ||
        v.placa.toLowerCase().includes(searchLower)
      );
    }

    // Tipo
    if (tipoFilter !== 'todos') {
      result = result.filter(v => v.tipo === tipoFilter);
    }

    // Região
    if (regiaoFilter !== 'todas') {
      result = result.filter(v => v.regiao === regiaoFilter);
    }

    // Data
    if (dataFilter) {
      const dataFiltro = dataFilter.toDateString();
      result = result.filter(v => 
        v.dataAgendada && new Date(v.dataAgendada).toDateString() === dataFiltro
      );
    }

    // Vistoriador
    if (vistoriadorFilter === 'nao_atribuido') {
      result = result.filter(v => !v.vistoriador);
    } else if (vistoriadorFilter !== 'todos') {
      result = result.filter(v => v.vistoriadorId === vistoriadorFilter);
    }

    return result;
  }, [vistorias, activeTab, search, tipoFilter, regiaoFilter, dataFilter, vistoriadorFilter]);

  // Limpar filtros
  const limparFiltros = () => {
    setSearch('');
    setTipoFilter('todos');
    setRegiaoFilter('todas');
    setDataFilter(undefined);
    setVistoriadorFilter('todos');
  };

  // Handler para abrir modal de agendamento
  const handleAgendar = (vistoria: VistoriaFila) => {
    setVistoriaSelecionada({
      id: vistoria.id,
      protocolo: vistoria.protocolo,
      cliente: vistoria.cliente,
      veiculo: vistoria.veiculo,
      placa: vistoria.placa,
      regiao: vistoria.regiao,
    });
    setAgendarModalOpen(true);
  };

  // Handler para salvar agendamento
  const handleSaveAgendamento = async (data: AgendarVistoriaFormData) => {
    // TODO: Implementar mutação real para salvar no banco
    console.log('Agendamento:', data);
    toast.success('Vistoria agendada com sucesso!');
    setAgendarModalOpen(false);
  };

  // Handler para abrir modal de atribuição
  const handleAtribuir = (vistoria: VistoriaFila) => {
    setVistoriaParaAtribuir({
      id: vistoria.id,
      protocolo: vistoria.protocolo,
      cliente: vistoria.cliente,
      veiculo: vistoria.veiculo,
      placa: vistoria.placa,
      endereco: vistoria.regiao, // TODO: buscar endereço completo
      regiao: vistoria.regiao,
      dataAgendada: vistoria.dataAgendada || '',
      periodo: 'manha', // TODO: extrair do horário real
      vistoriadorAtualId: vistoria.vistoriadorId,
      vistoriadorAtualNome: vistoria.vistoriador,
    });
    setAtribuirModalOpen(true);
  };

  // Handler para salvar atribuição
  const handleSaveAtribuicao = async (vistoriadorId: string) => {
    // TODO: Implementar mutação real para salvar no banco
    console.log('Atribuição vistoriador:', vistoriadorId);
    toast.success('Vistoriador atribuído com sucesso!');
    setAtribuirModalOpen(false);
  };

  // Ações 
  const handleAction = (action: string, vistoria: VistoriaFila) => {
    switch (action) {
      case 'agendar':
      case 'reagendar':
        handleAgendar(vistoria);
        break;
      case 'atribuir':
        handleAtribuir(vistoria);
        break;
      default:
        toast.info(`Ação: ${action} - Vistoria: ${vistoria.protocolo}`);
    }
  };

  // Renderizar ações contextuais
  const renderAcoes = (vistoria: VistoriaFila) => {
    const acoes: { label: string; icon: React.ElementType; action: string }[] = [
      { label: 'Ver detalhes', icon: Eye, action: 'ver_detalhes' },
    ];

    switch (vistoria.status) {
      case 'pendente':
        acoes.push(
          { label: 'Agendar', icon: CalendarDays, action: 'agendar' },
          { label: 'Atribuir vistoriador', icon: UserPlus, action: 'atribuir' },
          { label: 'Enviar auto vistoria', icon: Send, action: 'auto_vistoria' }
        );
        break;
      case 'agendada':
        acoes.push(
          { label: 'Reagendar', icon: RotateCcw, action: 'reagendar' },
          { label: 'Atribuir/Trocar vistoriador', icon: UserPlus, action: 'atribuir' },
          { label: 'Cancelar', icon: Trash2, action: 'cancelar' }
        );
        break;
      case 'aguardando_analise':
        acoes.push({ label: 'Analisar', icon: CheckCircle, action: 'analisar' });
        break;
      case 'auto_vistoria_pendente':
        acoes.push({ label: 'Reenviar link', icon: LinkIcon, action: 'reenviar_link' });
        break;
      case 'reprovada':
        acoes.push({ label: 'Reagendar', icon: RotateCcw, action: 'reagendar' });
        break;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {acoes.map((acao, index) => (
            <DropdownMenuItem 
              key={acao.action}
              onClick={() => handleAction(acao.action, vistoria)}
            >
              <acao.icon className="mr-2 h-4 w-4" />
              {acao.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/monitoramento/dashboard">Monitoramento</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Vistorias</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-2xl font-bold mt-4">Fila de Vistorias</h1>
        <p className="text-muted-foreground">
          Gerencie vistorias pendentes, agendadas e em análise
        </p>
      </div>

      {/* Tabs - Removida tab "Agendadas" separada, consolidada em "Pendentes" */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-2">
          <TabsTrigger value="pendentes" className="gap-2">
            Pendentes
            <Badge variant="secondary" className="ml-1">{contadores.pendentes}</Badge>
          </TabsTrigger>
          <TabsTrigger value="em_campo" className="gap-2">
            Em Campo
            <Badge variant="secondary" className="ml-1">{contadores.emCampo}</Badge>
          </TabsTrigger>
          <TabsTrigger value="aguardando_analise" className="gap-2">
            Aguard. Análise
            <Badge variant="secondary" className="ml-1">{contadores.aguardandoAnalise}</Badge>
          </TabsTrigger>
          <TabsTrigger value="auto_vistoria" className="gap-2">
            Auto Vistoria
            <Badge variant="secondary" className="ml-1">{contadores.autoVistoria}</Badge>
          </TabsTrigger>
          <TabsTrigger value="concluidas" className="gap-2">
            Concluídas
            <Badge variant="secondary" className="ml-1">{contadores.concluidasHoje}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, placa ou protocolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="auto_vistoria">Auto Vistoria</SelectItem>
              <SelectItem value="ponto_fixo">Ponto Fixo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={regiaoFilter} onValueChange={setRegiaoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as regiões</SelectItem>
              {REGIOES_ATENDIMENTO.map((regiao) => (
                <SelectItem key={regiao.value} value={regiao.value}>
                  {regiao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dataFilter && "text-muted-foreground")}>
                <Calendar className="mr-2 h-4 w-4" />
                {dataFilter ? format(dataFilter, 'dd/MM/yyyy') : 'Data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dataFilter}
                onSelect={setDataFilter}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select value={vistoriadorFilter} onValueChange={setVistoriadorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vistoriador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
              {vistoriadores.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || tipoFilter !== 'todos' || regiaoFilter !== 'todas' || dataFilter || vistoriadorFilter !== 'todos') && (
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Conteúdo */}
        <div className="mt-4 rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : vistoriasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma vistoria encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Protocolo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-[180px]">Veículo</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead className="w-[120px]">Região</TableHead>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead className="w-[130px]">Vistoriador</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vistoriasFiltradas.map((vistoria) => (
                  <TableRow key={vistoria.id}>
                    <TableCell className="font-mono text-sm">
                      {vistoria.protocolo}
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/cadastro/associados/${vistoria.clienteId}`}
                        className="text-primary hover:underline"
                      >
                        {vistoria.cliente}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{vistoria.veiculo}</span>
                        <span className="text-xs text-muted-foreground font-mono">{vistoria.placa}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TIPO_CONFIG[vistoria.tipo].className}>
                        {TIPO_CONFIG[vistoria.tipo].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {vistoria.regiao}
                    </TableCell>
                    <TableCell>
                      {vistoria.dataAgendada ? (
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {format(new Date(vistoria.dataAgendada), 'dd/MM/yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(vistoria.dataAgendada), 'HH:mm')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não agendada</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {vistoria.vistoriador || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[vistoria.status].className}>
                        {STATUS_CONFIG[vistoria.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {renderAcoes(vistoria)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Tabs>

      {/* Modal de Agendamento */}
      <AgendarVistoriaModal
        open={agendarModalOpen}
        onOpenChange={setAgendarModalOpen}
        vistoria={vistoriaSelecionada}
        onSave={handleSaveAgendamento}
      />

      {/* Modal de Atribuir Vistoriador */}
      <AtribuirVistoriadorModal
        open={atribuirModalOpen}
        onOpenChange={setAtribuirModalOpen}
        vistoria={vistoriaParaAtribuir}
        onSave={handleSaveAtribuicao}
      />
    </div>
  );
}
