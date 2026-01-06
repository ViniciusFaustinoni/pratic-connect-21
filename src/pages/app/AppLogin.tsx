import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Lock, MessageCircle, CheckCircle, FlaskConical, Copy, Check, Mail, ChevronDown, User } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  isLocked,
  recordFailedAttempt,
  resetAttempts,
  getRemainingLockTimeSeconds,
  getAttemptsRemaining,
} from '@/lib/login-rate-limit';

// ============================================
// TIPOS E CONSTANTES
// ============================================
type LoginError = 
  | 'invalid_credentials'
  | 'cpf_not_found'
  | 'account_blocked'
  | 'account_suspended'
  | 'too_many_requests'
  | 'network_error'
  | 'unknown_error';

const ERROR_MESSAGES: Record<LoginError, string> = {
  invalid_credentials: 'CPF ou senha incorretos',
  cpf_not_found: 'CPF não encontrado. Verifique os dados.',
  account_blocked: 'Sua conta está bloqueada. Entre em contato conosco.',
  account_suspended: 'Sua conta está suspensa. Regularize sua situação.',
  too_many_requests: 'Muitas tentativas. Aguarde alguns minutos.',
  network_error: 'Erro de conexão. Verifique sua internet.',
  unknown_error: 'Erro inesperado. Tente novamente.',
};

// ============================================
// CPF UTILITIES
// ============================================
function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
}

function unformatCPF(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidCPF(cpf: string): boolean {
  const numbers = unformatCPF(cpf);
  if (numbers.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais (ex: 111.111.111-11)
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;
  
  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10])) return false;
  
  return true;
}

function parseLoginError(errorMessage: string): LoginError {
  if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('incorretos')) {
    return 'invalid_credentials';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('não encontrado')) {
    return 'cpf_not_found';
  }
  if (errorMessage.includes('blocked') || errorMessage.includes('bloqueado')) {
    return 'account_blocked';
  }
  if (errorMessage.includes('suspended') || errorMessage.includes('suspenso')) {
    return 'account_suspended';
  }
  if (errorMessage.includes('Too many') || errorMessage.includes('rate limit')) {
    return 'too_many_requests';
  }
  if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    return 'network_error';
  }
  return 'unknown_error';
}

const cpfSchema = z.string().length(11, 'CPF deve ter 11 dígitos');
const emailSchema = z.string().email('Email inválido');

