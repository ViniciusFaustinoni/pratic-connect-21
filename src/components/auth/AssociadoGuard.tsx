import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AssociadoGuardProps {
  children: React.ReactNode;
}

/**
 * Guard para rotas que só podem ser acessadas por associados
 * Redireciona funcionários para /dashboard e não autenticados para /app/login
 * Bloqueia acesso de associados com veículo reprovado
 */
export function AssociadoGuard({ children }: AssociadoGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Buscar dados do associado para verificar bloqueio
  const { data: associadoData, isLoading: isLoadingAssociado } = useQuery({
    queryKey: ['associado-guard', profile?.id],
    queryFn: async () => {
      if (!profile?.id || profile?.tipo !== 'associado') return null;

      const { data } = await supabase
        .from('associados')
        .select('id, status, bloqueado, motivo_bloqueio')
        .eq('user_id', user?.id)
        .maybeSingle();

      return data;
    },
    enabled: !!profile?.id && profile?.tipo === 'associado',
    staleTime: 30000, // 30 segundos
  });

  if (loading || isLoadingAssociado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  // Verificar primeiro_acesso - forçar definição de senha
  if (profile?.primeiro_acesso) {
    return <Navigate to="/definir-senha" replace />;
  }

  // Se é funcionário, redirecionar para o dashboard interno
  if (profile?.tipo === 'funcionario') {
    return <Navigate to="/dashboard" replace />;
  }

  // Se é prestador, redirecionar para o dashboard (ou área de prestadores quando existir)
  if (profile?.tipo === 'prestador') {
    return <Navigate to="/dashboard" replace />;
  }

  // BLACKLIST: Se associado está bloqueado por veículo reprovado, mostrar tela de reprovação
  if (
    associadoData?.status === 'bloqueado' && 
    associadoData?.motivo_bloqueio === 'VEICULO_REPROVADO'
  ) {
    return <Navigate to="/app/veiculo-reprovado" replace />;
  }

  return <>{children}</>;
}
