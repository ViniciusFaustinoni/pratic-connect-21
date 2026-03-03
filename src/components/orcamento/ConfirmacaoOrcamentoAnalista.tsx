import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, Loader2, ShieldCheck, Building2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  useOrcamentoItens,
  useConfirmarItem,
  useConfirmarOrcamentoAnalista,
  type OrcamentoItem,
  type OrcamentoReparo,
} from '@/hooks/useOrcamentoReparo';

interface Props {
  orcamento: OrcamentoReparo;
  sinistroId: string;
}

export function ConfirmacaoOrcamentoAnalista({ orcamento, sinistroId }: Props) {
  const { data: itens = [] } = useOrcamentoItens(orcamento.id);
  const confirmarItem = useConfirmarItem();
  const confirmarOrcamento = useConfirmarOrcamentoAnalista();

  const { data: autoCenters = [] } = useQuery({
    queryKey: ['auto-centers-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_centers')
        .select('id, nome, cidade, estado')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState('');
  const [editAutoCenter, setEditAutoCenter] = useState('');

  const itensAtivos = itens.filter(i => i.status !== 'cancelado');
  const itensConfirmados = itensAtivos.filter(i => i.confirmado_em);
  const todoConfirmado = itensAtivos.length > 0 && itensConfirmados.length === itensAtivos.length;
  const isConfirmado = (orcamento as any).confirmado_analista === true;

  const startEditing = (item: OrcamentoItem) => {
    setEditingId(item.id);
    setEditValor((item.valor_confirmado ?? item.valor_unitario).toString());
    setEditAutoCenter((item as any).auto_center_id || '');
  };

  const handleConfirmarItem = async (item: OrcamentoItem) => {
    const valor = parseFloat(editValor);
    if (isNaN(valor) || valor < 0) {
      toast.error('Valor inválido');
      return;
    }

    try {
      await confirmarItem.mutateAsync({
        item,
        valorConfirmado: valor,
        autoCenterId: item.tipo === 'peca' ? (editAutoCenter || null) : undefined,
        motivo: valor !== item.valor_unitario
          ? `Valor alterado de R$ ${item.valor_unitario.toFixed(2)} para R$ ${valor.toFixed(2)}`
          : undefined,
      });
      toast.success(`${item.descricao} confirmado!`);
      setEditingId(null);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleConfirmarTodos = async () => {
    try {
      await confirmarOrcamento.mutateAsync({
        orcamentoId: orcamento.id,
        sinistroId,
      });
      toast.success('Orçamento confirmado pelo analista!');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  if (isConfirmado) {
    return (
      <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          Orçamento confirmado pelo analista em {new Date((orcamento as any).confirmado_analista_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            Confirmação do Analista
          </div>
          <Badge variant="outline" className="text-xs">
            {itensConfirmados.length}/{itensAtivos.length} confirmados
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Revise e confirme cada item do orçamento. Você pode alterar valores e atribuir auto centers às peças.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {itensAtivos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aguardando orçamento do regulador...
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor Unit.</TableHead>
                <TableHead className="text-right">Confirmado</TableHead>
                <TableHead>Auto Center</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensAtivos.map((item) => {
                const isEditing = editingId === item.id;
                const jaConfirmado = !!item.confirmado_em;
                const valorDifere = item.valor_confirmado !== null && item.valor_confirmado !== item.valor_unitario;

                return (
                  <TableRow key={item.id} className={jaConfirmado ? 'bg-green-50/50 dark:bg-green-950/10' : ''}>
                    <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {item.tipo === 'peca' ? '🔧 Peça' : '🛠️ Serviço'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.quantidade}</TableCell>
                    <TableCell className="text-right text-sm">
                      R$ {item.valor_unitario.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          className="w-28 h-8 text-right text-sm"
                        />
                      ) : (
                        <span className={`text-sm ${valorDifere ? 'text-amber-600 font-semibold' : ''}`}>
                          {item.valor_confirmado !== null
                            ? `R$ ${item.valor_confirmado.toFixed(2)}`
                            : '-'}
                          {valorDifere && (
                            <span className="text-[10px] block text-muted-foreground">
                              (orig: R$ {item.valor_unitario.toFixed(2)})
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.tipo === 'peca' ? (
                        isEditing ? (
                          <Select value={editAutoCenter} onValueChange={setEditAutoCenter}>
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {autoCenters.map((ac) => (
                                <SelectItem key={ac.id} value={ac.id}>
                                  {ac.nome} {ac.cidade ? `- ${ac.cidade}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          (item as any).auto_center_id ? (
                            <span className="text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {autoCenters.find(ac => ac.id === (item as any).auto_center_id)?.nome || 'Auto Center'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {jaConfirmado ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">
                          <CheckCircle className="h-3 w-3 mr-0.5" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-600">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleConfirmarItem(item)}
                            disabled={confirmarItem.isPending}
                          >
                            {confirmarItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-0.5" />}
                            OK
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant={jaConfirmado ? 'ghost' : 'outline'}
                          className="h-7 text-xs"
                          onClick={() => startEditing(item)}
                        >
                          <Pencil className="h-3 w-3 mr-0.5" />
                          {jaConfirmado ? 'Editar' : 'Confirmar'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Totais */}
        {itensAtivos.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-between items-center">
              <div className="text-sm space-y-1">
                <div className="text-muted-foreground">
                  Total original: <strong>R$ {itensAtivos.reduce((s, i) => s + (i.valor_total || 0), 0).toFixed(2)}</strong>
                </div>
                {itensConfirmados.length > 0 && (
                  <div>
                    Total confirmado: <strong className="text-primary">
                      R$ {itensAtivos.reduce((s, i) => s + ((i.valor_confirmado ?? i.valor_unitario) * i.quantidade), 0).toFixed(2)}
                    </strong>
                  </div>
                )}
              </div>

              {todoConfirmado && (
                <Button onClick={handleConfirmarTodos} disabled={confirmarOrcamento.isPending}>
                  {confirmarOrcamento.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Confirmar Orçamento Completo
                </Button>
              )}
            </div>

            {!todoConfirmado && itensAtivos.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Confirme todos os itens individualmente para liberar a confirmação geral do orçamento.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
