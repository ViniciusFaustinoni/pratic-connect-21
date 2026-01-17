import { useState } from 'react';
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
import { toast } from 'sonner';

type StatusProfissional = 'disponivel' | 'indisponivel' | 'ferias' | 'afastado';
type FuncaoProfissional = 'vistoriador' | 'instalador';

interface Profissional {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf?: string;
  whatsapp?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  status: StatusProfissional;
  regioes: string[];
  funcoes: FuncaoProfissional[];
  capacidadeDiaria: number;
  tarefasHoje: number;
  ultimaAtividade: string;
}

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

const REGIOES_DISPONIVEIS = [
  'Centro',
  'Pinheiros',
  'Consolação',
  'Zona Sul',
  'Santo Amaro',
  'Zona Norte',
  'Campinas',
  'Valinhos',
];

const mockProfissionais: Profissional[] = [
  {
    id: '1',
    nome: 'Pedro Silva',
    email: 'pedro@pratic.com',
    telefone: '(11) 99999-1111',
    status: 'disponivel',
    regioes: ['Centro', 'Pinheiros', 'Consolação'],
    funcoes: ['vistoriador', 'instalador'],
    capacidadeDiaria: 5,
    tarefasHoje: 3,
    ultimaAtividade: '2026-01-17T14:30:00',
  },
  {
    id: '2',
    nome: 'João Santos',
    email: 'joao@pratic.com',
    telefone: '(11) 98888-2222',
    status: 'disponivel',
    regioes: ['Zona Sul', 'Santo Amaro'],
    funcoes: ['instalador'],
    capacidadeDiaria: 4,
    tarefasHoje: 4,
    ultimaAtividade: '2026-01-17T15:00:00',
  },
  {
    id: '3',
    nome: 'Maria Oliveira',
    email: 'maria@pratic.com',
    telefone: '(11) 97777-3333',
    status: 'ferias',
    regioes: ['Campinas', 'Valinhos'],
    funcoes: ['vistoriador'],
    capacidadeDiaria: 6,
    tarefasHoje: 0,
    ultimaAtividade: '2026-01-10T18:00:00',
  },
  {
    id: '4',
    nome: 'Carlos Mendes',
    email: 'carlos@pratic.com',
    telefone: '(11) 96666-4444',
    status: 'indisponivel',
    regioes: ['Zona Norte'],
    funcoes: ['vistoriador', 'instalador'],
    capacidadeDiaria: 5,
    tarefasHoje: 0,
    ultimaAtividade: '2026-01-16T12:00:00',
  },
];

export default function Equipe() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [regiaoFilter, setRegiaoFilter] = useState<string>('todas');
  const [funcaoFilter, setFuncaoFilter] = useState<string>('todos');
  
  // Estado do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<Profissional | null>(null);

  const handleNovoProfissional = () => {
    setProfissionalSelecionado(null);
    setModalOpen(true);
  };

  const handleEditar = (prof: Profissional) => {
    setProfissionalSelecionado(prof);
    setModalOpen(true);
  };

  const handleSave = (data: ProfissionalFormData) => {
    if (profissionalSelecionado) {
      toast.success(`Profissional ${data.nome} atualizado com sucesso!`);
    } else {
      toast.success(`Profissional ${data.nome} cadastrado com sucesso!`);
    }
    // TODO: Integrar com Supabase
    console.log('Dados salvos:', data);
  };

  const profissionaisFiltrados = mockProfissionais.filter((prof) => {
    const matchSearch = prof.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || prof.status === statusFilter;
    const matchRegiao = regiaoFilter === 'todas' || prof.regioes.includes(regiaoFilter);
    const matchFuncao =
      funcaoFilter === 'todos' ||
      (funcaoFilter === 'ambos' && prof.funcoes.length === 2) ||
      prof.funcoes.includes(funcaoFilter as FuncaoProfissional);
    return matchSearch && matchStatus && matchRegiao && matchFuncao;
  });

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
          telefone: profissionalSelecionado.telefone,
          whatsapp: profissionalSelecionado.whatsapp,
          cep: profissionalSelecionado.cep,
          logradouro: profissionalSelecionado.logradouro,
          numero: profissionalSelecionado.numero,
          bairro: profissionalSelecionado.bairro,
          cidade: profissionalSelecionado.cidade,
          uf: profissionalSelecionado.uf,
          regioes: profissionalSelecionado.regioes,
          funcoes: profissionalSelecionado.funcoes,
          capacidadeDiaria: profissionalSelecionado.capacidadeDiaria,
          status: profissionalSelecionado.status === 'ferias' || profissionalSelecionado.status === 'afastado' 
            ? 'indisponivel' 
            : profissionalSelecionado.status,
        } : null}
        onSave={handleSave}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
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
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="indisponivel">Indisponível</SelectItem>
            <SelectItem value="ferias">Férias</SelectItem>
            <SelectItem value="afastado">Afastado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={regiaoFilter} onValueChange={setRegiaoFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {REGIOES_DISPONIVEIS.map((regiao) => (
              <SelectItem key={regiao} value={regiao}>
                {regiao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="vistoriador">Vistoriador</SelectItem>
            <SelectItem value="instalador">Instalador</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profissionaisFiltrados.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">Nenhum profissional encontrado</p>
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
                      <Badge
                        variant="outline"
                        className={STATUS_CONFIG[profissional.status].className}
                      >
                        {STATUS_CONFIG[profissional.status].label}
                      </Badge>
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
                      <DropdownMenuItem className="text-destructive">
                        <UserX className="mr-2 h-4 w-4" />
                        Desativar
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
                    <span>{profissional.telefone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{profissional.regioes.join(', ')}</span>
                  </div>
                </div>

                {/* Funções */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-muted-foreground">Funções:</span>
                  <div className="flex gap-1">
                    {profissional.funcoes.includes('vistoriador') && (
                      <Badge variant="secondary" className="gap-1">
                        <Eye className="h-3 w-3" />
                        Vistoriador
                      </Badge>
                    )}
                    {profissional.funcoes.includes('instalador') && (
                      <Badge variant="secondary" className="gap-1">
                        <Wrench className="h-3 w-3" />
                        Instalador
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Capacidade */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Capacidade: {profissional.capacidadeDiaria} tarefas/dia
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Hoje:</span>
                    <span className="font-medium text-foreground">
                      {profissional.tarefasHoje}/{profissional.capacidadeDiaria}
                    </span>
                  </div>
                  <Progress
                    value={(profissional.tarefasHoje / profissional.capacidadeDiaria) * 100}
                    className="h-2"
                  />
                </div>

                {/* Última atividade */}
                <p className="text-xs text-muted-foreground mb-4">
                  Última atividade: {formatUltimaAtividade(profissional.ultimaAtividade)}
                </p>

                {/* Ações */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Calendar className="mr-2 h-4 w-4" />
                    Ver Agenda
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <BarChart className="mr-2 h-4 w-4" />
                    Relatório
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
