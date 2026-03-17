import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Info, X, Check } from 'lucide-react';
import { FieldHint } from './FieldHint';
import { PLAN_FIELD_HINTS } from './planFieldHints';
import { COMBUSTIVEIS_FALLBACK } from '@/data/combustiveis';

interface ElegibilidadeTabProps {
  planoId: string;
  linhaSlug: string;
}

type ElegibilidadeRecord = {
  id: string;
  plano_id: string;
  linha_slug: string;
  marca: string;
  modelo: string;
  ano_min: number;
  ano_max: number | null;
  combustivel: string | null;
  status: string;
  observacao: string | null;
  is_active: boolean | null;
  cobertura_fipe: number | null;
  created_at: string | null;
};

const STATUS_OPTIONS = [
  { value: 'aceito', label: 'Aceito' },
  { value: 'limitado', label: 'Limitado' },
  { value: 'negado', label: 'Negado' },
];

const COMBUSTIVEL_OPTIONS = [
  { value: 'qualquer', label: 'Qualquer' },
  ...COMBUSTIVEIS_FALLBACK,
];

const statusBadge = (status: string) => {
  if (status === 'aceito') return <Badge className="bg-green-600 text-white hover:bg-green-700">Aceito</Badge>;
  if (status === 'negado') return <Badge variant="destructive">Negado</Badge>;
  return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Limitado</Badge>;
};

const emptyForm = {
  marca: '',
  modelo: '',
  ano_min: new Date().getFullYear() - 10,
  ano_max: new Date().getFullYear() + 1,
  combustivel: 'qualquer',
  status: 'aceito',
  cobertura_fipe: 100,
  observacao: '',
};

