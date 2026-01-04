import { useState, useMemo } from 'react';
import { 
  Shield, 
  Users, 
  Crown,
  Briefcase,
  UserCheck,
  UserPlus,
  FileCheck,
  Megaphone,
  Scale,
  MapPin,
  Monitor,
  Wrench,
  User,
  LucideIcon,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  | 'associado';

interface RoleConfig {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

const rolesConfig: Record<AppRole, RoleConfig> = {
  diretor: { 
    label: 'Diretor', 
    desc: 'Acesso total ao sistema', 
    icon: Crown, 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
  },
  gerente_comercial: { 
    label: 'Gerente Comercial', 
    desc: 'Vendas, cadastro e relatórios', 
    icon: Briefcase, 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
  },
  supervisor_vendas: { 
    label: 'Supervisor de Vendas', 
    desc: 'Equipe e metas de vendas', 
    icon: Users, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
  },
  vendedor_clt: { 
    label: 'Vendedor CLT', 
    desc: 'Leads e cotações', 
    icon: UserCheck, 
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' 
  },
  vendedor_externo: { 
    label: 'Vendedor Externo', 
    desc: 'Leads e cotações (comissionado)', 
    icon: UserPlus, 
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' 
  },
  analista_cadastro: { 
    label: 'Analista de Cadastro', 
    desc: 'Documentos e associados', 
    icon: FileCheck, 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
  },
  analista_marketing: { 
    label: 'Analista de Marketing', 
    desc: 'Campanhas e métricas', 
    icon: Megaphone, 
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' 
  },
  analista_juridico: { 
    label: 'Analista Jurídico', 
    desc: 'Processos e consultas', 
    icon: Scale, 
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' 
  },
  coordenador_monitoramento: { 
    label: 'Coordenador de Monitoramento', 
    desc: 'Rastreadores e rotas', 
    icon: MapPin, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
  },
  analista_plataforma: { 
    label: 'Analista de Plataforma', 
    desc: 'Monitoramento e alertas', 
    icon: Monitor, 
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' 
  },
  instalador_vistoriador: { 
    label: 'Instalador/Vistoriador', 
    desc: 'App de campo', 
    icon: Wrench, 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
  },
  associado: { 
    label: 'Associado', 
    desc: 'App do associado', 
    icon: User, 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' 
  },
};

const allRoles = Object.keys(rolesConfig) as AppRole[];

interface UserProfile {
  id: string;
  user_id: string | null;
  nome: string;
  email: string | null;
}

export default function PerfisAcesso() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('por-perfil');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  // Contagem de usuários por role
  const { data: contagem } = useQuery({
    queryKey: ['roles-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role');
      if (error) throw error;
      
      const cont: Record<string, number> = {};
      data?.forEach(ur => {
        cont[ur.role] = (cont[ur.role] || 0) + 1;
      });
      return cont;
    }
  });

  // Lista de usuários funcionários
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, nome, email')
        .eq('tipo', 'funcionario')
        .order('nome');
      if (error) throw error;
      return data as UserProfile[];
    }
  });

  // Roles atribuídas por usuário
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      
      const map: Record<string, string[]> = {};
      data?.forEach(ur => {
        if (!map[ur.user_id]) map[ur.user_id] = [];
        map[ur.user_id].push(ur.role);
      });
      return map;
    }
  });

  // Adicionar role a usuário
  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-map'] });
      queryClient.invalidateQueries({ queryKey: ['roles-contagem'] });
    },
    onError: () => {
      toast.error('Erro ao atribuir perfil');
    }
  });

  // Remover role de usuário
  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-map'] });
      queryClient.invalidateQueries({ queryKey: ['roles-contagem'] });
    },
    onError: () => {
      toast.error('Erro ao remover perfil');
    }
  });

  const handleOpenEditModal = (user: UserProfile) => {
    if (!user.user_id) {
      toast.error('Usuário sem conta vinculada');
      return;
    }
    setEditingUser(user);
    setSelectedRoles((userRoles?.[user.user_id] || []) as AppRole[]);
  };

  const handleCloseEditModal = () => {
    setEditingUser(null);
    setSelectedRoles([]);
  };

  const handleToggleRole = (role: AppRole) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSaveRoles = async () => {
    if (!editingUser?.user_id) return;

    const currentRoles = (userRoles?.[editingUser.user_id] || []) as AppRole[];
    const toAdd = selectedRoles.filter(r => !currentRoles.includes(r));
    const toRemove = currentRoles.filter(r => !selectedRoles.includes(r));

    try {
      for (const role of toAdd) {
        await addRole.mutateAsync({ userId: editingUser.user_id, role });
      }
      for (const role of toRemove) {
        await removeRole.mutateAsync({ userId: editingUser.user_id, role });
      }
      toast.success('Perfis atualizados!');
      handleCloseEditModal();
    } catch {
      // Error handled by mutation
    }
  };

  const getUserRoles = (userId: string | null) => {
    if (!userId || !userRoles) return [];
    return userRoles[userId] || [];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Perfis de Acesso</h1>
          <p className="text-muted-foreground">Gerencie as permissões dos usuários do sistema</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="por-perfil" className="gap-2">
            <Shield className="h-4 w-4" />
            Por Perfil
          </TabsTrigger>
          <TabsTrigger value="por-usuario" className="gap-2">
            <Users className="h-4 w-4" />
            Por Usuário
          </TabsTrigger>
        </TabsList>

        <TabsContent value="por-perfil" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRoles.map(role => {
              const config = rolesConfig[role];
              const Icon = config.icon;
              const count = contagem?.[role] || 0;

              return (
                <Card key={role}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Sistema
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{config.label}</CardTitle>
                    <CardDescription>{config.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{count} usuário{count !== 1 ? 's' : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="por-usuario" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Funcionários</CardTitle>
              <CardDescription>Gerencie os perfis de acesso de cada usuário</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios?.map(user => {
                    const roles = getUserRoles(user.user_id);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {roles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">Nenhum perfil</span>
                            ) : (
                              roles.map(role => {
                                const config = rolesConfig[role as AppRole];
                                return config ? (
                                  <Badge key={role} variant="secondary" className="text-xs">
                                    {config.label}
                                  </Badge>
                                ) : null;
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenEditModal(user)}
                            disabled={!user.user_id}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!usuarios?.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum funcionário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Editar Perfis */}
      <Dialog open={!!editingUser} onOpenChange={() => handleCloseEditModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfis</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecione os perfis para <strong>{editingUser?.nome}</strong>
            </p>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {allRoles.filter(r => r !== 'associado').map(role => {
                const config = rolesConfig[role];
                const Icon = config.icon;
                const isSelected = selectedRoles.includes(role);

                return (
                  <div
                    key={role}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                    onClick={() => handleToggleRole(role)}
                  >
                    <Checkbox checked={isSelected} />
                    <div className={`p-1.5 rounded ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
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
            <Button variant="outline" onClick={handleCloseEditModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveRoles}
              disabled={addRole.isPending || removeRole.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
