import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calculator, Handshake, FileText, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAcordos } from '@/hooks/useAcordos';
import { format, addMonths } from 'date-fns';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpf = (cpf: string) => {
  const clean = cpf?.replace(/\D/g, '') || '';
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

const NovoAcordo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const associadoId = searchParams.get('associado');
  const boletosIds = searchParams.get('boletos')?.split(',').filter(Boolean) || [];

  const { criarAcordo, isCriando } = useAcordos();

  // Form state
  const [descontoPct, setDescontoPct] = useState(0);
  const [jurosPct, setJurosPct] = useState(0);
  const [qtdParcelas, setQtdParcelas] = useState(3);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [valorEntrada, setValorEntrada] = useState(0);
  const [primeiraParcela, setPrimeiraParcela] = useState(
    format(addMonths(new Date(), 1), 'yyyy-MM-dd')
  );

  // Dados do associado
  const { data: associado, isLoading: loadingAssociado } = useQuery({
    queryKey: ['associado-acordo', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, email')
        .eq('id', associadoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId
  });

  // Boletos selecionados
  const { data: boletos, isLoading: loadingBoletos } = useQuery({
    queryKey: ['boletos-acordo', boletosIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .in('id', boletosIds);
      if (error) throw error;
      return data || [];
    },
    enabled: boletosIds.length > 0
  });

  // Cálculos
  const valorOriginal = useMemo(() => {
    return boletos?.reduce((acc, b) => acc + (b.valor_final || 0), 0) || 0;
  }, [boletos]);

  const valorDesconto = useMemo(() => {
    return valorOriginal * (descontoPct / 100);
  }, [valorOriginal, descontoPct]);

  const valorJuros = useMemo(() => {
    return valorOriginal * (jurosPct / 100);
  }, [valorOriginal, jurosPct]);

  const valorAcordo = useMemo(() => {
    return valorOriginal - valorDesconto + valorJuros;
  }, [valorOriginal, valorDesconto, valorJuros]);

  const valorRestante = useMemo(() => {
    return valorAcordo - valorEntrada;
  }, [valorAcordo, valorEntrada]);

  const valorParcela = useMemo(() => {
    if (qtdParcelas <= 0) return 0;
    return valorRestante / qtdParcelas;
  }, [valorRestante, qtdParcelas]);

  // Preview parcelas
  const previewParcelas = useMemo(() => {
    const parcelas = [];
    const dataBase = new Date(primeiraParcela);

    for (let i = 1; i <= qtdParcelas; i++) {
      const data = new Date(dataBase);
      data.setMonth(data.getMonth() + (i - 1));
      data.setDate(diaVencimento);

      parcelas.push({
        numero: i,
        data: format(data, 'dd/MM/yyyy'),
        valor: valorParcela
      });
    }

    return parcelas;
  }, [qtdParcelas, primeiraParcela, diaVencimento, valorParcela]);

  const handleSubmit = async () => {
    if (!associadoId || boletosIds.length === 0) return;

    await criarAcordo({
      associado_id: associadoId,
      cobrancas_ids: boletosIds,
      valor_original: valorOriginal,
      valor_desconto: valorDesconto,
      valor_juros: valorJuros,
      valor_acordo: valorAcordo,
      qtd_parcelas: qtdParcelas,
      valor_parcela: valorParcela,
      dia_vencimento: diaVencimento,
      primeira_parcela_data: primeiraParcela,
      valor_entrada: valorEntrada > 0 ? valorEntrada : undefined
    });

    navigate('/cobranca/acordos');
  };

  const isLoading = loadingAssociado || loadingBoletos;

  if (!associadoId || boletosIds.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Selecione boletos a partir da página de inadimplentes</p>
        <Button variant="outline" onClick={() => navigate('/cobranca/inadimplentes')} className="mt-4">
          Ir para Inadimplentes
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Handshake className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Novo Acordo</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Dados */}
        <div className="space-y-6">
          {/* Associado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Associado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{associado?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPF:</span>
                <span className="font-medium">{formatCpf(associado?.cpf || '')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Boletos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Boletos Selecionados ({boletos?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletos?.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.referencia_mes?.toString().padStart(2, '0')}/{b.referencia_ano}
                      </TableCell>
                      <TableCell>
                        {b.data_vencimento && format(new Date(b.data_vencimento), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(b.valor_final || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 border-t bg-muted/50">
                <div className="flex justify-between font-medium">
                  <span>Total da Dívida:</span>
                  <span className="text-destructive">{formatCurrency(valorOriginal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculadora */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Configurar Acordo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={descontoPct}
                    onChange={(e) => setDescontoPct(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Juros (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={jurosPct}
                    onChange={(e) => setJurosPct(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dia Vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primeira Parcela</Label>
                  <Input
                    type="date"
                    value={primeiraParcela}
                    onChange={(e) => setPrimeiraParcela(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Entrada (opcional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={valorEntrada}
                    onChange={(e) => setValorEntrada(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Resumo */}
        <div className="space-y-6">
          {/* Resumo do Acordo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo do Acordo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Original:</span>
                  <span>{formatCurrency(valorOriginal)}</span>
                </div>
                {valorDesconto > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto ({descontoPct}%):</span>
                    <span>- {formatCurrency(valorDesconto)}</span>
                  </div>
                )}
                {valorJuros > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Juros ({jurosPct}%):</span>
                    <span>+ {formatCurrency(valorJuros)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium text-base">
                  <span>Valor do Acordo:</span>
                  <span>{formatCurrency(valorAcordo)}</span>
                </div>
                {valorEntrada > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Entrada:</span>
                      <span>- {formatCurrency(valorEntrada)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Restante:</span>
                      <span>{formatCurrency(valorRestante)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Valor da Parcela</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(valorParcela)}</p>
                <p className="text-sm text-muted-foreground">{qtdParcelas}x parcelas</p>
              </div>
            </CardContent>
          </Card>

          {/* Preview Parcelas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Parcelas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewParcelas.map((p) => (
                      <TableRow key={p.numero}>
                        <TableCell>{p.numero}ª</TableCell>
                        <TableCell>{p.data}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Botão */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={isCriando || valorParcela <= 0}
          >
            {isCriando ? 'Criando...' : 'Criar Acordo'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NovoAcordo;
