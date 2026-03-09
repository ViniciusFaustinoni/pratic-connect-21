import { useState } from 'react';
import { useUsuarioActions } from '@/hooks/useUsuarios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Plus, Trash2, Check, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppRoles } from '@/hooks/useAppRoles';
import type { ProfileWithRoles, RoleRecord } from '@/hooks/useUsuarios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GerenciarPerfisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: ProfileWithRoles;
}

export function GerenciarPerfisModal({
  open,
  onOpenChange,
  usuario,
}: GerenciarPerfisModalProps) {
  const [perfilSelecionado, setPerfilSelecionado] = useState<string>('');
  const [confirmRemover, setConfirmRemover] = useState<RoleRecord | null>(null);
  const { getRoleLabel, getRoleOptions, getRoleBadgeClass } = useAppRoles();
  
  const { 
    adicionarPerfil, 
    removerPerfil, 
    isAddingPerfil, 
    isRemovingPerfil 
  } = useUsuarioActions();

  const roleRecords = usuario.roleRecords || [];
  const roles = usuario.roles || [];
  
  // Perfis que ainda podem ser adicionados (exclui associado e os já atribuídos)
  const allOptions = getRoleOptions(true);
  const perfisDisponiveis = allOptions.filter(
    opt => !roles.includes(opt.value)
  );

  const handleAdicionar = () => {
    if (!perfilSelecionado || !usuario.user_id) return;
    
    adicionarPerfil(
      {
        userId: usuario.user_id,
        role: perfilSelecionado,
      },
      {
        onSuccess: () => {
          setPerfilSelecionado('');
        },
      }
    );
  };

  const handleConfirmarRemocao = () => {
    if (!confirmRemover) return;
    
    removerPerfil(confirmRemover.id, {
      onSuccess: () => {
        setConfirmRemover(null);
      },
    });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gerenciar Perfis
            </DialogTitle>
            <DialogDescription>
              {usuario.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* SEÇÃO: PERFIS ATIVOS */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Perfis Ativos ({roleRecords.length})
              </h4>
              
              {roleRecords.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum perfil atribuído</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {roleRecords.map((record) => (
                    <div 
                      key={record.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        getRoleBadgeClass(record.role)
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Check className="h-4 w-4" />
                        <div>
                          <p className="font-medium">
                            {getRoleLabel(record.role)}
                          </p>
                          <p className="text-xs opacity-70 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Adicionado em {formatDate(record.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => setConfirmRemover(record)}
                        disabled={isRemovingPerfil}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* SEÇÃO: ADICIONAR PERFIL */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Adicionar Novo Perfil
              </h4>
              
              {perfisDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Todos os perfis já foram atribuídos
                </p>
              ) : (
                <div className="flex gap-2">
                  <Select value={perfilSelecionado} onValueChange={setPerfilSelecionado}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfisDisponiveis.map((perfil) => (
                        <SelectItem key={perfil.value} value={perfil.value}>
                          {perfil.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={handleAdicionar}
                    disabled={!perfilSelecionado || isAddingPerfil || !usuario.user_id}
                  >
                    {isAddingPerfil ? (
                      'Adicionando...'
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {perfisDisponiveis.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Perfis disponíveis: {perfisDisponiveis.map(p => p.label).join(', ')}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE CONFIRMAÇÃO DE REMOÇÃO */}
      <AlertDialog open={!!confirmRemover} onOpenChange={(open) => !open && setConfirmRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o perfil{' '}
              <strong>{confirmRemover && getRoleLabel(confirmRemover.role)}</strong>{' '}
              de <strong>{usuario.nome}</strong>?
              <br />
              <br />
              O usuário perderá as permissões associadas a este perfil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmarRemocao}
              disabled={isRemovingPerfil}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingPerfil ? 'Removendo...' : 'Remover Perfil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
