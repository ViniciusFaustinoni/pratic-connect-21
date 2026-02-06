import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BarChart,
  Eye,
  Wrench,
  Edit,
  UserX,
  Umbrella,
  Loader2,
  Users,
  Navigation,
  Signal,
  SignalZero,
  Radio,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ProfissionalModal, Profissional as ProfissionalModalData, ProfissionalFormData } from '@/components/monitoramento/ProfissionalModal';
import { RelatorioTarefasModal } from '@/components/monitoramento/RelatorioTarefasModal';
import { useProfissionaisEquipe, useSaveProfissional, useToggleProfissionalStatus, ProfissionalEquipe, StatusProfissional, StatusOperacional } from '@/hooks/useEquipe';
import { toast } from 'sonner';
import { REGIOES_ATENDIMENTO } from '@/types/monitoramento';

const STATUS_CONFIG: Record<StatusProfissional, { label: string; className: string }> = {
  disponivel: {
    label: 'Disponível',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  indisponivel: {
    label: 'Indisponível',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  ferias: {
    label: 'Férias',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  afastado: {
    label: 'Afastado',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

const STATUS_OPERACIONAL_CONFIG: Record<StatusOperacional, { label: string; className: string; icon: React.ReactNode }> = {
  em_andamento: {
    label: 'Em Andamento',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Wrench className="h-3 w-3" />,
  },
  em_rota: {
    label: 'Em Rota',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <Navigation className="h-3 w-3" />,
  },
  disponivel_operacional: {
    label: 'Online',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse',
    icon: <Signal className="h-3 w-3" />,
  },
  offline: {
    label: 'Offline',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: <SignalZero className="h-3 w-3" />,
  },
};

export default function Equipe() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [statusOperacionalFilter, setStatusOperacionalFilter] = useState<string>('todos');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('todas');
  
  // Estado do modal de edição
  const [modalOpen, setModalOpen] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<ProfissionalEquipe | null>(null);
  
  // Estado do modal de relatório
  const [relatorioModalOpen, setRelatorioModalOpen] = useState(false);
  const [profissionalRelatorio, setProfissionalRelatorio] = useState<ProfissionalEquipe | null>(null);

  // Hooks de dados
  const { data: profissionais, isLoading, error } = useProfissionaisEquipe();
  const { mutate: saveProfissional, isPending: isSaving } = useSaveProfissional();
  const { mutate: toggleStatus } = useToggleProfissionalStatus();

  const handleNovoProfissional = () => {
    setProfissionalSelecionado(null);
    setModalOpen(true);
  };

  const handleEditar = (prof: ProfissionalEquipe) => {
    setProfissionalSelecionado(prof);
    setModalOpen(true);
  };

  const handleDesativar = (prof: ProfissionalEquipe) => {
    toggleStatus(
      { id: prof.id, ativo: !prof.ativo },
      {
        onSuccess: () => {
          toast.success(prof.ativo ? 'Profissional desativado' : 'Profissional ativado');
        },
        onError: (err) => {
          toast.error('Erro ao alterar status: ' + (err as Error).message);
        },
      }
    );
  };

  const handleSave = (data: ProfissionalFormData) => {
    saveProfissional(
      {
        id: profissionalSelecionado?.id,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        whatsapp: data.whatsapp,
        cpf: data.cpf,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
        regioes_atendimento: data.regioes,
        capacidade_diaria: data.capacidadeDiaria,
        ativo: data.status === 'disponivel',
      },
      {
        onSuccess: () => {
          toast.success(profissionalSelecionado ? 'Profissional atualizado!' : 'Profissional cadastrado!');
          setModalOpen(false);
        },
        onError: (err) => {
          toast.error('Erro: ' + (err as Error).message);
        },
      }
    );
  };

  const profissionaisFiltrados = useMemo(() => {
    if (!profissionais) return [];
    
    return profissionais.filter((prof) => {
      const matchSearch = prof.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'todos' || prof.status === statusFilter;
      const matchStatusOperacional = statusOperacionalFilter === 'todos' || prof.status_operacional === statusOperacionalFilter;
      const matchRegiao = regiaoFilter === 'todas' || prof.regioes_atendimento.includes(regiaoFilter);
      return matchSearch && matchStatus && matchStatusOperacional && matchRegiao;
    });
  }, [profissionais, searchTerm, statusFilter, statusOperacionalFilter, regiaoFilter]);

  const getInitials = (nome: string) =>
    nome
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const formatUltimaAtividade = (data: string) => {
    const date = new Date(data);
    const hoje = new Date();
    if (format(date, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd')) {
      return `Hoje às ${format(date, 'HH:mm')}`;
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
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
              <Link to="/monitoramento">Monitoramento</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Equipe</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipe de Vistoriadores e Instaladores</h1>
          <p className="text-muted-foreground">Gerencie sua equipe de campo</p>
        </div>
        <Button onClick={handleNovoProfissional}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Profissional
        </Button>
      </div>

      {/* Modal */}
      <ProfissionalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        profissional={profissionalSelecionado ? {
          id: profissionalSelecionado.id,
          nome: profissionalSelecionado.nome,
          cpf: profissionalSelecionado.cpf || '',
          email: profissionalSelecionado.email,
          telefone: profissionalSelecionado.telefone || '',
          whatsapp: profissionalSelecionado.whatsapp,
          cep: profissionalSelecionado.cep,
          logradouro: profissionalSelecionado.logradouro,
          numero: profissionalSelecionado.numero,
          bairro: profissionalSelecionado.bairro,
          cidade: profissionalSelecionado.cidade,
          uf: profissionalSelecionado.uf,
          regioes: profissionalSelecionado.regioes_atendimento,
          capacidadeDiaria: profissionalSelecionado.capacidade_diaria,
          status: profissionalSelecionado.status === 'ferias' || profissionalSelecionado.status === 'afastado' 
            ? 'indisponivel' 
            : profissionalSelecionado.status,
        } : null}
        onSave={handleSave}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="indisponivel">Indisponível</SelectItem>
            <SelectItem value="ferias">Férias</SelectItem>
            <SelectItem value="afastado">Afastado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusOperacionalFilter} onValueChange={setStatusOperacionalFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status Operacional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Operacionais</SelectItem>
            <SelectItem value="em_andamento">
              <span className="flex items-center gap-2">
                <Wrench className="h-3 w-3 text-blue-600" />
                Em Andamento
              </span>
            </SelectItem>
            <SelectItem value="em_rota">
              <span className="flex items-center gap-2">
                <Navigation className="h-3 w-3 text-purple-600" />
                Em Rota
              </span>
            </SelectItem>
            <SelectItem value="disponivel_operacional">
              <span className="flex items-center gap-2">
                <Signal className="h-3 w-3 text-emerald-600" />
                Online
              </span>
            </SelectItem>
            <SelectItem value="offline">
              <span className="flex items-center gap-2">
                <SignalZero className="h-3 w-3 text-gray-500" />
                Offline
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={regiaoFilter} onValueChange={setRegiaoFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
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

      {/* Grid de Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar equipe: {(error as Error).message}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profissionaisFiltrados.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">Nenhum profissional encontrado</p>
              <p className="text-sm text-muted-foreground">
                Cadastre profissionais com a role "instalador_vistoriador" no sistema.
              </p>
            </div>
          ) : (
            profissionaisFiltrados.map((profissional) => (
              <Card key={profissional.id} className="overflow-hidden">
                <CardContent className="p-4">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(profissional.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">{profissional.nome}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={STATUS_CONFIG[profissional.status].className}
                          >
                            {STATUS_CONFIG[profissional.status].label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`flex items-center gap-1 ${STATUS_OPERACIONAL_CONFIG[profissional.status_operacional].className}`}
                          >
                            {STATUS_OPERACIONAL_CONFIG[profissional.status_operacional].icon}
                            {STATUS_OPERACIONAL_CONFIG[profissional.status_operacional].label}
                          </Badge>
                          {profissional.rastreadores_atribuidos > 0 && (
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1 bg-orange-100 text-orange-800 border-orange-200"
                              title={`${profissional.rastreadores_atribuidos} rastreador(es) em posse`}
                            >
                              <Radio className="h-3 w-3" />
                              {profissional.rastreadores_atribuidos}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditar(profissional)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Calendar className="mr-2 h-4 w-4" />
                          Ver agenda
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Umbrella className="mr-2 h-4 w-4" />
                          Marcar férias
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className={profissional.ativo ? "text-destructive" : "text-green-600"}
                          onClick={() => handleDesativar(profissional)}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          {profissional.ativo ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Contato */}
                  <div className="space-y-1 mb-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{profissional.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{profissional.telefone || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">
                        {profissional.regioes_atendimento.length > 0 
                          ? profissional.regioes_atendimento.join(', ')
                          : 'Nenhuma região'
                        }
                      </span>
                    </div>
                  </div>

                  {/* Capacidade */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Capacidade: {profissional.capacidade_diaria} tarefas/dia
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Hoje:</span>
                      <span className="font-medium text-foreground">
                        {profissional.tarefas_hoje}/{profissional.capacidade_diaria}
                      </span>
                    </div>
                    <Progress
                      value={(profissional.tarefas_hoje / profissional.capacidade_diaria) * 100}
                      className="h-2"
                    />
                  </div>

                  {/* Última atividade */}
                  <p className="text-xs text-muted-foreground mb-4">
                    Última atividade: {profissional.ultima_atividade 
                      ? formatUltimaAtividade(profissional.ultima_atividade)
                      : 'Sem atividade registrada'
                    }
                  </p>

                  {/* Ações */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setProfissionalRelatorio(profissional);
                        setRelatorioModalOpen(true);
                      }}
                    >
                      <BarChart className="mr-2 h-4 w-4" />
                      Relatório
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
      
      {/* Modal de Relatório */}
      <RelatorioTarefasModal
        open={relatorioModalOpen}
        onOpenChange={setRelatorioModalOpen}
        profissionalId={profissionalRelatorio?.id || ''}
        profissionalNome={profissionalRelatorio?.nome || ''}
      />
    </div>
  );
}
