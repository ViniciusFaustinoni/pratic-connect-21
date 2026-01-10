import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Search, MoreHorizontal, 
  UserCheck, UserX, Edit, Trash2, Shield, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsuarios, useUsuarioActions } from '@/hooks/useUsuarios';
import { toast } from 'sonner';
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

const perfisConfig: Record<string, { label: string; color: string }> = {
  diretor: { label: 'Diretor', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  gerente_comercial: { label: 'Gerente Comercial', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  supervisor_vendas: { label: 'Supervisor', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  vendedor_clt: { label: 'Vendedor CLT', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  vendedor_externo: { label: 'Vendedor Externo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
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

export default function Usuarios() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { usuarios, isLoading, refetch } = useUsuarios({
    filters: {
      tipo: filterTipo !== 'todos' ? filterTipo as any : undefined,
      status: filterStatus !== 'todos' ? filterStatus as any : undefined,
      search: search || undefined,
    },
    pagination: { page: 1, pageSize: 100 }
  });

  const { desativarUsuario, ativarUsuario, resetarSenha } = useUsuarioActions();
  
  const stats = {
    total: usuarios.length,
    ativos: usuarios.filter(u => u.ativo).length,
    inativos: usuarios.filter(u => !u.ativo).length,
    funcionarios: usuarios.filter(u => u.tipo === 'funcionario').length,
  };

  const getInitials = (name: string) => 
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const handleDesativar = async (id: string) => {
    try {
      desativarUsuario(id);
      toast.success('Usuário desativado');
      refetch();
    } catch {
      toast.error('Erro ao desativar usuário');
    }
  };

  const handleAtivar = async (id: string) => {
    try {
      ativarUsuario(id);
      toast.success('Usuário ativado');
      refetch();
    } catch {
      toast.error('Erro ao ativar usuário');
    }
  };

  const handleResetarSenha = async (email: string) => {
    try {
      resetarSenha(email);
      toast.success('Email de recuperação enviado');
    } catch {
      toast.error('Erro ao enviar email');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Button onClick={() => navigate('/configuracoes/usuarios/novo')}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Cards Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-primary bg-primary/10' },
          { label: 'Ativos', value: stats.ativos, icon: UserCheck, color: 'text-green-500 bg-green-500/10' },
          { label: 'Inativos', value: stats.inativos, icon: UserX, color: 'text-red-500 bg-red-500/10' },
          { label: 'Funcionários', value: stats.funcionarios, icon: Shield, color: 'text-blue-500 bg-blue-500/10' },
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="funcionario">Funcionário</SelectItem>
            <SelectItem value="associado">Associado</SelectItem>
            <SelectItem value="prestador">Prestador</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Perfis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/50">
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((usuario) => (
                <TableRow 
                  key={usuario.id} 
                  className="border-border/50 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/configuracoes/usuarios/${usuario.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={usuario.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(usuario.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{usuario.nome}</p>
                        <p className="text-xs text-muted-foreground">{usuario.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={tiposUsuario[usuario.tipo]?.color}>
                      {tiposUsuario[usuario.tipo]?.label || usuario.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {usuario.roles?.slice(0, 2).map((role, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className={`text-xs ${perfisConfig[role]?.color || 'bg-gray-500/20 text-gray-400'}`}
                        >
                          {perfisConfig[role]?.label || role}
                        </Badge>
                      ))}
                      {(usuario.roles?.length || 0) > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(usuario.roles?.length || 0) - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.ativo ? 'default' : 'secondary'} className="gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${usuario.ativo ? 'bg-green-500' : 'bg-gray-500'}`} />
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/configuracoes/usuarios/${usuario.id}`); }}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResetarSenha(usuario.email); }}>
                          <Key className="w-4 h-4 mr-2" /> Resetar senha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {usuario.ativo ? (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(usuario.id); }}
                            className="text-red-500"
                          >
                            <UserX className="w-4 h-4 mr-2" /> Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleAtivar(usuario.id); }}
                            className="text-green-500"
                          >
                            <UserCheck className="w-4 h-4 mr-2" /> Ativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário não poderá mais acessar o sistema até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { if (deleteConfirm) handleDesativar(deleteConfirm); setDeleteConfirm(null); }}
              className="bg-red-500 hover:bg-red-600"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
