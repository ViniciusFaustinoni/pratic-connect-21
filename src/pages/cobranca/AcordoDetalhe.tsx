import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Handshake, User, FileText, DollarSign, Calendar, CheckCircle, XCircle, Clock, Ban, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAcordo, useAcordos } from '@/hooks/useAcordos';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { RegistrarPagamentoParcelaModal } from '@/components/cobranca/RegistrarPagamentoParcelaModal';
import { CancelarAcordoModal } from '@/components/cobranca/CancelarAcordoModal';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpf = (cpf: string) => {
  const clean = cpf?.replace(/\D/g, '') || '';
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'ativo': { label: 'Ativo', variant: 'default' },
    'pendente': { label: 'Aguardando Entrada', variant: 'secondary' },
    'aguardando_aprovacao': { label: 'Aguardando Aprovação', variant: 'secondary' },
    'quitado': { label: 'Quitado', variant: 'outline' },
    'quebrado': { label: 'Quebrado', variant: 'destructive' },
    'cancelado': { label: 'Cancelado', variant: 'secondary' }
  };
  return map[status] || { label: status, variant: 'secondary' as const };
};

const getParcelaStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    'pendente': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
    'pago': { label: 'Pago', className: 'bg-green-100 text-green-800' },
    'vencido': { label: 'Vencido', className: 'bg-red-100 text-red-800' }
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
};

const AcordoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: acordo, isLoading } = useAcordo(id);
  const { registrarPagamentoParcela, cancelarAcordo, confirmarEntrada, aprovarAcordo } = useAcordos();
  const { hasRole } = useAuth();

  const [parcelaSelecionada, setParcelaSelecionada] = useState<any>(null);
  const [cancelarModalOpen, setCancelarModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!acordo) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Acordo não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/cobranca/acordos')} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const status = getStatusBadge(acordo.status || '');
  const parcelas = acordo.parcelas || [];
  const parcelasPagas = parcelas.filter((p: any) => p.status === 'pago').length;
  const valorPago = parcelas
    .filter((p: any) => p.status === 'pago')
    .reduce((acc: number, p: any) => acc + (p.valor_pago || p.valor || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cobranca/acordos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Handshake className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">{acordo.numero || 'Acordo'}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Criado em {acordo.created_at && format(new Date(acordo.created_at), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        {acordo.status === 'ativo' && (
          <Button variant="destructive" onClick={() => setCancelarModalOpen(true)}>
            <Ban className="h-4 w-4 mr-2" />
            Cancelar Acordo
          </Button>
        )}
      </div>

      {/* Alerta Entrada Pendente */}
      {acordo.status === 'pendente' && acordo.valor_entrada && acordo.valor_entrada > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Entrada Pendente</p>
                  <p className="text-sm text-yellow-700">
                    Valor da entrada: {formatCurrency(acordo.valor_entrada)}
                  </p>
                </div>
              </div>
              <Button onClick={() => confirmarEntrada(acordo.id)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Entrada
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerta Aguardando Aprovação */}
      {acordo.status === 'aguardando_aprovacao' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Aguardando Aprovação</p>
                  <p className="text-sm text-yellow-700">
                    Este acordo possui desconto que requer aprovação da diretoria.
                    {acordo.valor_desconto > 0 && ` Desconto: ${formatCurrency(acordo.valor_desconto)}`}
                  </p>
                </div>
              </div>
              {hasRole('diretor') && (
                <div className="flex gap-2">
                  <Button variant="default" onClick={() => aprovarAcordo(acordo.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar
                  </Button>
                  <Button variant="destructive" onClick={() => setCancelarModalOpen(true)}>
                    <Ban className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Original:</span>
                <span>{formatCurrency(acordo.valor_original)}</span>
              </div>
              {acordo.valor_desconto > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(acordo.valor_desconto)}</span>
                </div>
              )}
              {acordo.valor_juros > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Juros:</span>
                  <span>+ {formatCurrency(acordo.valor_juros)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Valor do Acordo:</span>
                <span>{formatCurrency(acordo.valor_acordo)}</span>
              </div>
              {acordo.valor_entrada > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada:</span>
                  <span className="flex items-center gap-2">
                    {formatCurrency(acordo.valor_entrada)}
                    {acordo.entrada_paga ? (
                      <Badge variant="outline" className="text-xs">Paga</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pendente</Badge>
                    )}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parcelas Pagas:</span>
                <span>{parcelasPagas} de {acordo.qtd_parcelas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Pago:</span>
                <span className="text-green-600">{formatCurrency(valorPago)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Restante:</span>
                <span>{formatCurrency(acordo.valor_acordo - valorPago)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Associado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Associado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Nome:</span>
              <p className="font-medium">{acordo.associado?.nome}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CPF:</span>
              <p className="font-medium">{formatCpf(acordo.associado?.cpf || '')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone:</span>
              <p className="font-medium">{acordo.associado?.telefone}</p>
            </div>
            {acordo.associado?.email && (
              <div>
                <span className="text-muted-foreground">E-mail:</span>
                <p className="font-medium truncate">{acordo.associado?.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info do Acordo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Detalhes do Acordo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dia Vencimento:</span>
              <span className="font-medium">Dia {acordo.dia_vencimento}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primeira Parcela:</span>
              <span className="font-medium">
                {acordo.primeira_parcela_data && format(new Date(acordo.primeira_parcela_data), 'dd/MM/yyyy')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Parcela:</span>
              <span className="font-medium">{formatCurrency(acordo.valor_parcela)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Boletos Incluídos:</span>
              <span className="font-medium">{acordo.cobrancas_ids?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
                <TableHead>Data Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas
                .sort((a: any, b: any) => a.numero_parcela - b.numero_parcela)
                .map((p: any) => {
                  const parcelaStatus = getParcelaStatusBadge(p.status || 'pendente');
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.numero_parcela}ª</TableCell>
                      <TableCell>
                        {p.data_vencimento && format(new Date(p.data_vencimento), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>
                      <TableCell className="text-right">
                        {p.valor_pago ? formatCurrency(p.valor_pago) : '-'}
                      </TableCell>
                      <TableCell>
                        {p.data_pagamento ? format(new Date(p.data_pagamento), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={parcelaStatus.className}>{parcelaStatus.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {p.status !== 'pago' && acordo.status === 'ativo' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setParcelaSelecionada(p)}
                          >
                            Pagar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <RegistrarPagamentoParcelaModal
        open={!!parcelaSelecionada}
        onClose={() => setParcelaSelecionada(null)}
        parcela={parcelaSelecionada}
        onConfirm={(dados) => {
          registrarPagamentoParcela(dados);
          setParcelaSelecionada(null);
        }}
      />

      <CancelarAcordoModal
        open={cancelarModalOpen}
        onClose={() => setCancelarModalOpen(false)}
        onConfirm={(motivo) => {
          cancelarAcordo({ acordoId: acordo.id, motivo });
          setCancelarModalOpen(false);
        }}
      />
    </div>
  );
};

export default AcordoDetalhe;
