import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useRelatorioComissoes } from '@/hooks/useRelatorioComissoes';
import { ComissaoDetalhesPagamentoModal } from '@/components/comissoes/ComissaoDetalhesPagamentoModal';
import { COMISSOES_STATUS_OPTIONS, COMISSOES_TIPO_LANCAMENTO_OPTIONS, dateStringToDate, dateToDateString } from '@/lib/comissoes-filtros';

const PERFIS = [
  { value: 'vendedor_clt', label: 'Vendedor CLT' },
  { value: 'vendedor_externo', label: 'Vendedor Externo' },
  { value: 'agencia', label: 'Agência' },
  { value: 'supervisor_vendas', label: 'Supervisor' },
  { value: 'gerente_comercial', label: 'Gerente' },
];

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const getName = (item?: { nome?: string | null; full_name?: string | null; email?: string | null } | null) => item?.nome || item?.full_name || item?.email || '—';

export default function RelatorioComissoes() {
  const { filters, setFilters, grades, planos, vendedores, linhas, resumo, isLoading } = useRelatorioComissoes();
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const update = (key: keyof typeof filters, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const updatePeriodo = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;
    setFilters(prev => ({ ...prev, dataInicio: dateToDateString(range.from!), dataFim: dateToDateString(range.to || range.from!) }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Relatório de Comissões</h1>
        <p className="text-sm text-muted-foreground">Audite plano vendido, grade usada pelo vendedor de origem, destinatário, perfil, cálculo e status.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gerado</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(resumo.totalGerado)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pendente</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(resumo.totalPendente)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pago</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(resumo.totalPago)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Lançamentos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{resumo.quantidade}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <div className="md:col-span-2"><DatePickerWithRange date={{ from: dateStringToDate(filters.dataInicio), to: dateStringToDate(filters.dataFim) }} onDateChange={updatePeriodo} /></div>
          <Select value={filters.status} onValueChange={v => update('status', v)}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{COMISSOES_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.tipoLancamento} onValueChange={v => update('tipoLancamento', v)}><SelectTrigger><SelectValue placeholder="Tipo de lançamento" /></SelectTrigger><SelectContent>{COMISSOES_TIPO_LANCAMENTO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.gradeId} onValueChange={v => update('gradeId', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as grades</SelectItem>{grades.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.planoId} onValueChange={v => update('planoId', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os planos</SelectItem>{planos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.vendedorId} onValueChange={v => update('vendedorId', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os destinatários</SelectItem>{vendedores.map(v => <SelectItem key={v.id} value={v.id}>{getName(v)}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.role} onValueChange={v => update('role', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os perfis</SelectItem>{PERFIS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Parcela" value={filters.parcela === 'todas' ? '' : filters.parcela} onChange={e => update('parcela', e.target.value || 'todas')} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Vendedor origem</TableHead><TableHead>Destinatário</TableHead><TableHead>Perfil</TableHead><TableHead>Plano</TableHead><TableHead>Grade</TableHead><TableHead>Parcela</TableHead><TableHead>Base</TableHead><TableHead>Cálculo</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={12}>Carregando...</TableCell></TableRow> : linhas.map(linha => (
                <TableRow key={linha.id}>
                  <TableCell>{new Date(linha.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{getName(linha.contrato?.vendedor)}</TableCell>
                  <TableCell>{getName(linha.vendedor)}</TableCell>
                  <TableCell>{linha.nivel_nome || linha.role_destinatario || '—'}</TableCell>
                  <TableCell>{linha.plano?.nome || '—'}</TableCell>
                  <TableCell>{linha.grade?.nome || '—'}</TableCell>
                  <TableCell>{linha.parcela_numero || '—'}</TableCell>
                  <TableCell>{formatCurrency(Number(linha.valor_base))}</TableCell>
                  <TableCell>{linha.tipo_calculo === 'valor_fixo' ? formatCurrency(Number(linha.valor_comissao)) : `${Number(linha.percentual_aplicado || 0)}%`}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(linha.valor_total))}</TableCell>
                  <TableCell><Badge variant={linha.status === 'paga' ? 'default' : 'secondary'}>{linha.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setDetalheId(linha.id)}><Eye className="mr-1 h-3.5 w-3.5" /> Detalhes</Button></TableCell>
                </TableRow>
              ))}
              {!isLoading && linhas.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Nenhuma comissão encontrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ComissaoDetalhesPagamentoModal
        open={Boolean(detalheId)}
        comissaoId={detalheId}
        onOpenChange={(open) => !open && setDetalheId(null)}
      />
    </div>
  );
}
