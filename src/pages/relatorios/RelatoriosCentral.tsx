import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, Search, Star, DollarSign, Users, 
  AlertTriangle, BarChart3, ShoppingCart, Wrench, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RelatorioModal } from '@/components/relatorios/RelatorioModal';
import { getRotaExistente, getRelatorioConfig } from '@/config/relatoriosConfig';

interface Relatorio {
  id: string;
  nome: string;
  descricao: string;
  rota: string;
}

interface Categoria {
  id: string;
  nome: string;
  icone: React.ComponentType<{ className?: string }>;
  cor: string;
  corBadge: string;
  descricao: string;
  relatorios: Relatorio[];
}

export default function RelatoriosCentral() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    const saved = localStorage.getItem('relatorios_favoritos');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedRelatorio, setSelectedRelatorio] = useState<Relatorio | null>(null);
  const [showModal, setShowModal] = useState(false);

  const toggleFavorito = (relatorioId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const novosFavoritos = favoritos.includes(relatorioId)
      ? favoritos.filter(id => id !== relatorioId)
      : [...favoritos, relatorioId];
    
    setFavoritos(novosFavoritos);
    localStorage.setItem('relatorios_favoritos', JSON.stringify(novosFavoritos));
    toast.success(favoritos.includes(relatorioId) ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
  };

  const categorias: Categoria[] = [
    {
      id: 'comercial',
      nome: 'Comercial',
      icone: ShoppingCart,
      cor: 'bg-blue-500',
      corBadge: 'bg-blue-500/10 text-blue-600 border-blue-200',
      descricao: 'Vendas, leads e conversões',
      relatorios: [
        { id: 'leads-origem', nome: 'Leads por Origem', descricao: 'Análise de origem dos leads', rota: '/relatorios/leads-origem' },
        { id: 'conversao-vendedor', nome: 'Conversão por Vendedor', descricao: 'Taxa de conversão da equipe', rota: '/relatorios/conversao-vendedor' },
        { id: 'tempo-conversao', nome: 'Tempo Médio de Conversão', descricao: 'Ciclo de vendas', rota: '/relatorios/tempo-conversao' },
        { id: 'cotacoes-contratos', nome: 'Cotações x Contratos', descricao: 'Funil de vendas', rota: '/relatorios/cotacoes-contratos' },
        { id: 'metas-realizado', nome: 'Metas vs Realizado', descricao: 'Acompanhamento de metas', rota: '/relatorios/metas-realizado' },
        { id: 'ranking-vendedores', nome: 'Ranking de Vendedores', descricao: 'Performance da equipe', rota: '/relatorios/ranking-vendedores' },
      ]
    },
    {
      id: 'financeiro',
      nome: 'Financeiro',
      icone: DollarSign,
      cor: 'bg-green-500',
      corBadge: 'bg-green-500/10 text-green-600 border-green-200',
      descricao: 'Receitas, despesas e fluxo de caixa',
      relatorios: [
        { id: 'receitas-plano', nome: 'Receitas por Plano', descricao: 'Faturamento por tipo de plano', rota: '/relatorios/receitas-plano' },
        { id: 'inadimplencia-faixa', nome: 'Inadimplência por Faixa', descricao: 'Aging de inadimplentes', rota: '/relatorios/inadimplencia-faixa' },
        { id: 'aging-recebiveis', nome: 'Aging de Recebíveis', descricao: 'Contas a receber por vencimento', rota: '/relatorios/aging-recebiveis' },
        { id: 'fluxo-caixa', nome: 'Fluxo de Caixa Projetado', descricao: 'Projeção de entradas e saídas', rota: '/relatorios/fluxo-caixa' },
        { id: 'conciliacao-bancaria', nome: 'Conciliação Bancária', descricao: 'Confronto bancário', rota: '/relatorios/conciliacao-bancaria' },
        { id: 'custos-centro', nome: 'Custos por Centro', descricao: 'Despesas por centro de custo', rota: '/relatorios/custos-centro' },
      ]
    },
    {
      id: 'operacional',
      nome: 'Operacional',
      icone: Wrench,
      cor: 'bg-orange-500',
      corBadge: 'bg-orange-500/10 text-orange-600 border-orange-200',
      descricao: 'Instalações, rotas e estoque',
      relatorios: [
        { id: 'instalacoes-regiao', nome: 'Instalações por Região', descricao: 'Distribuição geográfica', rota: '/relatorios/instalacoes-regiao' },
        { id: 'tempo-instalacao', nome: 'Tempo Médio de Instalação', descricao: 'Eficiência operacional', rota: '/relatorios/tempo-instalacao' },
        { id: 'produtividade-instalador', nome: 'Produtividade por Instalador', descricao: 'Performance da equipe técnica', rota: '/relatorios/produtividade-instalador' },
        { id: 'estoque-rastreadores', nome: 'Estoque de Rastreadores', descricao: 'Posição de estoque', rota: '/relatorios/estoque-rastreadores' },
        { id: 'chamados-tipo', nome: 'Chamados por Tipo', descricao: 'Assistência 24h por categoria', rota: '/relatorios/chamados-tipo' },
      ]
    },
    {
      id: 'associados',
      nome: 'Associados',
      icone: Users,
      cor: 'bg-purple-500',
      corBadge: 'bg-purple-500/10 text-purple-600 border-purple-200',
      descricao: 'Base de associados e veículos',
      relatorios: [
        { id: 'crescimento-base', nome: 'Crescimento da Base', descricao: 'Evolução de associados', rota: '/relatorios/crescimento-base' },
        { id: 'churn-rate', nome: 'Churn Rate', descricao: 'Taxa de cancelamento', rota: '/relatorios/churn-rate' },
        { id: 'ltv-segmento', nome: 'LTV por Segmento', descricao: 'Lifetime value por perfil', rota: '/relatorios/ltv-segmento' },
        { id: 'associados-regiao', nome: 'Associados por Região', descricao: 'Distribuição geográfica', rota: '/relatorios/associados-regiao' },
        { id: 'veiculos-marca', nome: 'Veículos por Marca/Modelo', descricao: 'Perfil da frota', rota: '/relatorios/veiculos-marca' },
      ]
    },
    {
      id: 'sinistros',
      nome: 'Sinistros',
      icone: AlertTriangle,
      cor: 'bg-red-500',
      corBadge: 'bg-red-500/10 text-red-600 border-red-200',
      descricao: 'Sinistralidade e regulação',
      relatorios: [
        { id: 'sinistralidade-periodo', nome: 'Sinistralidade por Período', descricao: 'Índice de sinistralidade', rota: '/relatorios/sinistralidade-periodo' },
        { id: 'sinistros-tipo', nome: 'Sinistros por Tipo', descricao: 'Colisão, roubo, furto, etc', rota: '/relatorios/sinistros-tipo' },
        { id: 'tempo-regulacao', nome: 'Tempo Médio de Regulação', descricao: 'SLA de atendimento', rota: '/relatorios/tempo-regulacao' },
        { id: 'valores-pagos', nome: 'Valores Pagos vs Provisões', descricao: 'Análise de provisões', rota: '/relatorios/valores-pagos' },
        { id: 'top-sinistros', nome: 'Top 10 Sinistros', descricao: 'Maiores ocorrências', rota: '/relatorios/top-sinistros' },
      ]
    },
    {
      id: 'gerencial',
      nome: 'Gerencial',
      icone: BarChart3,
      cor: 'bg-indigo-500',
      corBadge: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
      descricao: 'Visão executiva e KPIs',
      relatorios: [
        { id: 'dashboard-executivo', nome: 'Dashboard Executivo', descricao: 'Visão geral do negócio', rota: '/relatorios/dashboard-executivo' },
        { id: 'comparativo-mensal', nome: 'Comparativo Mensal', descricao: 'Evolução mês a mês', rota: '/relatorios/comparativo-mensal' },
        { id: 'kpis', nome: 'Indicadores-Chave (KPIs)', descricao: 'Métricas principais', rota: '/relatorios/kpis' },
        { id: 'analise-tendencias', nome: 'Análise de Tendências', descricao: 'Projeções e tendências', rota: '/relatorios/analise-tendencias' },
        { id: 'performance-geral', nome: 'Performance Geral', descricao: 'Desempenho consolidado', rota: '/relatorios/performance-geral' },
      ]
    },
  ];

  // Todos os relatórios flat para busca
  const todosRelatorios = useMemo(() => 
    categorias.flatMap(cat => 
      cat.relatorios.map(rel => ({ 
        ...rel, 
        categoria: cat.nome, 
        categoriaId: cat.id, 
        cor: cat.cor,
        corBadge: cat.corBadge 
      }))
    ), 
    []
  );

  // Filtrar por busca
  const relatoriosFiltrados = useMemo(() => 
    busca 
      ? todosRelatorios.filter(r => 
          r.nome.toLowerCase().includes(busca.toLowerCase()) ||
          r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
          r.categoria.toLowerCase().includes(busca.toLowerCase())
        )
      : [],
    [busca, todosRelatorios]
  );

  // Relatórios favoritos
  const relatoriosFavoritos = useMemo(() => 
    todosRelatorios.filter(r => favoritos.includes(r.id)),
    [favoritos, todosRelatorios]
  );

  const handleRelatorioClick = (relatorio: Relatorio) => {
    // Verificar se existe rota dedicada
    const rotaExistente = getRotaExistente(relatorio.id);
    
    if (rotaExistente) {
      navigate(rotaExistente);
      return;
    }
    
    // Verificar se tem configuração de relatório genérico
    const config = getRelatorioConfig(relatorio.id);
    
    if (config) {
      setSelectedRelatorio(relatorio);
      setShowModal(true);
      return;
    }
    
    // Fallback: mostrar toast informativo
    toast.info(`Abrindo ${relatorio.nome}...`, {
      description: 'Este relatório será implementado em breve.'
    });
  };

  const RelatorioCard = ({ 
    relatorio, 
    showCategoria = false 
  }: { 
    relatorio: typeof todosRelatorios[0]; 
    showCategoria?: boolean;
  }) => (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
      onClick={() => handleRelatorioClick(relatorio)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                {relatorio.nome}
              </h3>
              {showCategoria && (
                <Badge variant="outline" className={cn("text-xs", relatorio.corBadge)}>
                  {relatorio.categoria}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {relatorio.descricao}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => toggleFavorito(relatorio.id, e)}
            >
              <Star 
                className={cn(
                  "h-4 w-4",
                  favoritos.includes(relatorio.id) 
                    ? "fill-yellow-400 text-yellow-400" 
                    : "text-muted-foreground"
                )} 
              />
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Central de Relatórios</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Acesse todos os relatórios do sistema em um só lugar
          </p>
        </div>
        <Badge variant="secondary" className="text-sm self-start sm:self-auto">
          <FileText className="h-3 w-3 mr-1" />
          {todosRelatorios.length} relatórios disponíveis
        </Badge>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar relatórios por nome, descrição ou categoria..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Resultados da Busca */}
      {busca && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Resultados da busca ({relatoriosFiltrados.length})
          </h2>
          {relatoriosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  Nenhum relatório encontrado para "{busca}"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatoriosFiltrados.map(rel => (
                <RelatorioCard key={rel.id} relatorio={rel} showCategoria />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Principal (quando não está buscando) */}
      {!busca && (
        <>
          {/* Favoritos */}
          {relatoriosFavoritos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                Favoritos
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {relatoriosFavoritos.map(rel => (
                  <RelatorioCard key={rel.id} relatorio={rel} showCategoria />
                ))}
              </div>
            </div>
          )}

          {/* Grid de Categorias */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categorias.map(categoria => {
              const Icone = categoria.icone;
              return (
                <Card key={categoria.id} className="overflow-hidden">
                  <CardHeader className={cn("pb-3", categoria.cor, "text-white")}>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icone className="h-5 w-5" />
                      {categoria.nome}
                    </CardTitle>
                    <p className="text-white/80 text-sm">{categoria.descricao}</p>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {categoria.relatorios.slice(0, 4).map(rel => (
                        <div 
                          key={rel.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                          onClick={() => handleRelatorioClick(rel)}
                        >
                          <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {rel.nome}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                      {categoria.relatorios.length > 4 && (
                        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                          Ver todos ({categoria.relatorios.length})
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Lista Completa por Tabs */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Todos os Relatórios</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="comercial">
                <TabsList className="flex-wrap h-auto gap-1 mb-4">
                  {categorias.map(cat => (
                    <TabsTrigger key={cat.id} value={cat.id} className="text-sm">
                      {cat.nome} ({cat.relatorios.length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {categorias.map(cat => (
                  <TabsContent key={cat.id} value={cat.id}>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {cat.relatorios.map(rel => (
                        <RelatorioCard 
                          key={rel.id} 
                          relatorio={{ 
                            ...rel, 
                            categoria: cat.nome, 
                            categoriaId: cat.id, 
                            cor: cat.cor,
                            corBadge: cat.corBadge 
                          }} 
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de Relatório Genérico */}
      <RelatorioModal 
        open={showModal} 
        onOpenChange={setShowModal}
        relatorio={selectedRelatorio}
      />
    </div>
  );
}
