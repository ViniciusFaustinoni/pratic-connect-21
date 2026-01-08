import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle,
  Circle,
  Building2,
  Calendar,
  Wallet
} from 'lucide-react';
import { useExtratoBancario, useMovimentacoesBancarias, useConciliarMovimentacao, StatusExtrato } from '@/hooks/useExtratoBancario';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<StatusExtrato, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  processando: { label: 'Processando', color: 'bg-blue-100 text-blue-800' },
  processado: { label: 'Processado', color: 'bg-green-100 text-green-800' },
  conciliado: { label: 'Conciliado', color: 'bg-emerald-100 text-emerald-800' },
  erro: { label: 'Erro', color: 'bg-red-100 text-red-800' },
};

export default function ExtratoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: extrato, isLoading: loadingExtrato } = useExtratoBancario(id);
  const { data: movimentacoes, isLoading: loadingMovimentacoes } = useMovimentacoesBancarias(id);
  const conciliarMutation = useConciliarMovimentacao();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleConciliar = (movimentacaoId: string) => {
    conciliarMutation.mutate({ movimentacaoId });
  };

  if (loadingExtrato) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!extrato) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Extrato não encontrado</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/financeiro/extratos-bancarios')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[extrato.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/financeiro/extratos-bancarios')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{extrato.arquivo_nome}</h1>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            {extrato.conta_bancaria?.banco_nome} - Ag: {extrato.conta_bancaria?.agencia} Cc: {extrato.conta_bancaria?.conta}
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="font-semibold">
                  {extrato.data_inicio && extrato.data_fim
                    ? `${format(new Date(extrato.data_inicio), 'dd/MM')} - ${format(new Date(extrato.data_fim), 'dd/MM/yy')}`
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Créditos</p>
                <p className="font-semibold text-green-600">{formatCurrency(extrato.total_creditos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Débitos</p>
                <p className="font-semibold text-red-600">{formatCurrency(extrato.total_debitos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Final</p>
                <p className="font-semibold">{formatCurrency(extrato.saldo_final || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Movimentações ({extrato.qtd_lancamentos})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-[100px] text-center">Conciliado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMovimentacoes ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : movimentacoes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                movimentacoes?.map(mov => (
                  <TableRow key={mov.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(mov.data_lancamento), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{mov.descricao}</p>
                        {mov.nome_pagador && (
                          <p className="text-xs text-muted-foreground">{mov.nome_pagador}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mov.documento || '-'}
                    </TableCell>
                    <TableCell>
                      {mov.categoria && (
                        <Badge variant="outline" className="text-xs">
                          {mov.categoria}
                          {mov.subcategoria && ` / ${mov.subcategoria}`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-mono font-medium",
                        mov.tipo === 'credito' ? 'text-green-600' : 'text-red-600'
                      )}>
                        {mov.tipo === 'credito' ? '+' : '-'} {formatCurrency(mov.valor)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {mov.saldo_apos !== undefined ? formatCurrency(mov.saldo_apos) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {mov.conciliado ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleConciliar(mov.id)}
                          disabled={conciliarMutation.isPending}
                        >
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
