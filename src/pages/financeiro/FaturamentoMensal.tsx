import { useState } from 'react';
import { 
  Calendar, DollarSign, Users, FileText, Play, CheckCircle, 
  AlertCircle, Loader2, ExternalLink 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const meses = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'rascunho': { label: 'Rascunho', variant: 'secondary' },
  'processando': { label: 'Processando', variant: 'outline' },
  'gerado': { label: 'Gerado', variant: 'default' },
  'enviado': { label: 'Enviado', variant: 'default' },
  'fechado': { label: 'Fechado', variant: 'secondary' },
  'cancelado': { label: 'Cancelado', variant: 'destructive' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function FaturamentoMensal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  // Query: Faturamentos existentes
  const { data: faturamentos, isLoading: loadingFaturamentos } = useQuery({
    queryKey: ['faturamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamentos')
        .select('*')
        .order('referencia_ano', { ascending: false })
        .order('referencia_mes', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    }
  });

  // Query: Associados para faturar
  const { data: resumoFaturamento, isLoading: loadingResumo } = useQuery({
    queryKey: ['associados-para-faturar', mesSelecionado, anoSelecionado],
    queryFn: async () => {
      // Buscar associados ativos com contrato vigente
      const { data: associados, error: errorAssoc } = await supabase
        .from('associados')
        .select(`
          id, nome, cpf, dia_vencimento,
          contratos!inner(id, valor_mensal, status, dia_vencimento)
        `)
        .eq('status', 'ativo')
        .eq('contratos.status', 'ativo');
      
      if (errorAssoc) throw errorAssoc;

      // Verificar cobranças já existentes no período
      const competencia = `${String(mesSelecionado).padStart(2, '0')}/${anoSelecionado}`;
      const { data: cobrancasExistentes } = await supabase
        .from('asaas_cobrancas')
        .select('associado_id')
        .eq('tipo', 'mensalidade')
        .eq('competencia', competencia);

      const idsComCobranca = new Set(cobrancasExistentes?.map(c => c.associado_id) || []);
      const pendentes = associados?.filter(a => !idsComCobranca.has(a.id)) || [];

      return {
        total: associados?.length || 0,
        jaFaturados: idsComCobranca.size,
        pendentes: pendentes,
        valorEstimado: pendentes.reduce((acc, a) => {
          const contrato = Array.isArray(a.contratos) ? a.contratos[0] : a.contratos;
          return acc + (contrato?.valor_mensal || 0);
        }, 0)
      };
    }
  });

  // Mutation: Gerar faturamento
  const gerarFaturamentoMutation = useMutation({
    mutationFn: async () => {
      if (!resumoFaturamento?.pendentes.length) {
        throw new Error('Não há associados pendentes para faturar');
      }

      const { data: { user } } = await supabase.auth.getUser();
      const competencia = `${String(mesSelecionado).padStart(2, '0')}/${anoSelecionado}`;

      // 1. Criar/atualizar registro de faturamento
      const { data: faturamento, error: errorFat } = await supabase
        .from('faturamentos')
        .upsert({
          referencia_mes: mesSelecionado,
          referencia_ano: anoSelecionado,
          status: 'processando',
          data_geracao: new Date().toISOString(),
          gerado_por: user?.id
        }, { onConflict: 'referencia_mes,referencia_ano' })
        .select()
        .single();

      if (errorFat) throw errorFat;

      // 2. Gerar cobranças para cada associado pendente
      let totalGerado = 0;
      let valorTotal = 0;

      for (const associado of resumoFaturamento.pendentes) {
        const contrato = Array.isArray(associado.contratos) 
          ? associado.contratos[0] 
          : associado.contratos;
        const diaVencimento = contrato?.dia_vencimento || associado.dia_vencimento || 10;
        const dataVencimento = new Date(anoSelecionado, mesSelecionado - 1, diaVencimento);
        const valorMensal = contrato?.valor_mensal || 0;

        const { error } = await supabase.from('asaas_cobrancas').insert({
          associado_id: associado.id,
          asaas_id: `fat-${Date.now()}-${totalGerado}`,
          tipo: 'mensalidade',
          valor: valorMensal,
          valor_liquido: valorMensal,
          data_emissao: new Date().toISOString().split('T')[0],
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          competencia: competencia,
          referencia: `Mensalidade ${competencia}`,
          status: 'PENDING'
        });

        if (!error) {
          totalGerado++;
          valorTotal += valorMensal;
        }
      }

      // 3. Atualizar faturamento com totais
      await supabase.from('faturamentos').update({
        status: 'gerado',
        total_associados: resumoFaturamento.pendentes.length,
        total_cobrancas: totalGerado,
        valor_total: valorTotal,
        valor_pendente: valorTotal
      }).eq('id', faturamento.id);

      return { totalGerado, valorTotal };
    },
    onSuccess: (result) => {
      toast.success(`${result.totalGerado} cobranças geradas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['faturamentos'] });
      queryClient.invalidateQueries({ queryKey: ['associados-para-faturar'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista'] });
    },
    onError: (error) => {
      toast.error('Erro ao gerar faturamento');
      console.error(error);
    }
  });

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturamento Mensal</h1>
        <p className="text-muted-foreground">
          Geração de cobranças em lote para associados ativos
        </p>
      </div>

      {/* Seletor de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Período de Referência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select
                value={String(mesSelecionado)}
                onValueChange={(v) => setMesSelecionado(Number(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes) => (
                    <SelectItem key={mes.value} value={String(mes.value)}>
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select
                value={String(anoSelecionado)}
                onValueChange={(v) => setAnoSelecionado(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Período */}
      {loadingResumo ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : resumoFaturamento && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Associados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumoFaturamento.total}</div>
                <p className="text-xs text-muted-foreground">Com contrato ativo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Já Faturados</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumoFaturamento.jaFaturados}</div>
                <p className="text-xs text-muted-foreground">Neste período</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resumoFaturamento.pendentes.length}</div>
                <p className="text-xs text-muted-foreground">Sem cobrança</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Estimado</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(resumoFaturamento.valorEstimado)}
                </div>
                <p className="text-xs text-muted-foreground">Total pendente</p>
              </CardContent>
            </Card>
          </div>

          {/* Card de Ação */}
          <Card>
            <CardContent className="pt-6">
              {resumoFaturamento.pendentes.length > 0 ? (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">
                    {resumoFaturamento.pendentes.length} associados serão faturados
                  </AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Valor total estimado: {formatCurrency(resumoFaturamento.valorEstimado)}
                  </AlertDescription>
                  <div className="mt-4">
                    <Button
                      size="lg"
                      onClick={() => gerarFaturamentoMutation.mutate()}
                      disabled={gerarFaturamentoMutation.isPending}
                    >
                      {gerarFaturamentoMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Gerar Faturamento
                        </>
                      )}
                    </Button>
                  </div>
                </Alert>
              ) : (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Faturamento completo</AlertTitle>
                  <AlertDescription className="text-green-700">
                    Todos os associados já foram faturados para{' '}
                    {meses.find(m => m.value === mesSelecionado)?.label}/{anoSelecionado}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Histórico de Faturamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Histórico de Faturamentos
          </CardTitle>
          <CardDescription>Últimos 12 meses de geração</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFaturamentos ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : faturamentos && faturamentos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-center">Cobranças</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Gerado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturamentos.map((fat) => (
                  <TableRow key={fat.id}>
                    <TableCell className="font-medium">
                      {String(fat.referencia_mes).padStart(2, '0')}/{fat.referencia_ano}
                    </TableCell>
                    <TableCell className="text-center">
                      {fat.total_cobrancas || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(fat.valor_total || 0)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(fat.valor_pago || 0)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatCurrency(fat.valor_pendente || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusConfig[fat.status || 'rascunho']?.variant || 'secondary'}>
                        {statusConfig[fat.status || 'rascunho']?.label || fat.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {fat.data_geracao 
                        ? format(new Date(fat.data_geracao), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/financeiro/cobrancas?competencia=${String(fat.referencia_mes).padStart(2, '0')}/${fat.referencia_ano}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum faturamento realizado ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
