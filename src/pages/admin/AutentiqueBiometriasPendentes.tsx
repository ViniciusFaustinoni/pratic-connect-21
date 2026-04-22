import { useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search, ShieldAlert, ShieldQuestion, Loader2, Send } from 'lucide-react';
import { useBiometriasPendentes, type BiometriaPendente } from '@/hooks/useBiometriasPendentes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type StatusFilter = 'todos' | 'biometric_review' | 'biometric_rejected';

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'biometric_review') {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <ShieldQuestion className="mr-1 h-3 w-3" />
        Em revisão
      </Badge>
    );
  }
  if (status === 'biometric_rejected') {
    return (
      <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">
        <ShieldAlert className="mr-1 h-3 w-3" />
        Rejeitada
      </Badge>
    );
  }
  return <Badge variant="outline">{status || '—'}</Badge>;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

function formatCpf(cpf: string | null) {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function AutentiqueBiometriasPendentes() {
  const { data, isLoading, refetch, isFetching } = useBiometriasPendentes();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [search, setSearch] = useState('');
  const [reenviarTarget, setReenviarTarget] = useState<BiometriaPendente | null>(null);
  const [reenviando, setReenviando] = useState(false);

  const filtered = useMemo(() => {
    let list = data?.contratos || [];
    if (statusFilter !== 'todos') {
      list = list.filter((c) => c.autentique_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        (c.cliente_nome || '').toLowerCase().includes(q) ||
        (c.cliente_cpf || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (c.numero || '').toLowerCase().includes(q) ||
        (c.veiculo_placa || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, statusFilter, search]);

  const handleAbrirAutentique = (c: BiometriaPendente) => {
    if (!c.autentique_documento_id) {
      toast({
        title: 'Documento Autentique não encontrado',
        description: 'Este contrato não possui ID do Autentique vinculado.',
        variant: 'destructive',
      });
      return;
    }
    window.open(`https://painel.autentique.com.br/documentos/${c.autentique_documento_id}`, '_blank');
  };

  const handleReenviarSelfie = async () => {
    if (!reenviarTarget) return;
    setReenviando(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('autentique-reenviar-selfie', {
        body: { contratoId: reenviarTarget.id },
      });
      if (error) throw error;
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao reenviar selfie');
      }
      toast({
        title: 'Solicitação enviada',
        description: result.message || 'Cliente recebeu novo link via WhatsApp.',
      });
      setReenviarTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['biometrias-pendentes'] });
      await queryClient.invalidateQueries({ queryKey: ['biometrias-pendentes-count'] });
    } catch (err: any) {
      toast({
        title: 'Erro ao reenviar selfie',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Biometrias Pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Contratos com selfie biométrica aguardando aprovação manual ou reprovados pelo Autentique.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Em revisão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{data?.totalReview ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Aguardando análise manual da Autentique</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Rejeitadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{data?.totalRejected ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Cliente precisa refazer a selfie</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF, contrato ou placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="biometric_review">Em revisão</SelectItem>
              <SelectItem value="biometric_rejected">Rejeitadas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhuma biometria pendente encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.cliente_nome || '—'}</div>
                      <div className="text-xs text-muted-foreground">{formatCpf(c.cliente_cpf)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{c.numero || c.id.slice(0, 8)}</div>
                      {c.biometric_resend_count ? (
                        <div className="text-xs text-muted-foreground">
                          Reenvios: {c.biometric_resend_count}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {[c.veiculo_marca, c.veiculo_modelo].filter(Boolean).join(' ') || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.veiculo_placa || ''}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.autentique_status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(c.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAbrirAutentique(c)}
                          title="Aprovar/reprovar no painel Autentique"
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Autentique
                        </Button>
                        {c.autentique_status === 'biometric_rejected' && (
                          <Button
                            size="sm"
                            onClick={() => setReenviarTarget(c)}
                            title="Solicitar nova selfie ao cliente"
                          >
                            <Send className="mr-1 h-3.5 w-3.5" />
                            Reenviar selfie
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ⓘ A API pública do Autentique não permite aprovar biometrias em revisão diretamente. Para casos
        em revisão, abra o painel do Autentique para concluir a análise — assim que resolvido, o status
        é atualizado automaticamente aqui via webhook.
      </p>

      {/* Diálogo de confirmação de reenvio */}
      <AlertDialog open={!!reenviarTarget} onOpenChange={(open) => !open && setReenviarTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar selfie biométrica?</AlertDialogTitle>
            <AlertDialogDescription>
              Será enviada uma mensagem via WhatsApp para{' '}
              <strong>{reenviarTarget?.cliente_nome}</strong> ({reenviarTarget?.cliente_telefone || 'sem telefone'})
              com o link para refazer a selfie. Limite: 1 reenvio a cada 6 horas por contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reenviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReenviarSelfie} disabled={reenviando}>
              {reenviando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Confirmar envio'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
