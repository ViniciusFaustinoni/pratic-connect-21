import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ExternalLink, Copy, Check, AlertCircle, FileText,
  CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  veiculoId: string;
}

const formatCurrency = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—';

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pago: { label: 'Pago', className: 'bg-green-500/15 text-green-700 border-green-500/30', icon: CheckCircle2 },
  aguardando_pagamento: { label: 'Em aberto', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30', icon: Clock },
  vencido: { label: 'Vencido', className: 'bg-red-500/15 text-red-700 border-red-500/30', icon: AlertCircle },
  cancelado: { label: 'Cancelado', className: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

export function VeiculoFinanceiroSGA({ veiculoId }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Veículo (para situação SGA + totais)
  const { data: veiculo } = useQuery({
    queryKey: ['veiculo-sga-info', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, codigo_hinova, situacao_financeira_sga, situacao_financeira_sga_em, total_aberto_sga, total_vencido_sga')
        .eq('id', veiculoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!veiculoId,
  });

  // Cobranças importadas do SGA
  const { data: cobrancas, isLoading } = useQuery({
    queryKey: ['veiculo-cobrancas-sga', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('id, nosso_numero, status, valor, valor_final, multa, juros, data_emissao, data_vencimento, data_pagamento, linha_digitavel, boleto_url, tipo_boleto_hinova, referencia_mes, referencia_ano, sincronizado_sga_em')
        .eq('veiculo_id', veiculoId)
        .eq('origem', 'sga_hinova')
        .order('data_vencimento', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!veiculoId,
  });

  const filtradas = useMemo(() => {
    if (!cobrancas) return [];
    if (filtroStatus === 'todos') return cobrancas;
    return cobrancas.filter((c) => c.status === filtroStatus);
  }, [cobrancas, filtroStatus]);

  const totais = useMemo(() => {
    if (!cobrancas) return { aberto: 0, vencido: 0, pago: 0, qtdAberto: 0, qtdVencido: 0, qtdPago: 0 };
    let aberto = 0, vencido = 0, pago = 0, qtdAberto = 0, qtdVencido = 0, qtdPago = 0;
    for (const c of cobrancas) {
      const valor = Number(c.valor_final) || Number(c.valor) || 0;
      if (c.status === 'aguardando_pagamento') { aberto += valor; qtdAberto++; }
      else if (c.status === 'vencido') { vencido += valor; qtdVencido++; }
      else if (c.status === 'pago') { pago += valor; qtdPago++; }
    }
    return { aberto, vencido, pago, qtdAberto, qtdVencido, qtdPago };
  }, [cobrancas]);

  const copiarLinha = async (id: string, linha: string) => {
    try {
      await navigator.clipboard.writeText(linha);
      setCopiedId(id);
      toast.success('Linha digitável copiada');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  if (!veiculo?.codigo_hinova) {
    return (
      <div className="p-6 m-0 space-y-4">
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-medium">Veículo não mapeado no SGA</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Este veículo ainda não possui <code className="text-xs">codigo_hinova</code> vinculado.
              Para sincronizar, acesse <strong>Cobranças › Sincronizar Financeiro</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 m-0 space-y-5">
      {/* Header com situação (somente leitura) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Situação financeira SGA</h3>
            {veiculo.situacao_financeira_sga === 'ADIMPLENTE' && (
              <Badge variant="outline" className="bg-green-500/15 text-green-700 border-green-500/30">ADIMPLENTE</Badge>
            )}
            {veiculo.situacao_financeira_sga === 'INADIMPLENTE' && (
              <Badge variant="outline" className="bg-red-500/15 text-red-700 border-red-500/30">INADIMPLENTE</Badge>
            )}
            {!veiculo.situacao_financeira_sga && (
              <Badge variant="outline" className="text-muted-foreground">Não sincronizado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Última sincronização: {veiculo.situacao_financeira_sga_em
              ? new Date(veiculo.situacao_financeira_sga_em).toLocaleString('pt-BR')
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground italic">
            Para sincronizar, acesse <strong>Cobranças › Sincronizar Financeiro</strong>.
          </p>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-4">
          <p className="text-xs text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totais.aberto)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totais.qtdAberto} boleto(s)</p>
        </div>
        <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-4">
          <p className="text-xs text-muted-foreground">Vencido</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totais.vencido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totais.qtdVencido} boleto(s)</p>
        </div>
        <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-4">
          <p className="text-xs text-muted-foreground">Pago (histórico)</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totais.pago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totais.qtdPago} boleto(s)</p>
        </div>
      </div>

      <Separator />

      {/* Filtro */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium text-sm">Boletos ({filtradas.length})</h4>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aguardando_pagamento">Em aberto</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {cobrancas?.length === 0
              ? 'Nenhum boleto sincronizado. Acesse Cobranças › Sincronizar Financeiro.'
              : 'Nenhum boleto neste filtro.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Multa/Juros</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((c) => {
                const cfg = statusConfig[c.status] || { label: c.status, className: '', icon: FileText };
                const Icon = cfg.icon;
                const ref = c.referencia_mes && c.referencia_ano
                  ? `${String(c.referencia_mes).padStart(2, '0')}/${c.referencia_ano}`
                  : c.tipo_boleto_hinova || '—';
                const valor = Number(c.valor) || 0;
                const valorFinal = Number(c.valor_final) || valor;
                const acrescimos = (Number(c.multa) || 0) + (Number(c.juros) || 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="outline" className={cn('gap-1', cfg.className)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ref}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.data_vencimento)}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.data_pagamento)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(valor)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {acrescimos > 0 ? formatCurrency(acrescimos) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatCurrency(valorFinal)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.linha_digitavel && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => copiarLinha(c.id, c.linha_digitavel!)}
                            title="Copiar linha digitável"
                          >
                            {copiedId === c.id ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {c.boleto_url && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            asChild
                            title="Abrir 2ª via"
                          >
                            <a href={c.boleto_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
