import { useState } from 'react';
import { Calculator, History, AlertTriangle, Users, DollarSign, TrendingUp, ArrowUpDown, ExternalLink, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const statusConfig: Record<string, { label: string; class: string }> = {
  aberto: { label: 'Aberto', class: 'bg-gray-100 text-gray-800' },
  fechado: { label: 'Fechado', class: 'bg-yellow-100 text-yellow-800' },
  aprovado: { label: 'Aprovado', class: 'bg-blue-100 text-blue-800' },
  processado: { label: 'Processado', class: 'bg-green-100 text-green-800' },
};

const formatCurrency = (value: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatMesAno = (mes: number, ano: number) => {
  return format(new Date(ano, mes - 1), "MMMM 'de' yyyy", { locale: ptBR });
};

const BENEFICIO_LABELS: Record<string, string> = {
  colisao: 'Colisão',
  roubo_furto: 'Roubo/Furto',
  incendio: 'Incêndio',
  vidros: 'Vidros/Faróis',
  terceiros: 'Terceiros',
  assistencia: 'Assistência 24h',
  outros: 'Outros',
};

export default function RateioSinistros() {
  const navigate = useNavigate();
  const [showHistorico, setShowHistorico] = useState(false);

  // Buscar último fechamento mensal (Sistema B — fonte única de verdade)
  const { data: fechamentoAtual, isLoading: loadingAtual } = useQuery({
    queryKey: ['fechamento-rateio-diretoria'],
    queryFn: async () => {
      const hoje = new Date();

      // Tentar mês atual primeiro
      const { data: atual } = await supabase
        .from('fechamentos_mensais')
        .select('*, despesas_rateio(*)')
        .eq('ano', hoje.getFullYear())
        .eq('mes', hoje.getMonth() + 1)
        .maybeSingle();
      if (atual) return { ...atual, _isCurrentMonth: true };

      // Fallback: último disponível
      const { data: ultimo } = await supabase
        .from('fechamentos_mensais')
        .select('*, despesas_rateio(*)')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimo) return { ...ultimo, _isCurrentMonth: false };
      return null;
    },
  });

  // Fechamento anterior para comparativo
  const { data: fechamentoAnterior } = useQuery({
    queryKey: ['fechamento-rateio-anterior'],
    queryFn: async () => {
      const hoje = new Date();
      let mesAnt = hoje.getMonth(); // 0-based = mês anterior
      let anoAnt = hoje.getFullYear();
      if (mesAnt === 0) { mesAnt = 12; anoAnt -= 1; }

      const { data } = await supabase
        .from('fechamentos_mensais')
        .select('*')
        .eq('ano', anoAnt)
        .eq('mes', mesAnt)
        .maybeSingle();
      return data;
    },
  });

  // Histórico de fechamentos
  const { data: historico, isLoading: loadingHistorico } = useQuery({
    queryKey: ['fechamentos-historico-diretoria'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fechamentos_mensais')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(12);
      return data || [];
    },
    enabled: showHistorico,
  });

  const isCurrentMonth = (fechamentoAtual as any)?._isCurrentMonth ?? false;
  const despesasRateio = (fechamentoAtual as any)?.despesas_rateio || [];

  const totalCotas = fechamentoAtual?.total_cotas_ativas || 0;
  const totalDespesas = fechamentoAtual?.total_despesas_rateio || 0;
  const valorMedioCota = totalCotas > 0 ? totalDespesas / totalCotas : 0;

  // Comparativo
  const variacaoRateio = (() => {
    if (!fechamentoAtual || !fechamentoAnterior) return null;
    const cotasAtual = fechamentoAtual.total_cotas_ativas || 0;
    const despAtual = fechamentoAtual.total_despesas_rateio || 0;
    const valorAtual = cotasAtual > 0 ? despAtual / cotasAtual : 0;

    const cotasAnt = fechamentoAnterior.total_cotas_ativas || 0;
    const despAnt = fechamentoAnterior.total_despesas_rateio || 0;
    const valorAnterior = cotasAnt > 0 ? despAnt / cotasAnt : 0;

    if (valorAnterior === 0) return null;
    const percentual = ((valorAtual - valorAnterior) / valorAnterior) * 100;
    return { percentual, valorAtual, valorAnterior, alerta: Math.abs(percentual) > 5 };
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rateio de Sinistros</h1>
          <p className="text-muted-foreground">Visão consolidada do rateio mutualista</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistorico(!showHistorico)}>
            <History className="h-4 w-4 mr-2" />
            {showHistorico ? 'Ocultar Histórico' : 'Histórico'}
          </Button>
          <Button onClick={() => navigate('/financeiro/faturamento')}>
            <Calculator className="h-4 w-4 mr-2" />
            Ir para Faturamento
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Info: fonte única */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Os dados abaixo refletem os fechamentos mensais realizados no módulo Financeiro.
          Para calcular ou gerar faturas, acesse <strong>Financeiro → Faturamento Mensal</strong>.
        </AlertDescription>
      </Alert>

      {/* Nenhum fechamento */}
      {!fechamentoAtual && !loadingAtual && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhum fechamento mensal encontrado. Acesse o módulo Financeiro para iniciar o primeiro fechamento.
          </AlertDescription>
        </Alert>
      )}

      {/* Mostrando mês antigo */}
      {fechamentoAtual && !isCurrentMonth && !loadingAtual && (
        <Alert>
          <History className="h-4 w-4" />
          <AlertDescription>
            Exibindo o último fechamento disponível: <strong>{formatMesAno(fechamentoAtual.mes, fechamentoAtual.ano)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta variação > 5% */}
      {variacaoRateio?.alerta && (
        <Alert variant={variacaoRateio.percentual > 0 ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Variação significativa: <strong>{variacaoRateio.percentual > 0 ? '+' : ''}{variacaoRateio.percentual.toFixed(1)}%</strong> em relação ao mês anterior
            ({formatCurrency(variacaoRateio.valorAnterior)} → {formatCurrency(variacaoRateio.valorAtual)} por cota)
          </AlertDescription>
        </Alert>
      )}

      {/* Comparativo */}
      {variacaoRateio && (
        <Card className="border-muted">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comparativo Valor por Cota</p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Anterior</p>
                    <p className="text-lg font-semibold">{formatCurrency(variacaoRateio.valorAnterior)}</p>
                  </div>
                  <div className="text-2xl">→</div>
                  <div>
                    <p className="text-xs text-muted-foreground">Atual</p>
                    <p className="text-lg font-semibold">{formatCurrency(variacaoRateio.valorAtual)}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Variação</p>
                <p className={`text-2xl font-bold ${
                  variacaoRateio.percentual > 0 ? 'text-destructive' :
                  variacaoRateio.percentual < 0 ? 'text-green-600' : ''
                }`}>
                  {variacaoRateio.percentual > 0 ? '+' : ''}
                  {variacaoRateio.percentual.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {fechamentoAtual && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Fechamento de {formatMesAno(fechamentoAtual.mes, fechamentoAtual.ano)}
              </CardTitle>
              <Badge className={statusConfig[fechamentoAtual.status]?.class || 'bg-gray-100'}>
                {statusConfig[fechamentoAtual.status]?.label || fechamentoAtual.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Users className="h-4 w-4" />
                    Associados Ativos
                  </div>
                  <p className="text-2xl font-bold">{(fechamentoAtual.total_associados_ativos || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Total de Cotas
                  </div>
                  <p className="text-2xl font-bold">{totalCotas.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <DollarSign className="h-4 w-4" />
                    Total Despesas
                  </div>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDespesas)}</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <ArrowUpDown className="h-4 w-4" />
                    Valor Médio / Cota
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(valorMedioCota)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Despesas por Benefício */}
            {despesasRateio.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Despesas por Benefício</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Benefício</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Cotas Elegíveis</TableHead>
                        <TableHead className="text-right">Valor / Cota</TableHead>
                        <TableHead className="text-right">Eventos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despesasRateio.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">
                            {BENEFICIO_LABELS[d.tipo_beneficio] || d.tipo_beneficio}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(d.valor_total)}</TableCell>
                          <TableCell className="text-right">{(d.total_cotas_elegivel || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(d.valor_por_cota)}</TableCell>
                          <TableCell className="text-right">{d.quantidade_eventos || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {showHistorico && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Fechamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistorico ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Associados</TableHead>
                    <TableHead className="text-right">Cotas</TableHead>
                    <TableHead className="text-right">Total Despesas</TableHead>
                    <TableHead className="text-right">Valor/Cota</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico?.map((f: any) => {
                    const vc = (f.total_cotas_ativas || 0) > 0
                      ? (f.total_despesas_rateio || 0) / f.total_cotas_ativas
                      : 0;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{formatMesAno(f.mes, f.ano)}</TableCell>
                        <TableCell className="text-right">{(f.total_associados_ativos || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(f.total_cotas_ativas || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.total_despesas_rateio)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(vc)}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig[f.status]?.class || 'bg-gray-100'}>
                            {statusConfig[f.status]?.label || f.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
