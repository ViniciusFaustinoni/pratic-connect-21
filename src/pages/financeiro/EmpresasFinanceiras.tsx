import { useState } from 'react';
import { Plus, Pencil, Building2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
  useEmpresas, useSetorEmpresaMap, useSalvarEmpresa, useSalvarVinculoSetor,
  EMPRESA_PAPEIS, Empresa,
} from '@/hooks/useEmpresas';
import { SOLICITACAO_SETORES } from '@/hooks/useSolicitacoesFinanceiras';

const papelLabel = (v: string) => EMPRESA_PAPEIS.find((p) => p.value === v)?.label ?? v;

const emptyEmpresa: Partial<Empresa> = {
  nome: '', tipo: 'ltda', papel: 'outros', cnpj: '', percentual_rateio: 0, ativo: true, ordem: 100,
};

export default function EmpresasFinanceiras() {
  const { data: empresas, isLoading } = useEmpresas();
  const { data: mapa } = useSetorEmpresaMap();
  const salvarEmpresa = useSalvarEmpresa();
  const salvarVinculo = useSalvarVinculoSetor();

  const [editando, setEditando] = useState<Partial<Empresa> | null>(null);

  const totalRateio = (empresas ?? [])
    .filter((e) => e.tipo === 'ltda' && e.ativo)
    .reduce((a, e) => a + Number(e.percentual_rateio || 0), 0);

  const empresaDoSetor = (setor: string) =>
    mapa?.find((m) => m.setor === setor)?.empresa_id ?? '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas & Rateio</h1>
          <p className="text-muted-foreground">
            Associação e LTDAs do grupo — base para a visão real (por empresa)
          </p>
        </div>
        <Button onClick={() => setEditando(emptyEmpresa)}>
          <Plus className="mr-2 h-4 w-4" /> Nova empresa
        </Button>
      </div>

      {/* Empresas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Empresas do grupo</CardTitle>
          <Badge variant={Math.round(totalRateio) === 100 ? 'default' : 'secondary'}>
            Rateio LTDAs: {totalRateio.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="text-right">% Rateio</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(empresas ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" /> {e.nome}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.tipo === 'associacao' ? 'outline' : 'secondary'}>
                        {e.tipo === 'associacao' ? 'Associação' : 'LTDA'}
                      </Badge>
                    </TableCell>
                    <TableCell>{papelLabel(e.papel)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.cnpj || '—'}</TableCell>
                    <TableCell className="text-right">
                      {e.tipo === 'ltda' ? `${Number(e.percentual_rateio).toLocaleString('pt-BR')}%` : '—'}
                    </TableCell>
                    <TableCell>
                      {e.ativo ? <Badge variant="default">Sim</Badge> : <Badge variant="outline">Não</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditando(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* De/Para setor -> empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vínculo Setor → Empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define qual empresa assume cada setor na visão real. Usado para classificar solicitações e despesas.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {SOLICITACAO_SETORES.map((s) => (
              <div key={s.value} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <span className="text-sm">{s.label}</span>
                <Select
                  value={empresaDoSetor(s.value)}
                  onValueChange={(v) => salvarVinculo.mutate({ setor: s.value, empresa_id: v })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(empresas ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EmpresaModal
        key={editando?.id ?? (editando ? 'nova' : 'fechado')}
        empresa={editando}
        onClose={() => setEditando(null)}
        onSave={(e) => salvarEmpresa.mutate(e, { onSuccess: () => setEditando(null) })}
        saving={salvarEmpresa.isPending}
      />
    </div>
  );
}

function EmpresaModal({
  empresa, onClose, onSave, saving,
}: {
  empresa: Partial<Empresa> | null;
  onClose: () => void;
  onSave: (e: Partial<Empresa>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Empresa>>(empresa ?? {});

  const open = !!empresa;
  const set = (k: keyof Empresa, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo ?? 'ltda'} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="associacao">Associação</SelectItem>
                  <SelectItem value="ltda">LTDA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.papel ?? 'outros'} onValueChange={(v) => set('papel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPRESA_PAPEIS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label>% Rateio</Label>
              <Input
                type="number" step="0.01"
                value={form.percentual_rateio ?? 0}
                onChange={(e) => set('percentual_rateio', parseFloat(e.target.value) || 0)}
                disabled={form.tipo === 'associacao'}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Empresa ativa</Label>
            <Switch checked={form.ativo ?? true} onCheckedChange={(v) => set('ativo', v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.nome?.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
