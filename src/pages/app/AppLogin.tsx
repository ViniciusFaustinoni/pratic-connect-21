import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Lock } from 'lucide-react';
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Shield className="h-10 w-10 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">PRATIC</h1>
            <p className="text-sm text-muted-foreground">Proteção Veicular</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Acesse sua conta</CardTitle>
            <CardDescription>
              Digite seu CPF e senha para entrar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant={accountLocked ? 'destructive' : 'destructive'}>
                  {accountLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

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
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCPFChange}
                  disabled={loading}
                  className="text-center text-lg tracking-wide"
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
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || accountLocked}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || accountLocked}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : accountLocked ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Bloqueado
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {/* TODO: Implement forgot password */}}
              >
                Esqueci minha senha
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Problemas para acessar? Ligue para (11) 3333-4444
        </p>
      </div>
    </div>
  );
}
