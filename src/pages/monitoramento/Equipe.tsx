import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ProfissionalModal, ProfissionalFormData } from '@/components/monitoramento/ProfissionalModal';
import { RelatorioTarefasModal } from '@/components/monitoramento/RelatorioTarefasModal';
import { EquipeCard, EquipeFilters, EquipeMetrics } from '@/components/equipe';
import { useProfissionaisEquipe, useSaveProfissional, useToggleProfissionalStatus, ProfissionalEquipe } from '@/hooks/useEquipe';
import { toast } from 'sonner';

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

  const handleRelatorio = (prof: ProfissionalEquipe) => {
    setProfissionalRelatorio(prof);
    setRelatorioModalOpen(true);
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
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        prof.nome.toLowerCase().includes(searchLower) ||
        prof.email.toLowerCase().includes(searchLower) ||
        (prof.telefone && prof.telefone.includes(searchTerm));
      const matchStatus = statusFilter === 'todos' || prof.status === statusFilter;
      const matchStatusOperacional = statusOperacionalFilter === 'todos' || prof.status_operacional === statusOperacionalFilter;
      const matchRegiao = regiaoFilter === 'todas' || prof.regioes_atendimento.includes(regiaoFilter);
      return matchSearch && matchStatus && matchStatusOperacional && matchRegiao;
    });
  }, [profissionais, searchTerm, statusFilter, statusOperacionalFilter, regiaoFilter]);

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
          <h1 className="text-2xl font-bold text-foreground">Equipe de Campo</h1>
          <p className="text-muted-foreground">
            Gerencie vistoriadores e instaladores em tempo real
          </p>
        </div>
        <Button onClick={handleNovoProfissional} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Profissional
        </Button>
      </div>

      {/* Modal de Edição */}
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

      {/* Métricas */}
      {profissionais && profissionais.length > 0 && (
        <EquipeMetrics profissionais={profissionais} />
      )}

      {/* Filtros */}
      <EquipeFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOperacionalFilter={statusOperacionalFilter}
        onStatusOperacionalChange={setStatusOperacionalFilter}
        regiaoFilter={regiaoFilter}
        onRegiaoChange={setRegiaoFilter}
      />

      {/* Grid de Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando equipe...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-destructive/5 rounded-lg border border-destructive/20">
          <p className="text-destructive font-medium">Erro ao carregar equipe</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profissionaisFiltrados.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 bg-muted/20 rounded-lg border border-dashed border-border">
              <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Nenhum profissional encontrado
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Cadastre profissionais com a role "instalador_vistoriador" no sistema 
                ou ajuste os filtros de busca.
              </p>
              <Button onClick={handleNovoProfissional} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Profissional
              </Button>
            </div>
          ) : (
            profissionaisFiltrados.map((profissional) => (
              <EquipeCard
                key={profissional.id}
                profissional={profissional}
                onEditar={handleEditar}
                onDesativar={handleDesativar}
                onRelatorio={handleRelatorio}
              />
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
