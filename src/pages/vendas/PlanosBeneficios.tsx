import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, MapPin, Settings, Loader2, Info
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCotaDesagioDefault, useCotaMinimaDesagioDefault } from '@/hooks/useConteudosSistema';
import { formatarMoeda } from '@/utils/format';

// Hooks para dados do Supabase
import { useProductLines, usePlans, useMainCoverages } from '@/hooks/usePlans';
import { useBeneficiosAtivos } from '@/hooks/useBeneficiosAdmin';
import { useResumoSaudeBeneficios, useCustoBeneficios, type CustoBeneficio } from '@/hooks/useCustoBeneficios';
import { ResumoSaudeCard } from '@/components/beneficios/ResumoSaudeCard';
import { BadgeIndicador } from '@/components/beneficios/IndicadorSaude';

// Componentes
import { TabelaPrecosCarros, TabelaPrecosMotos } from '@/components/planos/TabelaPrecos';
import { VeiculosAceitosCarros, VeiculosAceitosMotos } from '@/components/planos/VeiculosAceitos';
import { CalculadoraPreco } from '@/components/planos/CalculadoraPreco';
import { GlossarioTermos, RegrasImportantes, TabelaCotasTaxas } from '@/components/planos/GlossarioSection';
import { ContatosInline } from '@/components/planos/ContatosRapidos';
import { BuscaPlanos } from '@/components/planos/BuscaPlanos';
import { ComparadorNiveisSelect, ComparadorNiveisMotos } from '@/components/planos/ComparadorNiveis';
import { RankingVendedores } from '@/components/planos/RankingVendedores';
import { RegioesConfig } from '@/components/planos/RegioesConfig';
import { PlanoLineSection } from '@/components/planos/PlanoLineSection';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Componente de Skeleton para loading dos planos
function PlanosSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((section) => (
        <section key={section}>
          <Skeleton className="h-7 w-48 mb-4" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-64 rounded-lg" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function PlanosBeneficios() {
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [searchTerm, setSearchTerm] = useState('');
  const { isDiretor, isDesenvolvedor, isGerente, isSupervisor, isAdminMaster } = usePermissions();
  const podeVerConfigAvancada = isDiretor || isGerente || isSupervisor || isDesenvolvedor || isAdminMaster;

  // Config dinâmica de deságio
  const { data: cotaDesagioPerc = 8 } = useCotaDesagioDefault();
  const { data: cotaMinimaDesagio = 2000 } = useCotaMinimaDesagioDefault();

  // Hooks para dados do Supabase
  const { data: productLines, isLoading: loadingLines, error: errorLines } = useProductLines();
  const { data: plans, isLoading: loadingPlans, error: errorPlans } = usePlans();
  const { data: mainCoverages, isLoading: loadingCoverages } = useMainCoverages();
  const { data: beneficiosAdicionais, isLoading: loadingBeneficios } = useBeneficiosAtivos();
  const { data: resumoSaude, isLoading: loadingResumo } = useResumoSaudeBeneficios();
  const { data: custosReais } = useCustoBeneficios();

  // Criar mapa para acesso rápido por ID do benefício
  const custosPorBeneficio = custosReais?.reduce((acc, custo) => {
    acc[custo.beneficio_id] = custo;
    return acc;
  }, {} as Record<string, CustoBeneficio>) || {};

  const isLoading = loadingLines || loadingPlans;
  const hasError = errorLines || errorPlans;

  const handleSearch = (term: string) => {
    setSearchTerm(term.toLowerCase());
  };

  // Filtrar benefícios adicionais
  const beneficiosFiltrados = beneficiosAdicionais?.filter(b => 
    searchTerm === '' || 
    b.nome.toLowerCase().includes(searchTerm) ||
    b.descricao?.toLowerCase().includes(searchTerm)
  ) || [];

  // Helper para obter planos de uma linha específica com filtro de busca
  const getPlansByLineId = (lineId: string) => {
    const linePlans = plans?.filter(p => p.product_line_id === lineId) || [];
    
    if (!searchTerm) return linePlans;
    
    return linePlans.filter(plan => {
      // Buscar no nome do plano
      if (plan.name?.toLowerCase().includes(searchTerm)) return true;
      if (plan.nome?.toLowerCase().includes(searchTerm)) return true;
      
      // Buscar na descrição
      if (plan.descricao?.toLowerCase().includes(searchTerm)) return true;
      
      // Buscar no badge
      if (plan.badge_text?.toLowerCase().includes(searchTerm)) return true;
      
      // Buscar nos benefícios
      if (plan.plan_benefits?.some(b => 
        b.benefits?.name?.toLowerCase().includes(searchTerm) || 
        b.custom_text?.toLowerCase().includes(searchTerm)
      )) return true;
      
      return false;
    });
  };

  // Filtrar linhas por tipo de veículo
  const carLines = productLines?.filter(line => line.vehicle_type === 'car') || [];
  const motoLines = productLines?.filter(line => line.vehicle_type === 'motorcycle') || [];

  return (
    <div className="container mx-auto p-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planos e Benefícios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consulte planos, coberturas e benefícios disponíveis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuscaPlanos onSearch={handleSearch} />
          <CalculadoraPreco />
        </div>
      </div>

      {/* Banner informativo para diretores */}
      {isDiretor && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            Para criar ou editar planos e benefícios, acesse{' '}
            <Link to="/diretoria/planos-beneficios" className="font-medium underline hover:text-blue-800 dark:hover:text-blue-200">
              Diretoria → Planos/Benefícios
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={cn(
          "grid w-full lg:w-auto",
          podeVerConfigAvancada ? "grid-cols-4 lg:grid-cols-7" : "grid-cols-5"
        )}>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="carros">Carros</TabsTrigger>
          <TabsTrigger value="motos">Motos</TabsTrigger>
          {podeVerConfigAvancada && (
            <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
          )}
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          {podeVerConfigAvancada && (
            <TabsTrigger value="regioes" className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Regiões
            </TabsTrigger>
          )}
          <TabsTrigger value="glossario">Glossário</TabsTrigger>
        </TabsList>

        {/* Tab Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-8">
          {/* Estado de Loading */}
          {isLoading && <PlanosSkeleton />}

          {/* Estado de Erro */}
          {hasError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Erro ao carregar planos. Por favor, tente novamente mais tarde.
              </AlertDescription>
            </Alert>
          )}

          {/* Estado Vazio */}
          {!isLoading && !hasError && (!productLines?.length || !plans?.length) && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum plano disponível no momento.
            </div>
          )}

          {/* Planos por Linha de Produto (dinâmico do Supabase) */}
          {!isLoading && !hasError && productLines?.map((line) => (
            <PlanoLineSection
              key={line.id}
              productLine={line}
              plans={getPlansByLineId(line.id)}
            />
          ))}

          {/* Coberturas Principais (do Supabase) */}
          {!loadingCoverages && mainCoverages && mainCoverages.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Coberturas Principais</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {mainCoverages.map((coverage) => (
                  <Card key={coverage.id} className="text-center p-4 hover:shadow-md transition-shadow">
                    <div className="text-3xl mb-2">{coverage.icon}</div>
                    <p className="font-medium text-sm">{coverage.name}</p>
                    <p className="text-xs text-muted-foreground">{coverage.subtitle}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Regra de Deságio */}
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>REGRA DE DESÁGIO:</strong> Em todos os planos com cota de participação inferior a 10%, 
              quando o associado optar pelo DESÁGIO (adesivo publicitário), a cota de participação passa a ser 
              <strong> {cotaDesagioPerc}% (mínimo {formatarMoeda(cotaMinimaDesagio)})</strong>.
            </AlertDescription>
          </Alert>

          <ContatosInline />
        </TabsContent>

        {/* Tab Carros */}
        <TabsContent value="carros" className="space-y-8">
          {/* Planos de Carros (dinâmico do Supabase) */}
          {isLoading && <PlanosSkeleton />}
          
          {!isLoading && !hasError && carLines.map((line) => (
            <PlanoLineSection
              key={line.id}
              productLine={line}
              plans={getPlansByLineId(line.id)}
            />
          ))}

          <ComparadorNiveisSelect />
          <TabelaPrecosCarros titulo="Tabela de Preços - Linha Select" />
          <VeiculosAceitosCarros />
        </TabsContent>

        {/* Tab Motos */}
        <TabsContent value="motos" className="space-y-8">
          {/* Planos de Motos (dinâmico do Supabase) */}
          {isLoading && <PlanosSkeleton />}
          
          {!isLoading && !hasError && motoLines.map((line) => (
            <PlanoLineSection
              key={line.id}
              productLine={line}
              plans={getPlansByLineId(line.id)}
            />
          ))}

          <ComparadorNiveisMotos />
          <TabelaPrecosMotos />
          <VeiculosAceitosMotos />
        </TabsContent>


        {/* Tab Adicionais - Apenas para gestores */}
        {podeVerConfigAvancada && (
        <TabsContent value="adicionais" className="space-y-4">
          {/* Resumo de Saúde Financeira - apenas visualização para diretor */}
          {isDiretor && (
            <ResumoSaudeCard
              superavit={resumoSaude?.superavit || 0}
              equilibrio={resumoSaude?.equilibrio || 0}
              prejuizo={resumoSaude?.prejuizo || 0}
              semDados={resumoSaude?.sem_dados || 0}
              isLoading={loadingResumo}
            />
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Benefícios Adicionais</CardTitle>
                <CardDescription>
                  Complemente seu plano com benefícios extras conforme sua necessidade
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBeneficios ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : beneficiosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum benefício adicional encontrado.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {beneficiosFiltrados.map((beneficio) => (
                    <div 
                      key={beneficio.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {beneficio.categoria}
                          </Badge>
                          {/* Badge de indicador de saúde (visível para Diretor) */}
                          {isDiretor && custosPorBeneficio[beneficio.id] && (
                            <BadgeIndicador 
                              indicador={custosPorBeneficio[beneficio.id].indicador} 
                              size="sm" 
                            />
                          )}
                          <span className="font-medium">{beneficio.nome}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{beneficio.descricao}</p>
                      </div>
                      <Badge className="text-lg font-bold whitespace-nowrap ml-4 bg-primary shrink-0">
                        {formatCurrency(beneficio.preco)}/mês
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Tab Ranking */}
        <TabsContent value="ranking" className="space-y-8">
          <RankingVendedores />
        </TabsContent>

        {/* Tab Regiões - Apenas para gestores */}
        {podeVerConfigAvancada && (
        <TabsContent value="regioes" className="space-y-8">
          <RegioesConfig />
        </TabsContent>
        )}

        {/* Tab Glossário */}
        <TabsContent value="glossario" className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <GlossarioTermos />
            <div className="space-y-6">
              <RegrasImportantes />
            </div>
          </div>
          <TabelaCotasTaxas />
          <ContatosInline />
        </TabsContent>
      </Tabs>
    </div>
  );
}
