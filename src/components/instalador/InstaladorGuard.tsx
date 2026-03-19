import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface InstaladorGuardProps {
  children: React.ReactNode;
}

export function InstaladorGuard({ children }: InstaladorGuardProps) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);

  // Detectar troca de usuário e limpar cache de queries sensíveis
  useEffect(() => {
    if (user?.id && lastUserIdRef.current && user.id !== lastUserIdRef.current) {
      console.warn('[InstaladorGuard] Troca de usuário detectada, limpando cache');
      queryClient.removeQueries({ queryKey: ['tarefa-atual'] });
      queryClient.removeQueries({ queryKey: ['vistoria-completa'] });
      queryClient.removeQueries({ queryKey: ['vistoria-completa-servico'] });
      queryClient.removeQueries({ queryKey: ['servicos'] });
      queryClient.removeQueries({ queryKey: ['servicos-historico'] });
    }
    lastUserIdRef.current = user?.id ?? null;
  }, [user?.id, queryClient]);

  // Timeout de loading para evitar tela branca infinita
  const [loadingTooLong, setLoadingTooLong] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingTooLong(false);
      return;
    }

    const timer = setTimeout(async () => {
      console.warn('[InstaladorGuard] Loading > 10s, tentando refresh da sessão...');
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('[InstaladorGuard] Refresh falhou:', error);
          setLoadingTooLong(true);
        }
      } catch {
        setLoadingTooLong(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && loadingTooLong) {
    return <Navigate to="/instalador/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/instalador/login" state={{ from: location }} replace />;
  }

  // Verificar se tem a role de instalador/vistoriador (role unificada)
  if (!hasRole('instalador_vistoriador')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
          <p className="mt-2 text-slate-400">
            Você não tem permissão para acessar o App do Instalador.
          </p>
          <button
            onClick={() => window.location.href = '/auth'}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Voltar para Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
