import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, FileSpreadsheet, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Recuperado {
  id: string;
  matricula: string;
  nome: string;
  placa: string | null;
  vencimento: string;
  linha_digitavel: string;
  valor: number;
  recuperado_em: string;
  lote_id: string;
  recuperado_no_lote_id: string | null;
  motivo_recuperacao: string | null;
}

interface Lote {
  id: string;
  nome_arquivo: string;
  total_boletos: number;
  total_associados: number;
  valor_total: number;
  total_enviados: number;
  status: string;
  created_at: string;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
}

function getDefaultPeriodo() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodoToRange(periodo: string): { inicio: string; fim: string } {
  // periodo: 'YYYY-MM' ou 'todos'
  if (periodo === 'todos') return { inicio: '1970-01-01T00:00:00Z', fim: '2999-12-31T23:59:59Z' };
  const [y, m] = periodo.split('-').map((n) => parseInt(n, 10));
  const inicio = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
  const fim = new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
  return { inicio, fim };
}

function gerarOpcoesPeriodo(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [{ value: 'todos', label: 'Todos os períodos' }];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    out.push({ value: v, label: lbl.charAt(0).toUpperCase() + lbl.slice(1) });
  }
  return out;
}

export default function RecuperadosPage() {
  const [periodo, setPeriodo] = useState<string>(getDefaultPeriodo());
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [recuperados, setRecuperados] = useState<Recuperado[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);

  useEffect(() => {
    let cancel = false;
    async function carregar() {
      setLoading(true);
      const { inicio, fim } = periodoToRange(periodo);

      const [{ data: rec, error: e1 }, { data: lts, error: e2 }] = await Promise.all([
        supabase
          .from('cobranca_csv_boletos')
          .select('id, matricula, nome, placa, vencimento, linha_digitavel, valor, recuperado_em, lote_id, recuperado_no_lote_id')
          .eq('status', 'recuperado')
          .gte('recuperado_em', inicio)
          .lt('recuperado_em', fim)
          .order('recuperado_em', { ascending: false })
          .limit(2000),
        supabase
          .from('cobranca_csv_lotes')
          .select('id, nome_arquivo, total_boletos, total_associados, valor_total, total_enviados, status, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (cancel) return;
      if (e1) toast.error(`Erro ao carregar recuperados: ${e1.message}`);
      if (e2) toast.error(`Erro ao carregar lotes: ${e2.message}`);
      setRecuperados((rec as Recuperado[]) || []);
      setLotes((lts as Lote[]) || []);
      setLoading(false);
    }
    carregar();
    return () => {
      cancel = true;
    };
  }, [periodo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return recuperados;
    return recuperados.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.matricula.toLowerCase().includes(q) ||
        (r.placa || '').toLowerCase().includes(q),
    );
  }, [recuperados, busca]);

  const kpis = useMemo(() => {
    const total = filtrados.reduce((s, r) => s + Number(r.valor || 0), 0);
    const associados = new Set(filtrados.map((r) => r.matricula)).size;
    const ticket = filtrados.length > 0 ? total / filtrados.length : 0;
    return { total, qtd: filtrados.length, associados, ticket };
  }, [filtrados]);

  const exportarCsv = () => {
    const linhas = [
      ['Associado', 'Matricula', 'Placa', 'Vencimento', 'Linha Digitavel', 'Valor', 'Recuperado em'].join(';'),
      ...filtrados.map((r) =>
        [
          r.nome.replace(/;/g, ','),
          r.matricula,
          r.placa || '',
          r.vencimento,
          r.linha_digitavel,
          String(r.valor).replace('.', ','),
          fmtDate(r.recuperado_em),
        ].join(';'),
      ),
    ].join('\n');
    const blob = new Blob([linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recuperados-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {gerarOpcoesPeriodo().map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome, matrícula ou placa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <Button onClick={exportarCsv} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Valor recuperado" value={fmtBRL(kpis.total)} accent="success" icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Boletos recuperados" value={kpis.qtd.toLocaleString('pt-BR')} accent="primary" />
        <KpiCard label="Associados únicos" value={kpis.associados.toLocaleString('pt-BR')} />
        <KpiCard label="Ticket médio" value={fmtBRL(kpis.ticket)} />
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Boletos recuperados ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum boleto recuperado no período selecionado.
            </div>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Recuperado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{r.matricula}</TableCell>
                      <TableCell>{r.placa || '—'}</TableCell>
                      <TableCell className="text-xs">{r.vencimento}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{fmtBRL(Number(r.valor || 0))}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.recuperado_em)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de lotes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de lotes importados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-right">Boletos</TableHead>
                  <TableHead className="text-right">Associados</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{fmtDate(l.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{l.nome_arquivo}</TableCell>
                    <TableCell className="text-right">{l.total_boletos}</TableCell>
                    <TableCell className="text-right">{l.total_associados}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(l.valor_total || 0))}</TableCell>
                    <TableCell className="text-right">{l.total_enviados}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === 'ativo' ? 'default' : 'outline'}>{l.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {lotes.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground p-6">Nenhum lote importado ainda.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, accent, icon }: { label: string; value: string; accent?: 'success' | 'primary'; icon?: React.ReactNode }) {
  const color = accent === 'success' ? 'text-green-600' : accent === 'primary' ? 'text-primary' : '';
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">{icon}{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
