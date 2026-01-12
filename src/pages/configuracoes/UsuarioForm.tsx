import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, User, Shield, TrendingUp, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useVendedorStats } from '@/hooks/useVendedorHistorico';

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

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    tipo: 'funcionario',
    ativo: true,
    perfis: preselectedPerfil ? [preselectedPerfil] : [] as string[],
  });

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
    if (usuario) {
      setFormData({
        nome: usuario.nome || '',
        email: usuario.email || '',
        telefone: usuario.telefone || '',
        cpf: usuario.cpf || '',
        tipo: usuario.tipo || 'funcionario',
        ativo: usuario.ativo ?? true,
        perfis: usuario.roles || [],
      });
    }
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
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            nome: formData.nome,
            email: formData.email,
            telefone: formData.telefone,
            cpf: formData.cpf,
            tipo: formData.tipo,
            perfis: formData.perfis,
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Usuário atualizado!' : 'Usuário criado!');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      navigate('/configuracoes/usuarios');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar usuário');
    }
  });

  const handlePerfilToggle = (perfil: string) => {
    setFormData(prev => ({
      ...prev,
      perfis: prev.perfis.includes(perfil)
        ? prev.perfis.filter(p => p !== perfil)
        : [...prev.perfis, perfil]
    }));
  };

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
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} 
                      placeholder="000.000.000-00" 
                      className="bg-background" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                      className="bg-background" 
                      disabled={isEditing} 
                      required 
                    />
                    {isEditing && <p className="text-xs text-muted-foreground">Email não pode ser alterado</p>}
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

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de usuário *</Label>
                  <Select 
                    key={`tipo-${formData.tipo}`}
                    value={formData.tipo} 
                    onValueChange={(v) => setFormData({ ...formData, tipo: v })}
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
                    <div 
                      key={perfil.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.perfis.includes(perfil.value) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border/50 hover:border-border'
                      }`}
                      onClick={() => handlePerfilToggle(perfil.value)}
                    >
                      <Checkbox 
                        checked={formData.perfis.includes(perfil.value)}
                        onCheckedChange={() => handlePerfilToggle(perfil.value)}
                      />
                      <div>
                        <p className="font-medium text-sm">{perfil.label}</p>
                        <p className="text-xs text-muted-foreground">{perfil.desc}</p>
                      </div>
                    </div>
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
