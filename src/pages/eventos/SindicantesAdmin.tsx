import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Building2, MoreHorizontal, Pencil, Power, Eye, Search, Users, Activity, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ESPECIALIDADES_LABELS, REGIOES_LABELS, type EmpresaSindicancia } from '@/types/sindicancia';
import { CnpjInput, CpfInput, TelefoneInput, CurrencyInput } from '@/components/inputs/MaskedInputs';
import { SindicanteDetalheSheet } from '@/components/sindicante/SindicanteDetalheSheet';

// Badge color mapping for especialidades
const ESPECIALIDADE_COLORS: Record<string, string> = {
  fraude_veicular: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
  roubo_furto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200',
  incendio: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200',
  colisao_suspeita: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200',
  geral: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
};

interface SummaryCards {
  total: number;
  ativos: number;
  comCasoAndamento: number;
  sindicanciasEsteMes: number;
}

interface CasosAtivosMap {
  [empresaId: string]: number;
}

export default function SindicantesAdmin() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<EmpresaSindicancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryCards>({ total: 0, ativos: 0, comCasoAndamento: 0, sindicanciasEsteMes: 0 });
  const [casosAtivos, setCasosAtivos] = useState<CasosAtivosMap>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState('todos');
  const [especialidadeFilter, setEspecialidadeFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmpresaSindicancia | null>(null);
  const [saving, setSaving] = useState(false);

  // Sheet
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaSindicancia | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Form state
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
    valor_por_sindicancia: 0,
    observacoes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [empresasRes, casosRes, mesRes] = await Promise.all([
      supabase.from('empresas_sindicancia').select('*').order('razao_social'),
      supabase.from('sindicancias').select('empresa_sindicancia_id').in('status', ['atribuido', 'em_andamento']),
      supabase.from('sindicancias').select('id').gte('data_abertura', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const emps = (empresasRes.data || []) as unknown as EmpresaSindicancia[];
    setEmpresas(emps);

    // Count casos ativos per empresa
    const casosMap: CasosAtivosMap = {};
    const empresasComCaso = new Set<string>();
    (casosRes.data || []).forEach((c: any) => {
      if (c.empresa_sindicancia_id) {
        casosMap[c.empresa_sindicancia_id] = (casosMap[c.empresa_sindicancia_id] || 0) + 1;
        empresasComCaso.add(c.empresa_sindicancia_id);
      }
    });
    setCasosAtivos(casosMap);

    setSummary({
      total: emps.length,
      ativos: emps.filter(e => e.ativo).length,
      comCasoAndamento: empresasComCaso.size,
      sindicanciasEsteMes: mesRes.data?.length || 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered empresas
  const filtered = useMemo(() => {
    return empresas.filter(e => {
      if (statusFilter === 'ativo' && !e.ativo) return false;
      if (statusFilter === 'inativo' && e.ativo) return false;
      if (especialidadeFilter !== 'todos' && !e.especialidades?.includes(especialidadeFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = (e.nome_fantasia || '').toLowerCase().includes(q)
          || e.razao_social.toLowerCase().includes(q)
          || e.cnpj.includes(q)
          || e.responsavel_nome.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [empresas, statusFilter, especialidadeFilter, searchQuery]);

  const openNew = () => {
    setEditing(null);
    setForm({
      razao_social: '', nome_fantasia: '', cnpj: '', responsavel_nome: '',
      responsavel_cpf: '', responsavel_telefone: '', responsavel_email: '',
      especialidades: [], regioes_atuacao: [], valor_por_sindicancia: 0, observacoes: '',
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
      valor_por_sindicancia: e.valor_por_sindicancia || 0,
      observacoes: e.observacoes || '',
    });
    setShowModal(true);
  };

  const toggleCheckbox = (field: 'especialidades' | 'regioes_atuacao', value: string) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value],
    }));
  };

  const handleSave = async () => {
    if (!form.razao_social || !form.cnpj || !form.responsavel_nome || !form.responsavel_telefone || !form.responsavel_email) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);

    // Validate unique CNPJ
    const { data: existingCnpj } = await supabase
      .from('empresas_sindicancia')
      .select('id')
      .eq('cnpj', form.cnpj)
      .maybeSingle();

    if (existingCnpj && existingCnpj.id !== editing?.id) {
      toast.error('CNPJ já cadastrado');
      setSaving(false);
      return;
    }

    if (editing) {
      // EDIT: just update the empresa record
      const { error } = await supabase
        .from('empresas_sindicancia')
        .update({
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia || null,
          cnpj: form.cnpj,
          responsavel_nome: form.responsavel_nome,
          responsavel_cpf: form.responsavel_cpf || null,
          responsavel_telefone: form.responsavel_telefone || null,
          responsavel_email: form.responsavel_email || null,
          especialidades: form.especialidades,
          regioes_atuacao: form.regioes_atuacao,
          valor_por_sindicancia: form.valor_por_sindicancia || null,
          observacoes: form.observacoes || null,
        })
        .eq('id', editing.id);

      if (error) {
        toast.error('Erro ao atualizar: ' + error.message);
      } else {
        toast.success('Sindicante atualizado!');
        setShowModal(false);
        fetchData();
      }
    } else {
      // NEW: 1) create user, 2) get profile_id, 3) insert empresa
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) { toast.error('Sessão expirada'); setSaving(false); return; }

        const res = await supabase.functions.invoke('create-user', {
          body: {
            nome: form.responsavel_nome,
            email: form.responsavel_email,
            cpf: form.responsavel_cpf || undefined,
            telefone: form.responsavel_telefone || undefined,
            tipo: 'prestador',
            perfis: ['sindicante'],
          },
        });

        if (res.error || !res.data?.success) {
          toast.error(res.data?.error || 'Erro ao criar usuário');
          setSaving(false);
          return;
        }

        const userId = res.data.userId;

        // Get profile_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        const profileId = profile?.id || null;

        // Insert empresa
        const { error } = await supabase.from('empresas_sindicancia').insert({
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia || null,
          cnpj: form.cnpj,
          responsavel_nome: form.responsavel_nome,
          responsavel_cpf: form.responsavel_cpf || null,
          responsavel_telefone: form.responsavel_telefone || null,
          responsavel_email: form.responsavel_email || null,
          especialidades: form.especialidades,
          regioes_atuacao: form.regioes_atuacao,
          valor_por_sindicancia: form.valor_por_sindicancia || null,
          observacoes: form.observacoes || null,
          profile_id: profileId,
        });

        if (error) {
          toast.error('Erro ao cadastrar empresa: ' + error.message);
        } else {
          toast.success(`Sindicante cadastrado! Email de acesso enviado para ${form.responsavel_email}`);
          setShowModal(false);
          fetchData();
        }
      } catch (err: any) {
        toast.error('Erro inesperado: ' + (err.message || 'Tente novamente'));
      }
    }

    setSaving(false);
  };

  const toggleAtivo = async (empresa: EmpresaSindicancia) => {
    const { error } = await supabase
      .from('empresas_sindicancia')
      .update({ ativo: !empresa.ativo })
      .eq('id', empresa.id);

    if (error) {
      toast.error('Erro ao alterar status');
    } else {
      toast.success(empresa.ativo ? 'Sindicante desativado' : 'Sindicante ativado');
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Home &gt; Eventos &gt; Sindicantes</p>
          <h1 className="text-2xl font-bold">Sindicantes</h1>
          <p className="text-muted-foreground">Empresas de sindicância cadastradas</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Sindicante
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><Building2 className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cadastrados</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><Users className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.ativos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Com Caso em Andamento</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.comCasoAndamento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Sindicâncias este Mês</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary.sindicanciasEsteMes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={especialidadeFilter} onValueChange={setEspecialidadeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Especialidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {Object.entries(ESPECIALIDADES_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou responsável..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum sindicante encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Especialidades</TableHead>
                <TableHead className="text-center">Casos Ativos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <button
                      className="font-medium text-primary hover:underline text-left"
                      onClick={() => { setSelectedEmpresa(e); setSheetOpen(true); }}
                    >
                      {e.nome_fantasia || e.razao_social}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.cnpj}</TableCell>
                  <TableCell className="text-sm">{e.responsavel_nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.responsavel_telefone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(e.especialidades || []).map(esp => (
                        <Badge key={esp} variant="outline" className={`text-xs ${ESPECIALIDADE_COLORS[esp] || ''}`}>
                          {ESPECIALIDADES_LABELS[esp] || esp}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{casosAtivos[e.id] || 0}</TableCell>
                  <TableCell>
                    <Badge variant={e.ativo ? 'default' : 'secondary'}>
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleAtivo(e)}>
                          <Power className="h-4 w-4 mr-2" /> {e.ativo ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/eventos/sindicancias?empresa=${e.id}`)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver Casos
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Sindicante' : 'Novo Sindicante'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Dados da Empresa */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Dados da Empresa</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Razão Social *</Label>
                  <Input value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ *</Label>
                  <CnpjInput value={form.cnpj} onChange={v => setForm(f => ({ ...f, cnpj: v }))} />
                </div>
              </div>
            </div>

            {/* Dados do Responsável */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Dados do Responsável</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <CpfInput value={form.responsavel_cpf} onChange={v => setForm(f => ({ ...f, responsavel_cpf: v }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone *</Label>
                  <TelefoneInput value={form.responsavel_telefone} onChange={v => setForm(f => ({ ...f, responsavel_telefone: v }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Email * {!editing && <span className="text-xs text-muted-foreground">(será o login do sindicante)</span>}</Label>
                  <Input type="email" value={form.responsavel_email} onChange={e => setForm(f => ({ ...f, responsavel_email: e.target.value }))} disabled={!!editing} />
                  {editing && <p className="text-xs text-muted-foreground">O email de login não pode ser alterado por aqui.</p>}
                </div>
              </div>
            </div>

            {/* Configuração */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Configuração</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Especialidades</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ESPECIALIDADES_LABELS).map(([value, label]) => (
                      <div key={value} className="flex items-center gap-2">
                        <Checkbox
                          id={`esp-${value}`}
                          checked={form.especialidades.includes(value)}
                          onCheckedChange={() => toggleCheckbox('especialidades', value)}
                        />
                        <label htmlFor={`esp-${value}`} className="text-sm cursor-pointer">{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Regiões de Atuação</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(REGIOES_LABELS).map(([value, label]) => (
                      <div key={value} className="flex items-center gap-2">
                        <Checkbox
                          id={`reg-${value}`}
                          checked={form.regioes_atuacao.includes(value)}
                          onCheckedChange={() => toggleCheckbox('regioes_atuacao', value)}
                        />
                        <label htmlFor={`reg-${value}`} className="text-sm cursor-pointer">{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Valor por Sindicância</Label>
                    <CurrencyInput value={form.valor_por_sindicancia} onChange={v => setForm(f => ({ ...f, valor_por_sindicancia: v }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? 'Salvar' : 'Cadastrar Sindicante'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <SindicanteDetalheSheet
        empresa={selectedEmpresa}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={openEdit}
        casosAtivos={selectedEmpresa ? casosAtivos[selectedEmpresa.id] || 0 : 0}
      />
    </div>
  );
}
