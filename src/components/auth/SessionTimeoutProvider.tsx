import { ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTimeout, SESSION_TIMEOUT_CONFIG } from '@/hooks/useSessionTimeout';
import { SessionTimeoutModal } from './SessionTimeoutModal';

interface SessionTimeoutProviderProps {
  children: ReactNode;
  variant?: 'internal' | 'app';
}

export function SessionTimeoutProvider({
  children,
  variant = 'internal',
}: SessionTimeoutProviderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const config = variant === 'internal' 
    ? SESSION_TIMEOUT_CONFIG.INTERNAL 
    : SESSION_TIMEOUT_CONFIG.APP;

  const handleTimeout = useCallback(async () => {
    await signOut();
    const loginPath = variant === 'internal' ? '/auth' : '/app/login';
    navigate(loginPath, { 
      replace: true,
      state: { reason: 'session_expired' }
    });
  }, [signOut, navigate, variant]);

  const {
    showWarning,
    remainingTime,
    extendSession,
  } = useSessionTimeout({
    timeoutDuration: config.timeoutDuration,
    warningBefore: config.warningBefore,
    onTimeout: handleTimeout,
    enabled: !!user,
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