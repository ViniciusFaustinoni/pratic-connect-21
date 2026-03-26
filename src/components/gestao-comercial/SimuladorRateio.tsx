import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, Users, DollarSign, AlertTriangle, ArrowRight, Shield, Gift } from 'lucide-react';
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

export function SimuladorRateio() {
  const now = new Date();
  const [mesRef, setMesRef] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const mesesOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, i);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
      return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, []);

  const [ano, mes] = mesRef.split('-').map(Number);

  // Fetch real coberturas from database
  const { data: coberturas = [], isLoading: loadingCoberturas } = useQuery({
    queryKey: ['simulador-coberturas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coberturas')
        .select('id, nome, valor')
        .eq('ativo', true)
        .order('nome') as any;
      return (data || []) as { id: string; nome: string; valor: number | null }[];
    },
  });

  // Fetch real benefits from database
  const { data: beneficios = [], isLoading: loadingBeneficios } = useQuery({
    queryKey: ['simulador-beneficios'],
    queryFn: async () => {
      const { data } = await supabase
        .from('benefits')
        .select('id, name, preco_sugerido')
        .eq('is_active', true)
        .order('name');
      return (data || []).map(b => ({ id: b.id, nome: b.name, preco_sugerido: b.preco_sugerido }));
    },
  });

  // Fetch active associates
  const { data: baseAtiva, isLoading: loadingBase } = useQuery({
    queryKey: ['simulador-base-ativa'],
    queryFn: async () => {
      const { count } = await supabase
        .from('associados')
        .select('id', { count: 'exact', head: true })
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
        .lt('data_ocorrencia', fimMes) as any;

      return (data || []) as { tipo: string | null; valor_indenizacao: number | null; valor_cota_participacao: number | null }[];
    },
  });

  // Fetch existing fechamento
  const { data: fechamentoExistente } = useQuery({
    queryKey: ['simulador-fechamento-existente', mesRef],
    queryFn: async (): Promise<{ id: string; status: string } | null> => {
      const result = await supabase
        .from('fechamentos_mensais' as any)
        .select('id, status')
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano);
      return (result.data as any)?.[0] || null;
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

  // Map sinistros to coberturas/beneficios
  const projecoesCoberturas = useMemo(() => {
    return coberturas.map(c => {
      // Match sinistros by tipo containing cobertura name
      const matched = (sinistrosData || []).filter(s => {
        const tipo = (s.tipo || '').toLowerCase();
        const nome = c.nome.toLowerCase();
        return tipo.includes(nome) || nome.includes(tipo);
      });
      const custoLiquido = matched.reduce((sum, s) => {
        const bruto = s.valor_indenizacao || 0;
        const cota = s.valor_cota_participacao || 0;
        return sum + Math.max(0, bruto - cota);
      }, 0);
      const cotaParticipacao = matched.reduce((sum, s) => sum + (s.valor_cota_participacao || 0), 0);
      return {
        id: c.id,
        nome: c.nome,
        valorCatalogo: c.valor || 0,
        eventos: matched.length,
        cotaParticipacao,
        custoLiquido,
        valorPorCota: totalCotas > 0 ? custoLiquido / totalCotas : 0,
      };
    });
  }, [coberturas, sinistrosData, totalCotas]);

  const projecoesBeneficios = useMemo(() => {
    return beneficios.map(b => {
      const matched = (sinistrosData || []).filter(s => {
        const tipo = (s.tipo || '').toLowerCase();
        const nome = b.nome.toLowerCase();
        return tipo.includes(nome) || nome.includes(tipo);
      });
      const custoLiquido = matched.reduce((sum, s) => {
        const bruto = s.valor_indenizacao || 0;
        const cota = s.valor_cota_participacao || 0;
        return sum + Math.max(0, bruto - cota);
      }, 0);
      const cotaParticipacao = matched.reduce((sum, s) => sum + (s.valor_cota_participacao || 0), 0);
      return {
        id: b.id,
        nome: b.nome,
        valorCatalogo: b.preco_sugerido || 0,
        eventos: matched.length,
        cotaParticipacao,
        custoLiquido,
        valorPorCota: totalCotas > 0 ? custoLiquido / totalCotas : 0,
      };
    });
  }, [beneficios, sinistrosData, totalCotas]);

  const totalRateioCoberturas = projecoesCoberturas.reduce((s, p) => s + p.custoLiquido, 0);
  const totalRateioBeneficios = projecoesBeneficios.reduce((s, p) => s + p.custoLiquido, 0);
  const totalRateio = totalRateioCoberturas + totalRateioBeneficios;
  const rateioMedioPorAssociado = (baseAtiva?.total || 1) > 0
    ? (totalRateio / (baseAtiva?.total || 1)) + taxaAdmin
    : 0;

  const isLoading = loadingBase || loadingCotas || loadingSinistros || loadingCoberturas || loadingBeneficios;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const renderTable = (
    items: typeof projecoesCoberturas,
    icon: React.ReactNode,
    title: string,
    description: string,
    totalCusto: number,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Valor Catálogo</TableHead>
                <TableHead className="text-center">Eventos</TableHead>
                <TableHead className="text-right">Cota Participação</TableHead>
                <TableHead className="text-right">Custo Líquido</TableHead>
                <TableHead className="text-right">Valor / Cota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(p.valorCatalogo)}
                  </TableCell>
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
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-center">
                  {items.reduce((s, p) => s + p.eventos, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(items.reduce((s, p) => s + p.cotaParticipacao, 0))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalCusto)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge>{formatCurrency(totalCotas > 0 ? totalCusto / totalCotas : 0)}</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

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

      {/* Coberturas Table */}
      {renderTable(
        projecoesCoberturas,
        <Shield className="h-4 w-4 text-primary" />,
        `Coberturas (${coberturas.length})`,
        'Eventos cobertos contratualmente — custo líquido dividido pelas cotas ativas',
        totalRateioCoberturas,
      )}

      {/* Benefícios Table */}
      {renderTable(
        projecoesBeneficios,
        <Gift className="h-4 w-4 text-accent-foreground" />,
        `Benefícios (${beneficios.length})`,
        'Serviços adicionais — custo líquido dividido pelas cotas ativas',
        totalRateioBeneficios,
      )}

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
