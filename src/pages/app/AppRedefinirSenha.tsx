import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
  Check,
  X,
} from 'lucide-react';

interface PasswordStrength {
  score: number;
  label: 'Muito fraca' | 'Fraca' | 'Média' | 'Forte';
  color: string;
  progressColor: string;
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
  };
}

function checkPasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  const labels: PasswordStrength['label'][] = ['Muito fraca', 'Fraca', 'Fraca', 'Média', 'Forte'];
  const colors = ['text-destructive', 'text-destructive', 'text-orange-500', 'text-yellow-500', 'text-green-500'];
  const progressColors = ['bg-destructive', 'bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  return {
    score,
    label: labels[score],
    color: colors[score],
    progressColor: progressColors[score],
    checks,
  };
}

export default function AppRedefinirSenha() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [countdown, setCountdown] = useState(5);

  const strength = checkPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = strength.score >= 3 && passwordsMatch;

  // Check for recovery session
  useEffect(() => {
    const handleRecovery = async () => {
      try {
        // Supabase automatically processes the hash fragment
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
          setCheckingSession(false);
          return;
        }

        if (!session) {
          setError('Sessão não encontrada. Solicite um novo link de recuperação.');
          setCheckingSession(false);
          return;
        }

        setSessionReady(true);
      } catch (err) {
        console.error('Recovery error:', err);
        setError('Erro ao processar o link. Tente novamente.');
      } finally {
        setCheckingSession(false);
      }
    };

    // Listen for auth state changes (handles the recovery token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    handleRecovery();

    return () => subscription.unsubscribe();
  }, []);

  // Countdown after success
  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (success && countdown === 0) {
      navigate('/app/login');
    }
  }, [success, countdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (strength.score < 3) {
      setError('A senha precisa ser pelo menos "Média".');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Erro ao atualizar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary to-primary/80">
        <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-primary/80">
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Senha alterada com sucesso!
              </h2>
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para o login em {countdown}s...
              </p>
              <Button
                className="mt-4 w-full"
                onClick={() => navigate('/app/login')}
              >
                Ir para login agora
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state (no session)
  if (!sessionReady && error) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-primary/80">
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Link inválido
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                className="mt-4 w-full"
                onClick={() => navigate('/app/login')}
              >
                Voltar para login
              </Button>
            </div>
          </div>
        </div>
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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Redefinir Senha</h2>
            <p className="text-sm text-muted-foreground">Crie uma nova senha segura</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  className="h-12 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={loading}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Indicador de força */}
            {newPassword.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Força da senha:</span>
                    <span className={`font-medium ${strength.color}`}>{strength.label}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all duration-300 ${strength.progressColor}`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Checklist de requisitos */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    {strength.checks.minLength ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={strength.checks.minLength ? 'text-foreground' : 'text-muted-foreground'}>
                      8+ caracteres
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {strength.checks.hasUppercase ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={strength.checks.hasUppercase ? 'text-foreground' : 'text-muted-foreground'}>
                      Letra maiúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {strength.checks.hasLowercase ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={strength.checks.hasLowercase ? 'text-foreground' : 'text-muted-foreground'}>
                      Letra minúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {strength.checks.hasNumber ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={strength.checks.hasNumber ? 'text-foreground' : 'text-muted-foreground'}>
                      Número
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmar Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  className="h-12 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Indicador de match */}
            {confirmPassword.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                {passwordsMatch ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Senhas coincidem</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Senhas não coincidem</span>
                  </>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full text-base font-semibold"
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>

          {/* Versão */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Versão 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