export function ElegibilidadeTab({ planoId, linhaSlug }: ElegibilidadeTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: regras, isLoading } = useQuery({
    queryKey: ['elegibilidade-plano', planoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('*')
        .eq('plano_id', planoId)
        .eq('is_active', true)
        .order('marca', { ascending: true })
        .order('modelo', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ElegibilidadeRecord[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['elegibilidade-plano', planoId] });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        plano_id: planoId,
        linha_slug: linhaSlug || 'geral',
        marca: values.marca.trim().toUpperCase(),
        modelo: values.modelo.trim().toUpperCase() || 'TODOS OS MODELOS',
        ano_min: values.ano_min,
        ano_max: values.ano_max || null,
        combustivel: values.combustivel || 'qualquer',
        status: values.status,
        cobertura_fipe: values.status === 'negado' ? 0 : (values.cobertura_fipe || 100),
        observacao: values.observacao || null,
        is_active: true,
      };

      if (values.id) {
        const { error } = await supabase
          .from('plano_elegibilidade_modelos')
          .update(payload as any)
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plano_elegibilidade_modelos')
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Regra atualizada' : 'Regra adicionada');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['plano_elegibilidade_modelos'] });
      resetForm();
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plano_elegibilidade_modelos')
        .update({ is_active: false } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regra removida');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['plano_elegibilidade_modelos'] });
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (r: ElegibilidadeRecord) => {
    setForm({
      marca: r.marca,
      modelo: r.modelo,
      ano_min: r.ano_min,
      ano_max: r.ano_max || new Date().getFullYear() + 1,
      combustivel: r.combustivel || 'qualquer',
      status: r.status,
      cobertura_fipe: r.cobertura_fipe ?? 100,
      observacao: r.observacao || '',
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.marca.trim()) {
      toast.error('Informe a marca');
      return;
    }
    saveMutation.mutate({ ...form, id: editingId || undefined });
  };

  if (isLoading) {
    return <div className="space-y-3 py-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  }

  return (
    <div className="space-y-4 py-2">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Whitelist restritiva:</strong> se existirem regras aqui, somente veículos que correspondam a uma regra com status "Aceito" ou "Limitado" serão aceitos na cotação. 
          Veículos não listados serão <strong>automaticamente negados</strong>. 
          Use status "Negado" para bloquear marcas/modelos específicos dentro da whitelist.
        </AlertDescription>
      </Alert>

      {/* Rules table */}
      {regras && regras.length > 0 ? (
        <div className="rounded-md border overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap px-2">Marca</TableHead>
                <TableHead className="whitespace-nowrap px-2">Modelo</TableHead>
                <TableHead className="whitespace-nowrap px-2">Ano</TableHead>
                <TableHead className="whitespace-nowrap px-2">Comb.</TableHead>
                <TableHead className="whitespace-nowrap px-2">Status</TableHead>
                <TableHead className="whitespace-nowrap px-2">FIPE</TableHead>
                <TableHead className="whitespace-nowrap px-2 min-w-[100px]">Obs</TableHead>
                <TableHead className="whitespace-nowrap px-2 w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium px-2 py-1.5 whitespace-nowrap">{r.marca}</TableCell>
                  <TableCell className="px-2 py-1.5 whitespace-nowrap">{r.modelo}</TableCell>
                  <TableCell className="px-2 py-1.5 whitespace-nowrap">
                    {r.ano_min}{r.ano_max ? ` - ${r.ano_max}` : '+'}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 capitalize whitespace-nowrap">{r.combustivel || 'qualquer'}</TableCell>
                  <TableCell className="px-2 py-1.5">{statusBadge(r.status)}</TableCell>
                  <TableCell className="px-2 py-1.5">{r.status !== 'negado' ? `${r.cobertura_fipe ?? 100}%` : '—'}</TableCell>
                  <TableCell className="px-2 py-1.5 text-muted-foreground max-w-[150px]">
                    <span className="line-clamp-2">{r.observacao || '—'}</span>
                  </TableCell>
                  <TableCell className="px-2 py-1.5">
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMutation.mutate(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma regra de elegibilidade configurada. Este plano aceita todos os veículos.
        </p>
      )}

      {/* Add / Edit form */}
      {showForm ? (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold">{editingId ? 'Editar Regra' : 'Nova Regra'}</h4>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Marca *<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_marca} /></Label>
                <Input
                  value={form.marca}
                  onChange={(e) => setForm(f => ({ ...f, marca: e.target.value.toUpperCase() }))}
                  placeholder="Ex: VOLKSWAGEN"
                  className="h-8 text-sm uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modelo<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_modelo} /></Label>
                <Input
                  value={form.modelo}
                  onChange={(e) => setForm(f => ({ ...f, modelo: e.target.value.toUpperCase() }))}
                  placeholder="TODOS OS MODELOS"
                  className="h-8 text-sm uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ano Mín<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_ano} /></Label>
                <Input
                  type="number"
                  value={form.ano_min}
                  onChange={(e) => setForm(f => ({ ...f, ano_min: parseInt(e.target.value) || 2000 }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano Máx</Label>
                <Input
                  type="number"
                  value={form.ano_max}
                  onChange={(e) => setForm(f => ({ ...f, ano_max: parseInt(e.target.value) || new Date().getFullYear() + 1 }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Combustível<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_combustivel} /></Label>
                <Select value={form.combustivel} onValueChange={(v) => setForm(f => ({ ...f, combustivel: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMBUSTIVEL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_status} /></Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cobertura FIPE (%)<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_cobertura_fipe} /></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.status === 'negado' ? 0 : form.cobertura_fipe}
                  onChange={(e) => setForm(f => ({ ...f, cobertura_fipe: parseInt(e.target.value) || 100 }))}
                  disabled={form.status === 'negado'}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observação<FieldHint text={PLAN_FIELD_HINTS.elegibilidade_observacao} /></Label>
                <Input
                  value={form.observacao}
                  onChange={(e) => setForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Opcional"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" disabled={saveMutation.isPending} onClick={handleSubmit}>
                <Check className="h-3.5 w-3.5 mr-1" />
                {editingId ? 'Salvar' : 'Adicionar'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Regra
        </Button>
      )}
    </div>
  );
}
