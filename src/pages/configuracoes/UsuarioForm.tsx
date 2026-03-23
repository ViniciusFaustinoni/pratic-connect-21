import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, User, Shield, TrendingUp, History, Lock, Mail, MapPin, Eye, Pencil, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useVendedorStats } from '@/hooks/useVendedorHistorico';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppRoles } from '@/hooks/useAppRoles';
import { MODULE_LABELS } from '@/config/modules';
import { useRegioesAtendimento } from '@/hooks/useRegioesAtendimento';

// Card editável de acesso a módulos por usuário
function ModuleAccessCard({ userId }: { userId: string | undefined }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, { visible: boolean; can_edit: boolean }>>({});

  const { data: userVisibility, isLoading } = useQuery({
    queryKey: ['user-module-visibility', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from('user_module_visibility')
        .select('module_id, visible, can_edit')
        .eq('user_id', userId);
      if (error) throw error;
      return data as { module_id: string; visible: boolean; can_edit: boolean }[];
    },
    enabled: !!userId,
  });

  // Construir estado efetivo: banco + edições locais
  const getModuleState = useCallback((mod: string) => {
    if (localChanges[mod]) return localChanges[mod];
    const row = userVisibility?.find(r => r.module_id === mod);
    return { visible: row?.visible ?? false, can_edit: row?.can_edit ?? true };
  }, [userVisibility, localChanges]);

  const toggleVisible = (mod: string) => {
    const current = getModuleState(mod);
    setLocalChanges(prev => ({
      ...prev,
      [mod]: { ...current, visible: !current.visible }
    }));
  };

  const toggleCanEdit = (mod: string) => {
    const current = getModuleState(mod);
    setLocalChanges(prev => ({
      ...prev,
      [mod]: { ...current, can_edit: !current.can_edit }
    }));
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  const handleSave = async () => {
    if (!userId || !hasChanges) return;
    setSaving(true);
    try {
      const upsertData = Object.entries(localChanges).map(([module_id, state]) => ({
        user_id: userId,
        module_id,
        visible: state.visible,
        can_edit: state.can_edit,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await (supabase as any)
        .from('user_module_visibility')
        .upsert(upsertData, { onConflict: 'user_id,module_id' });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['user-module-visibility', userId] });
      queryClient.invalidateQueries({ queryKey: ['module-visibility'] });
      setLocalChanges({});
      toast.success('Acessos do usuário atualizados!');
    } catch (err: any) {
      toast.error('Erro ao salvar acessos: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const allModules = Object.keys(MODULE_LABELS);

  if (!userId) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="w-5 h-5" />
            Acesso a Módulos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Salve o usuário primeiro para configurar os acessos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5" />
              Acesso a Módulos
            </CardTitle>
            <CardDescription>
              Configure quais módulos este usuário pode visualizar e editar
            </CardDescription>
          </div>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar acessos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {allModules.map(mod => {
                const state = getModuleState(mod);
                const isChanged = !!localChanges[mod];
                return (
                  <div
                    key={mod}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isChanged ? 'border-amber-500/50 bg-amber-500/5' :
                      state.visible ? 'border-primary/30 bg-primary/5' : 'border-border/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={state.visible}
                        onCheckedChange={() => toggleVisible(mod)}
                        className="scale-75"
                      />
                      <span className={`text-sm font-medium ${state.visible ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {MODULE_LABELS[mod]}
                      </span>
                    </div>
                    {state.visible && (
                      <button
                        onClick={() => toggleCanEdit(mod)}
                        className={`p-1 rounded transition-colors ${
                          state.can_edit ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted'
                        }`}
                        title={state.can_edit ? 'Pode editar (clique para somente leitura)' : 'Somente leitura (clique para permitir edição)'}
                      >
                        {state.can_edit ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Link
                to="/configuracoes/usuarios-acessos?tab=visibilidade"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Gerenciar na Matriz de Visibilidade
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Componente para métricas de vendedor
function VendedorMetricasCard({ userId, navigate }: { userId: string; navigate: (path: string) => void }) {
  const { data: stats, isLoading } = useVendedorStats(userId);
  
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5" />
            Métricas de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const taxaConversao = stats?.total ? ((stats.ganhos / stats.total) * 100).toFixed(1) : '0';
  
  return (
    <Card className="border-border/50 border-green-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Métricas de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total de Leads</span>
          <span className="font-medium">{stats?.total || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Conversões</span>
          <span className="font-medium text-green-500">{stats?.ganhos || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Perdidos</span>
          <span className="font-medium text-red-500">{stats?.perdidos || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Taxa de Conversão</span>
          <span className="font-medium">{taxaConversao}%</span>
        </div>
        <Button 
          type="button"
          variant="outline" 
          className="w-full mt-2"
          onClick={() => navigate(`/vendas/vendedores/${userId}`)}
        >
          <History className="w-4 h-4 mr-2" />
          Ver Histórico Completo
        </Button>
      </CardContent>
    </Card>
  );
}

export default function UsuarioForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const preselectedPerfil = searchParams.get('perfil');

  const { isDiretor, isAdminMaster } = usePermissions();
  const { roles: appRoles, getRoleLabel, getRoleDescription, isLoading: isLoadingRoles } = useAppRoles();
  const { regioes: REGIOES_ATENDIMENTO } = useRegioesAtendimento();
  
  // Perfis disponíveis dinamicamente (exclui 'associado')
  const perfisDisponiveis = appRoles
    .filter(r => r.role !== 'associado')
    .map(r => ({ value: r.role, label: r.label, desc: r.description }));

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    senha: '',
    tipo: 'funcionario',
    ativo: true,
    perfis: preselectedPerfil ? [preselectedPerfil] : [] as string[],
    regioes_atendimento: [] as string[],
    capacidade_diaria: 10,
    grade_comissao_id: '' as string,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [alterandoEmail, setAlterandoEmail] = useState(false);
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  // Função para alterar email (admin)
  const alterarEmail = async () => {
    if (!novoEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoEmail)) { toast.error('Digite um email válido'); return; }
    setAlterandoEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-email', {
        body: { userId: usuario?.user_id, novoEmail }
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      toast.success('Email alterado com sucesso!');
      setNovoEmail('');
      setFormData(prev => ({ ...prev, email: novoEmail }));
      queryClient.invalidateQueries({ queryKey: ['usuario-edit', id] });
    } catch (err: any) { toast.error(err.message || 'Erro ao alterar email'); }
    finally { setAlterandoEmail(false); }
  };

  // Função para redefinir senha (admin)
  const redefinirSenha = async () => {
    if (novaSenha.length < 8) { toast.error('A senha deve ter pelo menos 8 caracteres'); return; }
    setAlterandoSenha(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: usuario?.user_id, novaSenha }
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      toast.success('Senha redefinida com sucesso!');
      setNovaSenha('');
    } catch (err: any) { toast.error(err.message || 'Erro ao redefinir senha'); }
    finally { setAlterandoSenha(false); }
  };

  // Buscar usuário existente
  const { data: usuario, isLoading } = useQuery({
    queryKey: ['usuario-edit', id],
    queryFn: async () => {
      if (!id) return null;
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', id).single();
      if (profileError) throw profileError;
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles').select('role').eq('user_id', profile.user_id);
      if (rolesError) throw rolesError;
      return { ...profile, roles: roles?.map(r => r.role) || [] };
    },
    enabled: isEditing
  });

  // Buscar grade atribuída ao usuário
  const { data: userGrade } = useQuery({
    queryKey: ['usuario-grade-comissao', usuario?.user_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('usuario_grade_comissao')
        .select('grade_id')
        .eq('user_id', usuario!.user_id)
        .maybeSingle();
      if (error) throw error;
      return data?.grade_id || '';
    },
    enabled: isEditing && !!usuario?.user_id,
  });

  // Buscar grades disponíveis
  const { data: gradesDisponiveis = [] } = useQuery({
    queryKey: ['grades-comissao-ativas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('grades_comissao')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  useEffect(() => {
    if (!usuario) return;
    const next = {
      nome: usuario.nome || '', email: usuario.email || '',
      telefone: usuario.telefone || '', cpf: usuario.cpf || '',
      cnpj: (usuario as any).cnpj || '',
      razao_social: (usuario as any).razao_social || '',
      nome_fantasia: (usuario as any).nome_fantasia || '',
      senha: '', tipo: usuario.tipo || 'funcionario', ativo: usuario.ativo ?? true,
      perfis: usuario.roles || [], regioes_atendimento: usuario.regioes_atendimento || [],
      capacidade_diaria: usuario.capacidade_diaria || 10,
      grade_comissao_id: userGrade || '',
    };
    setFormData((prev) => {
      const same = prev.nome === next.nome && prev.email === next.email &&
        prev.telefone === next.telefone && prev.cpf === next.cpf &&
        prev.cnpj === next.cnpj && prev.razao_social === next.razao_social &&
        prev.nome_fantasia === next.nome_fantasia &&
        prev.tipo === next.tipo && prev.ativo === next.ativo &&
        prev.perfis.length === next.perfis.length &&
        prev.perfis.every((p, i) => p === next.perfis[i]) &&
        prev.regioes_atendimento.length === next.regioes_atendimento.length &&
        prev.capacidade_diaria === next.capacidade_diaria &&
        prev.grade_comissao_id === next.grade_comissao_id;
      return same ? prev : next;
    });
  }, [usuario, userGrade]);

  // Salvar usuário
  const saveUser = useMutation({
    mutationFn: async () => {
      if (isEditing && usuario) {
        const isAgencia = formData.perfis.includes('agencia');
        const profileUpdate: any = {
          nome: formData.nome, telefone: formData.telefone,
          tipo: formData.tipo as any, ativo: formData.ativo,
          updated_at: new Date().toISOString(),
        };
        if (isAgencia) {
          profileUpdate.cnpj = formData.cnpj;
          profileUpdate.razao_social = formData.razao_social;
          profileUpdate.nome_fantasia = formData.nome_fantasia;
          profileUpdate.cpf = null;
        } else {
          profileUpdate.cpf = formData.cpf;
          profileUpdate.cnpj = null;
          profileUpdate.razao_social = null;
          profileUpdate.nome_fantasia = null;
        }
        const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', id);
        if (profileError) throw profileError;
        await supabase.from('user_roles').delete().eq('user_id', usuario.user_id);
        if (formData.perfis.length > 0) {
          const { error: rolesError } = await supabase.from('user_roles')
            .insert(formData.perfis.map(role => ({ user_id: usuario.user_id, role: role as any })));
          if (rolesError) throw rolesError;
        }

        // Salvar grade de comissão
        const isVendas = formData.perfis.some(p => ['vendedor_clt', 'vendedor_externo', 'agencia'].includes(p));
        if (isVendas && formData.grade_comissao_id) {
          const { data: session } = await supabase.auth.getSession();
          await (supabase as any).from('usuario_grade_comissao').delete().eq('user_id', usuario.user_id);
          await (supabase as any).from('usuario_grade_comissao').insert({
            user_id: usuario.user_id,
            grade_id: formData.grade_comissao_id,
            atribuido_por: session?.session?.user?.id || null,
          });
        } else if (!isVendas) {
          await (supabase as any).from('usuario_grade_comissao').delete().eq('user_id', usuario.user_id);
        }
      } else {
        setFieldErrors({});
        const isVistoriador = formData.perfis.some(p => ['instalador_vistoriador', 'vistoriador_base'].includes(p));
        const isAgenciaNew = formData.perfis.includes('agencia');
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            nome: formData.nome, email: formData.email, telefone: formData.telefone,
            ...(isAgenciaNew
              ? { cnpj: formData.cnpj, razao_social: formData.razao_social, nome_fantasia: formData.nome_fantasia }
              : { cpf: formData.cpf }
            ),
            senha: formData.senha, tipo: formData.tipo, perfis: formData.perfis,
            ...(isVistoriador && { regioes_atendimento: formData.regioes_atendimento, capacidade_diaria: formData.capacidade_diaria }),
          }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      setFieldErrors({});
      toast.success(isEditing ? 'Usuário atualizado!' : 'Usuário criado!');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      navigate('/configuracoes/usuarios');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Erro ao salvar usuário';
      if (errorMessage.includes('CPF já está cadastrado')) {
        setFieldErrors(prev => ({ ...prev, cpf: 'Este CPF já está cadastrado no sistema' }));
        toast.error('CPF já cadastrado.');
      } else if (errorMessage.includes('email já está em uso') || errorMessage.includes('already been registered')) {
        setFieldErrors(prev => ({ ...prev, email: 'Este email já está cadastrado no sistema' }));
        toast.error('Email já cadastrado.');
      } else { toast.error(errorMessage); }
    }
  });

  const handleProfileChange = useCallback((perfilId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      perfis: checked ? [...prev.perfis, perfilId].sort() : prev.perfis.filter(p => p !== perfilId)
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/usuarios')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? 'Atualize as informações do usuário' : 'Preencha os dados do novo usuário'}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveUser.mutate(); }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="bg-background" required />
                  </div>
                  {formData.perfis.includes('agencia') ? (
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ *</Label>
                      <Input id="cnpj" value={formData.cnpj} onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
                        const masked = raw.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
                        setFormData({ ...formData, cnpj: masked });
                        if (fieldErrors.cnpj) setFieldErrors(prev => ({ ...prev, cnpj: '' }));
                      }} placeholder="00.000.000/0000-00" maxLength={18} className={`bg-background ${fieldErrors.cnpj ? 'border-destructive focus-visible:ring-destructive' : ''}`} required />
                      {fieldErrors.cnpj && <p className="text-xs text-destructive font-medium">{fieldErrors.cnpj}</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input id="cpf" value={formData.cpf} onChange={(e) => {
                        setFormData({ ...formData, cpf: e.target.value });
                        if (fieldErrors.cpf) setFieldErrors(prev => ({ ...prev, cpf: '' }));
                      }} placeholder="000.000.000-00" className={`bg-background ${fieldErrors.cpf ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                      {fieldErrors.cpf && <p className="text-xs text-destructive font-medium">{fieldErrors.cpf}</p>}
                    </div>
                  )}
                </div>

                {formData.perfis.includes('agencia') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="razao_social">Razão Social *</Label>
                      <Input id="razao_social" value={formData.razao_social} onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })} placeholder="Razão Social da empresa" className="bg-background" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                      <Input id="nome_fantasia" value={formData.nome_fantasia} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })} placeholder="Nome Fantasia" className="bg-background" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                    }} className={`bg-background ${fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`} disabled={isEditing} required />
                    {fieldErrors.email && <p className="text-xs text-red-500 font-medium">{fieldErrors.email}</p>}
                    {isEditing && !fieldErrors.email && (
                      <p className="text-xs text-muted-foreground">
                        {(isDiretor || isAdminMaster) ? 'Use o painel de Segurança para alterar o email' : 'Email não pode ser alterado'}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" className="bg-background" />
                  </div>
                </div>

                {!isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha de acesso *</Label>
                    <Input id="senha" type="password" value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} placeholder="Mínimo 6 caracteres" className="bg-background" required minLength={6} />
                    <p className="text-xs text-muted-foreground">Senha inicial para o usuário acessar o sistema</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de usuário *</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funcionario">Funcionário</SelectItem>
                      <SelectItem value="associado">Associado</SelectItem>
                      <SelectItem value="prestador">Prestador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Perfis de Acesso */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5" />
                  Perfis de Acesso
                </CardTitle>
                <CardDescription>Selecione os perfis que este usuário terá</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {perfisDisponiveis.map((perfil) => (
                    <label 
                      key={perfil.value}
                      htmlFor={`perfil-${perfil.value}`}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.perfis.includes(perfil.value) ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
                      }`}
                    >
                      <Checkbox 
                        id={`perfil-${perfil.value}`}
                        checked={formData.perfis.includes(perfil.value)}
                        onCheckedChange={(checked) => handleProfileChange(perfil.value, checked === true)}
                      />
                      <div>
                        <p className="font-medium text-sm">{perfil.label}</p>
                        <p className="text-xs text-muted-foreground">{perfil.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Acesso a Módulos — editável, por usuário */}
            <ModuleAccessCard userId={isEditing ? id : undefined} />

            {/* Configurações de Campo */}
            {formData.perfis.some(p => ['instalador_vistoriador', 'vistoriador_base'].includes(p)) && (
              <Card className="border-border/50 border-yellow-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="w-5 h-5 text-yellow-500" />
                    Configurações de Campo
                  </CardTitle>
                  <CardDescription>Configurações específicas para vistoriadores (opcional)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Regiões de Atuação</Label>
                    <p className="text-xs text-muted-foreground mb-2">Deixe em branco para atender todas as regiões</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {REGIOES_ATENDIMENTO.map((regiao) => (
                        <label key={regiao.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={formData.regioes_atendimento?.includes(regiao.value)}
                            onCheckedChange={(checked) => {
                              const current = formData.regioes_atendimento || [];
                              setFormData({
                                ...formData,
                                regioes_atendimento: checked ? [...current, regiao.value] : current.filter(r => r !== regiao.value)
                              });
                            }}
                          />
                          {regiao.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacidade_diaria">Capacidade Diária</Label>
                    <Input id="capacidade_diaria" type="number" min={1} max={20} value={formData.capacidade_diaria}
                      onChange={(e) => setFormData({ ...formData, capacidade_diaria: parseInt(e.target.value) || 10 })}
                      className="bg-background" />
                    <p className="text-xs text-muted-foreground">Máximo de tarefas por dia (1-20)</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grade de Comissão — para consultores e agências */}
            {formData.perfis.some(p => ['vendedor_clt', 'vendedor_externo', 'agencia'].includes(p)) && (
              <Card className="border-border/50 border-green-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Grade de Comissão
                  </CardTitle>
                  <CardDescription>Atribua uma grade de comissionamento a este usuário</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="grade_comissao">Grade</Label>
                    <Select
                      value={formData.grade_comissao_id || 'none'}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, grade_comissao_id: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione uma grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma grade</SelectItem>
                        {gradesDisponiveis.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define os percentuais de comissão aplicados a este consultor/agência
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-lg">Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Usuário ativo</p>
                    <p className="text-xs text-muted-foreground">Inativos não acessam o sistema</p>
                  </div>
                  <Switch checked={formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} />
                </div>
              </CardContent>
            </Card>

            {isEditing && (isDiretor || isAdminMaster) && usuario?.user_id && (
              <Card className="border-border/50 border-amber-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="w-5 h-5 text-amber-500" />
                    Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="novoEmail">Novo email</Label>
                    <Input id="novoEmail" type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="novo@email.com" className="bg-background" />
                    <Button type="button" variant="outline" className="w-full" onClick={alterarEmail} disabled={alterandoEmail || !novoEmail}>
                      {alterandoEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                      Alterar Email
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="novaSenha">Nova senha</Label>
                    <Input id="novaSenha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 8 caracteres" className="bg-background" />
                    <Button type="button" variant="outline" className="w-full border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-400 dark:hover:bg-amber-500/10" onClick={redefinirSenha} disabled={alterandoSenha || !novaSenha}>
                      {alterandoSenha ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Redefinir Senha
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">As alterações são aplicadas imediatamente</p>
                </CardContent>
              </Card>
            )}

            {isEditing && usuario?.roles?.some((r: string) => ['vendedor_clt', 'vendedor_externo'].includes(r)) && (
              <VendedorMetricasCard userId={usuario.user_id} navigate={navigate} />
            )}

            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-lg">Resumo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Perfis</span>
                  <span className="font-medium">{formData.perfis.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium capitalize">{formData.tipo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium ${formData.ativo ? 'text-green-500' : 'text-red-500'}`}>
                    {formData.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button type="submit" className="w-full" disabled={saveUser.isPending}>
                {saveUser.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isEditing ? 'Salvar alterações' : 'Criar usuário'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/configuracoes/usuarios')} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
