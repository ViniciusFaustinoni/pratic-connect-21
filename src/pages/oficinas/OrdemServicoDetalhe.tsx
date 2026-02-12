import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Car, User, Calendar, FileText, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrdemServico, useOSItens, useOSHistorico, useDeleteOSItem } from '@/hooks/useOrdensServico';
import { OSStatusDialog } from '@/components/oficinas/OSStatusDialog';
import { OSItemFormDialog } from '@/components/oficinas/OSItemFormDialog';
import { OSTimeline } from '@/components/oficinas/OSTimeline';
import { OSConclusaoModal } from '@/components/oficinas/OSConclusaoModal';
import { useState } from 'react';
import {
  STATUS_ORDEM_SERVICO_LABELS,
  STATUS_ORDEM_SERVICO_COLORS,
  TIPO_ITEM_OS_LABELS,
} from '@/types/database';

export default function OrdemServicoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [conclusaoOpen, setConclusaoOpen] = useState(false);

  const { data: os, isLoading } = useOrdemServico(id);
  const { data: itens } = useOSItens(id);
  const { data: historico } = useOSHistorico(id);
  const deleteItem = useDeleteOSItem();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (isLoading) {
    return <div className="flex h-96 items-center justify-center">Carregando...</div>;
  }

  if (!os) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-lg">Ordem de serviço não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/ordens-servico')}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/ordens-servico')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{os.numero}</h1>
            <Badge className={STATUS_ORDEM_SERVICO_COLORS[os.status]}>
              {STATUS_ORDEM_SERVICO_LABELS[os.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Criado em {format(new Date(os.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        {os.status !== 'concluido' && os.status !== 'cancelado' && (
          <Button variant="default" onClick={() => setConclusaoOpen(true)}>
            Concluir OS
          </Button>
        )}
        {(os.status === 'concluido' && ((os as any).autentique_url || !(os as any).termo_saida_assinado)) && (
          <Button variant="default" onClick={() => setConclusaoOpen(true)}>
            Termo de Saída
          </Button>
        )}
        <Button variant="outline" onClick={() => setStatusOpen(true)}>Atualizar Status</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Oficina</p>
                  <p className="font-medium">{os.oficina?.nome_fantasia || os.oficina?.razao_social}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Associado</p>
                  <p className="font-medium">{os.associado?.nome}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Veículo</p>
                  <p className="font-medium">{os.veiculo?.placa}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Itens do Orçamento</CardTitle>
              <Button size="sm" onClick={() => setItemOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </CardHeader>
            <CardContent>
              {itens?.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum item adicionado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">{TIPO_ITEM_OS_LABELS[item.tipo]}</Badge>
                        </TableCell>
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteItem.mutate({ id: item.id, ordem_servico_id: os.id })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Separator className="my-4" />
              <div className="flex justify-end gap-8">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Orçamento</p>
                  <p className="text-2xl font-bold">{formatCurrency(os.valor_orcamento)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observations */}
          {os.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{os.observacoes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Timeline */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OSTimeline historico={historico || []} />
            </CardContent>
          </Card>
        </div>
      </div>

      <OSStatusDialog os={os} open={statusOpen} onOpenChange={setStatusOpen} />
      <OSItemFormDialog osId={os.id} open={itemOpen} onOpenChange={setItemOpen} />
      <OSConclusaoModal os={os} open={conclusaoOpen} onOpenChange={setConclusaoOpen} />
    </div>
  );
}
