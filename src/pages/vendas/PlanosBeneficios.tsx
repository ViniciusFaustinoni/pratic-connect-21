import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, MapPin, Settings
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

// Hooks para dados do Supabase
import { useProductLines, usePlans, useMainCoverages } from '@/hooks/usePlans';

// Componentes
import { TabelaPrecosCarros, TabelaPrecosMotos, TabelaPrecosEletricos } from '@/components/planos/TabelaPrecos';
import { VeiculosAceitosCarros, VeiculosAceitosMotos } from '@/components/planos/VeiculosAceitos';
import { CalculadoraPreco } from '@/components/planos/CalculadoraPreco';
import { GlossarioTermos, RegrasImportantes, TabelaCotasTaxas } from '@/components/planos/GlossarioSection';
import { ContatosInline } from '@/components/planos/ContatosRapidos';
import { BuscaPlanos } from '@/components/planos/BuscaPlanos';
import { ComparadorNiveisSelect, ComparadorNiveisMotos } from '@/components/planos/ComparadorNiveis';
import { RankingPlanos } from '@/components/planos/RankingPlanos';
import { RegioesConfig } from '@/components/planos/RegioesConfig';
import { PlanosConfig } from '@/components/planos/PlanosConfig';
import { BeneficiosAdicionaisConfig } from '@/components/planos/BeneficiosAdicionaisConfig';
import { PlanoLineSection } from '@/components/planos/PlanoLineSection';

// Dados hardcoded que continuam
import { BENEFICIOS_ADICIONAIS_COMPLETO } from '@/data/planosPrecos';

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
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const podeEditar = isDiretor || isDesenvolvedor;

  // Hooks para dados do Supabase
  const { data: productLines, isLoading: loadingLines, error: errorLines } = useProductLines();
  const { data: plans, isLoading: loadingPlans, error: errorPlans } = usePlans();
  const { data: mainCoverages, isLoading: loadingCoverages } = useMainCoverages();

  const isLoading = loadingLines || loadingPlans;
  const hasError = errorLines || errorPlans;

  const handleSearch = (term: string) => {
    setSearchTerm(term.toLowerCase());
  };

  // Filtrar benefícios adicionais
  const beneficiosFiltrados = BENEFICIOS_ADICIONAIS_COMPLETO.filter(b => 
    searchTerm === '' || 
    b.nome.toLowerCase().includes(searchTerm) ||
    b.descricao.toLowerCase().includes(searchTerm)
  );

  // Helper para obter planos de uma linha específica
  const getPlansByLineId = (lineId: string) => {
    return plans?.filter(p => p.product_line_id === lineId) || [];
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
          {podeEditar && (
            <p className="text-sm text-muted-foreground mt-1">
              <Settings className="h-3.5 w-3.5 inline mr-1" />
              Modo Diretor: Você pode editar configurações
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <BuscaPlanos onSearch={handleSearch} />
          <CalculadoraPreco />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 lg:w-auto">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="carros">Carros</TabsTrigger>
          <TabsTrigger value="motos">Motos</TabsTrigger>
          <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="regioes" className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            Regiões
          </TabsTrigger>
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
              <strong> 8% (mínimo R$2.000)</strong>.
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


        {/* Tab Adicionais */}
        <TabsContent value="adicionais" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Benefícios Adicionais</CardTitle>
              <CardDescription>
                Complemente seu plano com benefícios extras conforme sua necessidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {beneficiosFiltrados.map((beneficio, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {beneficio.categoria}
                        </Badge>
                        <span className="font-medium">{beneficio.nome}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{beneficio.descricao}</p>
                    </div>
                    <Badge className="text-lg font-bold whitespace-nowrap ml-4 bg-primary">
                      {formatCurrency(beneficio.preco)}/mês
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Ranking */}
        <TabsContent value="ranking" className="space-y-8">
          <RankingPlanos />
        </TabsContent>

        {/* Tab Regiões */}
        <TabsContent value="regioes" className="space-y-8">
          <RegioesConfig />
        </TabsContent>

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
