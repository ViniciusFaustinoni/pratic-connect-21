import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Download, RefreshCw, AlertCircle, CheckCircle2, Clock, Search, Plus, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';

type CobrancaStatus = 'pendente' | 'emitido' | 'erro';

interface CobrancaLocal {
  id: string;
  associado_nome: string;
  placa: string;
  cotas: number;
  valor_rateio: number;
  taxa_admin: number;
  adicionais: number;
  total: number;
  status: CobrancaStatus;
  erro_msg?: string;
  asaas_id: string;
  boleto_url?: string | null;
  data_vencimento: string;
}

function getCobrancaStatus(c: any): CobrancaStatus {
  if (c.asaas_id?.startsWith('LOCAL-')) return 'pendente';
  if (c.boleto_url || (c.asaas_id && !c.asaas_id.startsWith('LOCAL-'))) return 'emitido';
  return 'pendente';
}

function mapCobranca(c: any): CobrancaLocal {
  const comp = c.composicao_resumo as any;
  const veiculos = comp?.veiculos || [];
  const placa = veiculos.map((v: any) => v.placa).join(', ') || c.veiculo?.placa || '—';
  const cotas = veiculos.reduce((sum: number, v: any) => sum + (v.cotas || 0), 0);

  return {
    id: c.id,
    associado_nome: c.associado?.nome || '—',
    placa,
    cotas,
    valor_rateio: comp?.rateio_total || 0,
    taxa_admin: comp?.taxa_administrativa_total || 0,
    adicionais: 0,
    total: c.valor || 0,
    status: getCobrancaStatus(c),
    asaas_id: c.asaas_id,
    boleto_url: c.boleto_url,
    data_vencimento: c.data_vencimento,
  };
}

