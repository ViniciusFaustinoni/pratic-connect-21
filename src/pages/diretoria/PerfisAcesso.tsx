import { useState } from 'react';
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
  Eye,
  Radio,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppRoles } from '@/hooks/useAppRoles';

/** Map icon_name from DB to Lucide component */
const ICON_MAP: Record<string, LucideIcon> = {
  Crown, Shield, Briefcase, Users, UserCheck, UserPlus, FileCheck,
  Megaphone, Scale, MapPin, Monitor, Wrench, User, Eye, Radio, Building2,
};

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
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const { roles: appRoles, getRoleLabel, getRoleColor, isLoading: rolesLoading } = useAppRoles();

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

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await (supabase as any)
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-map'] });
      queryClient.invalidateQueries({ queryKey: ['roles-contagem'] });
    },
    onError: () => { toast.error('Erro ao atribuir perfil'); }
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await (supabase as any)
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
    onError: () => { toast.error('Erro ao remover perfil'); }
  });

  const handleOpenEditModal = (user: UserProfile) => {
    if (!user.user_id) {
      toast.error('Usuário sem conta vinculada');
      return;
    }
    setEditingUser(user);
    setSelectedRoles(userRoles?.[user.user_id] || []);
  };

  const handleCloseEditModal = () => {
    setEditingUser(null);
    setSelectedRoles([]);
  };

  const handleToggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSaveRoles = async () => {
    if (!editingUser?.user_id) return;

    const currentRoles = userRoles?.[editingUser.user_id] || [];
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
            {appRoles.map(roleConfig => {
              const count = contagem?.[roleConfig.role] || 0;
              const IconComponent = ICON_MAP[roleConfig.icon_name] || Shield;

              return (
                <Card key={roleConfig.role}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg bg-${roleConfig.color}-500/20 text-${roleConfig.color}-400`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {roleConfig.area}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{roleConfig.label}</CardTitle>
                    <CardDescription>{roleConfig.description}</CardDescription>
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
                              roles.map(role => (
                                <Badge key={role} variant="secondary" className="text-xs">
                                  {getRoleLabel(role)}
                                </Badge>
                              ))
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
              {appRoles.filter(r => r.role !== 'associado').map(roleConfig => {
                const IconComponent = iconMap[roleConfig.icon_name] || Shield;
                const isSelected = selectedRoles.includes(roleConfig.role);

                return (
                  <div
                    key={roleConfig.role}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                    onClick={() => handleToggleRole(roleConfig.role)}
                  >
                    <Checkbox checked={isSelected} />
                    <div className={`p-1.5 rounded bg-${roleConfig.color}-500/20 text-${roleConfig.color}-400`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{roleConfig.label}</p>
                      <p className="text-xs text-muted-foreground">{roleConfig.description}</p>
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
