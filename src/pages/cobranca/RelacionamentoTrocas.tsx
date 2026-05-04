import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, RefreshCw, Search, Phone, FileText } from 'lucide-react';
import { formatarMoeda } from '@/utils/format';

type Status = 'aberto' | 'em_negociacao' | 'resolvido' | 'cancelado';

interface DebitoRow {
  id: string;
  cpf: string;
  nome: string | null;
  valor_total: number;
  quantidade_boletos: number;
  status: Status;
  observacao: string | null;
  detalhe_boletos: any;
  resolvido_em: string | null;
  created_at: string;
  solicitacao_troca_id: string | null;
}

const STATUS_CFG: Record<Status, { label: string; cls: string }> = {
  aberto: { label: 'Em aberto', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  em_negociacao: { label: 'Em negociação', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  resolvido: { label: 'Resolvido', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};

export default function RelacionamentoTrocas() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | 'todos'>('aberto');
  const [busca, setBusca] = useState('');
  const [editing, setEditing] = useState<DebitoRow | null>(null);
  const [obs, setObs] = useState('');
  const [novoStatus, setNovoStatus] = useState<Status>('em_negociacao');
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['relacionamento-debitos', tab],
    queryFn: async () => {
      let q = (supabase as any)
        .from('relacionamento_debitos_pendentes')
        .select('*')
        .order('created_at', { ascending: false });
      if (tab !== 'todos') q = q.eq('status', tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DebitoRow[];
    },
    refetchInterval: 30000,
  });

  const filtrados = useMemo(() => {
    if (!busca) return data || [];
    const t = busca.toLowerCase();
    return (data || []).filter((d) =>
      [d.nome, d.cpf].some((v) => (v || '').toLowerCase().includes(t)),
    );
  }, [data, busca]);

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const patch: any = {
        status: novoStatus,
        observacao: obs || null,
      };
      if (novoStatus === 'resolvido') patch.resolvido_em = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('relacionamento_debitos_pendentes')
        .update(patch)
        .eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Atualizado');
      qc.invalidateQueries({ queryKey: ['relacionamento-debitos'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Falha ao salvar'),
  });

  const handleRecheckSGA = async (row: DebitoRow) => {
    setRecheckingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke('cron-recheck-debitos-troca', {
        body: { only_id: row.id },
      });
      if (error) throw error;
      toast.success('Re-verificado no SGA');
      qc.invalidateQueries({ queryKey: ['relacionamento-debitos'] });
    } catch (e: any) {
      toast.error(e.message || 'Falha na verificação SGA');
    } finally {
      setRecheckingId(null);
    }
  };

  const counts = useMemo(() => {
    const base = { aberto: 0, em_negociacao: 0, resolvido: 0, cancelado: 0 } as Record<Status, number>;
    (data || []).forEach((d) => {
      base[d.status] = (base[d.status] || 0) + 1;
    });
    return base;
  }, [data]);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relacionamento — Débitos Pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Fila de associados em troca de titularidade com saldo devedor no SGA.
          </p>
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['relacionamento-debitos'] })}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="aberto">
                  Em aberto {counts.aberto > 0 && <Badge className="ml-1.5">{counts.aberto}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="em_negociacao">Em negociação</TabsTrigger>
                <TabsTrigger value="resolvido">Resolvidos</TabsTrigger>
                <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou CPF"
                className="pl-9 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Nenhum débito nesta fila.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Associado antigo</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-right">Saldo devedor</TableHead>
                  <TableHead className="text-right">Boletos</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((d) => {
                  const cfg = STATUS_CFG[d.status];
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Badge className={`${cfg.cls} border-0`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{d.nome || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.cpf}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatarMoeda(Number(d.valor_total || 0))}
                      </TableCell>
                      <TableCell className="text-right">{d.quantidade_boletos}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRecheckSGA(d)}
                            disabled={recheckingId === d.id}
                          >
                            <RefreshCw className={`h-3 w-3 ${recheckingId === d.id ? 'animate-spin' : ''}`} />
                            Re-checar SGA
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditing(d);
                              setObs(d.observacao || '');
                              setNovoStatus(d.status === 'aberto' ? 'em_negociacao' : d.status);
                            }}
                          >
                            <FileText className="h-3 w-3" /> Tratar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tratar débito · {editing?.nome}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">CPF</p>
                  <p className="font-mono">{editing.cpf}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Saldo</p>
                  <p className="font-semibold">{formatarMoeda(Number(editing.valor_total))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Boletos</p>
                  <p>{editing.quantidade_boletos}</p>
                </div>
              </div>

              {Array.isArray(editing.detalhe_boletos) && editing.detalhe_boletos.length > 0 && (
                <div className="rounded-md border p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                  {editing.detalhe_boletos.map((b: any, i: number) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Venc. {b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <span className="font-mono">{formatarMoeda(Number(b.valor || 0))}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Novo status</label>
                <select
                  className="w-full border rounded-md h-9 px-2 text-sm bg-background mt-1"
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value as Status)}
                >
                  <option value="em_negociacao">Em negociação</option>
                  <option value="resolvido">Resolvido (quitado)</option>
                  <option value="cancelado">Cancelar acompanhamento</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Observação interna</label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={3}
                  placeholder="Registre o contato, acordo, etc."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
