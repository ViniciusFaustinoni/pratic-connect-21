import { supabase } from '@/integrations/supabase/client';

interface BloqueioResult {
  bloqueado: boolean;
  permanente: boolean;
  mensagem: string;
  minutos_restantes?: number;
}

interface TentativaResult {
  sucesso: boolean;
  bloqueado: boolean;
  permanente: boolean;
  tentativas_restantes: number;
  minutos?: number;
}

interface SessaoResult {
  success: boolean;
  token?: string;
  error?: string;
}

// Detectar tipo de dispositivo
export function detectarDispositivo(): 'desktop' | 'mobile' {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  return isMobile ? 'mobile' : 'desktop';
}

// Obter IP aproximado
export async function obterIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

// Verificar se email está bloqueado
export async function verificarBloqueio(email: string): Promise<BloqueioResult> {
  try {
    const { data, error } = await supabase.functions.invoke('auth-tentativas', {
      body: { 
        action: 'verificar', 
        email: email.toLowerCase().trim() 
      }
    });

    if (error) {
      console.error('Erro ao verificar bloqueio:', error);
      return { bloqueado: false, permanente: false, mensagem: '' };
    }

    if (data?.bloqueado) {
      return {
        bloqueado: true,
        permanente: data.permanente || false,
        mensagem: data.mensagem || 'Conta bloqueada temporariamente.',
        minutos_restantes: data.minutos_restantes
      };
    }

    return { bloqueado: false, permanente: false, mensagem: '' };
  } catch (err) {
    console.error('Erro ao verificar bloqueio:', err);
    return { bloqueado: false, permanente: false, mensagem: '' };
  }
}

// Registrar tentativa de login
export async function registrarTentativa(
  email: string, 
  sucesso: boolean, 
  motivo_falha?: string
): Promise<TentativaResult> {
  try {
    const ip = await obterIP();
    
    const { data, error } = await supabase.functions.invoke('auth-tentativas', {
      body: { 
        action: 'registrar', 
        email: email.toLowerCase().trim(),
        ip,
        sucesso,
        motivo_falha
      }
    });

    if (error) {
      console.error('Erro ao registrar tentativa:', error);
      return { sucesso: false, bloqueado: false, permanente: false, tentativas_restantes: 0 };
    }

    return {
      sucesso: data?.sucesso ?? false,
      bloqueado: data?.bloqueado ?? false,
      permanente: data?.permanente ?? false,
      tentativas_restantes: data?.tentativas_restantes ?? 0,
      minutos: data?.minutos
    };
  } catch (err) {
    console.error('Erro ao registrar tentativa:', err);
    return { sucesso: false, bloqueado: false, permanente: false, tentativas_restantes: 0 };
  }
}

// Criar sessão customizada
export async function criarSessao(
  profileId: string, 
  tipoDispositivo: 'desktop' | 'mobile'
): Promise<SessaoResult> {
  try {
    const ip = await obterIP();
    
    const { data, error } = await supabase.functions.invoke('auth-session', {
      body: { 
        action: 'create', 
        profile_id: profileId,
        tipo_dispositivo: tipoDispositivo,
        ip,
        user_agent: navigator.userAgent
      }
    });

    if (error) {
      console.error('Erro ao criar sessão:', error);
      return { success: false, error: 'Erro ao criar sessão' };
    }

    if (data?.success && data?.token) {
      return { success: true, token: data.token };
    }

    return { success: false, error: data?.error || 'Erro desconhecido' };
  } catch (err) {
    console.error('Erro ao criar sessão:', err);
    return { success: false, error: 'Erro ao criar sessão' };
  }
}

// Encerrar sessão
export async function encerrarSessao(token: string): Promise<boolean> {
  try {
    const ip = await obterIP();
    
    const { error } = await supabase.functions.invoke('auth-session', {
      body: { 
        action: 'logout', 
        token,
        ip,
        user_agent: navigator.userAgent
      }
    });

    return !error;
  } catch (err) {
    console.error('Erro ao encerrar sessão:', err);
    return false;
  }
}

// Validar sessão existente
export async function validarSessao(token: string): Promise<boolean> {
  try {
    const ip = await obterIP();
    
    const { data, error } = await supabase.functions.invoke('auth-session', {
      body: { 
        action: 'validate', 
        token,
        ip,
        user_agent: navigator.userAgent
      }
    });

    if (error) return false;
    return data?.success ?? false;
  } catch {
    return false;
  }
}

export const SESSION_TOKEN_KEY = 'sga_session_token';
