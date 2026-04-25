import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Edit, Key, Loader2, MoreHorizontal, Plus, Search, Shield, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useAppRoles } from '@/hooks/useAppRoles';
import { ProfileWithRoles, useUsuarioActions, useUsuarios } from '@/hooks/useUsuarios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PerfisVisibilidade = lazy(() => import('@/pages/configuracoes/Perfis'));
import { ExportarUsuariosDialog } from '@/components/configuracoes/ExportarUsuariosDialog';

const PAGE_SIZE = 20;

const TIPOS_GERENCIAVEIS = [
  { value: 'funcionario', label: 'Funcionário' },
  { value: 'prestador', label: 'Prestador' },
  { value: 'agencia', label: 'Agência' },
] as const;

const tipoLabel: Record<string, string> = {
  funcionario: 'Funcionário',
  prestador: 'Prestador',
  agencia: 'Agência',
};

function getInitials(nome?: string | null) {
  return (nome || '?')
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function UsuariosAcessos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'usuarios';

  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [perfil, setPerfil] = useState('todos');
  const [page, setPage] = useState(1);
  const [passwordDialog, setPasswordDialog] = useState<ProfileWithRoles | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<ProfileWithRoles | null>(null);
  const [senha, setSenha] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const { roles, getRoleLabel, getRolesByArea, isLoading: loadingRoles } = useAppRoles();
  const roleOptions = roles.filter(role => role.role !== 'associado');

  const { usuarios, pagination, isLoading, refetch } = useUsuarios({
    filters: {
      search: search || undefined,
      tipo: tipo !== 'todos' ? (tipo as any) : undefined,
      status: status !== 'todos' ? (status as any) : undefined,
      perfil: perfil !== 'todos' ? perfil : undefined,
    },
    pagination: { page, pageSize: PAGE_SIZE },
  });

  const {
    ativarUsuario,
    desativarUsuario,
    resetarSenhaAdmin,
    excluirUsuario,
    isResettingPassword,
    isDeletingUser,
  } = useUsuarioActions();

  const rolesByArea = useMemo(() => getRolesByArea(), [roles]);
  const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE));

  const stats = useMemo(() => ({
    total: pagination.total,
    ativos: usuarios.filter(usuario => usuario.ativo).length,
    inativos: usuarios.filter(usuario => !usuario.ativo).length,
    perfis: roleOptions.length,
  }), [pagination.total, roleOptions.length, usuarios]);

  const changeTab = (tab: string) => setSearchParams({ tab });

  const resetPassword = async () => {
    if (!passwordDialog?.user_id) return;
    if (senha.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    await resetarSenhaAdmin({ userId: passwordDialog.user_id, novaSenha: senha });
    setPasswordDialog(null);
    setSenha('');
  };

  const deleteUser = async () => {
    if (!deleteDialog) return;
    await excluirUsuario({ profileId: deleteDialog.id, userId: deleteDialog.user_id });
    setDeleteDialog(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuários e acessos</h1>
          <p className="text-sm text-muted-foreground">
            Crie usuários internos, altere tipos, atribua perfis e mantenha acessos operacionais.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => navigate('/configuracoes/usuarios/novo')} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo usuário
          </Button>
        </div>
      </div>

      <ExportarUsuariosDialog open={exportOpen} onOpenChange={setExportOpen} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric title="Total" value={stats.total} icon={Users} />
        <Metric title="Ativos" value={stats.ativos} icon={UserCheck} />
        <Metric title="Inativos" value={stats.inativos} icon={UserX} />
        <Metric title="Perfis" value={stats.perfis} icon={Shield} />
      </div>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de perfis</TabsTrigger>
          <TabsTrigger value="visibilidade">Matriz de acessos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Gerenciamento</CardTitle>
              <CardDescription>
                Tela exclusiva para usuários internos: funcionários, prestadores, agências, técnicos e equipe comercial. Associados são geridos em Associados.
              </CardDescription>
              <div className="grid gap-2 pt-2 md:grid-cols-[1fr_180px_180px_220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={event => { setSearch(event.target.value); setPage(1); }}
                    placeholder="Buscar por nome, email ou CPF"
                    className="pl-9"
                  />
                </div>
                <Select value={tipo} onValueChange={value => { setTipo(value); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    {TIPOS_GERENCIAVEIS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="inativo">Inativos</SelectItem>
                    <SelectItem value="bloqueado">Bloqueados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={perfil} onValueChange={value => { setPerfil(value); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os perfis</SelectItem>
                    {roleOptions.map(role => (
                      <SelectItem key={role.role} value={role.role}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
                </div>
              ) : usuarios.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Perfis</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuarios.map(usuario => (
                        <TableRow key={usuario.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback>{getInitials(usuario.nome)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{usuario.nome}</p>
                                <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{tipoLabel[usuario.tipo] || usuario.tipo}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-md flex-wrap gap-1">
                              {usuario.roles.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Sem perfil</span>
                              ) : usuario.roles.map(role => (
                                <Badge key={role} variant="outline" className="text-xs">
                                  {getRoleLabel(role)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={usuario.ativo ? 'default' : 'outline'}>
                              {usuario.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {usuario.created_at ? format(new Date(usuario.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/configuracoes/usuarios/${usuario.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" /> Editar usuário
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPasswordDialog(usuario)} disabled={!usuario.user_id}>
                                  <Key className="mr-2 h-4 w-4" /> Redefinir senha
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {usuario.ativo ? (
                                  <DropdownMenuItem onClick={() => desativarUsuario(usuario.id)}>
                                    <UserX className="mr-2 h-4 w-4" /> Desativar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => ativarUsuario(usuario.id)}>
                                    <UserCheck className="mr-2 h-4 w-4" /> Ativar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteDialog(usuario)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir definitivamente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>{pagination.total} usuário(s)</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page === 1}>
                    Anterior
                  </Button>
                  <span>Página {page} de {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tipos" className="space-y-4">
          {loadingRoles ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            Object.entries(rolesByArea).map(([area, areaRoles]) => (
              <Card key={area}>
                <CardHeader>
                  <CardTitle className="text-base">{area}</CardTitle>
                  <CardDescription>{areaRoles.length} perfil(is) de acesso configurado(s)</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {areaRoles.filter(role => role.role !== 'associado').map(role => (
                    <div key={role.role} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{role.label}</p>
                        <Badge variant="outline">{role.sigla}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{role.description || 'Sem descrição'}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="visibilidade">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PerfisVisibilidade />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Dialog open={!!passwordDialog} onOpenChange={open => { if (!open) { setPasswordDialog(null); setSenha(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {passwordDialog?.nome}. A alteração é aplicada imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={senha}
              onChange={event => setSenha(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordDialog(null); setSenha(''); }}>Cancelar</Button>
            <Button onClick={resetPassword} disabled={isResettingPassword || senha.length < 8}>
              {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={open => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o perfil e o acesso de {deleteDialog?.nome}. Use apenas quando tiver certeza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              disabled={isDeletingUser}
              className={cn('bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            >
              {isDeletingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
