import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle, MapPin, Settings, Loader2, Info, CalendarCheck, ChevronDown, Car, Bike, GitCompare
} from 'lucide-react';
import { calcularOpcoesVencimento } from '@/utils/vencimento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { CalculadoraPreco, type DadosParaCotacao } from '@/components/planos/CalculadoraPreco';
import { GlossarioTermos, RegrasImportantes, TabelaCotasTaxas } from '@/components/planos/GlossarioSection';
import { ContatosInline } from '@/components/planos/ContatosRapidos';
import { BuscaPlanos } from '@/components/planos/BuscaPlanos';
import { ComparadorNiveisSelect, ComparadorNiveisMotos } from '@/components/planos/ComparadorNiveis';
import { RankingVendedores } from '@/components/planos/RankingVendedores';
import { RegioesConfig } from '@/components/planos/RegioesConfig';
import { PlanoLineSection } from '@/components/planos/PlanoLineSection';
import { CotacaoFormDialog, type CotacaoBaseParaFormulario } from '@/components/cotacoes/CotacaoFormDialog';

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
      {[1, 2].map((section) => (
        <section key={section}>
          <Skeleton className="h-7 w-48 mb-4" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-48 rounded-lg" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SeFecharHojeButton() {
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const [opcao1, opcao2] = calcularOpcoesVencimento(diaHoje);
  const dataFormatada = format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Se fechar hoje?</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">Se fechar hoje?</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {dataFormatada}
          </p>
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">Opções de vencimento:</p>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-base px-4 py-1.5 font-bold">
                Dia {opcao1}
              </Badge>
              <span className="text-muted-foreground self-center text-sm">ou</span>
              <Badge variant="secondary" className="text-base px-4 py-1.5 font-bold">
                Dia {opcao2}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Se o associado fechar hoje, o vencimento da mensalidade será no <strong>dia {opcao1}</strong> ou <strong>dia {opcao2}</strong>.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PlanosBeneficios() {
  const [activeTab, setActiveTab] = useState('carros');
  const [searchTerm, setSearchTerm] = useState('');
  const [cotacaoDialogOpen, setCotacaoDialogOpen] = useState(false);
  const [cotacaoBase, setCotacaoBase] = useState<CotacaoBaseParaFormulario | null>(null);
  const [comparadorTipo, setComparadorTipo] = useState<'carros' | 'motos'>('carros');
  const { isDiretor, isDesenvolvedor, isGerente, isSupervisor, isAdminMaster, isVendedorClt, isVendedorExterno } = usePermissions();
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

  // Região mapping: calculadora usa slugs curtos, cotador usa slugs longos
  const REGIAO_CALC_TO_COTADOR: Record<string, string> = {
    rj: 'rio_de_janeiro',
    lagos: 'regiao_lagos',
    sp: 'sao_paulo',
  };

  const handleIrParaCotacao = (dados: DadosParaCotacao) => {
    setCotacaoBase({
      valor_fipe: dados.valorFipe,
      valor_adicional: null,
      valor_adesao: null,
      validade_dias: null,
      veiculo_marca: dados.marca || null,
      veiculo_modelo: dados.modelo || null,
      veiculo_ano: dados.ano || null,
      veiculo_placa: dados.placa || null,
      codigo_fipe: null,
      categoria: null,
      regiao: REGIAO_CALC_TO_COTADOR[dados.regiao] || dados.regiao,
      nome_solicitante: null,
      telefone1_solicitante: null,
      email_solicitante: null,
      lead_id: null,
      plano_id: dados.planoId || null,
    });
    setCotacaoDialogOpen(true);
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
      if (plan.name?.toLowerCase().includes(searchTerm)) return true;
      if (plan.nome?.toLowerCase().includes(searchTerm)) return true;
      if (plan.descricao?.toLowerCase().includes(searchTerm)) return true;
      if (plan.badge_text?.toLowerCase().includes(searchTerm)) return true;
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

  // Calcular número de tabs
  const tabCount = 4 + (podeVerConfigAvancada ? 2 : 0) + 1; // carros, motos, comparador, ranking + adicionais + regioes + glossário

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
          <CalculadoraPreco onIrParaCotacao={handleIrParaCotacao} />
          <SeFecharHojeButton />
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
          podeVerConfigAvancada ? "grid-cols-4 lg:grid-cols-7" : "grid-cols-4 lg:grid-cols-5"
        )}>
          <TabsTrigger value="carros" className="gap-1.5">
            <Car className="h-3.5 w-3.5" />
            Carros
          </TabsTrigger>
          <TabsTrigger value="motos" className="gap-1.5">
            <Bike className="h-3.5 w-3.5" />
            Motos
          </TabsTrigger>
          <TabsTrigger value="comparador" className="gap-1.5">
            <GitCompare className="h-3.5 w-3.5" />
            Comparador
          </TabsTrigger>
          {podeVerConfigAvancada && (
            <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
          )}
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          {podeVerConfigAvancada && (
            <TabsTrigger value="regioes" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Regiões
            </TabsTrigger>
          )}
          <TabsTrigger value="glossario">Glossário</TabsTrigger>
        </TabsList>

        {/* Tab Carros (default) */}
        <TabsContent value="carros" className="space-y-6">
          {isLoading && <PlanosSkeleton />}

          {hasError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Erro ao carregar planos. Por favor, tente novamente mais tarde.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !hasError && carLines.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum plano de carro disponível no momento.
            </div>
          )}

          {/* Planos por Linha */}
          {!isLoading && !hasError && carLines.map((line) => (
            <PlanoLineSection
              key={line.id}
              productLine={line}
              plans={getPlansByLineId(line.id)}
            />
          ))}

          {/* Coberturas Principais */}
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

          {/* Tabela de Preços (colapsável) */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2">
                <span className="font-medium">📋 Tabela de Preços — Carros</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>svg&]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <TabelaPrecosCarros />
            </CollapsibleContent>
          </Collapsible>

          {/* Veículos Aceitos (colapsável) */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2">
                <span className="font-medium">🚗 Veículos Aceitos — Carros</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <VeiculosAceitosCarros />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* Tab Motos */}
        <TabsContent value="motos" className="space-y-6">
          {isLoading && <PlanosSkeleton />}
          
          {!isLoading && !hasError && motoLines.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum plano de moto disponível no momento.
            </div>
          )}

          {!isLoading && !hasError && motoLines.map((line) => (
            <PlanoLineSection
              key={line.id}
              productLine={line}
              plans={getPlansByLineId(line.id)}
            />
          ))}

          {/* Coberturas Principais */}
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

          {/* Tabela de Preços (colapsável) */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2">
                <span className="font-medium">📋 Tabela de Preços — Motos</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <TabelaPrecosMotos />
            </CollapsibleContent>
          </Collapsible>

          {/* Veículos Aceitos (colapsável) */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2">
                <span className="font-medium">🏍️ Veículos Aceitos — Motos</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <VeiculosAceitosMotos />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* Tab Comparador */}
        <TabsContent value="comparador" className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant={comparadorTipo === 'carros' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setComparadorTipo('carros')}
              className="gap-1.5"
            >
              <Car className="h-4 w-4" />
              Carros
            </Button>
            <Button
              variant={comparadorTipo === 'motos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setComparadorTipo('motos')}
              className="gap-1.5"
            >
              <Bike className="h-4 w-4" />
              Motos
            </Button>
          </div>
          {comparadorTipo === 'carros' ? <ComparadorNiveisSelect /> : <ComparadorNiveisMotos />}
        </TabsContent>

        {/* Tab Adicionais - Apenas para gestores */}
        {podeVerConfigAvancada && (
        <TabsContent value="adicionais" className="space-y-4">
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

      {/* CotacaoFormDialog pré-preenchido pela calculadora */}
      <CotacaoFormDialog
        open={cotacaoDialogOpen}
        onOpenChange={setCotacaoDialogOpen}
        cotacaoBase={cotacaoBase}
      />
    </div>
  );
}
