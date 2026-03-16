import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TIPOS
// ============================================
interface SessionTimeoutConfig {
  timeoutDuration: number;
  warningBefore: number;
  onTimeout: () => void;
  onWarning?: () => void;
  enabled?: boolean;
}

interface SessionTimeoutState {
  showWarning: boolean;
  remainingTime: number;
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

  // Refs para callbacks instáveis — quebra a cascata de re-renders
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  const showWarningRef = useRef(showWarning);

  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { showWarningRef.current = showWarning; }, [showWarning]);

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
    onWarningRef.current?.();

    countdownRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearAllTimers();
          onTimeoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningBefore, clearAllTimers]);

  // ============================================
  // RESETAR TIMEOUT
  // ============================================
  const resetTimeout = useCallback(() => {
    if (!enabled) return;

    clearAllTimers();
    setShowWarning(false);
    setRemainingTime(timeoutDuration);
    lastActivityRef.current = Date.now();

    const warningTime = (timeoutDuration - warningBefore) * 1000;
    warningTimeoutRef.current = setTimeout(() => {
      startCountdown();
    }, warningTime);

    timeoutRef.current = setTimeout(() => {
      clearAllTimers();
      onTimeoutRef.current();
    }, timeoutDuration * 1000);
  }, [enabled, timeoutDuration, warningBefore, startCountdown, clearAllTimers]);

  // ============================================
  // ESTENDER SESSÃO
  // ============================================
  const extendSession = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  // ============================================
  // HANDLER DE ATIVIDADE (usa refs para estabilidade)
  // ============================================
  const handleActivity = useCallback(() => {
    if (!showWarningRef.current) {
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        resetTimeout();
      }
    }
  }, [resetTimeout]);

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

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity, resetTimeout, clearAllTimers]);

  // ============================================
  // VERIFICAR AO VOLTAR DE TAB (deps estáveis)
  // ============================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const elapsed = (Date.now() - lastActivityRef.current) / 1000;
        if (elapsed >= timeoutDuration) {
          onTimeoutRef.current();
        } else if (elapsed >= timeoutDuration - warningBefore) {
          startCountdown();
        } else {
          // Sessão ainda válida — atualiza ref para evitar falsos positivos
          lastActivityRef.current = Date.now();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeoutDuration, warningBefore, startCountdown]);

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
  INTERNAL: {
    timeoutDuration: 30 * 60,
    warningBefore: 5 * 60,
  },
  APP: {
    timeoutDuration: 60 * 60,
    warningBefore: 5 * 60,
  },
} as const;
