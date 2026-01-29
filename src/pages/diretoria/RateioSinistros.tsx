import { useState } from 'react';
import { Calculator, Check, Play, History, AlertTriangle, Users, DollarSign, TrendingUp, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { CalcularRateioModal } from '@/components/diretoria';
import { RateioDetalhesFaixasCard } from '@/components/diretoria/RateioDetalhesFaixasCard';
import { type RateioPorCota } from '@/hooks/useFaixasCotas';

const statusConfig: Record<string, { label: string; class: string }> = {
  calculado: { label: 'Calculado', class: 'bg-yellow-100 text-yellow-800' },
  aprovado: { label: 'Aprovado', class: 'bg-blue-100 text-blue-800' },
  aplicado: { label: 'Aplicado', class: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', class: 'bg-red-100 text-red-800' },
};

const formatCurrency = (value: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatMesAno = (mes: number, ano: number) => {
  return format(new Date(ano, mes - 1), "MMMM 'de' yyyy", { locale: ptBR });
};

export default function RateioSinistros() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [showHistorico, setShowHistorico] = useState(false);
  const [calcularModalOpen, setCalcularModalOpen] = useState(false);

  // Lista de rateios (histórico)
  const { data: rateios, isLoading: loadingRateios } = useQuery({
    queryKey: ['rateios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rateios')
        .select(`
          *,
          aprovador:profiles!rateios_aprovado_por_fkey(nome)
        `)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Rateio do mês atual com detalhes
  const { data: rateioAtual, isLoading: loadingAtual } = useQuery({
    queryKey: ['rateio-atual'],
    queryFn: async () => {
      const hoje = new Date();
      const { data, error } = await supabase
        .from('rateios')
        .select(`
          *,
          detalhes:rateios_detalhes(
            *,
            plano:planos(nome)
          ),
          detalhes_faixas:rateios_detalhes_faixas(*)
        `)
        .eq('ano', hoje.getFullYear())
        .eq('mes', hoje.getMonth() + 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Rateio do mês anterior para comparativo
  const { data: rateioAnterior } = useQuery({
    queryKey: ['rateio-anterior'],
    queryFn: async () => {
      const hoje = new Date();
      let mesAnterior = hoje.getMonth(); // getMonth() já retorna 0-11, então mês atual - 1
      let anoAnterior = hoje.getFullYear();
      if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior -= 1;
      }
      const { data, error } = await supabase
        .from('rateios')
        .select('*')
        .eq('ano', anoAnterior)
        .eq('mes', mesAnterior)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Calcular variação entre rateios
  const variacaoRateio = (() => {
    if (!rateioAtual || !rateioAnterior) return null;
    const valorAtual = rateioAtual.valor_rateio_por_cota || rateioAtual.valor_rateio_por_associado || 0;
    const valorAnterior = rateioAnterior.valor_rateio_por_cota || rateioAnterior.valor_rateio_por_associado || 0;
    if (valorAnterior === 0) return null;
    const variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;
    return {
      percentual: variacao,
      valorAtual,
      valorAnterior,
      alerta: Math.abs(variacao) > 5
    };
  })();

  // Mutation - Calcular Rateio (CORRIGIDO: usando fn_calcular_rateio_por_cotas)
  const calcularRateio = useMutation({
    mutationFn: async ({ mes, ano }: { mes: number; ano: number }) => {
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const proximoMes = mes === 12 ? 1 : mes + 1;
      const proximoAno = mes === 12 ? ano + 1 : ano;
      const fimMes = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;

      // Buscar sinistros, associados e total de cotas
      const [sinistrosRes, associadosRes, cotasRes] = await Promise.all([
        supabase.from('sinistros')
          .select('valor_indenizacao')
          .in('status', ['aprovado', 'indenizado'])
          .gte('data_ocorrencia', inicioMes)
          .lt('data_ocorrencia', fimMes),
        supabase.from('associados')
          .select('id, plano_id')
          .eq('status', 'ativo'),
        // Buscar total de cotas usando função SQL
        supabase.rpc('fn_calcular_total_cotas_ativos')
      ]);

      const sinistros = sinistrosRes.data || [];
      const associados = associadosRes.data || [];
      const totalCotas = Number(cotasRes.data) || 0;

      const totalAssociados = associados.length;
      const totalSinistros = sinistros.length;
      const valorTotalSinistros = sinistros.reduce((sum, s) => sum + (s.valor_indenizacao || 0), 0);
      const percentualFundo = 10;
      const valorFundo = valorTotalSinistros * (percentualFundo / 100);
      
      // Chamar fn_calcular_rateio_por_cotas para obter valores ajustados por faixa
      const { data: rateioDetalhado, error: erroRateio } = await supabase.rpc('fn_calcular_rateio_por_cotas', {
        p_custo_total: valorTotalSinistros + valorFundo,
        p_percentual_fundo: percentualFundo,
      });

      // Valor base por cota (sem ajustes)
      const valorRateioPorCota = totalCotas > 0 
        ? (valorTotalSinistros + valorFundo) / totalCotas 
        : 0;
      
      // Manter compatibilidade com campo antigo (valor por associado = média)
      const valorRateioPorAssociado = totalAssociados > 0
        ? (valorTotalSinistros + valorFundo) / totalAssociados
        : 0;

      const { data, error } = await supabase
        .from('rateios')
        .upsert({
          mes,
          ano,
          total_associados: totalAssociados,
          total_sinistros: totalSinistros,
          valor_total_sinistros: valorTotalSinistros,
          valor_rateio_por_associado: valorRateioPorAssociado,
          percentual_fundo_reserva: percentualFundo,
          valor_fundo_reserva: valorFundo,
          status: 'calculado',
          formula_utilizada: '(Sinistros + Fundo) / Total Cotas + Ajustes por Faixa',
          // Campos para sistema de cotas
          total_cotas: totalCotas,
          valor_rateio_por_cota: valorRateioPorCota
        }, { onConflict: 'mes,ano' })
        .select()
        .single();

      if (error) throw error;

      // Salvar detalhes por faixa se disponível
      if (rateioDetalhado && rateioDetalhado.length > 0 && data?.id) {
        // Primeiro, remover detalhes antigos
        await supabase
          .from('rateios_detalhes_faixas')
          .delete()
          .eq('rateio_id', data.id);

        // Inserir novos detalhes
        const detalhesParaInserir = rateioDetalhado.map((detalhe: RateioPorCota) => ({
          rateio_id: data.id,
          faixa_id: detalhe.faixa_id,
          fipe_de: detalhe.fipe_de,
          fipe_ate: detalhe.fipe_ate,
          quantidade_cotas: detalhe.quantidade_cotas,
          contratos_na_faixa: detalhe.contratos_na_faixa || 0,
          total_cotas_faixa: detalhe.total_cotas_faixa || 0,
          ajuste_percentual: detalhe.ajuste_percentual,
          valor_base_cota: detalhe.valor_base_cota,
          valor_final_cota: detalhe.valor_final_cota,
        }));

        await supabase
          .from('rateios_detalhes_faixas')
          .insert(detalhesParaInserir);
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Rateio calculado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['rateios'] });
      queryClient.invalidateQueries({ queryKey: ['rateio-atual'] });
    },
    onError: (error) => {
      toast.error('Erro ao calcular rateio: ' + error.message);
    }
  });

  // Mutation - Aprovar Rateio
  const aprovarRateio = useMutation({
    mutationFn: async (rateioId: string) => {
      const { error } = await supabase
        .from('rateios')
        .update({ 
          status: 'aprovado',
          aprovado_em: new Date().toISOString(),
          aprovado_por: profile?.id
        })
        .eq('id', rateioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rateio aprovado!');
      queryClient.invalidateQueries({ queryKey: ['rateios'] });
      queryClient.invalidateQueries({ queryKey: ['rateio-atual'] });
    }
  });

  // Mutation - Aplicar Rateio
  const aplicarRateio = useMutation({
    mutationFn: async (rateioId: string) => {
      const { error } = await supabase
        .from('rateios')
        .update({ 
          status: 'aplicado',
          aplicado_em: new Date().toISOString()
        })
        .eq('id', rateioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rateio aplicado!');
      queryClient.invalidateQueries({ queryKey: ['rateios'] });
      queryClient.invalidateQueries({ queryKey: ['rateio-atual'] });
    }
  });

  const isLoading = loadingRateios || loadingAtual;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rateio de Sinistros</h1>
          <p className="text-muted-foreground">Cálculo e gestão do rateio mensal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistorico(!showHistorico)}>
            <History className="h-4 w-4 mr-2" />
            {showHistorico ? 'Ocultar Histórico' : 'Histórico'}
          </Button>
          <Button onClick={() => setCalcularModalOpen(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            Calcular Rateio
          </Button>
        </div>
      </div>

      {/* Alerta se não há rateio */}
      {!rateioAtual && !isLoading && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhum rateio calculado para o mês atual. Clique em "Calcular Novo Rateio" para iniciar.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de Variação > 5% */}
      {variacaoRateio?.alerta && (
        <Alert variant={variacaoRateio.percentual > 0 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <span>
              Variação significativa no rateio: <strong>{variacaoRateio.percentual > 0 ? '+' : ''}{variacaoRateio.percentual.toFixed(1)}%</strong> em relação ao mês anterior
              ({formatCurrency(variacaoRateio.valorAnterior)} → {formatCurrency(variacaoRateio.valorAtual)})
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Card Comparativo com Mês Anterior */}
      {rateioAtual && rateioAnterior && (
        <Card className="border-info/30 bg-info/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comparativo com Mês Anterior</p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Anterior</p>
                    <p className="text-lg font-semibold">{formatCurrency(variacaoRateio?.valorAnterior || 0)}</p>
                  </div>
                  <div className="text-2xl">→</div>
                  <div>
                    <p className="text-xs text-muted-foreground">Atual</p>
                    <p className="text-lg font-semibold">{formatCurrency(variacaoRateio?.valorAtual || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Variação</p>
                <p className={`text-2xl font-bold ${
                  (variacaoRateio?.percentual || 0) > 0 ? 'text-red-600' : 
                  (variacaoRateio?.percentual || 0) < 0 ? 'text-green-600' : ''
                }`}>
                  {(variacaoRateio?.percentual || 0) > 0 ? '+' : ''}
                  {variacaoRateio?.percentual?.toFixed(1) || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Rateio Atual */}
      {rateioAtual && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Rateio de {formatMesAno(rateioAtual.mes, rateioAtual.ano)}
              </CardTitle>
              <Badge className={statusConfig[rateioAtual.status]?.class || 'bg-gray-100'}>
                {statusConfig[rateioAtual.status]?.label || rateioAtual.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Grid de métricas */}
            <div className="grid grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Users className="h-4 w-4" />
                    Total Associados
                  </div>
                  <p className="text-2xl font-bold">{rateioAtual.total_associados?.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Total de Cotas
                  </div>
                  <p className="text-2xl font-bold">{rateioAtual.total_cotas?.toLocaleString() || '-'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Total Sinistros
                  </div>
                  <p className="text-2xl font-bold">{rateioAtual.total_sinistros}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <DollarSign className="h-4 w-4" />
                    Valor Total Sinistros
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(rateioAtual.valor_total_sinistros)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Valor por Cota
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(rateioAtual.valor_rateio_por_cota || rateioAtual.valor_rateio_por_associado)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Fundo de Reserva */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Fundo de Reserva</p>
                    <p className="text-lg font-semibold">
                      {rateioAtual.percentual_fundo_reserva}% do valor total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Valor destinado</p>
                    <p className="text-xl font-bold">{formatCurrency(rateioAtual.valor_fundo_reserva)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-end gap-2">
              {rateioAtual.status === 'calculado' && (
                <Button 
                  onClick={() => aprovarRateio.mutate(rateioAtual.id)}
                  disabled={aprovarRateio.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar Rateio
                </Button>
              )}
              {rateioAtual.status === 'aprovado' && (
                <Button 
                  onClick={() => aplicarRateio.mutate(rateioAtual.id)}
                  disabled={aplicarRateio.isPending}
                  variant="default"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Aplicar Rateio
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhes por Plano */}
      {rateioAtual?.detalhes && rateioAtual.detalhes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Associados</TableHead>
                  <TableHead className="text-right">Sinistros</TableHead>
                  <TableHead className="text-right">Valor Sinistros</TableHead>
                  <TableHead className="text-right">Valor Rateio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateioAtual.detalhes.map((detalhe: any) => (
                  <TableRow key={detalhe.id}>
                    <TableCell className="font-medium">{detalhe.plano?.nome || 'N/A'}</TableCell>
                    <TableCell className="text-right">{detalhe.total_associados}</TableCell>
                    <TableCell className="text-right">{detalhe.total_sinistros}</TableCell>
                    <TableCell className="text-right">{formatCurrency(detalhe.valor_sinistros)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(detalhe.valor_rateio)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detalhes por Faixa FIPE */}
      {rateioAtual?.detalhes_faixas && rateioAtual.detalhes_faixas.length > 0 && (
        <RateioDetalhesFaixasCard detalhesFaixas={rateioAtual.detalhes_faixas as RateioPorCota[]} />
      )}
      {showHistorico && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Rateios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Associados</TableHead>
                  <TableHead className="text-right">Sinistros</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Valor/Associado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aprovado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateios?.slice(0, 12).map((rateio) => (
                  <TableRow key={rateio.id}>
                    <TableCell className="font-medium">
                      {formatMesAno(rateio.mes, rateio.ano)}
                    </TableCell>
                    <TableCell className="text-right">{rateio.total_associados?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{rateio.total_sinistros}</TableCell>
                    <TableCell className="text-right">{formatCurrency(rateio.valor_total_sinistros)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(rateio.valor_rateio_por_associado)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[rateio.status]?.class || 'bg-gray-100'}>
                        {statusConfig[rateio.status]?.label || rateio.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rateio.aprovador?.nome || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CalcularRateioModal
        open={calcularModalOpen}
        onClose={() => setCalcularModalOpen(false)}
      />
    </div>
  );
}