export default function EmissaoCobrancas() {
  const queryClient = useQueryClient();
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, emitidos: 0, erros: 0 });
  const [errosMap, setErrosMap] = useState<Record<string, string>>({});
  const [modalCobranca, setModalCobranca] = useState(false);

  // Buscar fechamento mais recente aprovado/processado
  const { data: fechamento, isLoading: loadingFechamento } = useQuery({
    queryKey: ['fechamento-emissao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fechamentos_mensais')
        .select('*')
        .in('status', ['aprovado', 'processado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar cobranças do fechamento
  const { data: cobrancasRaw, isLoading: loadingCobrancas } = useQuery({
    queryKey: ['cobrancas-emissao', fechamento?.id],
    queryFn: async () => {
      if (!fechamento?.id) return [];
      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select('*, associado:associados(nome), veiculo:veiculos(placa)')
        .eq('fechamento_id', fechamento.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!fechamento?.id,
  });

  const cobrancas: CobrancaLocal[] = (cobrancasRaw || []).map(mapCobranca).map(c => ({
    ...c,
    status: errosMap[c.id] ? 'erro' as CobrancaStatus : c.status,
    erro_msg: errosMap[c.id],
  }));

  // Estatísticas
  const totalFaturas = cobrancas.length;
  const emitidas = cobrancas.filter(c => c.status === 'emitido').length;
  const pendentes = cobrancas.filter(c => c.status === 'pendente').length;
  const comErro = cobrancas.filter(c => c.status === 'erro').length;

  const statusGeral = processando
    ? 'Em processamento'
    : pendentes === 0 && totalFaturas > 0
      ? 'Concluído'
      : 'Aguardando emissão';

  // Filtros
  const cobrancasFiltradas = cobrancas.filter(c => {
    const matchNome = !filtroNome || 
      c.associado_nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
      c.placa.toLowerCase().includes(filtroNome.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
    return matchNome && matchStatus;
  });

  // Emissão individual
  const emitirBoleto = useCallback(async (cobrancaId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('emitir-boleto-individual', {
        body: { cobranca_id: cobrancaId },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

      if (data.ja_emitido) {
        return true;
      }

      // Limpar erro se existia
      setErrosMap(prev => {
        const next = { ...prev };
        delete next[cobrancaId];
        return next;
      });

      return true;
    } catch (err: any) {
      setErrosMap(prev => ({ ...prev, [cobrancaId]: err.message }));
      return false;
    }
  }, []);

  // Emissão em lote
  const emitirTodos = useCallback(async (apenasErros = false) => {
    const pendentesIds = cobrancas
      .filter(c => apenasErros ? c.status === 'erro' : (c.status === 'pendente' || c.status === 'erro'))
      .map(c => c.id);

    if (pendentesIds.length === 0) {
      toast.info('Nenhum boleto pendente para emitir');
      return;
    }

    setProcessando(true);
    setProgresso({ atual: 0, total: pendentesIds.length, emitidos: 0, erros: 0 });

    let emitidos = 0;
    let erros = 0;

    for (let i = 0; i < pendentesIds.length; i++) {
      setProgresso(prev => ({ ...prev, atual: i + 1 }));
      const ok = await emitirBoleto(pendentesIds[i]);
      if (ok) emitidos++;
      else erros++;
      setProgresso(prev => ({ ...prev, emitidos, erros }));

      // Refetch a cada 10 para atualizar a UI
      if ((i + 1) % 10 === 0) {
        await queryClient.invalidateQueries({ queryKey: ['cobrancas-emissao'] });
      }

      // Delay entre chamadas
      if (i < pendentesIds.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['cobrancas-emissao'] });
    setProcessando(false);

    if (erros === 0) {
      toast.success(`Emissão concluída! ${emitidos} boletos emitidos com sucesso.`);
    } else {
      toast.warning(`Emissão finalizada: ${emitidos} emitidos, ${erros} com erro.`);
    }
  }, [cobrancas, emitirBoleto, queryClient]);

  // Exportar CSV
  const exportarCSV = useCallback(() => {
    const headers = ['Nome', 'Placa', 'Valor', 'Vencimento', 'Status', 'Link Boleto'];
    const rows = cobrancas.map(c => [
      c.associado_nome,
      c.placa,
      c.total.toFixed(2),
      c.data_vencimento,
      c.status === 'emitido' ? 'Emitido' : c.status === 'erro' ? 'Erro' : 'Pendente',
      c.boleto_url || '',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emissao-${fechamento?.mes}-${fechamento?.ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cobrancas, fechamento]);

  const isLoading = loadingFechamento || loadingCobrancas;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Emissão de Cobranças</h1>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!fechamento) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Emissão de Cobranças</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum fechamento aprovado</p>
            <p className="text-muted-foreground mt-1">É necessário aprovar um fechamento mensal antes de emitir cobranças.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesRef = `${meses[fechamento.mes]} ${fechamento.ano}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Emissão de Cobranças</h1>
          <p className="text-muted-foreground">Referência: {mesRef}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalCobranca(true)}>
            <Plus className="h-4 w-4 mr-1" /> Cobrança Avulsa
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={cobrancas.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </div>
      </div>

      {/* Painel de Status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total Faturas</p>
            <p className="text-2xl font-bold">{totalFaturas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Emitidas</p>
            <p className="text-2xl font-bold text-green-600">{emitidas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">{pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Com Erro</p>
            <p className="text-2xl font-bold text-destructive">{comErro}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusGeral === 'Concluído' ? 'default' : statusGeral === 'Em processamento' ? 'secondary' : 'outline'} className="mt-1">
              {statusGeral}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Progresso */}
      {processando && (
        <Card>
          <CardContent className="pt-4 pb-3 px-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Emitindo boleto {progresso.atual} de {progresso.total}...</span>
              <span className="text-muted-foreground">{progresso.emitidos} ok · {progresso.erros} erros</span>
            </div>
            <Progress value={progresso.total > 0 ? (progresso.atual / progresso.total) * 100 : 0} />
          </CardContent>
        </Card>
      )}

      {/* Resultado final */}
      {!processando && progresso.total > 0 && progresso.atual === progresso.total && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">
                Emissão concluída! {progresso.emitidos} emitidos{progresso.erros > 0 ? `, ${progresso.erros} com erro` : ''}.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações + Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => emitirTodos(false)} disabled={processando || pendentes === 0}>
          <Send className="h-4 w-4 mr-1" /> Emitir Todos os Boletos ({pendentes})
        </Button>
        {comErro > 0 && (
          <Button variant="destructive" onClick={() => emitirTodos(true)} disabled={processando}>
            <RefreshCw className="h-4 w-4 mr-1" /> Reemitir com Erro ({comErro})
          </Button>
        )}

        <div className="flex-1" />

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou placa..."
            value={filtroNome}
            onChange={e => setFiltroNome(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="emitido">Emitidos</SelectItem>
            <SelectItem value="erro">Com Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associado</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="text-right">Cotas</TableHead>
                <TableHead className="text-right">Rateio</TableHead>
                <TableHead className="text-right">Taxa Admin</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma fatura encontrada
                  </TableCell>
                </TableRow>
              ) : (
                cobrancasFiltradas.map(c => (
                  <TableRow key={c.id} className={c.status === 'erro' ? 'bg-destructive/5' : undefined}>
                    <TableCell className="font-medium">{c.associado_nome}</TableCell>
                    <TableCell className="font-mono text-xs">{c.placa}</TableCell>
                    <TableCell className="text-right">{c.cotas}</TableCell>
                    <TableCell className="text-right">R$ {c.valor_rateio.toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {c.taxa_admin.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">R$ {c.total.toFixed(2)}</TableCell>
                    <TableCell>
                      {c.status === 'emitido' && (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Emitido
                        </Badge>
                      )}
                      {c.status === 'pendente' && (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                      {c.status === 'erro' && (
                        <div className="space-y-1">
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" /> Erro
                          </Badge>
                          {c.erro_msg && (
                            <p className="text-xs text-destructive max-w-[200px] truncate" title={c.erro_msg}>
                              {c.erro_msg}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'erro' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => emitirBoleto(c.id).then(() => queryClient.invalidateQueries({ queryKey: ['cobrancas-emissao'] }))}
                            disabled={processando}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                        {c.boleto_url && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={c.boleto_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
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

      <NovaCobrancaModal open={modalCobranca} onClose={() => setModalCobranca(false)} />
    </div>
  );
}
