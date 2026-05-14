import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Send, Search, Loader2, AlertCircle, Phone, CheckCircle2, Inbox } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATE_NOME = 'cobranca_inadimplencia_pratic';

type Filtros = {
  busca: string;
  match: 'todos' | 'com_match' | 'sem_match';
  tipo: 'todos' | string;
  whatsapp: 'todos' | 'com' | 'sem';
  status: 'todos' | string;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function LoteAtivoCobrancas() {
  const [filtros, setFiltros] = useState<Filtros>({
    busca: '',
    match: 'todos',
    tipo: 'todos',
    whatsapp: 'todos',
    status: 'todos',
  });
  const [confirmAberto, setConfirmAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [resultado, setResultado] = useState<{ sucesso: number; erros: number } | null>(null);

  const { data: lote, isLoading: loadingLote } = useQuery({
    queryKey: ['cobranca-csv-lote-ativo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobranca_csv_lotes')
        .select('id, nome_arquivo, total_boletos, total_associados, valor_total, total_enviados, status, created_at')
        .in('status', ['ativo', 'parcial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: boletos, isLoading: loadingBoletos, refetch } = useQuery({
    queryKey: ['cobranca-csv-boletos', lote?.id],
    enabled: !!lote?.id,
    queryFn: async () => {
      const acc: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('cobranca_csv_boletos')
          .select('id, matricula, nome, placa, vencimento, data_vencimento, linha_digitavel, valor, status, telefones, associado_id, veiculo_id, match_origem, tipo, status_origem, cpf')
          .eq('lote_id', lote!.id)
          .order('nome', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        acc.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return acc;
    },
  });

  const tiposDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (boletos || []).forEach((b) => b.tipo && s.add(b.tipo));
    return Array.from(s).sort();
  }, [boletos]);

  const statusDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (boletos || []).forEach((b) => b.status && s.add(b.status));
    return Array.from(s).sort();
  }, [boletos]);

  const filtrados = useMemo(() => {
    const q = filtros.busca.trim().toLowerCase();
    return (boletos || []).filter((b) => {
      if (filtros.match === 'com_match' && !b.associado_id) return false;
      if (filtros.match === 'sem_match' && b.associado_id) return false;
      if (filtros.tipo !== 'todos' && (b.tipo || '') !== filtros.tipo) return false;
      if (filtros.status !== 'todos' && (b.status || '') !== filtros.status) return false;
      const tels: string[] = Array.isArray(b.telefones) ? b.telefones : [];
      if (filtros.whatsapp === 'com' && tels.length === 0) return false;
      if (filtros.whatsapp === 'sem' && tels.length > 0) return false;
      if (q) {
        const hay = `${b.nome || ''} ${b.matricula || ''} ${b.placa || ''} ${b.cpf || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [boletos, filtros]);

  const kpis = useMemo(() => {
    const total = filtrados.length;
    const valor = filtrados.reduce((s, b) => s + Number(b.valor || 0), 0);
    const comMatch = filtrados.filter((b) => !!b.associado_id).length;
    const semMatch = total - comMatch;
    const comWa = filtrados.filter((b) => Array.isArray(b.telefones) && b.telefones.length > 0).length;
    return { total, valor, comMatch, semMatch, comWa };
  }, [filtrados]);

  const dispararMeta = useCallback(async () => {
    setConfirmAberto(false);
    setResultado(null);

    if (!lote?.id) {
      toast.error('Nenhum lote ativo. Importe um CSV primeiro em "Importar CSV (SGA)".');
      return;
    }

    // Agrupa por matricula para 1 mensagem por associado
    const map = new Map<string, { nome: string; matricula: string; telefones_validos: string[]; boletos: any[] }>();
    for (const b of filtrados) {
      const tels: string[] = Array.isArray(b.telefones) ? b.telefones : [];
      if (tels.length === 0) continue;
      const key = (b.matricula || b.associado_id || b.id).toString();
      const cur = map.get(key) ?? { nome: b.nome || 'Associado', matricula: b.matricula || '', telefones_validos: tels, boletos: [] };
      cur.boletos.push({
        placa: b.placa || '',
        vencimento: b.vencimento || (b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : ''),
        linha_digitavel: b.linha_digitavel || '',
        valor: Number(b.valor || 0),
      });
      map.set(key, cur);
    }
    const destinatarios = Array.from(map.values());
    if (destinatarios.length === 0) {
      toast.error('Nenhum destinatário com WhatsApp nos filtros atuais.');
      return;
    }

    setEnviando(true);
    const CHUNK = 10; // chunks pequenos evitam timeout do edge runtime
    const total = destinatarios.length;
    setProgresso({ atual: 0, total });
    let sucesso = 0;
    let erros = 0;

    for (let i = 0; i < total; i += CHUNK) {
      const slice = destinatarios.slice(i, i + CHUNK);
      const isLast = i + CHUNK >= total;
      let tentativa = 0;
      let chunkOk = false;
      let ultimoErro = '';
      while (tentativa < 2 && !chunkOk) {
        tentativa++;
        try {
          const { data, error } = await supabase.functions.invoke('disparar-cobranca-csv-meta', {
            body: {
              template_nome: TEMPLATE_NOME,
              destinatarios: slice,
              is_first_chunk: false,
              is_last_chunk: isLast,
              lote_id: lote.id,
              nome_arquivo: lote?.nome_arquivo ?? 'lote-ativo',
              skip_reconciliacao: true,
            },
          });
          if (error) throw new Error(error.message);
          if (!data?.success) throw new Error(data?.error || 'Falha no servidor');
          sucesso += data.sucesso || 0;
          erros += data.erros || 0;
          chunkOk = true;
        } catch (e: any) {
          ultimoErro = e?.message || 'erro desconhecido';
          if (tentativa < 2) await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (!chunkOk) {
        erros += slice.reduce((s, d) => s + d.telefones_validos.length, 0);
        toast.error(`Erro no lote ${i / CHUNK + 1}: ${ultimoErro}`);
      }
      setProgresso({ atual: Math.min(i + CHUNK, total), total });
    }

    setEnviando(false);
    setResultado({ sucesso, erros });
    refetch();
    if (erros === 0) toast.success(`Disparo concluído: ${sucesso} mensagens enviadas.`);
    else toast.warning(`Disparo finalizado: ${sucesso} ok, ${erros} erro(s).`);
  }, [filtrados, lote, refetch]);

  if (loadingLote) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  if (!lote) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhum lote ativo</p>
          <p className="text-sm text-muted-foreground mt-1">
            Importe um CSV na aba <strong>Importar CSV</strong> para liberar o disparo em massa.
          </p>
        </CardContent>
      </Card>
    );
  }

  const destComWa = new Set(
    filtrados.filter((b) => Array.isArray(b.telefones) && b.telefones.length > 0).map((b) => b.matricula || b.id),
  ).size;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>Lote ativo: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{lote.nome_arquivo}</code></span>
            <Badge variant="outline" className="text-xs">
              importado em {new Date(lote.created_at).toLocaleString('pt-BR')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label="Boletos no lote" value={lote.total_boletos ?? 0} />
            <Kpi label="Associados" value={lote.total_associados ?? 0} />
            <Kpi label="Valor total" valueText={formatBRL(Number(lote.valor_total || 0))} accent="primary" />
            <Kpi label="Já enviados" value={lote.total_enviados ?? 0} accent="success" />
            <Kpi label="Status" valueText={lote.status} />
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, matrícula, placa, CPF..."
              value={filtros.busca}
              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
              className="pl-9"
            />
          </div>
          <FilterSelect
            label="Vínculo"
            value={filtros.match}
            onChange={(v) => setFiltros((f) => ({ ...f, match: v as any }))}
            options={[
              { value: 'todos', label: 'Todos vínculos' },
              { value: 'com_match', label: 'Com match' },
              { value: 'sem_match', label: 'Sem match' },
            ]}
          />
          <FilterSelect
            label="Tipo"
            value={filtros.tipo}
            onChange={(v) => setFiltros((f) => ({ ...f, tipo: v }))}
            options={[
              { value: 'todos', label: 'Todos tipos' },
              ...tiposDisponiveis.map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            label="WhatsApp"
            value={filtros.whatsapp}
            onChange={(v) => setFiltros((f) => ({ ...f, whatsapp: v as any }))}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'com', label: 'Com WhatsApp' },
              { value: 'sem', label: 'Sem WhatsApp' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={filtros.status}
            onChange={(v) => setFiltros((f) => ({ ...f, status: v }))}
            options={[
              { value: 'todos', label: 'Todos status' },
              ...statusDisponiveis.map((s) => ({ value: s, label: s })),
            ]}
          />
        </CardContent>
      </Card>

      {/* KPIs do filtro + ação */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Filtrados" value={kpis.total} />
        <Kpi label="Com match" value={kpis.comMatch} accent="success" />
        <Kpi label="Sem match" value={kpis.semMatch} accent="warning" />
        <Kpi label="Com WhatsApp" value={kpis.comWa} accent="primary" />
        <Kpi label="Associados c/ WA" value={destComWa} accent="primary" />
        <Kpi label="Valor filtrado" valueText={formatBRL(kpis.valor)} accent="primary" />
      </div>

      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Disparar via Meta
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Opera apenas sobre os boletos já salvos do lote ativo, respeitando os filtros acima.
              Template Meta: <code className="text-xs bg-muted px-1 py-0.5 rounded">{TEMPLATE_NOME}</code>
            </p>
          </div>
          <Button
            size="lg"
            disabled={enviando || destComWa === 0}
            onClick={() => setConfirmAberto(true)}
            className="gap-2"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Disparar para {destComWa} associado(s)
          </Button>
        </CardContent>
      </Card>

      {enviando && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-sm flex items-center justify-between">
              <span>Enviando...</span>
              <span className="text-muted-foreground">{progresso.atual} / {progresso.total} associados</span>
            </div>
            <Progress value={progresso.total > 0 ? (progresso.atual / progresso.total) * 100 : 0} />
          </CardContent>
        </Card>
      )}

      {resultado && !enviando && (
        <Alert className={resultado.erros === 0 ? 'border-green-600/40 bg-green-600/5' : ''}>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Disparo concluído: <strong>{resultado.sucesso}</strong> mensagens enviadas
            {resultado.erros > 0 && <> · <strong className="text-destructive">{resultado.erros}</strong> com erro</>}.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {loadingBoletos ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                      Nenhum boleto corresponde aos filtros.
                    </TableCell></TableRow>
                  ) : (
                    filtrados.slice(0, 500).map((b) => {
                      const tels: string[] = Array.isArray(b.telefones) ? b.telefones : [];
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.nome || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{b.matricula || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{b.placa || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{b.tipo || '—'}</Badge></TableCell>
                          <TableCell>
                            {b.associado_id ? (
                              <Badge className="bg-emerald-600 text-xs">{b.match_origem || 'match'}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-600/40 text-xs">sem match</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {tels.length > 0 ? (
                              <Badge className="bg-green-600 gap-1 text-xs"><Phone className="h-3 w-3" /> {tels.length}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatBRL(Number(b.valor || 0))}</TableCell>
                          <TableCell className="text-xs">{b.vencimento || (b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : '—')}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{b.status || '—'}</Badge></TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {filtrados.length > 500 && (
                <div className="p-3 text-xs text-center text-muted-foreground border-t">
                  Mostrando 500 de {filtrados.length}. O disparo processa todos os filtrados.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmAberto} onOpenChange={setConfirmAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar disparo via Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Serão disparadas mensagens para <strong>{destComWa} associado(s)</strong> com WhatsApp,
              referentes a <strong>{kpis.total} boleto(s)</strong> filtrado(s) do lote ativo.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={dispararMeta}>Confirmar e disparar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, valueText, accent }: { label: string; value?: number; valueText?: string; accent?: 'success' | 'warning' | 'primary' }) {
  const color =
    accent === 'success' ? 'text-green-600' :
    accent === 'warning' ? 'text-amber-600' :
    accent === 'primary' ? 'text-primary' : '';
  const display = valueText ?? (typeof value === 'number' ? value.toLocaleString('pt-BR') : '0');
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{display}</p>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