// Check if we're in development mode
const isDev = import.meta.env.DEV;

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function AppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, loading: authLoading } = useAuth();

  // CPF + Senha state
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | string | null>(null);
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);
  const [showCpfSenha, setShowCpfSenha] = useState(false);

  // Magic Link state
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkEnviado, setMagicLinkEnviado] = useState(false);

  // Modal states
  const [modalRecuperarSenha, setModalRecuperarSenha] = useState(false);
  const [modalPrimeiroAcesso, setModalPrimeiroAcesso] = useState(false);
  const [cpfRecuperacao, setCpfRecuperacao] = useState('');
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false);
  const [loadingRecuperacao, setLoadingRecuperacao] = useState(false);

  // Test user modal
  const [modalContaTeste, setModalContaTeste] = useState(false);
  const [loadingContaTeste, setLoadingContaTeste] = useState(false);
  const [testCredentials, setTestCredentials] = useState<{ cpf: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'cpf' | 'password' | null>(null);

  const cpfKey = unformatCPF(cpf);

  // Check lock status and countdown
  useEffect(() => {
    if (!cpfKey || cpfKey.length !== 11) {
      setAccountLocked(false);
      setLockTimeRemaining(0);
      return;
    }

    const checkLock = () => {
      if (isLocked(cpfKey)) {
        setAccountLocked(true);
        setLockTimeRemaining(getRemainingLockTimeSeconds(cpfKey));
      } else {
        setAccountLocked(false);
        setLockTimeRemaining(0);
      }
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, [cpfKey]);

  // Redirect if already logged in as associado
  useEffect(() => {
    if (user && profile?.tipo === 'associado') {
      const from = (location.state as any)?.from?.pathname || '/app/home';
      navigate(from, { replace: true });
    }
  }, [user, profile, navigate, location]);

  const formatLockTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
    setError(null);
  };

  // Google Login
  const handleGoogleLogin = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/home`
      }
    });
    if (error) setError(parseLoginError(error.message));
  };

  // Magic Link Login
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicLinkLoading(true);
    setError(null);

    const emailResult = emailSchema.safeParse(magicLinkEmail);
    if (!emailResult.success) {
      setError('invalid_credentials');
      setMagicLinkLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: magicLinkEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/app/home`
      }
    });

    setMagicLinkLoading(false);
    if (error) {
      setError(parseLoginError(error.message));
    } else {
      setMagicLinkEnviado(true);
    }
  };

  // CPF + Senha Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCPF = unformatCPF(cpf);

    // Validate CPF format and digits
    const cpfResult = cpfSchema.safeParse(rawCPF);
    if (!cpfResult.success || !isValidCPF(rawCPF)) {
      setError('invalid_credentials');
      return;
    }

    // Check if locked
    if (isLocked(rawCPF)) {
      setError('too_many_requests');
      return;
    }

    if (!password || password.length < 6) {
      setError('invalid_credentials');
      return;
    }

    setLoading(true);

    try {
      // For now, we'll use email-based auth with CPF as identifier
      // The email format will be cpf@associado.pratic.com.br
      const email = `${rawCPF}@associado.pratic.com.br`;
      const result = await signIn({ email, password });

      if (!result.success) {
        const errorMessage = result.error || 'Erro ao fazer login';
        const parsedError = parseLoginError(errorMessage);
        
        if (parsedError === 'invalid_credentials') {
          const attemptsRemaining = getAttemptsRemaining(rawCPF);
          recordFailedAttempt(rawCPF);

          if (isLocked(rawCPF)) {
            setAccountLocked(true);
            setError('too_many_requests');
          } else {
            // Keep showing attempts remaining in Portuguese
            setError(`CPF ou senha inválidos. ${attemptsRemaining - 1} tentativas restantes.`);
          }
        } else {
          setError(parsedError);
        }
      } else {
        resetAttempts(rawCPF);
      }
    } catch (err) {
      setError('unknown_error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarSenha = async () => {
    const rawCPF = unformatCPF(cpfRecuperacao);
    if (rawCPF.length !== 11) return;

    setLoadingRecuperacao(true);
    // TODO: Integrar com backend para enviar link de recuperação
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoadingRecuperacao(false);
    setRecuperacaoEnviada(true);
  };

  const closeRecuperarSenhaModal = () => {
    setModalRecuperarSenha(false);
    setCpfRecuperacao('');
    setRecuperacaoEnviada(false);
  };

  // Handle creating test account
  const handleCriarContaTeste = async () => {
    setLoadingContaTeste(true);
    setTestCredentials(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-test-user');

      if (error) throw error;

      if (data?.cpf && data?.password) {
        setTestCredentials({
          cpf: data.cpf,
          password: data.password,
        });
        toast.success('Conta de teste criada com sucesso!');
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      console.error('Erro ao criar conta teste:', err);
      toast.error(err.message || 'Erro ao criar conta de teste');
    } finally {
      setLoadingContaTeste(false);
    }
  };

  const copyToClipboard = async (text: string, field: 'cpf' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field === 'cpf' ? 'CPF' : 'Senha'} copiado!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const useTestCredentials = () => {
    if (testCredentials) {
      setCpf(formatCPF(testCredentials.cpf));
      setPassword(testCredentials.password);
      setModalContaTeste(false);
      setShowCpfSenha(true);
      toast.success('Credenciais preenchidas! Clique em Entrar.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary to-primary/80">
        <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-primary/80">
      {/* Header com Logo */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4 pt-12">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
            <Shield className="h-12 w-12 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary-foreground">PRATIC</h1>
            <p className="text-sm text-primary-foreground/80">Proteção Veicular</p>
          </div>
        </div>
      </div>

      {/* Card do Formulário */}
      <div className="w-full rounded-t-3xl bg-background px-6 pb-8 pt-6 shadow-2xl">
        <div className="mx-auto w-full max-w-sm">
          {/* Título */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-foreground">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground">Escolha uma forma de entrar</p>
          </div>

          {/* Erro geral */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {ERROR_MESSAGES[error as LoginError] || error}
              </AlertDescription>
            </Alert>
          )}

          {/* Botão Google */}
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full flex items-center justify-center gap-3 border-2 text-base font-medium"
            onClick={handleGoogleLogin}
          >
            <GoogleIcon />
            Entrar com Google
          </Button>

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Seção Magic Link */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Receba um link de acesso no seu email</p>
            
            {!magicLinkEnviado ? (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={magicLinkEmail}
                    onChange={(e) => {
                      setMagicLinkEmail(e.target.value);
                      setError(null);
                    }}
                    disabled={magicLinkLoading}
                    className="h-12 pl-10"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={magicLinkLoading || !magicLinkEmail}
                >
                  {magicLinkLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de acesso'
                  )}
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700">Link enviado!</p>
                    <p className="text-sm text-green-600">Verifique seu email. O link expira em 1 hora.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-green-700 hover:text-green-800"
                  onClick={() => {
                    setMagicLinkEnviado(false);
                    setMagicLinkEmail('');
                  }}
                >
                  Enviar para outro email
                </Button>
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Collapse CPF + Senha */}
          <Collapsible open={showCpfSenha} onOpenChange={setShowCpfSenha}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full flex items-center justify-between h-11 px-4 text-muted-foreground hover:text-foreground"
              >
                <span>Entrar com CPF e Senha</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showCpfSenha ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {accountLocked && lockTimeRemaining > 0 && (
                  <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Tempo restante: <strong>{formatLockTime(lockTimeRemaining)}</strong>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cpf"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={handleCPFChange}
                      disabled={loading || accountLocked}
                      className="h-12 pl-10 text-lg tracking-wide"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      disabled={loading || accountLocked}
                      className="h-12 pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading || accountLocked}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full text-base font-semibold"
                  disabled={loading || accountLocked}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Entrando...
                    </>
                  ) : accountLocked ? (
                    <>
                      <Lock className="mr-2 h-5 w-5" />
                      Bloqueado
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>

              {/* Link Esqueci Senha */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => setModalRecuperarSenha(true)}
                >
                  Esqueci minha senha
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Botão Primeiro Acesso */}
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-2 border-primary text-base font-semibold text-primary hover:bg-primary/5"
            onClick={() => setModalPrimeiroAcesso(true)}
          >
            Primeiro acesso
          </Button>

          {/* Botão Conta de Teste - Apenas em desenvolvimento */}
          {isDev && (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 h-10 w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setModalContaTeste(true)}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Criar Conta de Teste
            </Button>
          )}

          {/* Link para Sistema Interno */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              É funcionário?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Acesse o Sistema
              </Link>
            </p>
          </div>

          {/* Versão */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Versão 2.0.1 {isDev && <span className="text-orange-500">(DEV)</span>}
          </p>
        </div>
      </div>

      {/* Modal Recuperar Senha */}
      <Dialog open={modalRecuperarSenha} onOpenChange={setModalRecuperarSenha}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              {recuperacaoEnviada
                ? 'Enviamos as instruções para o WhatsApp cadastrado.'
                : 'Digite seu CPF para receber as instruções de recuperação.'}
            </DialogDescription>
          </DialogHeader>

          {!recuperacaoEnviada ? (
            <>
              <div className="py-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf-recuperacao">CPF</Label>
                  <Input
                    id="cpf-recuperacao"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpfRecuperacao}
                    onChange={(e) => setCpfRecuperacao(formatCPF(e.target.value))}
                    className="h-12 text-center text-lg tracking-wide"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeRecuperarSenhaModal}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleRecuperarSenha}
                  disabled={unformatCPF(cpfRecuperacao).length !== 11 || loadingRecuperacao}
                >
                  {loadingRecuperacao ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar'
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Verifique seu WhatsApp cadastrado e siga as instruções para redefinir sua senha.
                </p>
              </div>
              <Button
                type="button"
                className="mt-6 w-full"
                onClick={closeRecuperarSenhaModal}
              >
                Entendi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Primeiro Acesso */}
      <Dialog open={modalPrimeiroAcesso} onOpenChange={setModalPrimeiroAcesso}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Primeiro Acesso</DialogTitle>
            <DialogDescription>
              Para criar sua senha, você precisa ter um contrato ativo com a PRATIC.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                Como criar sua senha:
              </p>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </span>
                  <span>Verifique se você já é associado PRATIC</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    2
                  </span>
                  <span>Entre em contato pelo WhatsApp</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    3
                  </span>
                  <span>Informe seu CPF</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    4
                  </span>
                  <span>Receba sua senha temporária</span>
                </li>
              </ol>
            </div>

            <Button
              type="button"
              className="mt-6 w-full gap-2"
              onClick={() => {
                window.open(
                  'https://wa.me/5500000000000?text=Olá! Preciso criar minha senha de acesso ao app PRATIC.',
                  '_blank'
                );
              }}
            >
              <MessageCircle className="h-5 w-5" />
              Falar no WhatsApp
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setModalPrimeiroAcesso(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Conta de Teste */}
      <Dialog open={modalContaTeste} onOpenChange={setModalContaTeste}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-orange-500" />
              Conta de Teste
            </DialogTitle>
            <DialogDescription>
              Crie uma conta de teste para desenvolvimento. Esta funcionalidade está disponível apenas em ambiente de desenvolvimento.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!testCredentials ? (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg bg-orange-50 p-4 text-center">
                  <p className="text-sm text-orange-700">
                    Será criado um usuário associado fictício com dados de teste para você poder explorar todas as funcionalidades do app.
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleCriarContaTeste}
                  disabled={loadingContaTeste}
                >
                  {loadingContaTeste ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="mr-2 h-4 w-4" />
                      Criar Conta de Teste
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-center text-sm font-medium text-foreground">
                  Conta criada com sucesso!
                </p>

                <div className="space-y-3">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">CPF</p>
                        <p className="font-mono font-medium">{formatCPF(testCredentials.cpf)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(testCredentials.cpf, 'cpf')}
                      >
                        {copiedField === 'cpf' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Senha</p>
                        <p className="font-mono font-medium">{testCredentials.password}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(testCredentials.password, 'password')}
                      >
                        {copiedField === 'password' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={useTestCredentials}
                >
                  Usar estas credenciais
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setModalContaTeste(false);
                setTestCredentials(null);
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
