import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, Users, DollarSign, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const BENEFICIO_TIPOS = [
  { key: 'colisao', label: 'Colisão / PT / IF' },
  { key: 'roubo_furto', label: 'Roubo / Furto' },
  { key: 'assistencia', label: 'Assistência 24h' },
  { key: 'terceiros', label: 'Danos a Terceiros' },
  { key: 'vidros', label: 'Vidros' },
  { key: 'operacional', label: 'Operacional' },
];

export function SimuladorRateio() {
  const now = new Date();
  const [mesRef, setMesRef] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  // Generate last 6 months options
  const mesesOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, i);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
      return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, []);

  const [ano, mes] = mesRef.split('-').map(Number);

  // Fetch active associates with vehicles
  const { data: baseAtiva, isLoading: loadingBase } = useQuery({
    queryKey: ['simulador-base-ativa'],
    queryFn: async () => {
      const { data, count } = await supabase
        .from('associados')
        .select('id', { count: 'exact' })
        .eq('status', 'ativo');
      return { total: count || 0 };
    },
  });

  // Fetch total active cotas
  const { data: cotasData, isLoading: loadingCotas } = useQuery({
    queryKey: ['simulador-cotas-ativas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('veiculos')
        .select('quantidade_cotas, associados!inner(status)')
        .eq('associados.status', 'ativo');
      const totalCotas = data?.reduce((sum, v) => sum + (v.quantidade_cotas || 1), 0) || 0;
      return { totalCotas, totalVeiculos: data?.length || 0 };
    },
  });

  // Fetch approved sinistros for the month
  const { data: sinistrosData, isLoading: loadingSinistros } = useQuery({
    queryKey: ['simulador-sinistros', mesRef],
    queryFn: async () => {
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fimMes = mes === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

      const { data } = await supabase
        .from('sinistros')
        .select('tipo, valor_indenizacao, valor_cota_participacao')
        .in('status', ['aprovado', 'pago', 'encerrado'])
        .gte('data_ocorrencia', inicioMes)
        .lt('data_ocorrencia', fimMes);

      // Group by benefit type
      const porBeneficio: Record<string, { total: number; count: number; cotaParticipacao: number }> = {};
      BENEFICIO_TIPOS.forEach(b => {
        porBeneficio[b.key] = { total: 0, count: 0, cotaParticipacao: 0 };
      });

      data?.forEach((s: any) => {
        const tipo = mapSinistroTipo(s.tipo);
        if (porBeneficio[tipo]) {
          const bruto = s.valor_indenizacao || 0;
          const cota = s.valor_cota_participacao || 0;
          porBeneficio[tipo].total += Math.max(0, bruto - cota);
          porBeneficio[tipo].count += 1;
          porBeneficio[tipo].cotaParticipacao += cota;
        }
      });

      return porBeneficio;
    },
  });

  // Fetch existing fechamento for this month
  const { data: fechamentoExistente } = useQuery({
    queryKey: ['simulador-fechamento-existente', mesRef],
    queryFn: async () => {
      const { data } = await supabase
        .from('fechamentos_mensais')
        .select('id, status')
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)
        .limit(1);
      return data?.[0] || null;
    },
  });

  // Fetch configuracoes
  const { data: configs } = useQuery({
    queryKey: ['simulador-configs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['taxa_administrativa_padrao', 'atuarial_valor_por_cota']);
      const map: Record<string, string> = {};
      data?.forEach(c => { map[c.chave] = c.valor; });
      return map;
    },
  });

  const taxaAdmin = Number(configs?.['taxa_administrativa_padrao']) || 49.90;
  const totalCotas = cotasData?.totalCotas || 1;

  // Calculate projections
  const projecoes = useMemo(() => {
    if (!sinistrosData) return [];
    return BENEFICIO_TIPOS.map(b => {
      const dados = sinistrosData[b.key];
      const custoLiquido = dados?.total || 0;
      const valorPorCota = totalCotas > 0 ? custoLiquido / totalCotas : 0;
      return {
        ...b,
        custoLiquido,
        eventos: dados?.count || 0,
        cotaParticipacao: dados?.cotaParticipacao || 0,
        valorPorCota,
      };
    });
  }, [sinistrosData, totalCotas]);

  const totalRateio = projecoes.reduce((s, p) => s + p.custoLiquido, 0);
  const rateioMedioPorAssociado = (baseAtiva?.total || 1) > 0
    ? (totalRateio / (baseAtiva?.total || 1)) + taxaAdmin
    : 0;

  const isLoading = loadingBase || loadingCotas || loadingSinistros;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Simulador de Rateio</h3>
        </div>
        <Select value={mesRef} onValueChange={setMesRef}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Mês de referência" />
          </SelectTrigger>
          <SelectContent>
            {mesesOptions.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info alert */}
      <Alert>
        <Calculator className="h-4 w-4" />
        <AlertTitle>Simulação — não gera cobranças</AlertTitle>
        <AlertDescription>
          Esta projeção usa sinistros aprovados e a base ativa atual para estimar o impacto do rateio mensal.
          Após revisar, confirme o fechamento no módulo Financeiro para gerar as faturas.
        </AlertDescription>
      </Alert>

      {fechamentoExistente && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fechamento já existe</AlertTitle>
          <AlertDescription>
            Já existe um fechamento para este mês com status "{fechamentoExistente.status}".
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> Associados Ativos
            </div>
            <p className="text-2xl font-bold">{baseAtiva?.total?.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Veículos / Cotas</div>
            <p className="text-2xl font-bold">
              {cotasData?.totalVeiculos?.toLocaleString('pt-BR')} / {totalCotas.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Total Rateio
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalRateio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Impacto Médio / Associado
            </div>
            <p className="text-2xl font-bold">{formatCurrency(rateioMedioPorAssociado)}</p>
            <p className="text-xs text-muted-foreground">Rateio + Taxa Admin ({formatCurrency(taxaAdmin)})</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by benefit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projeção por Benefício</CardTitle>
          <CardDescription>Custo líquido (já descontada a cota de participação) dividido pelas cotas ativas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benefício</TableHead>
                <TableHead className="text-center">Eventos</TableHead>
                <TableHead className="text-right">Cota Participação</TableHead>
                <TableHead className="text-right">Custo Líquido</TableHead>
                <TableHead className="text-right">Valor / Cota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projecoes.map(p => (
                <TableRow key={p.key}>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={p.eventos > 0 ? 'default' : 'secondary'}>{p.eventos}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(p.cotaParticipacao)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.custoLiquido)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{formatCurrency(p.valorPorCota)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-center">
                  {projecoes.reduce((s, p) => s + p.eventos, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(projecoes.reduce((s, p) => s + p.cotaParticipacao, 0))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalRateio)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge>{formatCurrency(totalCotas > 0 ? totalRateio / totalCotas : 0)}</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action */}
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!!fechamentoExistente}
          onClick={() => {
            window.location.href = '/financeiro/faturamento';
          }}
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Ir para Fechamento Mensal
        </Button>
      </div>
    </div>
  );
}

function mapSinistroTipo(tipo: string | null): string {
  if (!tipo) return 'operacional';
  const t = tipo.toLowerCase();
  if (t.includes('colisao') || t.includes('colisão') || t.includes('perda_total') || t.includes('incendio') || t.includes('incêndio')) return 'colisao';
  if (t.includes('roubo') || t.includes('furto')) return 'roubo_furto';
  if (t.includes('assistencia') || t.includes('assistência') || t.includes('reboque') || t.includes('guincho')) return 'assistencia';
  if (t.includes('terceiro')) return 'terceiros';
  if (t.includes('vidro') || t.includes('para-brisa') || t.includes('parabrisa')) return 'vidros';
  return 'operacional';
}
