import { useState } from 'react';
import { Calculator, Check, Play, History, AlertTriangle, Users, DollarSign, TrendingUp } from 'lucide-react';
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
          )
        `)
        .eq('ano', hoje.getFullYear())
        .eq('mes', hoje.getMonth() + 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Mutation - Calcular Rateio (CORRIGIDO: divisão por COTAS conforme PDF)
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
      
      // CORREÇÃO: Dividir por COTAS em vez de associados
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
          formula_utilizada: '(Sinistros + Fundo) / Total Cotas',
          // Novos campos para sistema de cotas
          total_cotas: totalCotas,
          valor_rateio_por_cota: valorRateioPorCota
        }, { onConflict: 'mes,ano' })
        .select()
        .single();

      if (error) throw error;
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

      {/* Histórico de Rateios */}
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
