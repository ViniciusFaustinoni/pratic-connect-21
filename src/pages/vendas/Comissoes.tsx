import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  BarChart3, 
  Trophy, 
  Calendar, 
  Users, 
  History,
  Settings,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useComissoes } from '@/hooks/useComissoes';
import { useComissoesExtended } from '@/hooks/useComissoesExtended';
import { useComissoesCampanhas } from '@/hooks/useComissoesCampanhas';
import { PermissionGate } from '@/components/PermissionGate';
import { ComissoesKPICards } from '@/components/comissoes/ComissoesKPICards';
import { ComissoesChart } from '@/components/comissoes/ComissoesChart';
import { ComissoesResumoTable } from '@/components/comissoes/ComissoesResumoTable';
import { ComissoesRankingTab } from '@/components/comissoes/ComissoesRankingTab';
import { ComissoesFechamentoTab } from '@/components/comissoes/ComissoesFechamentoTab';
import { ComissoesDetalhesTab } from '@/components/comissoes/ComissoesDetalhesTab';
import { ComissoesHistoricoTab } from '@/components/comissoes/ComissoesHistoricoTab';
import { toast } from 'sonner';

const statusLabels: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  em_apuracao: { label: 'Em Apuração', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  fechada: { label: 'Fechada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  paga: { label: 'Paga', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export default function Comissoes() {
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());
  const [activeTab, setActiveTab] = useState('resumo');

  // Hooks de dados
  const { comissoes, isLoading: isLoadingComissoes, aprovarComissao, aprovarEmLote, marcarComoPaga } = useComissoes({
    mes,
    ano,
  });

  const {
    resumoVendedores,
    deducoesMensal,
    auditoriaRecente,
    isLoading: isLoadingExtended,
    isLoadingAuditoria,
    executarFechamento,
    totalComissoes,
    vendedoresAtivos,
    totalVendas,
    totaisDeducoes,
  } = useComissoesExtended({ mes, ano });

  const { campanhas, campanhaAtual, criarCampanha } = useComissoesCampanhas();

  // Campanha do mês/ano selecionado
  const campanhaSelecionada = campanhas.find(c => c.mes === mes && c.ano === ano) || null;

  // Comissões por status
  const comissoesPendentes = comissoes?.filter(c => c.status === 'pendente') || [];
  const comissoesAprovadas = comissoes?.filter(c => c.status === 'aprovada') || [];

  const handleCriarCampanha = () => {
    const dataInicio = startOfMonth(new Date(ano, mes - 1));
    const dataFim = endOfMonth(new Date(ano, mes - 1));
    
    criarCampanha.mutate({
      nome: `Campanha ${format(dataInicio, 'MMMM yyyy', { locale: ptBR })}`,
      mes,
      ano,
      data_inicio: format(dataInicio, 'yyyy-MM-dd'),
      data_fim: format(dataFim, 'yyyy-MM-dd'),
    });
  };

  const handleExecutarFechamento = () => {
    executarFechamento.mutate({ mes, ano });
  };

  const handleAprovar = (id: string) => {
    aprovarComissao.mutate(id);
  };

  const handleAprovarLote = (ids: string[]) => {
    aprovarEmLote.mutate(ids);
  };

  const handleMarcarPaga = (id: string) => {
    marcarComoPaga.mutate(id);
  };

  const handleVendedorClick = (vendedorId: string) => {
    setActiveTab('detalhes');
  };

  // Meses e anos para seletores
  const meses = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i), 'MMMM', { locale: ptBR }),
  }));

  const anos = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <PermissionGate 
      permission={['isDiretor', 'isGerente', 'isSupervisor']} 
      mode="any"
      fallback={
        <div className="container mx-auto py-12 text-center">
          <DollarSign className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar a gestão de comissões.
          </p>
        </div>
      }
    >
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <nav className="text-sm text-muted-foreground mb-1">
              Vendas / Comissões
            </nav>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Gestão de Comissionamento
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Status da campanha */}
            {campanhaSelecionada && (
              <Badge className={statusLabels[campanhaSelecionada.status]?.color || ''}>
                {statusLabels[campanhaSelecionada.status]?.label || campanhaSelecionada.status}
              </Badge>
            )}

            {/* Seletores de período */}
            <div className="flex gap-2">
              <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a.toString()}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Link to="/vendas/comissoes/config">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="resumo" className="gap-2">
              <BarChart3 className="h-4 w-4 hidden sm:block" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2">
              <Trophy className="h-4 w-4 hidden sm:block" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="fechamento" className="gap-2">
              <Calendar className="h-4 w-4 hidden sm:block" />
              Fechamento
            </TabsTrigger>
            <TabsTrigger value="detalhes" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4 hidden sm:block" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Resumo Executivo */}
          <TabsContent value="resumo" className="mt-6 space-y-6">
            <ComissoesKPICards
              totalComissoes={totalComissoes}
              vendedoresAtivos={vendedoresAtivos}
              totalVendas={totalVendas}
              totalDeducoes={totaisDeducoes}
              isLoading={isLoadingExtended}
            />

            <ComissoesChart 
              resumoVendedores={resumoVendedores || []} 
              maxVendedores={10}
            />

            <ComissoesResumoTable
              resumoVendedores={resumoVendedores || []}
              isLoading={isLoadingExtended}
              onVendedorClick={handleVendedorClick}
            />
          </TabsContent>

          {/* Tab 2: Ranking */}
          <TabsContent value="ranking" className="mt-6">
            <ComissoesRankingTab
              mes={mes}
              ano={ano}
              hasCampanha={!!campanhaSelecionada}
              onCriarCampanha={handleCriarCampanha}
            />
          </TabsContent>

          {/* Tab 3: Fechamento */}
          <TabsContent value="fechamento" className="mt-6">
            <ComissoesFechamentoTab
              mes={mes}
              ano={ano}
              campanha={campanhaSelecionada}
              comissoesPendentes={comissoesPendentes}
              comissoesAprovadas={comissoesAprovadas}
              onCriarCampanha={handleCriarCampanha}
              onExecutarFechamento={handleExecutarFechamento}
              onAprovar={handleAprovar}
              onAprovarLote={handleAprovarLote}
              onMarcarPaga={handleMarcarPaga}
              isExecutingFechamento={executarFechamento.isPending}
            />
          </TabsContent>

          {/* Tab 4: Detalhes */}
          <TabsContent value="detalhes" className="mt-6">
            <ComissoesDetalhesTab
              resumoVendedores={resumoVendedores || []}
              deducoesMensal={deducoesMensal || []}
              comissoes={comissoes || []}
              isLoading={isLoadingExtended}
            />
          </TabsContent>

          {/* Tab 5: Histórico */}
          <TabsContent value="historico" className="mt-6">
            <ComissoesHistoricoTab
              auditoria={auditoriaRecente || []}
              pagamentos={[]}
              isLoadingAuditoria={isLoadingAuditoria}
              isLoadingPagamentos={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
