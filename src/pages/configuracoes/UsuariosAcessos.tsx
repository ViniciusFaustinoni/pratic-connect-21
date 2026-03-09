import { useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, UserCheck, UserX, BadgeDollarSign, Shield, FileText, 
  Search, Plus, MoreHorizontal, Edit, Key, ExternalLink, 
  Upload, Download, Crown, Briefcase, UserPlus, FileCheck, 
  Megaphone, Scale, MapPin, Monitor, Wrench, User, LogIn, 
  LogOut, AlertTriangle, Trash, Settings, LucideIcon, Eye, EyeOff, Grid3X3,
  RefreshCw, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { useUsuarios, useUsuarioActions, ProfileWithRoles } from '@/hooks/useUsuarios';
import { useVendedores, useVendedoresContagem } from '@/hooks/useVendedores';
import { ImportarUsuariosDialog } from '@/components/usuarios/ImportarUsuariosDialog';
import { useAppRoles } from '@/hooks/useAppRoles';

const PerfisVisibilidade = lazy(() => import('@/pages/configuracoes/Perfis'));

// ==================== CONFIGS ====================

const perfisConfig: Record<string, { label: string; color: string }> = {
  diretor: { label: 'Diretor', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  gerente_comercial: { label: 'Gerente Comercial', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  supervisor_vendas: { label: 'Supervisor', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  vendedor_clt: { label: 'Vendedor CLT', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  vendedor_externo: { label: 'Vendedor Externo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  agencia: { label: 'Agência', color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' },
  analista_cadastro: { label: 'Analista Cadastro', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  coordenador_monitoramento: { label: 'Coord. Monitoramento', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  analista_plataforma: { label: 'Analista Plataforma', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  instalador_vistoriador: { label: 'Instalador', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  analista_marketing: { label: 'Analista Marketing', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  analista_juridico: { label: 'Analista Jurídico', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
};

const tiposUsuario: Record<string, { label: string; color: string }> = {
  funcionario: { label: 'Funcionário', color: 'bg-blue-500/20 text-blue-400' },
  associado: { label: 'Associado', color: 'bg-green-500/20 text-green-400' },
  prestador: { label: 'Prestador', color: 'bg-orange-500/20 text-orange-400' },
};

type AppRole = 
  | 'diretor'
  | 'gerente_comercial'
  | 'supervisor_vendas'
  | 'vendedor_clt'
  | 'vendedor_externo'
  | 'analista_cadastro'
  | 'analista_marketing'
  | 'analista_juridico'
  | 'coordenador_monitoramento'
  | 'analista_plataforma'
  | 'instalador_vistoriador'
  | 'associado'
  | 'agencia';

interface RoleConfig {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

const rolesConfig: Record<AppRole, RoleConfig> = {
  diretor: { label: 'Diretor', desc: 'Acesso total ao sistema', icon: Crown, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  gerente_comercial: { label: 'Gerente Comercial', desc: 'Vendas, cadastro e relatórios', icon: Briefcase, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  supervisor_vendas: { label: 'Supervisor de Vendas', desc: 'Equipe e metas de vendas', icon: Users, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  vendedor_clt: { label: 'Vendedor CLT', desc: 'Leads e cotações', icon: UserCheck, color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
  vendedor_externo: { label: 'Vendedor Externo', desc: 'Leads e cotações (comissionado)', icon: UserPlus, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  analista_cadastro: { label: 'Analista de Cadastro', desc: 'Documentos e associados', icon: FileCheck, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  analista_marketing: { label: 'Analista de Marketing', desc: 'Campanhas e métricas', icon: Megaphone, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  analista_juridico: { label: 'Analista Jurídico', desc: 'Processos e consultas', icon: Scale, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  coordenador_monitoramento: { label: 'Coordenador de Monitoramento', desc: 'Rastreadores e rotas', icon: MapPin, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  analista_plataforma: { label: 'Analista de Plataforma', desc: 'Monitoramento e alertas', icon: Monitor, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  instalador_vistoriador: { label: 'Instalador/Vistoriador', desc: 'App de campo', icon: Wrench, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  associado: { label: 'Associado', desc: 'App do associado', icon: User, color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  agencia: { label: 'Agência', desc: 'Parceiro de vendas', icon: Briefcase, color: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200' },
};

const allRoles = Object.keys(rolesConfig) as AppRole[];

const acoesConfig: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  login: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  logout: { label: 'Logout', icon: LogOut, color: 'text-gray-500 bg-gray-500/10' },
  login_sucesso: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  login_falha: { label: 'Login Falhou', icon: AlertTriangle, color: 'text-red-500 bg-red-500/10' },
  criar: { label: 'Criação', icon: Plus, color: 'text-blue-500 bg-blue-500/10' },
  editar: { label: 'Edição', icon: Edit, color: 'text-yellow-500 bg-yellow-500/10' },
  excluir: { label: 'Exclusão', icon: Trash, color: 'text-red-500 bg-red-500/10' },
  alterar_senha: { label: 'Senha', icon: Key, color: 'text-purple-500 bg-purple-500/10' },
  alterar_perfil: { label: 'Perfil', icon: Shield, color: 'text-cyan-500 bg-cyan-500/10' },
  ativar: { label: 'Ativação', icon: User, color: 'text-green-500 bg-green-500/10' },
  desativar: { label: 'Desativação', icon: User, color: 'text-orange-500 bg-orange-500/10' },
};

const PAGE_SIZE = 15;

// ==================== COMPONENT ====================

export default function UsuariosAcessos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'usuarios';
  const [activeTab, setActiveTab] = useState(initialTab);
  const queryClient = useQueryClient();
  const { roles: appRolesData, getRoleLabel, getRoleBadgeClass, getRoleOptions, isLoading: isLoadingAppRoles } = useAppRoles();
  const allRoles = appRolesData.filter(r => r.role !== 'associado').map(r => r.role);

  // ===== USUARIOS STATE =====
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPerfil, setFilterPerfil] = useState<string>('todos');
  const [page, setPage] = useState(1);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Dialogs state
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProfileWithRoles | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<ProfileWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ===== VENDEDORES STATE =====
  const [searchVendedor, setSearchVendedor] = useState('');
  const [filterTipoVendedor, setFilterTipoVendedor] = useState<string>('todos');

  // ===== PERFIS STATE =====
  const [editingUser, setEditingUser] = useState<{ id: string; user_id: string | null; nome: string; email: string | null } | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // ===== LOGS STATE =====
  const [searchLogs, setSearchLogs] = useState('');
  const [filterAcao, setFilterAcao] = useState<string>('todas');

  // ===== USUARIOS HOOKS =====
  const { usuarios, pagination, isLoading: isLoadingUsuarios, refetch: refetchUsuarios } = useUsuarios({
    filters: {
      tipo: filterTipo !== 'todos' ? filterTipo as any : undefined,
      status: filterStatus !== 'todos' ? filterStatus as any : undefined,
      search: search || undefined,
      perfil: filterPerfil !== 'todos' ? filterPerfil as any : undefined,
    },
    pagination: { page, pageSize: PAGE_SIZE }
  });
  
  const { 
    desativarUsuario, 
    ativarUsuario, 
    resetarSenhaAdmin,
    excluirUsuario,
    isResettingPassword,
    isDeletingUser 
  } = useUsuarioActions();

  // ===== VENDEDORES HOOKS =====
  const { data: vendedores, isLoading: isLoadingVendedores } = useVendedores();
  const { data: contagemVendedores } = useVendedoresContagem();

  // ===== PERFIS HOOKS =====
  const { data: contagemPerfis } = useQuery({
    queryKey: ['roles-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('role');
      if (error) throw error;
      const cont: Record<string, number> = {};
      data?.forEach(ur => { cont[ur.role] = (cont[ur.role] || 0) + 1; });
      return cont;
    }
  });

  const { data: usuariosPerfis } = useQuery({
    queryKey: ['usuarios-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, user_id, nome, email').eq('tipo', 'funcionario').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles-map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      data?.forEach(ur => { if (!map[ur.user_id]) map[ur.user_id] = []; map[ur.user_id].push(ur.role); });
      return map;
    }
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-map'] });
      queryClient.invalidateQueries({ queryKey: ['roles-contagem'] });
    },
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-map'] });
      queryClient.invalidateQueries({ queryKey: ['roles-contagem'] });
    },
  });

  // ===== LOGS HOOKS =====
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['logs-auditoria', searchLogs, filterAcao],
    queryFn: async () => {
      let query = supabase.from('auth_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (searchLogs) query = query.or(`email.ilike.%${searchLogs}%`);
      if (filterAcao !== 'todas') query = query.eq('acao', filterAcao);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // ===== STATS =====
  const stats = {
    total: pagination.total,
    ativos: usuarios.filter(u => u.ativo).length,
    inativos: usuarios.filter(u => !u.ativo).length,
    vendedores: vendedores?.length || 0,
  };

  // ===== PAGINATION =====
  const totalPages = Math.ceil(pagination.total / PAGE_SIZE);
  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, pagination.total);

  // ===== HELPERS =====
  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleDesativar = async (id: string) => {
    try {
      desativarUsuario(id);
      toast.success('Usuário desativado');
      refetchUsuarios();
    } catch {
      toast.error('Erro ao desativar usuário');
    }
  };

  const handleAtivar = async (id: string) => {
    try {
      ativarUsuario(id);
      toast.success('Usuário ativado');
      refetchUsuarios();
    } catch {
      toast.error('Erro ao ativar usuário');
    }
  };

  const handleExcluirPermanente = async () => {
    if (!deleteConfirm) return;
    try {
      await excluirUsuario({ profileId: deleteConfirm.id, userId: deleteConfirm.user_id });
      setDeleteConfirm(null);
      refetchUsuarios();
    } catch {
      // Error handled by mutation
    }
  };

  const handleResetarSenha = async () => {
    if (!resetPasswordDialog?.user_id || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    try {
      await resetarSenhaAdmin({ userId: resetPasswordDialog.user_id, novaSenha: newPassword });
      setResetPasswordDialog(null);
      setNewPassword('');
      setShowPassword(false);
    } catch {
      // Error handled by mutation
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    setShowPassword(true);
  };

  const downloadTemplate = () => {
    const template = [{ nome: 'João Silva', telefone: '21999990000', email: 'joao@empresa.com', senha: 'Senha123!' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, 'template-importacao-usuarios.xlsx');
  };

  const handleOpenEditModal = (user: { id: string; user_id: string | null; nome: string; email: string | null }) => {
    if (!user.user_id) { toast.error('Usuário sem conta vinculada'); return; }
    setEditingUser(user);
    setSelectedRoles((userRoles?.[user.user_id] || []) as string[]);
  };

  const handleCloseEditModal = () => {
    setEditingUser(null);
    setSelectedRoles([]);
  };

  const handleToggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSaveRoles = async () => {
    if (!editingUser?.user_id) return;
    const currentRoles = (userRoles?.[editingUser.user_id] || []) as string[];
    const toAdd = selectedRoles.filter(r => !currentRoles.includes(r));
    const toRemove = currentRoles.filter(r => !selectedRoles.includes(r));
    try {
      for (const role of toAdd) await addRole.mutateAsync({ userId: editingUser.user_id, role });
      for (const role of toRemove) await removeRole.mutateAsync({ userId: editingUser.user_id, role });
      toast.success('Perfis atualizados!');
      handleCloseEditModal();
    } catch { /* handled */ }
  };

  const filteredVendedores = vendedores?.filter(v => {
    const matchSearch = !searchVendedor || v.nome?.toLowerCase().includes(searchVendedor.toLowerCase());
    const matchTipo = filterTipoVendedor === 'todos' || v.roles?.includes(filterTipoVendedor === 'clt' ? 'vendedor_clt' : 'vendedor_externo');
    return matchSearch && matchTipo;
  }) || [];

  // Reset page when filters change
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários e Acessos</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários, vendedores, perfis de acesso e logs do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Button onClick={() => navigate('/configuracoes/usuarios/novo')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Cards Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'Ativos', value: stats.ativos, icon: UserCheck, color: 'text-green-500 bg-green-500/10' },
          { label: 'Inativos', value: stats.inativos, icon: UserX, color: 'text-red-500 bg-red-500/10' },
          { label: 'Vendedores', value: stats.vendedores, icon: BadgeDollarSign, color: 'text-purple-500 bg-purple-500/10' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-muted/50 rounded-lg p-1">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="gap-2">
            <BadgeDollarSign className="h-4 w-4" />
            Vendedores
          </TabsTrigger>
          <TabsTrigger value="perfis" className="gap-2">
            <Shield className="h-4 w-4" />
            Perfis de Acesso
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs de Atividade
          </TabsTrigger>
          <TabsTrigger value="visibilidade" className="gap-2">
            <Grid3X3 className="h-4 w-4" />
            Visibilidade
          </TabsTrigger>
        </TabsList>

        {/* TAB: USUÁRIOS */}
        <TabsContent value="usuarios" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome, email ou CPF..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                className="pl-10 bg-background" 
              />
            </div>
            <Select value={filterTipo} onValueChange={(v) => handleFilterChange(setFilterTipo, v)}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="funcionario">Funcionário</SelectItem>
                <SelectItem value="associado">Associado</SelectItem>
                <SelectItem value="prestador">Prestador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPerfil} onValueChange={(v) => handleFilterChange(setFilterPerfil, v)}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                <SelectItem value="vendedor_clt">Vendedor CLT</SelectItem>
                <SelectItem value="vendedor_externo">Vendedor Externo</SelectItem>
                <SelectItem value="gerente_comercial">Gerente Comercial</SelectItem>
                <SelectItem value="supervisor_vendas">Supervisor Vendas</SelectItem>
                <SelectItem value="analista_cadastro">Analista Cadastro</SelectItem>
                <SelectItem value="diretor">Diretor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => handleFilterChange(setFilterStatus, v)}>
              <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="min-w-[200px]">Usuário</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Perfis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Criado em</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingUsuarios ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border/50">
                        <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : usuarios.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                  ) : (
                    usuarios.map((usuario) => (
                      <TableRow key={usuario.id} className="border-border/50 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/configuracoes/usuarios/${usuario.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarImage src={usuario.avatar_url || ''} />
                              <AvatarFallback className="bg-primary/10 text-primary">{getInitials(usuario.nome)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[180px]">{usuario.nome}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{usuario.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={tiposUsuario[usuario.tipo]?.color}>{tiposUsuario[usuario.tipo]?.label || usuario.tipo}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {usuario.roles?.slice(0, 2).map((role, idx) => (
                              <Badge key={idx} variant="outline" className={`text-xs ${perfisConfig[role]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                                {perfisConfig[role]?.label || role}
                              </Badge>
                            ))}
                            {(usuario.roles?.length || 0) > 2 && <Badge variant="outline" className="text-xs">+{(usuario.roles?.length || 0) - 2}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={usuario.ativo ? 'default' : 'secondary'} className="gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${usuario.ativo ? 'bg-green-500' : 'bg-gray-500'}`} />
                            {usuario.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(usuario.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/configuracoes/usuarios/${usuario.id}`); }}>
                                <Edit className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setResetPasswordDialog(usuario); }}
                                disabled={!usuario.user_id}
                              >
                                <Key className="w-4 h-4 mr-2" /> Redefinir senha
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {usuario.ativo ? (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeactivateConfirm(usuario.id); }} className="text-orange-500">
                                  <UserX className="w-4 h-4 mr-2" /> Desativar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAtivar(usuario.id); }} className="text-green-500">
                                  <UserCheck className="w-4 h-4 mr-2" /> Ativar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(usuario); }} 
                                className="text-red-500"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir permanentemente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {pagination.total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Mostrando {startItem} a {endItem} de {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB: VENDEDORES */}
        <TabsContent value="vendedores" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar vendedor..." value={searchVendedor} onChange={(e) => setSearchVendedor(e.target.value)} className="pl-10 bg-background" />
            </div>
            <Select value={filterTipoVendedor} onValueChange={setFilterTipoVendedor}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="externo">Externo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingVendedores ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50">
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredVendedores.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum vendedor encontrado</TableCell></TableRow>
                ) : (
                  filteredVendedores.map((vendedor) => {
                    const contagem = contagemVendedores?.[vendedor.user_id || ''];
                    const totalLeads = contagem?.total || 0;
                    const ganhos = contagem?.ganhos || 0;
                    const conversao = totalLeads > 0 ? Math.round((ganhos / totalLeads) * 100) : 0;
                    const isCLT = vendedor.roles?.includes('vendedor_clt');

                    return (
                      <TableRow key={vendedor.id} className="border-border/50 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/vendas/vendedores/${vendedor.user_id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={vendedor.avatar_url || ''} />
                              <AvatarFallback className="bg-primary/10 text-primary">{getInitials(vendedor.nome || '')}</AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-foreground truncate max-w-[150px]">{vendedor.nome}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">{vendedor.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={isCLT ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
                            {isCLT ? 'CLT' : 'Externo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{totalLeads}</TableCell>
                        <TableCell>
                          <span className={conversao >= 30 ? 'text-green-500' : conversao >= 15 ? 'text-yellow-500' : 'text-red-500'}>
                            {conversao}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/vendas/vendedores/${vendedor.user_id}`); }}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB: PERFIS DE ACESSO */}
        <TabsContent value="perfis" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRoles.filter(r => r !== 'associado').map(role => {
              const config = rolesConfig[role];
              const Icon = config.icon;
              const count = contagemPerfis?.[role] || 0;
              return (
                <Card key={role} className="border-l-4" style={{ borderLeftColor: role === 'diretor' ? '#a855f7' : role === 'gerente_comercial' ? '#3b82f6' : role === 'supervisor_vendas' ? '#22c55e' : role === 'vendedor_clt' ? '#14b8a6' : role === 'vendedor_externo' ? '#06b6d4' : role === 'agencia' ? '#d946ef' : role === 'analista_cadastro' ? '#f97316' : role === 'coordenador_monitoramento' ? '#ef4444' : role === 'analista_plataforma' ? '#6b7280' : role === 'instalador_vistoriador' ? '#eab308' : role === 'analista_marketing' ? '#ec4899' : role === 'analista_juridico' ? '#6366f1' : '#9ca3af' }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-xs">{count} usuário{count !== 1 ? 's' : ''}</Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{config.label}</CardTitle>
                    <CardDescription>{config.desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Perfis por Usuário</CardTitle>
              <CardDescription>Atribua ou remova perfis de acesso</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosPerfis?.map(user => {
                    const roles = user.user_id && userRoles ? userRoles[user.user_id] || [] : [];
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.nome}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {roles.length === 0 ? <span className="text-muted-foreground text-sm">Nenhum perfil</span> : roles.map(role => {
                              const cfg = rolesConfig[role as AppRole];
                              return cfg ? <Badge key={role} variant="secondary" className="text-xs">{cfg.label}</Badge> : null;
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(user)} disabled={!user.user_id}>
                            <Settings className="w-4 h-4 mr-1" /> Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: LOGS */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por email..." value={searchLogs} onChange={(e) => setSearchLogs(e.target.value)} className="pl-10 bg-background" />
            </div>
            <Select value={filterAcao} onValueChange={setFilterAcao}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tipo de ação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as ações</SelectItem>
                <SelectItem value="login_sucesso">Login</SelectItem>
                <SelectItem value="login_falha">Login Falhou</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="criar">Criação</SelectItem>
                <SelectItem value="editar">Edição</SelectItem>
                <SelectItem value="excluir">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {isLoadingLogs ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              ) : logs?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-4 opacity-50" />
                  <p>Nenhum log encontrado</p>
                </div>
              ) : (
                logs?.map((log) => {
                  const info = acoesConfig[log.acao] || { label: log.acao, icon: FileText, color: 'text-gray-500 bg-gray-500/10' };
                  const Icon = info.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(log.email?.split('@')[0] || '')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate">{log.email || 'Sistema'}</span>
                          <Badge variant="outline" className={`gap-1 ${info.color}`}><Icon className="w-3 h-3" />{info.label}</Badge>
                        </div>
                        {log.metadata && typeof log.metadata === 'object' && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{(log.metadata as any).msg || (log.metadata as any).motivo_falha || ''}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{format(new Date(log.created_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          {log.ip_address && <span className="text-muted-foreground/70">IP: {String(log.ip_address)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: VISIBILIDADE */}
        <TabsContent value="visibilidade" className="mt-6">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <PerfisVisibilidade />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Deactivate Confirm Dialog */}
      <AlertDialog open={!!deactivateConfirm} onOpenChange={() => setDeactivateConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
            <AlertDialogDescription>O usuário não poderá mais acessar o sistema até ser reativado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deactivateConfirm) handleDesativar(deactivateConfirm); setDeactivateConfirm(null); }} className="bg-orange-500 hover:bg-orange-600">Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação é <strong className="text-foreground">irreversível</strong>. O usuário <strong className="text-foreground">{deleteConfirm?.nome}</strong> será completamente removido do sistema.</p>
              <p className="text-red-500">Todos os dados associados a este usuário serão perdidos permanentemente.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExcluirPermanente} 
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeletingUser}
            >
              {isDeletingUser ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordDialog} onOpenChange={() => { setResetPasswordDialog(null); setNewPassword(''); setShowPassword(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Redefinir Senha
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{resetPasswordDialog?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={generateRandomPassword}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Gerar aleatória
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-red-500">A senha deve ter pelo menos 8 caracteres</p>
              )}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-sm text-amber-500 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                A senha atual será substituída imediatamente. O usuário precisará usar a nova senha no próximo login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordDialog(null); setNewPassword(''); setShowPassword(false); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleResetarSenha} 
              disabled={!newPassword || newPassword.length < 8 || isResettingPassword}
            >
              {isResettingPassword ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Perfis */}
      <Dialog open={!!editingUser} onOpenChange={() => handleCloseEditModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Perfis</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">Selecione os perfis para <strong>{editingUser?.nome}</strong></p>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {allRoles.filter(r => r !== 'associado').map(role => {
                const config = rolesConfig[role];
                const Icon = config.icon;
                const isSelected = selectedRoles.includes(role);
                return (
                  <div key={role} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`} onClick={() => handleToggleRole(role)}>
                    <Checkbox checked={isSelected} />
                    <div className={`p-1.5 rounded ${config.color}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditModal}>Cancelar</Button>
            <Button onClick={handleSaveRoles} disabled={addRole.isPending || removeRole.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportarUsuariosDialog open={showImportDialog} onOpenChange={setShowImportDialog} onSuccess={() => refetchUsuarios()} />
    </div>
  );
}
