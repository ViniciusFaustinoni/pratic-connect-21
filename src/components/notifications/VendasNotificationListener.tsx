import { useNotificacoesVendasRealtime, useLeadsRealtime } from '@/hooks/useNotificacoesVendas';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Componente que escuta notificações de vendas em tempo real
 * Deve ser renderizado dentro do contexto de autenticação
 */
export function VendasNotificationListener() {
  const { user } = useAuth();
  
  // Só ativa se usuário estiver logado
  useNotificacoesVendasRealtime();
  useLeadsRealtime();
  
  return null;
}
