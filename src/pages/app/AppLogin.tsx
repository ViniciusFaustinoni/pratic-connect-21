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
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Lock, MessageCircle, CheckCircle, FlaskConical, Copy, Check, User } from 'lucide-react';
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
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;
  
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
const isDev = import.meta.env.DEV;

// ============================================
// COMPONENTE
// ============================================
export default function AppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, loading: authLoading } = useAuth();

  // Form state
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | string | null>(null);
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  // Modal states
  const [modalPrimeiroAcesso, setModalPrimeiroAcesso] = useState(false);
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

  // CPF + Senha Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCPF = unformatCPF(cpf);

    const cpfResult = cpfSchema.safeParse(rawCPF);
    if (!cpfResult.success || !isValidCPF(rawCPF)) {
      setError('invalid_credentials');
      return;
    }

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
            <p className="text-sm text-muted-foreground">Digite seu CPF e senha</p>
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

          {/* Alerta de bloqueio */}
          {accountLocked && lockTimeRemaining > 0 && (
            <Alert variant="destructive" className="mb-4">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Tempo restante: <strong>{formatLockTime(lockTimeRemaining)}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Formulário CPF + Senha */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Link
              to="/app/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

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
