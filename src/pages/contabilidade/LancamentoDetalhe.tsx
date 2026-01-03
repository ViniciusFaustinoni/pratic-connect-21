import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, FileText, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { EstornoDialog } from '@/components/contabilidade';
import { useLancamento } from '@/hooks/useContabilidade';
import { format } from 'date-fns';

export default function LancamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lancamento, isLoading } = useLancamento(id!);
  const [estornoOpen, setEstornoOpen] = useState(false);

  const statusColors: Record<string, string> = {
    ativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rascunho: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    estornado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    fechado: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando lançamento...</p>
      </div>
    );
  }

  if (!lancamento) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Lançamento não encontrado</p>
      </div>
    );
  }

  const totalDebito = lancamento.partidas
    ?.filter(p => p.tipo === 'debito')
    .reduce((sum, p) => sum + Number(p.valor), 0) || 0;

  const totalCredito = lancamento.partidas
    ?.filter(p => p.tipo === 'credito')
    .reduce((sum, p) => sum + Number(p.valor), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {lancamento.numero}
              </h1>
              <Badge className={statusColors[lancamento.status]}>
                {lancamento.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Lançamento contábil
            </p>
          </div>
        </div>

        {lancamento.status === 'ativo' && (
          <Button variant="outline" onClick={() => setEstornoOpen(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Estornar
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{lancamento.historico}</p>
              {lancamento.complemento && (
                <p className="text-muted-foreground mt-2">{lancamento.complemento}</p>
              )}
            </CardContent>
          </Card>

          {/* Partidas */}
          <Card>
            <CardHeader>
              <CardTitle>Partidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamento.partidas?.map((partida) => (
                      <TableRow key={partida.id}>
                        <TableCell>
                          <div>
                            <span className="font-mono text-sm text-muted-foreground mr-2">
                              {(partida.conta as any)?.codigo}
                            </span>
                            <span>{(partida.conta as any)?.descricao}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {partida.tipo === 'debito' ? formatCurrency(Number(partida.valor)) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {partida.tipo === 'credito' ? formatCurrency(Number(partida.valor)) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Totais</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(totalDebito)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(totalCredito)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Estorno Info */}
          {lancamento.status === 'estornado' && lancamento.motivo_estorno && (
            <Card className="border-red-200 dark:border-red-900/50">
              <CardHeader>
                <CardTitle className="text-red-600">Informações do Estorno</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">
                  Estornado em: {lancamento.estornado_em && format(new Date(lancamento.estornado_em), 'dd/MM/yyyy HH:mm')}
                </p>
                <p><strong>Motivo:</strong> {lancamento.motivo_estorno}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Data do Lançamento</p>
                <p className="font-medium">
                  {format(new Date(lancamento.data_lancamento), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Competência</p>
                <p className="font-medium">
                  {format(new Date(lancamento.data_competencia), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criado em</p>
                <p className="font-medium">
                  {format(new Date(lancamento.created_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Document */}
          {(lancamento.documento_tipo || lancamento.documento_numero) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lancamento.documento_tipo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium">{lancamento.documento_tipo}</p>
                  </div>
                )}
                {lancamento.documento_numero && (
                  <div>
                    <p className="text-sm text-muted-foreground">Número</p>
                    <p className="font-medium">{lancamento.documento_numero}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Origem</p>
                <Badge variant="outline">{lancamento.origem}</Badge>
              </div>
              {lancamento.criador && (
                <div>
                  <p className="text-sm text-muted-foreground">Criado por</p>
                  <p className="font-medium">{(lancamento.criador as any)?.nome}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Estorno Dialog */}
      <EstornoDialog
        open={estornoOpen}
        onOpenChange={setEstornoOpen}
        lancamentoId={lancamento.id}
        lancamentoNumero={lancamento.numero}
      />
    </div>
  );
}
