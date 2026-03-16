import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  useGlossario, 
  useRegrasImportantes, 
  useCotasTaxas, 
  useTaxasProcedimentos 
} from '@/hooks/useConteudosSistema';
import { useCotaParticipacaoDefault, useCotaMinimaDefault } from '@/hooks/useConteudosSistema';
import { useConfigFipeRastreador, useConfigFipeRastreadorMoto } from '@/hooks/useConfigRastreador';
import { BookOpen, AlertTriangle, DollarSign, Loader2 } from 'lucide-react';

// Hook para buscar cotas da tabela planos_cotas_categoria (fonte primária)
function useCotasCategoriaTabela() {
  return useQuery({
    queryKey: ['planos_cotas_categoria_glossario'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_cotas_categoria')
        .select('categoria_veiculo, cota_percentual, cota_minima_valor')
        .order('categoria_veiculo');
      if (error) throw error;
      // Agrupar por categoria (pegar valores únicos — todos os planos de mesma categoria têm mesmos valores)
      const map = new Map<string, { percentual: number; minimo: number }>();
      (data || []).forEach(row => {
        if (!map.has(row.categoria_veiculo)) {
          map.set(row.categoria_veiculo, {
            percentual: Number(row.cota_percentual ?? 6),
            minimo: Number(row.cota_minima_valor ?? 1200),
          });
        }
      });
      return map;
    },
    staleTime: 1000 * 60 * 10,
  });
}

const CATEGORIA_LABELS: Record<string, string> = {
  passeio: 'Passeio',
  aplicativo: 'Aplicativo (Uber, 99, etc)',
  desagio: 'Com Deságio',
  moto: 'Motocicletas',
  diesel: 'Diesel',
  especial_plus: 'Especial Plus',
  lancamento: 'Lançamento',
  eletrico: 'Elétricos',
};

export function GlossarioTermos() {
  const { data: glossario = [], isLoading } = useGlossario();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Glossário</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Termos importantes para o consultor
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {glossario.map((item, index) => (
            <AccordionItem key={index} value={`termo-${index}`}>
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {item.termo}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  {item.definicao}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function RegrasImportantes() {
  const { data: regrasBase = [], isLoading } = useRegrasImportantes();
  const { data: fipeCarro = 30000 } = useConfigFipeRastreador();
  const { data: fipeMoto = 9000 } = useConfigFipeRastreadorMoto();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const regras = regrasBase.map((regra) => {
    if (regra.titulo !== 'Rastreador Obrigatório') return regra;
    return {
      ...regra,
      itens: regra.itens.map((item) => {
        if (item.startsWith('Carros')) return `Carros >R$ ${fipeCarro.toLocaleString('pt-BR')}`;
        if (item.startsWith('Motos')) return `Motos >R$ ${fipeMoto.toLocaleString('pt-BR')}`;
        return item;
      }),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold">Regras Importantes</h3>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {regras.map((regra, index) => (
          <Card 
            key={index}
            className="overflow-hidden border-l-4 border-l-primary"
          >
            <CardHeader className="pb-2 bg-muted/50">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-xl shrink-0">{regra.icone}</span>
                <span className="truncate">{regra.titulo}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="space-y-1.5">
                {regra.itens.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TabelaCotasTaxas() {
  const { data: cotasTaxas = [], isLoading: loadingCotas } = useCotasTaxas();
  const { data: cotasCategoriaMap, isLoading: loadingCotasTabela } = useCotasCategoriaTabela();
  const { data: taxasProcedimentos = [], isLoading: loadingTaxas } = useTaxasProcedimentos();
  const { data: cotaPercDefault = 6 } = useCotaParticipacaoDefault();
  const { data: cotaMinDefault = 1200 } = useCotaMinimaDefault();

  const isLoading = loadingCotas || loadingTaxas || loadingCotasTabela;

  // Fonte primária: planos_cotas_categoria (tabela). Fallback: cotas_taxas (JSON)
  const cotasExibicao = (() => {
    if (cotasCategoriaMap && cotasCategoriaMap.size > 0) {
      return Array.from(cotasCategoriaMap.entries()).map(([cat, vals]) => ({
        categoria: CATEGORIA_LABELS[cat] || cat,
        percentual: `${vals.percentual}%`,
        minimo: vals.minimo === 0 ? 'Sem mínimo' : `R$ ${vals.minimo.toLocaleString('pt-BR')}`,
        comDesagio: cat === 'passeio' ? '8%' : undefined,
        minimoDesagio: cat === 'passeio' ? 'R$ 2.000' : undefined,
      }));
    }
    return cotasTaxas;
  })();

  // Derivar valores de deságio das cotas para o alerta
  const desagioInfo = (() => {
    if (cotasCategoriaMap && cotasCategoriaMap.size > 0) {
      const desagioEntry = cotasCategoriaMap.get('desagio');
      const percDesagio = desagioEntry ? `${desagioEntry.percentual}%` : '8%';
      const minDesagio = desagioEntry
        ? (desagioEntry.minimo === 0 ? 'Sem mínimo' : `R$ ${desagioEntry.minimo.toLocaleString('pt-BR')}`)
        : `R$ ${(cotaMinDefault * 2).toLocaleString('pt-BR')}`;
      const passeioEntry = cotasCategoriaMap.get('passeio');
      const categoriasNormais = passeioEntry ? `Passeio ${passeioEntry.percentual}%` : `Passeio ${cotaPercDefault}%`;
      return { percDesagio, minDesagio, categoriasNormais };
    }
    const comDesagio = cotasTaxas.find(c => c.comDesagio);
    const percDesagio = comDesagio?.comDesagio || '8%';
    const minDesagio = comDesagio?.minimoDesagio || `R$ ${(cotaMinDefault * 2).toLocaleString('pt-BR')}`;
    const categoriasNormais = cotasTaxas
      .filter(c => c.percentual && parseFloat(c.percentual) < 10)
      .map(c => `${c.categoria} ${c.percentual}`)
      .join(', ');
    return { percDesagio, minDesagio, categoriasNormais: categoriasNormais || `Passeio ${cotaPercDefault}%` };
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cotas de Participação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cotas de Participação</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Categoria</TableHead>
                <TableHead className="text-center font-semibold">% FIPE</TableHead>
                <TableHead className="text-center font-semibold">Mínimo</TableHead>
                <TableHead className="text-center font-semibold">Com Deságio</TableHead>
                <TableHead className="text-center font-semibold">Mín. Deságio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotasExibicao.map((cota, index) => (
                <TableRow 
                  key={index}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium">{cota.categoria}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{cota.percentual}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{cota.minimo}</TableCell>
                  <TableCell className="text-center">
                    {cota.comDesagio ? (
                      <Badge variant="outline" className="text-green-600 dark:text-green-400">
                        {cota.comDesagio}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {cota.minimoDesagio || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alerta sobre Deságio */}
      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          Regra do Deságio
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          Quando a cota de participação for inferior a 10% ({desagioInfo.categoriasNormais}) e o associado 
          optar pelo <strong>DESÁGIO</strong> (desconto de 10% na mensalidade por uso de adesivo publicitário), 
          a cota de participação passa automaticamente para <strong>{desagioInfo.percDesagio}</strong> com mínimo de <strong>{desagioInfo.minDesagio}</strong>.
        </AlertDescription>
      </Alert>

      {/* Taxas de Procedimentos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Taxas de Procedimentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Procedimento</TableHead>
                <TableHead className="text-right font-semibold">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxasProcedimentos.map((taxa, index) => (
                <TableRow 
                  key={index}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium">{taxa.procedimento}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{taxa.taxa}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
