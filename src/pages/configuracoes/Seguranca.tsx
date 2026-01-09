import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Shield, Key, Smartphone, Monitor, LogOut, Loader2, 
  Eye, EyeOff, AlertTriangle, CheckCircle, Circle, Laptop
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Sessao {
  id: string;
  tipo_dispositivo: string;
  navegador: string | null;
  sistema_operacional: string | null;
  ip: string;
  ultimo_acesso: string;
  created_at: string;
  ativo: boolean;
}

export default function Seguranca() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Buscar sessões ativas
  const { data: sessoes, isLoading: loadingSessoes } = useQuery({
    queryKey: ['sessoes-ativas', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from('auth_sessoes')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('ativo', true)
        .order('ultimo_acesso', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar sessões:', error);
        return [];
      }
      
      return (data || []) as Sessao[];
    },
    enabled: !!profile?.id,
  });

  // Alterar senha
  const changePassword = useMutation({
    mutationFn: async () => {
      if (passwords.new !== passwords.confirm) {
        throw new Error('As senhas não coincidem');
      }
      if (passwords.new.length < 8) {
        throw new Error('A senha deve ter pelo menos 8 caracteres');
      }
      
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!');
      setPasswords({ current: '', new: '', confirm: '' });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao alterar senha');
    }
  });

  // Encerrar sessão específica
  const endSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('auth_sessoes')
        .update({ ativo: false })
        .eq('id', sessionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sessão encerrada');
      queryClient.invalidateQueries({ queryKey: ['sessoes-ativas'] });
    },
    onError: () => toast.error('Erro ao encerrar sessão')
  });

  // Encerrar todas as sessões
  const logoutAllSessions = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Todas as sessões foram encerradas');
      window.location.href = '/login';
    }
  });

  // Password validation helpers
  const hasMinLength = passwords.new.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwords.new);
  const hasNumber = /[0-9]/.test(passwords.new);

  const getDeviceIcon = (tipo: string) => {
    switch (tipo) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'desktop':
        return <Monitor className="h-5 w-5" />;
      default:
        return <Laptop className="h-5 w-5" />;
    }
  };

  const formatLastAccess = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return '-';
    }
  };

  // Determinar sessão atual (simplificado - em produção usar token)
  const currentSessionId = sessoes?.[0]?.id;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground">Gerencie sua senha e sessões ativas</p>
      </div>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Use uma senha forte com pelo menos 8 caracteres</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="••••••••"
                  className="bg-background pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-background pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Repita a nova senha"
                className="bg-background"
              />
            </div>

            {/* Password requirements */}
            {passwords.new && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">A senha deve conter:</p>
                <div className="grid gap-1 text-xs">
                  <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {hasMinLength ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    Mínimo 8 caracteres
                  </div>
                  <div className={`flex items-center gap-2 ${hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {hasUppercase ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    Uma letra maiúscula
                  </div>
                  <div className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {hasNumber ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    Um número
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Autenticação em Dois Fatores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Smartphone className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">2FA não configurado</p>
                <p className="text-sm text-muted-foreground">Proteja sua conta com autenticação em dois fatores</p>
              </div>
            </div>
            <Badge variant="outline">Em breve</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sessões Ativas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Sessões Ativas
              </CardTitle>
              <CardDescription>Dispositivos conectados à sua conta</CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Encerrar todas
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar todas as sessões?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá desconectar sua conta de todos os dispositivos, incluindo este.
                    Você precisará fazer login novamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => logoutAllSessions.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Encerrar todas
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loadingSessoes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessoes && sessoes.length > 0 ? (
              sessoes.map((session, index) => {
                const isCurrent = index === 0; // Primeira sessão é a mais recente
                return (
                  <div 
                    key={session.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isCurrent ? 'bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isCurrent ? 'bg-primary/10' : 'bg-muted'}`}>
                        {getDeviceIcon(session.tipo_dispositivo)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {session.navegador || 'Navegador desconhecido'} 
                            {session.sistema_operacional && ` • ${session.sistema_operacional}`}
                          </p>
                          {isCurrent && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Este dispositivo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatLastAccess(session.ultimo_acesso)}
                        </p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => endSession.mutate(session.id)}
                        disabled={endSession.isPending}
                      >
                        Encerrar
                      </Button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma sessão ativa encontrada</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zona de Perigo */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Desativar minha conta</p>
              <p className="text-sm text-muted-foreground">Você perderá acesso ao sistema</p>
            </div>
            <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" disabled>
              Desativar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
