import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Lock, MessageCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import {
  isLocked,
  recordFailedAttempt,
  resetAttempts,
  getRemainingLockTimeSeconds,
  getAttemptsRemaining,
} from '@/lib/login-rate-limit';

// CPF mask utility
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

const cpfSchema = z.string().length(11, 'CPF deve ter 11 dígitos');

export default function AppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, loading: authLoading } = useAuth();

  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  // Modal states
  const [modalRecuperarSenha, setModalRecuperarSenha] = useState(false);
  const [modalPrimeiroAcesso, setModalPrimeiroAcesso] = useState(false);
  const [cpfRecuperacao, setCpfRecuperacao] = useState('');
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false);
  const [loadingRecuperacao, setLoadingRecuperacao] = useState(false);

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
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const rawCPF = unformatCPF(cpf);

    // Validate CPF
    const cpfResult = cpfSchema.safeParse(rawCPF);
    if (!cpfResult.success) {
      setError('CPF inválido. Digite os 11 dígitos.');
      return;
    }

    // Check if locked
    if (isLocked(rawCPF)) {
      setError(`Conta bloqueada. Tente novamente em ${formatLockTime(getRemainingLockTimeSeconds(rawCPF))}.`);
      return;
    }

    if (!password) {
      setError('Digite sua senha.');
      return;
    }

    setLoading(true);

    try {
      // For now, we'll use email-based auth with CPF as identifier
      // The email format will be cpf@associado.pratic.com.br
      const email = `${rawCPF}@associado.pratic.com.br`;
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          const attemptsRemaining = getAttemptsRemaining(rawCPF);
          recordFailedAttempt(rawCPF);

          if (isLocked(rawCPF)) {
            setAccountLocked(true);
            setError('Muitas tentativas falhas. Conta bloqueada por 15 minutos.');
          } else {
            setError(`CPF ou senha inválidos. ${attemptsRemaining - 1} tentativas restantes.`);
          }
        } else {
          setError(signInError.message);
        }
      } else {
        resetAttempts(rawCPF);
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
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
            <p className="text-sm text-muted-foreground">Digite seu CPF e senha para entrar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                {accountLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {accountLocked && lockTimeRemaining > 0 && !error.includes('bloqueada') && (
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Tempo restante: <strong>{formatLockTime(lockTimeRemaining)}</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={handleCPFChange}
                disabled={loading}
                className="h-12 text-center text-lg tracking-wide"
              />
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
                    setError('');
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

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
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

          {/* Versão */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Versão 1.0.0
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
    </div>
  );
}
