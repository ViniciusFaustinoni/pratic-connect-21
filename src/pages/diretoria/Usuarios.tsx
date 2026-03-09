import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsuarios, useUsuarioActions, type UsuarioFilters, type ProfileWithRoles } from '@/hooks/useUsuarios';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRoles } from '@/hooks/useAppRoles';
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
import { TIPO_USUARIO_LABELS, type TipoUsuario } from '@/types/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovoFuncionarioModal } from '@/components/usuarios/NovoFuncionarioModal';

export default function UsuariosPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getRoleLabel, getRoleBadgeClass, getRoleOptions } = useAppRoles();
  
  const [filters, setFilters] = useState<UsuarioFilters>({
    search: '',
    tipo: 'funcionario',
    perfil: 'todos',
    status: 'todos',
  });
  
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [showNovoFuncionarioModal, setShowNovoFuncionarioModal] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'desativar' | 'ativar' | 'resetar' | 'bloquear' | 'desbloquear';
    usuario: ProfileWithRoles | null;
  }>({ open: false, type: 'desativar', usuario: null });

  const { usuarios, pagination, isLoading, error } = useUsuarios({
    filters,
    pagination: { page, pageSize },
  });

  const { 
    desativarUsuario, 
    ativarUsuario, 
    bloquearUsuario,
    desbloquearUsuario,
    resetarSenhaEmail, 
    isLoading: actionLoading 
  } = useUsuarioActions();

  // Options para o select de perfil (incluindo associado para filtro)
  const roleOptions = getRoleOptions(false);

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

  const isSelf = (usuario: ProfileWithRoles) => usuario.user_id === profile?.user_id;

  const hasActiveFilters = 
    filters.search || 
    filters.tipo !== 'funcionario' || 
    filters.perfil !== 'todos' || 
    filters.status !== 'todos';

  const maskCPF = (cpf: string | null) => {
    if (!cpf) return null;
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**');
  };

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
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou CPF..."
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

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

            <Select
              value={filters.perfil}
              onValueChange={(value) => handleFilterChange('perfil', value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                  Perfil: {getRoleLabel(filters.perfil)}
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
                                className={cn('text-xs border', getRoleBadgeClass(perfil))}
                              >
                                {getRoleLabel(perfil)}
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

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Novo Funcionário */}
      <NovoFuncionarioModal
        open={showNovoFuncionarioModal}
        onOpenChange={setShowNovoFuncionarioModal}
        onSuccess={() => {}}
      />

      {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
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
                <>Tem certeza que deseja desativar <strong>{confirmDialog.usuario?.nome}</strong>? O usuário não poderá mais acessar o sistema.</>
              )}
              {confirmDialog.type === 'ativar' && (
                <>Tem certeza que deseja ativar <strong>{confirmDialog.usuario?.nome}</strong>?</>
              )}
              {confirmDialog.type === 'bloquear' && (
                <>Tem certeza que deseja bloquear <strong>{confirmDialog.usuario?.nome}</strong>? O acesso será revogado imediatamente.</>
              )}
              {confirmDialog.type === 'desbloquear' && (
                <>Tem certeza que deseja desbloquear <strong>{confirmDialog.usuario?.nome}</strong>?</>
              )}
              {confirmDialog.type === 'resetar' && (
                <>Um email será enviado para <strong>{confirmDialog.usuario?.email}</strong> com instruções para redefinir a senha.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={actionLoading}>
              {actionLoading ? 'Aguarde...' : (
                <>
                  {confirmDialog.type === 'desativar' && 'Desativar'}
                  {confirmDialog.type === 'ativar' && 'Ativar'}
                  {confirmDialog.type === 'bloquear' && 'Bloquear'}
                  {confirmDialog.type === 'desbloquear' && 'Desbloquear'}
                  {confirmDialog.type === 'resetar' && 'Enviar email'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
