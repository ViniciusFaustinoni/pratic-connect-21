import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Botão administrativo para deslogar todos os usuários conectados
 * (útil para refresh de cache de permissões/perfis).
 *
 * - Visível apenas para Diretor (gating de UI).
 * - Autorização real continua server-side na edge `deslogar-todos-usuarios`.
 * - A sessão do Diretor que aciona NÃO é encerrada.
 */
export function DeslogarTodosUsuariosButton() {
  const { isDiretor } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  if (!isDiretor) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('deslogar-todos-usuarios');
      if (error) throw error;
      const total = (data as { total_deslogados?: number } | null)?.total_deslogados ?? 0;
      toast.success(`${total} ${total === 1 ? 'usuário desconectado' : 'usuários desconectados'}`);
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao deslogar usuários';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Deslogar todos os usuários</span>
          <span className="sm:hidden">Deslogar todos</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Todos os usuários conectados serão desconectados imediatamente e precisarão refazer o login no próximo acesso.
            Sua sessão de Diretor permanecerá ativa. Esta ação será registrada em log de auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, deslogar todos'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeslogarTodosUsuariosButton;
