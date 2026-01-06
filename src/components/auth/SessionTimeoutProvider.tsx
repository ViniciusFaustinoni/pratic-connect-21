import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTimeout, SESSION_TIMEOUT_CONFIG } from '@/hooks/useSessionTimeout';
import { SessionTimeoutModal } from './SessionTimeoutModal';

// ============================================
// TIPOS
// ============================================
interface SessionTimeoutProviderProps {
  children: ReactNode;
  /** 'internal' para sistema, 'app' para associado */
  variant?: 'internal' | 'app';
}

// ============================================
// COMPONENTE
// ============================================
export function SessionTimeoutProvider({
  children,
  variant = 'internal',
}: SessionTimeoutProviderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Configuração baseada na variante
  const config = variant === 'internal' 
    ? SESSION_TIMEOUT_CONFIG.INTERNAL 
    : SESSION_TIMEOUT_CONFIG.APP;

  // Callback de logout
  const handleTimeout = async () => {
    await signOut();
    const loginPath = variant === 'internal' ? '/auth' : '/app/login';
    navigate(loginPath, { 
      replace: true,
      state: { reason: 'session_expired' }
    });
  };

  // Hook de timeout
  const {
    showWarning,
    remainingTime,
    extendSession,
  } = useSessionTimeout({
    timeoutDuration: config.timeoutDuration,
    warningBefore: config.warningBefore,
    onTimeout: handleTimeout,
    enabled: !!user, // Só ativa se estiver logado
  });

  return (
    <>
      {children}
      
      <SessionTimeoutModal
        open={showWarning}
        remainingTime={remainingTime}
        onExtend={extendSession}
        onLogout={handleTimeout}
      />
    </>
  );
}
