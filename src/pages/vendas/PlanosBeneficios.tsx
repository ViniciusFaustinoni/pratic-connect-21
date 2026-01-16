import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Shield, Car, Zap, Bike, Star, Check, AlertTriangle, 
  Umbrella, Flame, CloudRain, Users, Wrench, Phone, MapPin, Fuel,
  ChevronDown, ChevronUp, Settings, FileText, Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

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

// Dados
import { 
  PLANOS_RESUMO, 
  COBERTURAS_ICONES, 
  BENEFICIOS_ADICIONAIS_COMPLETO 
} from '@/data/planosPrecos';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Card de Plano com benefícios e "Ver mais"
function PlanoCard({ plano }: { plano: typeof PLANOS_RESUMO[0] }) {
  const [expanded, setExpanded] = useState(false);
  const BENEFICIOS_VISIVEIS = 4;
  const temMaisBeneficios = plano.beneficios.length > BENEFICIOS_VISIVEIS;
  const beneficiosExibidos = expanded ? plano.beneficios : plano.beneficios.slice(0, BENEFICIOS_VISIVEIS);

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all hover:shadow-lg h-full flex flex-col',
      plano.badge && 'ring-2 ring-primary'
    )}>
      <div className={cn('h-2 bg-gradient-to-r', plano.cor)} />
      
      {plano.badge && (
        <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs">
          ⭐ {plano.badge}
        </Badge>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{plano.nome}</CardTitle>
          {plano.adicional && (
            <Badge variant="secondary" className="text-xs">
              {plano.adicional}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {plano.coberturaFipe > 0 ? (
            <Badge className={cn(
              'text-xs',
              plano.coberturaFipe === 100 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
            )}>
              {plano.coberturaFipe}% FIPE
            </Badge>
          ) : (
            <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              Roubo/Furto
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            &gt; {plano.anoMinimo}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm flex-1 flex flex-col">
        <div>
          <p className="text-xs text-muted-foreground">Cota Passeio:</p>
          <p className="font-medium">{plano.cotaPasesio}</p>
          {plano.cotaPasesioDesagio && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Com Deságio: {plano.cotaPasesioDesagio}
            </p>
          )}
        </div>

        {plano.cotaApp && (
          <div>
            <p className="text-xs text-muted-foreground">Cota APP:</p>
            <p className="font-medium">{plano.cotaApp}</p>
          </div>
        )}

        {/* Benefícios */}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-2">Benefícios inclusos:</p>
          <div className="space-y-1">
            {beneficiosExibidos.map((beneficio, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span className="text-xs">{beneficio}</span>
              </div>
            ))}
          </div>
          
          {temMaisBeneficios && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs h-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  +{plano.beneficios.length - BENEFICIOS_VISIVEIS} benefícios
                </>
              )}
            </Button>
          )}
        </div>

        {plano.alertaDesagio && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-300">{plano.alertaDesagio}</span>
          </div>
        )}

        {plano.destaque && (
          <p className="text-xs text-muted-foreground italic border-t pt-2">
            {plano.destaque}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Benefícios Elétricos
const BENEFICIOS_ELETRICOS = [
  'Roubo e Furto',
  'Colisão',
  'Incêndio',
  'Alagamento',
  'Chuva de Granizo',
  'Assistência 1000km',
  'Danos Terceiros R$40mil',
  '30 dias Carro Reserva',
  'Reboque Excedente',
  'Cobertura APP 100%',
];

export default function PlanosBeneficios() {
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [searchTerm, setSearchTerm] = useState('');
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const podeEditar = isDiretor || isDesenvolvedor;

  const handleSearch = (term: string) => {
    setSearchTerm(term.toLowerCase());
  };

  // Filtrar benefícios adicionais
  const beneficiosFiltrados = BENEFICIOS_ADICIONAIS_COMPLETO.filter(b => 
    searchTerm === '' || 
    b.nome.toLowerCase().includes(searchTerm) ||
    b.descricao.toLowerCase().includes(searchTerm)
  );

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
          {/* Fileira 1 - Linha Select */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              Linha Select
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANOS_RESUMO.filter(p => p.linha === 'select').map((plano) => (
                <PlanoCard key={plano.id} plano={plano} />
              ))}
            </div>
          </section>

          {/* Fileira 2 - Select One */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-emerald-600" />
              Select One
            </h2>
            <div className="grid gap-4">
              {PLANOS_RESUMO.filter(p => p.linha === 'select-one').map((plano) => (
                <PlanoCard key={plano.id} plano={plano} />
              ))}
            </div>
          </section>

          {/* Fileira 3 - Linha Especial */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              Linha Especial
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {PLANOS_RESUMO.filter(p => p.linha === 'especial').map((plano) => (
                <PlanoCard key={plano.id} plano={plano} />
              ))}
            </div>
          </section>

          {/* Fileira 4 - Linha Lançamento */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-violet-600" />
              Linha Lançamento
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANOS_RESUMO.filter(p => p.linha === 'lancamento').map((plano) => (
                <PlanoCard key={plano.id} plano={plano} />
              ))}
            </div>
          </section>

          {/* Fileira 5 - Linha Advanced (Motos) */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bike className="h-5 w-5 text-red-600" />
              Linha Advanced (Motos)
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {PLANOS_RESUMO.filter(p => p.linha === 'advanced').map((plano) => (
                <PlanoCard key={plano.id} plano={plano} />
              ))}
            </div>
          </section>


          {/* Coberturas Principais */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Coberturas Principais</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {COBERTURAS_ICONES.map((cobertura, index) => (
                <Card key={index} className="text-center p-4 hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-2">{cobertura.icone}</div>
                  <p className="font-medium text-sm">{cobertura.nome}</p>
                  <p className="text-xs text-muted-foreground">{cobertura.descricao}</p>
                </Card>
              ))}
            </div>
          </section>

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
          <ComparadorNiveisSelect />
          <TabelaPrecosCarros titulo="Tabela de Preços - Linha Select" />
          <VeiculosAceitosCarros />
        </TabsContent>

        {/* Tab Motos */}
        <TabsContent value="motos" className="space-y-8">
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
