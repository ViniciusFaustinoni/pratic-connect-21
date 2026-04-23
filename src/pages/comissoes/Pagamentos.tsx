import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, PlayCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useComissoesDashboard } from '@/hooks/useComissoesDashboard';
import { useComissoesBackfill } from '@/hooks/useComissoesBackfill';
import { ComissaoDetalhesPagamentoModal } from '@/components/comissoes/ComissaoDetalhesPagamentoModal';
import { toast } from 'sonner';

const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export default function PagamentosComissoes() {
  const queryClient = useQueryClient();
  const { items, isLoading } = useComissoesDashboard();
  const { executar, loading: backfillLoading, resultado } = useComissoesBackfill();
  const [status, setStatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [comissaoEmConferencia, setComissaoEmConferencia] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = status === 'todos' || item.status === status;
      const matchSearch = !search || item.usuario_nome.toLowerCase().includes(search.toLowerCase()) || (item.nivel_nome || '').toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [items, search, status]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
      const payload: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };
      if (nextStatus === 'paga') payload.pago_em = new Date().toISOString();
      const { error } = await (supabase as any).from('comissoes').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-comissoes'] });
      toast.success('Comissão atualizada');
      setComissaoEmConferencia(null);
    },
    onError: () => toast.error('Não foi possível atualizar a comissão'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagamentos de Comissões</h1>
          <p className="text-sm text-muted-foreground">Aprove, liquide e reprocesse lançamentos gerados pelo motor de comissões.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={backfillLoading} onClick={() => executar({ dry_run: true })}>
            <PlayCircle className="h-4 w-4 mr-2" /> Simular backfill
          </Button>
          <Button disabled={backfillLoading} onClick={() => executar({ dry_run: false })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Executar backfill
          </Button>
        </div>
      </div>

      {resultado && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            {resultado.dry_run ? 'Simulação' : 'Backfill'}: {resultado.total_cobrancas} cobrança(s), {resultado.total_comissoes_geradas} comissão(ões) gerada(s), {resultado.erros.length} erro(s).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lançamentos do mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por usuário ou nível" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="contestada">Contestada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow>
                ) : filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.usuario_nome}</div>
                      {item.usuario_email && <div className="text-xs text-muted-foreground">{item.usuario_email}</div>}
                    </TableCell>
                    <TableCell>{item.nivel_nome || '—'}</TableCell>
                    <TableCell>{item.parcela_numero ? `${item.parcela_numero}ª` : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                    <TableCell className="text-right">{formatMoney(item.valor_base)}</TableCell>
                    <TableCell className="text-right">{Number(item.percentual_aplicado || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(item.valor_total ?? item.valor_comissao)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {item.status === 'pendente' && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: item.id, nextStatus: 'aprovada' })}>Aprovar</Button>
                        )}
                        {item.status !== 'paga' && (
                          <Button size="sm" onClick={() => setComissaoEmConferencia(item.id)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Pagar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ComissaoDetalhesPagamentoModal
        open={Boolean(comissaoEmConferencia)}
        comissaoId={comissaoEmConferencia}
        onOpenChange={(open) => !open && setComissaoEmConferencia(null)}
        allowConfirm
        confirming={updateStatus.isPending}
        onConfirmPayment={(id) => updateStatus.mutate({ id, nextStatus: 'paga' })}
      />
    </div>
  );
}
