import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsuarios, useUsuarioActions, type UsuarioFilters, type ProfileWithRoles } from '@/hooks/useUsuarios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  UserX, 
  UserCheck, 
  KeyRound, 
  X, 
  Users,
  Shield,
  Ban,
  Unlock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPO_USUARIO_LABELS, PERFIL_ACESSO_LABELS, type PerfilAcesso, type TipoUsuario } from '@/types/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovoFuncionarioModal } from '@/components/usuarios/NovoFuncionarioModal';

// ============================================
// CORES DOS BADGES DE PERFIL
// ============================================
const PERFIL_COLORS: Record<PerfilAcesso, string> = {
  diretor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  gerente_comercial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  supervisor_vendas: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  vendedor_clt: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  vendedor_externo: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  analista_cadastro: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  coordenador_monitoramento: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  analista_plataforma: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  instalador_vistoriador: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  vistoriador_base: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  associado: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  analista_marketing: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  analista_juridico: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function UsuariosPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Estado de filtros
  const [filters, setFilters] = useState<UsuarioFilters>({
    search: '',
    tipo: 'funcionario',
    perfil: 'todos',
    status: 'todos',
  });
  
  // Estado de paginação
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Estado do modal de novo funcionário
  const [showNovoFuncionarioModal, setShowNovoFuncionarioModal] = useState(false);

  // Estado do modal de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'desativar' | 'ativar' | 'resetar' | 'bloquear' | 'desbloquear';
    usuario: ProfileWithRoles | null;
  }>({ open: false, type: 'desativar', usuario: null });

  // Buscar usuários
  const { usuarios, pagination, isLoading, error } = useUsuarios({
    filters,
    pagination: { page, pageSize },
  });

  // Ações
  const { 
    desativarUsuario, 
    ativarUsuario, 
    bloquearUsuario,
    desbloquearUsuario,
    resetarSenhaEmail, 
    isLoading: actionLoading 
  } = useUsuarioActions();

  // ============================================
  // HANDLERS
  // ============================================
  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setPage(1);
  };

  const handleFilterChange = (key: keyof UsuarioFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      tipo: 'funcionario',
      perfil: 'todos',
      status: 'todos',
    });
    setPage(1);
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.usuario) return;

    switch (confirmDialog.type) {
      case 'desativar':
        desativarUsuario(confirmDialog.usuario.id);
        break;
      case 'ativar':
        ativarUsuario(confirmDialog.usuario.id);
        break;
      case 'bloquear':
        bloquearUsuario({ profileId: confirmDialog.usuario.id });
        break;
      case 'desbloquear':
        desbloquearUsuario(confirmDialog.usuario.id);
        break;
      case 'resetar':
        resetarSenhaEmail(confirmDialog.usuario.email);
        break;
    }

    setConfirmDialog({ open: false, type: 'desativar', usuario: null });
  };

  // Não permitir ações no próprio usuário
  const isSelf = (usuario: ProfileWithRoles) => usuario.user_id === profile?.user_id;

  // ============================================
  // FILTROS ATIVOS
  // ============================================
  const hasActiveFilters = 
    filters.search || 
    filters.tipo !== 'funcionario' || 
    filters.perfil !== 'todos' || 
    filters.status !== 'todos';

  // Mascarar CPF
  const maskCPF = (cpf: string | null) => {
    if (!cpf) return null;
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**');
  };

  // Status badge
  const getStatusBadge = (usuario: ProfileWithRoles) => {
    if (usuario.bloqueado) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (!usuario.ativo) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Ativo</Badge>;
  };

  const totalPages = Math.ceil(pagination.total / pageSize) || 1;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/diretoria/perfis')}>
            <Shield className="h-4 w-4 mr-2" />
            Perfis de Acesso
          </Button>
          <Button onClick={() => setShowNovoFuncionarioModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Busca */}
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou CPF..."
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tipo */}
            <Select
              value={filters.tipo}
              onValueChange={(value) => handleFilterChange('tipo', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="funcionario">Funcionário</SelectItem>
                <SelectItem value="associado">Associado</SelectItem>
                <SelectItem value="prestador">Prestador</SelectItem>
              </SelectContent>
            </Select>

            {/* Perfil */}
            <Select
              value={filters.perfil}
              onValueChange={(value) => handleFilterChange('perfil', value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                {Object.entries(PERFIL_ACESSO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
                <SelectItem value="bloqueado">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtros ativos */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Filtros:</span>
              {filters.search && (
                <Badge variant="secondary">Busca: {filters.search}</Badge>
              )}
              {filters.tipo !== 'funcionario' && (
                <Badge variant="secondary">
                  Tipo: {TIPO_USUARIO_LABELS[filters.tipo as TipoUsuario] || filters.tipo}
                </Badge>
              )}
              {filters.perfil !== 'todos' && (
                <Badge variant="secondary">
                  Perfil: {PERFIL_ACESSO_LABELS[filters.perfil as PerfilAcesso]}
                </Badge>
              )}
              {filters.status !== 'todos' && (
                <Badge variant="secondary">
                  Status: {filters.status === 'ativo' ? 'Ativos' : filters.status === 'inativo' ? 'Inativos' : 'Bloqueados'}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TABELA */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-destructive">
              Erro ao carregar usuários: {error.message}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Nenhum usuário encontrado</h3>
              <p className="text-muted-foreground mt-1">
                {hasActiveFilters 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Nenhum usuário cadastrado no sistema'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario) => (
                    <TableRow key={usuario.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">{usuario.nome}</p>
                          {usuario.cpf && (
                            <p className="text-xs text-muted-foreground">
                              {maskCPF(usuario.cpf)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {usuario.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPO_USUARIO_LABELS[usuario.tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                          {usuario.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Sem perfil</span>
                          ) : (
                            usuario.roles.slice(0, 3).map((perfil) => (
                              <Badge
                                key={perfil}
                                className={cn('text-xs', PERFIL_COLORS[perfil])}
                              >
                                {PERFIL_ACESSO_LABELS[perfil]}
                              </Badge>
                            ))
                          )}
                          {usuario.roles.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{usuario.roles.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(usuario)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {usuario.data_ultimo_acesso 
                          ? format(new Date(usuario.data_ultimo_acesso), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/diretoria/usuarios/${usuario.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={() => setConfirmDialog({ 
                                open: true, 
                                type: 'resetar', 
                                usuario 
                              })}
                            >
                              <KeyRound className="h-4 w-4 mr-2" />
                              Resetar senha
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {usuario.ativo ? (
                              <DropdownMenuItem 
                                onClick={() => setConfirmDialog({ 
                                  open: true, 
                                  type: 'desativar', 
                                  usuario 
                                })}
                                disabled={isSelf(usuario)}
                                className="text-orange-600"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Desativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => setConfirmDialog({ 
                                  open: true, 
                                  type: 'ativar', 
                                  usuario 
                                })}
                                className="text-green-600"
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Ativar
                              </DropdownMenuItem>
                            )}

                            {usuario.bloqueado ? (
                              <DropdownMenuItem 
                                onClick={() => setConfirmDialog({ 
                                  open: true, 
                                  type: 'desbloquear', 
                                  usuario 
                                })}
                                className="text-green-600"
                              >
                                <Unlock className="h-4 w-4 mr-2" />
                                Desbloquear
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => setConfirmDialog({ 
                                  open: true, 
                                  type: 'bloquear', 
                                  usuario 
                                })}
                                disabled={isSelf(usuario)}
                                className="text-destructive"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Bloquear
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* PAGINAÇÃO */}
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, pagination.total)} de {pagination.total} usuários
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= pagination.total}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* DIALOG DE CONFIRMAÇÃO */}
      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'desativar' && 'Desativar usuário'}
              {confirmDialog.type === 'ativar' && 'Ativar usuário'}
              {confirmDialog.type === 'bloquear' && 'Bloquear usuário'}
              {confirmDialog.type === 'desbloquear' && 'Desbloquear usuário'}
              {confirmDialog.type === 'resetar' && 'Resetar senha'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'desativar' && (
                <>
                  Tem certeza que deseja desativar o usuário <strong>{confirmDialog.usuario?.nome}</strong>?
                  <br />
                  <span className="text-orange-600">Ele não poderá mais acessar o sistema.</span>
                </>
              )}
              {confirmDialog.type === 'ativar' && (
                <>
                  Tem certeza que deseja ativar o usuário <strong>{confirmDialog.usuario?.nome}</strong>?
                  <br />
                  <span className="text-green-600">Ele poderá acessar o sistema novamente.</span>
                </>
              )}
              {confirmDialog.type === 'bloquear' && (
                <>
                  Tem certeza que deseja bloquear o usuário <strong>{confirmDialog.usuario?.nome}</strong>?
                  <br />
                  <span className="text-destructive">O acesso será bloqueado imediatamente.</span>
                </>
              )}
              {confirmDialog.type === 'desbloquear' && (
                <>
                  Tem certeza que deseja desbloquear o usuário <strong>{confirmDialog.usuario?.nome}</strong>?
                  <br />
                  <span className="text-green-600">O usuário poderá acessar o sistema novamente.</span>
                </>
              )}
              {confirmDialog.type === 'resetar' && (
                <>
                  Um email será enviado para <strong>{confirmDialog.usuario?.email}</strong> com instruções para redefinir a senha.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={actionLoading}>
              {confirmDialog.type === 'desativar' && 'Desativar'}
              {confirmDialog.type === 'ativar' && 'Ativar'}
              {confirmDialog.type === 'bloquear' && 'Bloquear'}
              {confirmDialog.type === 'desbloquear' && 'Desbloquear'}
              {confirmDialog.type === 'resetar' && 'Enviar email'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Novo Funcionário */}
      <NovoFuncionarioModal
        open={showNovoFuncionarioModal}
        onOpenChange={setShowNovoFuncionarioModal}
        onSuccess={() => {
          // Refetch será automático pelo React Query
        }}
      />
    </div>
  );
}
