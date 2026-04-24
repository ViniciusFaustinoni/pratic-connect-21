import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type Mapeamento = {
  id: string;
  tipo: string;
  codigo_local: string;
  codigo_hinova: number;
  descricao: string | null;
  ativo: boolean | null;
};

const TIPOS = ['cor', 'combustivel', 'tipo_veiculo', 'tipo_foto'] as const;
type Tipo = typeof TIPOS[number];

const TIPO_LABELS: Record<Tipo, string> = {
  cor: 'Cores',
  combustivel: 'Combustíveis',
  tipo_veiculo: 'Tipos de Veículo',
  tipo_foto: 'Tipos de Foto (Documentos)',
};

export default function IntegracaoHinovaMapeamentos() {
  const qc = useQueryClient();
  const [tipoAtivo, setTipoAtivo] = useState<Tipo>('cor');
  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState({ tipo: 'cor' as Tipo, codigo_local: '', codigo_hinova: '', descricao: '' });

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['hinova_mapeamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hinova_mapeamentos')
        .select('*')
        .order('tipo')
        .order('codigo_local');
      if (error) throw error;
      return data as Mapeamento[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async (m: Partial<Mapeamento> & { id: string }) => {
      const { error } = await supabase
        .from('hinova_mapeamentos')
        .update({
          codigo_hinova: m.codigo_hinova,
          codigo_local: m.codigo_local,
          descricao: m.descricao,
          ativo: m.ativo,
        })
        .eq('id', m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hinova_mapeamentos'] });
      toast.success('Mapeamento salvo');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hinova_mapeamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hinova_mapeamentos'] });
      toast.success('Removido');
    },
  });

  const insertMut = useMutation({
    mutationFn: async () => {
      const codigo = parseInt(novo.codigo_hinova, 10);
      if (!novo.codigo_local.trim() || !Number.isFinite(codigo)) {
        throw new Error('Preencha código local e código Hinova válido');
      }
      const { error } = await supabase.from('hinova_mapeamentos').insert({
        tipo: novo.tipo,
        codigo_local: novo.codigo_local.trim().toLowerCase(),
        codigo_hinova: codigo,
        descricao: novo.descricao || null,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hinova_mapeamentos'] });
      toast.success('Mapeamento criado');
      setNovoOpen(false);
      setNovo({ tipo: tipoAtivo, codigo_local: '', codigo_hinova: '', descricao: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const itensFiltrados = itens.filter((i) => i.tipo === tipoAtivo);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mapeamentos Hinova</h1>
          <p className="text-sm text-muted-foreground">
            De-para entre valores locais e códigos numéricos da API SGA Hinova.
          </p>
        </div>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setNovo({ ...novo, tipo: tipoAtivo })}>
              <Plus className="h-4 w-4 mr-2" />
              Novo mapeamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo mapeamento Hinova</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v as Tipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código local (slug)</Label>
                <Input
                  value={novo.codigo_local}
                  onChange={(e) => setNovo({ ...novo, codigo_local: e.target.value })}
                  placeholder="ex: gasolina, branco, carro"
                />
              </div>
              <div>
                <Label>Código Hinova (numérico)</Label>
                <Input
                  type="number"
                  value={novo.codigo_hinova}
                  onChange={(e) => setNovo({ ...novo, codigo_hinova: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={novo.descricao}
                  onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => insertMut.mutate()} disabled={insertMut.isPending}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Tabs value={tipoAtivo} onValueChange={(v) => setTipoAtivo(v as Tipo)}>
        <TabsList>
          {TIPOS.map((t) => (
            <TabsTrigger key={t} value={t}>{TIPO_LABELS[t]}</TabsTrigger>
          ))}
        </TabsList>

        {TIPOS.map((t) => (
          <TabsContent key={t} value={t}>
            <Card className="p-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : itensFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum mapeamento para este tipo.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                    <span className="col-span-3">Código local</span>
                    <span className="col-span-2">Código Hinova</span>
                    <span className="col-span-4">Descrição</span>
                    <span className="col-span-2">Ativo</span>
                    <span className="col-span-1 text-right">Ações</span>
                  </div>
                  {itensFiltrados.map((m) => (
                    <LinhaEditavel
                      key={m.id}
                      item={m}
                      onSave={(patch) => updateMut.mutate({ id: m.id, ...patch })}
                      onDelete={() => deleteMut.mutate(m.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function LinhaEditavel({
  item, onSave, onDelete,
}: {
  item: Mapeamento;
  onSave: (patch: Partial<Mapeamento>) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState(item);

  const dirty =
    local.codigo_local !== item.codigo_local ||
    local.codigo_hinova !== item.codigo_hinova ||
    (local.descricao || '') !== (item.descricao || '') ||
    !!local.ativo !== !!item.ativo;

  return (
    <div className="grid grid-cols-12 gap-2 items-center px-2 py-1 rounded hover:bg-muted/50">
      <Input
        className="col-span-3 h-8"
        value={local.codigo_local}
        onChange={(e) => setLocal({ ...local, codigo_local: e.target.value })}
      />
      <Input
        className="col-span-2 h-8"
        type="number"
        value={local.codigo_hinova}
        onChange={(e) => setLocal({ ...local, codigo_hinova: parseInt(e.target.value, 10) || 0 })}
      />
      <Input
        className="col-span-4 h-8"
        value={local.descricao || ''}
        onChange={(e) => setLocal({ ...local, descricao: e.target.value })}
      />
      <div className="col-span-2">
        <Switch
          checked={!!local.ativo}
          onCheckedChange={(checked) => setLocal({ ...local, ativo: checked })}
        />
      </div>
      <div className="col-span-1 flex justify-end gap-1">
        {dirty && (
          <Button size="icon" variant="ghost" onClick={() => onSave(local)} title="Salvar">
            <Save className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onDelete} title="Remover">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
