import { useMemo, useState } from 'react';
import { Plus, TrendingUp, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useReceitas, useCategoriasReceita, useCriarReceita, useExcluirReceita,
} from '@/hooks/useReceitas';
import { useEmpresas } from '@/hooks/useEmpresas';
import { toast } from 'sonner';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Receitas() {
  const agora = new Date();
  const [mesRef, setMesRef] = useState(
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
  );
  const [ano, mes] = mesRef.split('-').map(Number);

  const { data: receitas, isLoading } = useReceitas(ano, mes);
  const { data: categorias = [] } = useCategoriasReceita();
  const { data: empresas = [] } = useEmpresas();
  const excluir = useExcluirReceita();

  const [modal, setModal] = useState(false);

  const total = (receitas ?? []).reduce((a, r) => a + Number(r.valor || 0), 0);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of receitas ?? []) {
      const k = r.categoria_nome || r.categoria_codigo || 'Outros';
      m.set(k, (m.get(k) || 0) + Number(r.valor || 0));
    }
    return Array.from(m.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [receitas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receitas</h1>
          <p className="text-muted-foreground">Entradas por categoria (Adesão, Cota, Boletos Hinova, etc.)</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-40" />
          <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Nova receita</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Receita do mês</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-2 text-green-600">{fmt(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">{receitas?.length ?? 0} lançamentos</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por categoria</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem receitas no período.</p>
            ) : porCategoria.map((c) => (
              <div key={c.nome} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{c.nome}</span>
                <span className="font-medium">{fmt(c.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (receitas ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhuma receita lançada neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(receitas ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{r.categoria_nome || r.categoria_codigo || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.descricao || '—'}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{fmt(r.valor)}</TableCell>
                    <TableCell><Badge variant="secondary">{r.origem}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => excluir.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovaReceitaModal open={modal} onClose={() => setModal(false)} categorias={categorias} empresas={empresas} />
    </div>
  );
}

function NovaReceitaModal({
  open, onClose, categorias, empresas,
}: {
  open: boolean; onClose: () => void;
  categorias: { codigo: string; nome: string }[];
  empresas: { id: string; nome: string }[];
}) {
  const criar = useCriarReceita();
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ data: hoje, categoria_codigo: '', valor: '', descricao: '', empresa_id: '' });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const parseValor = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.') || '0');
  const valido = form.categoria_codigo && parseValor(form.valor) > 0 && form.data;

  const handleSalvar = () => {
    if (!valido) { toast.error('Preencha categoria, valor e data'); return; }
    const cat = categorias.find((c) => c.codigo === form.categoria_codigo);
    criar.mutate({
      data: form.data,
      categoria_codigo: form.categoria_codigo,
      categoria_nome: cat?.nome ?? '',
      valor: parseValor(form.valor),
      descricao: form.descricao,
      empresa_id: form.empresa_id || null,
    }, { onSuccess: () => { setForm({ data: hoje, categoria_codigo: '', valor: '', descricao: '', empresa_id: '' }); onClose(); } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Receita</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={form.categoria_codigo} onValueChange={(v) => set('categoria_codigo', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={form.empresa_id} onValueChange={(v) => set('empresa_id', v)}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={!valido || criar.isPending}>
            {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lançar receita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
