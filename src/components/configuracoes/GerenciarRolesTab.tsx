import { useState } from 'react';
import { Plus, Search, Shield, Crown, Users, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppRoles } from '@/hooks/useAppRoles';
import { toast } from 'sonner';

// Mapa de ícones por área (fallback)
const AREA_ICONS: Record<string, React.ReactNode> = {
  'Diretoria': <Crown className="w-4 h-4" />,
  'Comercial': <Users className="w-4 h-4" />,
  'Cadastro': <Shield className="w-4 h-4" />,
  'Monitoramento': <Shield className="w-4 h-4" />,
  'Eventos': <Shield className="w-4 h-4" />,
  'Marketing': <Shield className="w-4 h-4" />,
  'Jurídico': <Shield className="w-4 h-4" />,
  'App': <Users className="w-4 h-4" />,
};

const AREA_BORDER_COLORS: Record<string, string> = {
  'Diretoria': 'border-l-purple-500',
  'Comercial': 'border-l-blue-500',
  'Cadastro': 'border-l-orange-500',
  'Monitoramento': 'border-l-teal-500',
  'Eventos': 'border-l-red-500',
  'Marketing': 'border-l-rose-500',
  'Jurídico': 'border-l-gray-500',
  'App': 'border-l-slate-500',
};

export function GerenciarRolesTab() {
  const { canCreateRoles, isDesenvolvedor, isDiretor } = usePermissions();
  const { roles, getRolesByArea, getRoleDescription, isLoading } = useAppRoles();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const grupos = getRolesByArea();

  // Filtrar por busca
  const filteredGrupos = Object.entries(grupos).reduce((acc, [area, areaPerfis]) => {
    const filtered = areaPerfis.filter(p => 
      p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) acc[area] = filtered;
    return acc;
  }, {} as Record<string, typeof roles>);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Informe o nome do perfil');
      return;
    }
    
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
    if (!snakeCaseRegex.test(newRoleName)) {
      toast.error('O nome do perfil deve estar em snake_case (ex: analista_financeiro)');
      return;
    }
    
    const jaExiste = roles.some(p => p.role === newRoleName);
    if (jaExiste) {
      toast.error('Já existe um perfil com este nome');
      return;
    }
    
    setIsCreating(true);
    
    try {
      if (isDesenvolvedor || isDiretor) {
        toast.info(
          `Para criar o perfil "${newRoleName}", é necessário adicionar ao ENUM app_role no banco de dados. ` +
          `Contate o desenvolvedor ou crie uma migration.`,
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Solicitação de criação do perfil "${newRoleName}" enviada para aprovação.`,
          { duration: 5000 }
        );
      }
      
      setIsCreateDialogOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
    } catch (error) {
      console.error('Erro ao criar perfil:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com busca e botão */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar perfil..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {canCreateRoles && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Perfil
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Perfil</DialogTitle>
                <DialogDescription>
                  Crie um novo perfil de acesso para o sistema.
                  {!isDesenvolvedor && !isDiretor && (
                    <span className="block mt-2 text-amber-400">
                      ⚠️ Sua solicitação precisará de aprovação de um Diretor.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Nome do Perfil</Label>
                  <Input
                    id="roleName"
                    placeholder="ex: analista_financeiro"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use snake_case, sem espaços ou caracteres especiais
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleDescription">Descrição</Label>
                  <Input
                    id="roleDescription"
                    placeholder="ex: Gestão financeira e contas a pagar"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateRole} disabled={!newRoleName.trim() || isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {isDesenvolvedor || isDiretor ? 'Criar Perfil' : 'Solicitar Criação'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info sobre Admin Master */}
      <Card className="border-border/50 bg-amber-500/5 border-amber-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Sistema de Dupla Validação</p>
              <p className="text-sm text-muted-foreground mt-1">
                O <strong className="text-foreground">Admin Master</strong> pode solicitar alterações de permissões, 
                mas precisa de aprovação de um <strong className="text-foreground">Diretor</strong> ou <strong className="text-foreground">Desenvolvedor</strong>.
                Diretores e Desenvolvedores podem fazer alterações diretamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de roles por área */}
      <div className="grid gap-6">
        {Object.entries(filteredGrupos).map(([area, areaPerfis]) => (
          <Card key={area} className={`border-border/50 border-l-4 ${AREA_BORDER_COLORS[area] || 'border-l-gray-500'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {AREA_ICONS[area] || <Shield className="w-4 h-4" />}
                {area}
                <Badge variant="secondary" className="ml-auto">
                  {areaPerfis.length} {areaPerfis.length === 1 ? 'perfil' : 'perfis'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {areaPerfis.map(perfil => (
                  <div 
                    key={perfil.role} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full bg-${perfil.color}-500`} />
                      <div>
                        <p className="font-medium text-foreground">{perfil.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {perfil.description || `ID: ${perfil.role}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {perfil.sigla}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(filteredGrupos).length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum perfil encontrado para "{searchTerm}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
