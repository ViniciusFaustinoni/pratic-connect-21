import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TIPOS
// ============================================
interface SessionTimeoutConfig {
  /** Tempo de inatividade até expirar (em segundos) */
  timeoutDuration: number;
  /** Tempo antes de expirar para mostrar aviso (em segundos) */
  warningBefore: number;
  /** Callback quando sessão expira */
  onTimeout: () => void;
  /** Callback quando aviso deve ser mostrado */
  onWarning?: () => void;
  /** Habilitado ou não */
  enabled?: boolean;
}

interface SessionTimeoutState {
  /** Mostrando modal de aviso */
  showWarning: boolean;
  /** Segundos restantes até expirar */
  remainingTime: number;
  /** Se o timeout está ativo */
  isActive: boolean;
}

// ============================================
// EVENTOS DE ATIVIDADE
// ============================================
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'wheel',
] as const;

// ============================================
// HOOK
// ============================================
export function useSessionTimeout({
  timeoutDuration,
  warningBefore,
  onTimeout,
  onWarning,
  enabled = true,
}: SessionTimeoutConfig): SessionTimeoutState & {
  resetTimeout: () => void;
  extendSession: () => void;
} {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeoutDuration);
  const [isActive, setIsActive] = useState(enabled);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // ============================================
  // LIMPAR TIMERS
  // ============================================
  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ============================================
  // INICIAR COUNTDOWN
  // ============================================
  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setRemainingTime(warningBefore);
    onWarning?.();

    countdownRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearAllTimers();
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningBefore, onWarning, onTimeout, clearAllTimers]);

  // ============================================
  // RESETAR TIMEOUT
  // ============================================
  const resetTimeout = useCallback(() => {
    if (!enabled) return;
    
    clearAllTimers();
    setShowWarning(false);
    setRemainingTime(timeoutDuration);
    lastActivityRef.current = Date.now();

    // Timer para mostrar aviso
    const warningTime = (timeoutDuration - warningBefore) * 1000;
    warningTimeoutRef.current = setTimeout(() => {
      startCountdown();
    }, warningTime);

    // Timer para timeout final (backup)
    timeoutRef.current = setTimeout(() => {
      clearAllTimers();
      onTimeout();
    }, timeoutDuration * 1000);
  }, [enabled, timeoutDuration, warningBefore, startCountdown, onTimeout, clearAllTimers]);

  // ============================================
  // ESTENDER SESSÃO
  // ============================================
  const extendSession = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  // ============================================
  // HANDLER DE ATIVIDADE
  // ============================================
  const handleActivity = useCallback(() => {
    // Só reseta se não estiver no período de warning
    if (!showWarning) {
      // Debounce: só reseta se passou pelo menos 1 segundo
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        resetTimeout();
      }
    }
  }, [showWarning, resetTimeout]);

  // ============================================
  // SETUP LISTENERS
  // ============================================
  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setIsActive(false);
      return;
    }

    setIsActive(true);
    resetTimeout();

    // Adicionar listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity, resetTimeout, clearAllTimers]);

  // ============================================
  // PAUSAR QUANDO TAB INATIVA
  // ============================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab inativa - não pausa, continua contando
      } else {
        // Tab ativa - verifica se expirou enquanto ausente
        const elapsed = (Date.now() - lastActivityRef.current) / 1000;
        if (elapsed >= timeoutDuration) {
          onTimeout();
        } else if (elapsed >= timeoutDuration - warningBefore) {
          startCountdown();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeoutDuration, warningBefore, onTimeout, startCountdown]);

  return {
    showWarning,
    remainingTime,
    isActive,
    resetTimeout,
    extendSession,
  };
}

// ============================================
// CONFIGURAÇÕES PADRÃO
// ============================================
export const SESSION_TIMEOUT_CONFIG = {
  /** Sistema Interno - 30 minutos */
  INTERNAL: {
    timeoutDuration: 30 * 60, // 1800 segundos
    warningBefore: 5 * 60,    // 300 segundos
  },
  /** App do Associado - 60 minutos */
  APP: {
    timeoutDuration: 60 * 60, // 3600 segundos
    warningBefore: 5 * 60,    // 300 segundos
  },
} as const;
