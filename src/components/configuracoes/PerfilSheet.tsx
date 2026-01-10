import { useState, useCallback } from 'react';
import { Check, X, Users, ArrowRight, Eye, Pencil, Save } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Perfil } from './PerfilCard';
import { PermissionSelect } from './PermissionSelect';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface Modulo {
  id: string;
  label: string;
}

type PermValue = boolean | 'read' | 'own';

interface PerfilSheetProps {
  perfil: Perfil | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modulos: Modulo[];
  matriz: Record<string, Record<string, PermValue>>;
  usuarios: Array<{ id: string; nome: string; email: string }>;
  onUsuarioClick?: (userId: string) => void;
  onPermissionChange?: (perfilId: string, moduloId: string, value: PermValue) => void;
}

const PermBadge = ({ value }: { value: PermValue }) => {
  if (value === true) {
    return (
      <Badge className="gap-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/30">
        <Check className="w-3 h-3" />
        Total
      </Badge>
    );
  }
  if (value === 'read') {
    return (
      <Badge className="gap-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/30">
        <Eye className="w-3 h-3" />
        Leitura
      </Badge>
    );
  }
  if (value === 'own') {
    return (
      <Badge className="gap-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30">
        <Pencil className="w-3 h-3" />
        Próprios
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground/50 border-muted-foreground/20">
      <X className="w-3 h-3" />
      Sem acesso
    </Badge>
  );
};

export function PerfilSheet({ 
  perfil, 
  open, 
  onOpenChange, 
  modulos, 
  matriz,
  usuarios,
  onUsuarioClick,
  onPermissionChange
}: PerfilSheetProps) {
  const { canManagePermissions, isDesenvolvedor, isDiretor } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, PermValue>>({});
  
  if (!perfil) return null;

  const perfilPermissoes = matriz[perfil.id] || {};
  const permissoesAtivas = modulos.filter(m => perfilPermissoes[m.id] && perfilPermissoes[m.id] !== false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedPermissions({});
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedPermissions({});
  };

  const handlePermChange = (moduloId: string, value: PermValue) => {
    setEditedPermissions(prev => ({ ...prev, [moduloId]: value }));
  };

  const handleSave = () => {
    // Aplicar alterações via callback se fornecido
    Object.entries(editedPermissions).forEach(([moduloId, value]) => {
      onPermissionChange?.(perfil.id, moduloId, value);
    });
    
    setIsEditing(false);
    setEditedPermissions({});
    
    if (isDesenvolvedor || isDiretor) {
      toast.success('Permissões atualizadas!');
    } else {
      toast.success('Solicitação enviada para aprovação!');
    }
  };

  const hasChanges = Object.keys(editedPermissions).length > 0;
  const getPermValue = (moduloId: string): PermValue => {
    return editedPermissions[moduloId] ?? perfilPermissoes[moduloId] ?? false;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => {
      if (!o) {
        setIsEditing(false);
        setEditedPermissions({});
      }
      onOpenChange(o);
    }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <div className="p-6 border-b border-border/50 bg-gradient-to-br from-muted/30 to-background">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-4 h-4 rounded-full ring-2 ring-offset-2 ring-offset-background ring-primary/30", perfil.color)} />
                <SheetTitle className="text-xl">{perfil.label}</SheetTitle>
              </div>
              {canManagePermissions && !isEditing && (
                <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Button>
              )}
            </div>
            <SheetDescription className="text-left mt-2">
              {perfil.descricao}
            </SheetDescription>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary">{perfil.area}</Badge>
              <Badge variant="outline" className="gap-1">
                <Users className="w-3 h-3" />
                {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}
              </Badge>
            </div>
          </SheetHeader>
        </div>
        
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Permissões */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Permissões ({permissoesAtivas.length}/{modulos.length} módulos)
                {isEditing && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Editando
                  </Badge>
                )}
              </h4>
              <div className="space-y-2">
                {modulos.map(m => {
                  const perm = getPermValue(m.id);
                  const hasAccess = perm === true || perm === 'read' || perm === 'own';
                  const isModified = editedPermissions[m.id] !== undefined;
                  
                  return (
                    <div 
                      key={m.id} 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-colors",
                        hasAccess ? "bg-muted/50" : "bg-muted/20",
                        isModified && "ring-1 ring-amber-500/30 bg-amber-500/5"
                      )}
                    >
                      <span className={cn(
                        "font-medium text-sm",
                        hasAccess ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {m.label}
                      </span>
                      {isEditing ? (
                        <PermissionSelect
                          value={perm}
                          onChange={(value) => handlePermChange(m.id, value)}
                        />
                      ) : (
                        <PermBadge value={perm || false} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Usuários */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Usuários com este perfil
              </h4>
              {usuarios.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum usuário com este perfil</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {usuarios.map(user => (
                    <button
                      key={user.id}
                      onClick={() => onUsuarioClick?.(user.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group text-left"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {user.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {user.nome}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-muted/30">
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCancelEdit}>
                Cancelar
              </Button>
              <Button 
                className="flex-1 gap-1.5" 
                onClick={handleSave}
                disabled={!hasChanges}
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
