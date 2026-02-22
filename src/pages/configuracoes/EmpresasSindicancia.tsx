import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { ESPECIALIDADES_LABELS, REGIOES_LABELS, type EmpresaSindicancia } from '@/types/sindicancia';

export default function EmpresasSindicancia() {
  const [empresas, setEmpresas] = useState<EmpresaSindicancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmpresaSindicancia | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    responsavel_nome: '',
    responsavel_cpf: '',
    responsavel_telefone: '',
    responsavel_email: '',
    especialidades: [] as string[],
    regioes_atuacao: [] as string[],
    valor_por_sindicancia: '',
    observacoes: '',
    ativo: true,
  });

  const fetchEmpresas = async () => {
    const { data } = await supabase
      .from('empresas_sindicancia')
      .select('*')
      .order('razao_social');
    if (data) setEmpresas(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchEmpresas(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      razao_social: '', nome_fantasia: '', cnpj: '', responsavel_nome: '',
      responsavel_cpf: '', responsavel_telefone: '', responsavel_email: '',
      especialidades: [], regioes_atuacao: [], valor_por_sindicancia: '',
      observacoes: '', ativo: true,
    });
    setShowModal(true);
  };

  const openEdit = (e: EmpresaSindicancia) => {
    setEditing(e);
    setForm({
      razao_social: e.razao_social,
      nome_fantasia: e.nome_fantasia || '',
      cnpj: e.cnpj,
      responsavel_nome: e.responsavel_nome,
      responsavel_cpf: e.responsavel_cpf || '',
      responsavel_telefone: e.responsavel_telefone || '',
      responsavel_email: e.responsavel_email || '',
      especialidades: e.especialidades || [],
      regioes_atuacao: e.regioes_atuacao || [],
      valor_por_sindicancia: e.valor_por_sindicancia?.toString() || '',
      observacoes: e.observacoes || '',
      ativo: e.ativo,
    });
    setShowModal(true);
  };

  const toggleArray = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const handleSave = async () => {
    if (!form.razao_social || !form.cnpj || !form.responsavel_nome) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    const payload = {
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia || null,
      cnpj: form.cnpj,
      responsavel_nome: form.responsavel_nome,
      responsavel_cpf: form.responsavel_cpf || null,
      responsavel_telefone: form.responsavel_telefone || null,
      responsavel_email: form.responsavel_email || null,
      especialidades: form.especialidades,
      regioes_atuacao: form.regioes_atuacao,
      valor_por_sindicancia: form.valor_por_sindicancia ? parseFloat(form.valor_por_sindicancia) : null,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('empresas_sindicancia').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('empresas_sindicancia').insert(payload));
    }

    if (error) {
      toast.error(error.message.includes('cnpj') ? 'CNPJ já cadastrado' : 'Erro ao salvar');
    } else {
      toast.success(editing ? 'Empresa atualizada!' : 'Empresa cadastrada!');
      setShowModal(false);
      fetchEmpresas();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas de Sindicância</h1>
          <p className="text-muted-foreground">Cadastro de empresas terceirizadas de investigação</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Empresa</Button>
      </div>

      {empresas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma empresa cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {empresas.map(e => (
            <Card key={e.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{e.razao_social}</span>
                      {e.nome_fantasia && <span className="text-sm text-muted-foreground">({e.nome_fantasia})</span>}
                      <Badge variant={e.ativo ? 'default' : 'secondary'}>{e.ativo ? 'Ativa' : 'Inativa'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">CNPJ: {e.cnpj} • Resp: {e.responsavel_nome}</p>
                    {e.especialidades?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {e.especialidades.map(esp => (
                          <Badge key={esp} variant="outline" className="text-xs">{ESPECIALIDADES_LABELS[esp] || esp}</Badge>
                        ))}
                      </div>
                    )}
                    {e.valor_por_sindicancia && (
                      <p className="text-sm mt-1">Valor: R$ {Number(e.valor_por_sindicancia).toFixed(2)}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empresa' : 'Nova Empresa de Sindicância'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Razão Social *</Label>
              <Input value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label>Responsável Técnico *</Label>
              <Input value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>CPF do Responsável</Label>
              <Input value={form.responsavel_cpf} onChange={e => setForm(f => ({ ...f, responsavel_cpf: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.responsavel_telefone} onChange={e => setForm(f => ({ ...f, responsavel_telefone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.responsavel_email} onChange={e => setForm(f => ({ ...f, responsavel_email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Valor por Sindicância (R$)</Label>
              <Input type="number" value={form.valor_por_sindicancia} onChange={e => setForm(f => ({ ...f, valor_por_sindicancia: e.target.value }))} />
            </div>
            <div className="space-y-2 flex items-center gap-3 pt-6">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label>Ativa</Label>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Especialidades</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ESPECIALIDADES_LABELS).map(([value, label]) => (
                  <Badge
                    key={value}
                    variant={form.especialidades.includes(value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setForm(f => ({ ...f, especialidades: toggleArray(f.especialidades, value) }))}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Regiões de Atuação</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(REGIOES_LABELS).map(([value, label]) => (
                  <Badge
                    key={value}
                    variant={form.regioes_atuacao.includes(value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setForm(f => ({ ...f, regioes_atuacao: toggleArray(f.regioes_atuacao, value) }))}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
