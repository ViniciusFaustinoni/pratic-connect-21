import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, User, Shield, TrendingUp, History, Lock, Mail } from 'lucide-react';
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
const perfisDisponiveis = [
  { value: 'diretor', label: 'Diretor', desc: 'Acesso total ao sistema' },
  { value: 'gerente_comercial', label: 'Gerente Comercial', desc: 'Vendas, relatórios e equipe' },
  { value: 'supervisor_vendas', label: 'Supervisor de Vendas', desc: 'Vendas da equipe' },
  { value: 'vendedor_clt', label: 'Vendedor CLT', desc: 'Vendas próprias' },
  { value: 'vendedor_externo', label: 'Vendedor Externo', desc: 'Vendas próprias' },
  { value: 'analista_cadastro', label: 'Analista de Cadastro', desc: 'Documentos e associados' },
  { value: 'coordenador_monitoramento', label: 'Coord. Monitoramento', desc: 'Instalações e rotas' },
  { value: 'analista_plataforma', label: 'Analista de Plataforma', desc: 'Rastreadores' },
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', desc: 'App instalador' },
  { value: 'vistoriador_base', label: 'Vistoriador Base', desc: 'Vistorias agendadas na base' },
  { value: 'analista_marketing', label: 'Analista de Marketing', desc: 'Campanhas e leads' },
  { value: 'analista_juridico', label: 'Analista Jurídico', desc: 'Processos e contratos' },
];

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

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    senha: '',
    tipo: 'funcionario',
    ativo: true,
    perfis: preselectedPerfil ? [preselectedPerfil] : [] as string[],
  });

  // Estado para erros de validação de campos específicos
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Estados para alteração de email e senha (admin)
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [alterandoEmail, setAlterandoEmail] = useState(false);
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  // Função para alterar email (admin)
  const alterarEmail = async () => {
    if (!novoEmail) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoEmail)) {
      toast.error('Digite um email válido');
      return;
    }
    
    setAlterandoEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-email', {
        body: { userId: usuario?.user_id, novoEmail }
      });
      
      if (error || data?.error) throw new Error(data?.error || error.message);
      
      toast.success('Email alterado com sucesso!');
      setNovoEmail('');
      // Atualizar dados do formulário
      setFormData(prev => ({ ...prev, email: novoEmail }));
      queryClient.invalidateQueries({ queryKey: ['usuario-edit', id] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar email');
    } finally {
      setAlterandoEmail(false);
    }
  };

  // Função para redefinir senha (admin)
  const redefinirSenha = async () => {
    if (novaSenha.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    
    setAlterandoSenha(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: usuario?.user_id, novaSenha }
      });
      
      if (error || data?.error) throw new Error(data?.error || error.message);
      
      toast.success('Senha redefinida com sucesso!');
      setNovaSenha('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha');
    } finally {
      setAlterandoSenha(false);
    }
  };

  // Buscar usuário existente
  const { data: usuario, isLoading } = useQuery({
    queryKey: ['usuario-edit', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (profileError) throw profileError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.user_id);
      
      if (rolesError) throw rolesError;

      return {
        ...profile,
        roles: roles?.map(r => r.role) || []
      };
    },
    enabled: isEditing
  });

  useEffect(() => {
    if (!usuario) return;

    const next = {
      nome: usuario.nome || '',
      email: usuario.email || '',
      telefone: usuario.telefone || '',
      cpf: usuario.cpf || '',
      senha: '',
      tipo: usuario.tipo || 'funcionario',
      ativo: usuario.ativo ?? true,
      perfis: usuario.roles || [],
    };

    // Evita loop: só atualiza o estado se algo realmente mudou
    setFormData((prev) => {
      const same =
        prev.nome === next.nome &&
        prev.email === next.email &&
        prev.telefone === next.telefone &&
        prev.cpf === next.cpf &&
        prev.tipo === next.tipo &&
        prev.ativo === next.ativo &&
        prev.perfis.length === next.perfis.length &&
        prev.perfis.every((p, i) => p === next.perfis[i]);

      return same ? prev : next;
    });
  }, [usuario]);

  // Salvar usuário
  const saveUser = useMutation({
    mutationFn: async () => {
      if (isEditing && usuario) {
        // Atualizar profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            cpf: formData.cpf,
            tipo: formData.tipo as any,
            ativo: formData.ativo,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (profileError) throw profileError;

        // Remover roles antigas
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', usuario.user_id);

        // Adicionar novas roles
        if (formData.perfis.length > 0) {
          const { error: rolesError } = await supabase
            .from('user_roles')
            .insert(
              formData.perfis.map(role => ({
                user_id: usuario.user_id,
                role: role as any
              }))
            );
          
          if (rolesError) throw rolesError;
        }
      } else {
        // Criar novo usuário via Edge Function
        // Limpar erros de campo anteriores
        setFieldErrors({});
        
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            nome: formData.nome,
            email: formData.email,
            telefone: formData.telefone,
            cpf: formData.cpf,
            senha: formData.senha,
            tipo: formData.tipo,
            perfis: formData.perfis,
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
      
      // Detectar erros de duplicidade e mostrar no campo específico
      if (errorMessage.includes('CPF já está cadastrado')) {
        setFieldErrors(prev => ({ ...prev, cpf: 'Este CPF já está cadastrado no sistema' }));
        toast.error('CPF já cadastrado. Por favor, verifique os dados.');
      } else if (errorMessage.includes('email já está em uso') || errorMessage.includes('already been registered')) {
        setFieldErrors(prev => ({ ...prev, email: 'Este email já está cadastrado no sistema' }));
        toast.error('Email já cadastrado. Por favor, verifique os dados.');
      } else {
        toast.error(errorMessage);
      }
    }
  });

  const handleProfileChange = useCallback((perfilId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      perfis: checked
        ? [...prev.perfis, perfilId].sort()
        : prev.perfis.filter(p => p !== perfilId)
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
                    <Input 
                      id="nome" 
                      value={formData.nome} 
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                      className="bg-background" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input 
                      id="cpf" 
                      value={formData.cpf} 
                      onChange={(e) => {
                        setFormData({ ...formData, cpf: e.target.value });
                        // Limpar erro do campo ao digitar
                        if (fieldErrors.cpf) {
                          setFieldErrors(prev => ({ ...prev, cpf: '' }));
                        }
                      }}
                      placeholder="000.000.000-00" 
                      className={`bg-background ${fieldErrors.cpf ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {fieldErrors.cpf && (
                      <p className="text-xs text-red-500 font-medium">{fieldErrors.cpf}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        // Limpar erro do campo ao digitar
                        if (fieldErrors.email) {
                          setFieldErrors(prev => ({ ...prev, email: '' }));
                        }
                      }}
                      className={`bg-background ${fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      disabled={isEditing} 
                      required 
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-red-500 font-medium">{fieldErrors.email}</p>
                    )}
                    {isEditing && !fieldErrors.email && (
                      <p className="text-xs text-muted-foreground">
                        {(isDiretor || isAdminMaster) 
                          ? 'Use o painel de Segurança para alterar o email' 
                          : 'Email não pode ser alterado'}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input 
                      id="telefone" 
                      value={formData.telefone} 
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} 
                      placeholder="(00) 00000-0000" 
                      className="bg-background" 
                    />
                    </div>
                  </div>

                {/* Campo de senha - apenas para novos usuários */}
                {!isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha de acesso *</Label>
                    <Input 
                      id="senha" 
                      type="password" 
                      value={formData.senha} 
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })} 
                      placeholder="Mínimo 6 caracteres" 
                      className="bg-background" 
                      required 
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Senha inicial para o usuário acessar o sistema
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de usuário *</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
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
                        formData.perfis.includes(perfil.value) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border/50 hover:border-border'
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
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Usuário ativo</p>
                    <p className="text-xs text-muted-foreground">Inativos não acessam o sistema</p>
                  </div>
                  <Switch 
                    checked={formData.ativo} 
                    onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card de Segurança - apenas para Diretor/Admin Master em modo edição */}
            {isEditing && (isDiretor || isAdminMaster) && usuario?.user_id && (
              <Card className="border-border/50 border-amber-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="w-5 h-5 text-amber-500" />
                    Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Alterar Email */}
                  <div className="space-y-2">
                    <Label htmlFor="novoEmail">Novo email</Label>
                    <Input
                      id="novoEmail"
                      type="email"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      placeholder="novo@email.com"
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={alterarEmail}
                      disabled={alterandoEmail || !novoEmail}
                    >
                      {alterandoEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                      Alterar Email
                    </Button>
                  </div>

                  <Separator />

                  {/* Redefinir Senha */}
                  <div className="space-y-2">
                    <Label htmlFor="novaSenha">Nova senha</Label>
                    <Input
                      id="novaSenha"
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                      onClick={redefinirSenha}
                      disabled={alterandoSenha || !novaSenha}
                    >
                      {alterandoSenha ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Redefinir Senha
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    As alterações são aplicadas imediatamente
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Card de Métricas de Vendas - Só aparece para vendedores */}
            {isEditing && usuario?.roles?.some((r: string) => ['vendedor_clt', 'vendedor_externo'].includes(r)) && (
              <VendedorMetricasCard userId={usuario.user_id} navigate={navigate} />
            )}

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Resumo</CardTitle>
              </CardHeader>
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
