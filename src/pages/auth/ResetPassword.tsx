import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================
type FormState = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'token_invalid';

type FormError = 
  | 'password_required'
  | 'password_weak'
  | 'passwords_mismatch'
  | 'token_expired'
  | 'token_invalid'
  | 'session_error'
  | 'unknown_error';

interface PasswordRequirement {
  id: string;
  label: string;
  validator: (password: string) => boolean;
}

// ============================================
// CONSTANTES
// ============================================
const ERROR_MESSAGES: Record<FormError, string> = {
  password_required: 'Por favor, informe a nova senha',
  password_weak: 'A senha não atende aos requisitos mínimos',
  passwords_mismatch: 'As senhas não coincidem',
  token_expired: 'Link expirado. Solicite um novo link de recuperação.',
  token_invalid: 'Link inválido. Solicite um novo link de recuperação.',
  session_error: 'Erro de sessão. Tente novamente.',
  unknown_error: 'Erro ao redefinir senha. Tente novamente.',
};

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', label: 'Mínimo 8 caracteres', validator: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'Pelo menos 1 maiúscula', validator: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'Pelo menos 1 minúscula', validator: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Pelo menos 1 número', validator: (p) => /[0-9]/.test(p) },
];

// ============================================
// COMPONENTE
// ============================================
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>('loading');
  const [error, setError] = useState<FormError | null>(null);

  // ============================================
  // VERIFICAR SESSÃO (token via URL)
  // ============================================
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Supabase automaticamente processa o token da URL
        // e cria uma sessão temporária se válido
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('session_error');
          setFormState('token_invalid');
          return;
        }

        if (!session) {
          // Sem sessão = token inválido ou expirado
          setError('token_invalid');
          setFormState('token_invalid');
          return;
        }

        // Token válido, sessão criada
        setFormState('ready');

      } catch (err) {
        console.error('Check session error:', err);
        setError('token_invalid');
        setFormState('token_invalid');
      }
    };

    // Listener para evento PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setFormState('ready');
      }
    });

    // Aguardar um pouco para Supabase processar o token
    const timer = setTimeout(checkSession, 500);
    
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // VALIDAÇÃO DE REQUISITOS
  // ============================================
  const getRequirementStatus = (requirement: PasswordRequirement): boolean => {
    return requirement.validator(password);
  };

  const allRequirementsMet = (): boolean => {
    return PASSWORD_REQUIREMENTS.every(req => req.validator(password));
  };

  // ============================================
  // VALIDAÇÃO DO FORM
  // ============================================
  const validateForm = (): boolean => {
    if (!password) {
      setError('password_required');
      return false;
    }

    if (!allRequirementsMet()) {
      setError('password_weak');
      return false;
    }

    if (password !== confirmPassword) {
      setError('passwords_mismatch');
      return false;
    }

    return true;
  };

  // ============================================
  // SUBMIT
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setFormState('submitting');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('Update password error:', updateError);
        
        if (updateError.message.includes('expired') || updateError.message.includes('invalid')) {
          setError('token_expired');
          setFormState('token_invalid');
        } else {
          setError('unknown_error');
          setFormState('error');
        }
        return;
      }

      // Sucesso!
      setFormState('success');

      // Redirect para login após 3 segundos
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setError('unknown_error');
      setFormState('error');
    }
  };

  // ============================================
  // HANDLERS
  // ============================================
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError(null);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (error === 'passwords_mismatch') setError(null);
  };

  // ============================================
  // RENDER - LOADING INICIAL
  // ============================================
  if (formState === 'loading') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Verificando link...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - TOKEN INVÁLIDO
  // ============================================
  if (formState === 'token_invalid') {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Link Inválido</h1>
        </div>

        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6 space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error ? ERROR_MESSAGES[error] : 'Este link de recuperação é inválido ou expirou.'}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full h-11"
                onClick={() => navigate('/forgot-password')}
              >
                Solicitar Novo Link
              </Button>
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // RENDER - SUCESSO
  // ============================================
  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Senha Alterada!</h1>
        </div>

        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6 space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes...
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // RENDER - FORMULÁRIO PRINCIPAL
  // ============================================
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SGA PRATIC</h1>
        <p className="text-muted-foreground text-sm">Sistema de Gestão de Associados</p>
      </div>

      {/* CARD */}
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Redefinir Senha</CardTitle>
          <CardDescription>
            Crie uma nova senha para sua conta
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ALERTA DE ERRO */}
          {formState === 'error' && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{ERROR_MESSAGES[error]}</AlertDescription>
            </Alert>
          )}

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CAMPO NOVA SENHA */}
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={formState === 'submitting'}
                  className={cn(
                    "pl-10 pr-10 h-11",
                    error === 'password_weak' && "border-destructive focus-visible:ring-destructive"
                  )}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* REQUISITOS DE SENHA */}
            {password.length > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Requisitos:</p>
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const met = getRequirementStatus(req);
                  return (
                    <div
                      key={req.id}
                      className={cn(
                        "flex items-center gap-2 text-xs transition-colors",
                        met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                      )}
                    >
                      {met ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      <span>{req.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CAMPO CONFIRMAR SENHA */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  disabled={formState === 'submitting'}
                  className={cn(
                    "pl-10 pr-10 h-11",
                    error === 'passwords_mismatch' && "border-destructive focus-visible:ring-destructive"
                  )}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Indicador de match */}
              {confirmPassword.length > 0 && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    password === confirmPassword
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  )}
                >
                  {password === confirmPassword ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Senhas coincidem
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Senhas não coincidem
                    </>
                  )}
                </div>
              )}
            </div>

            {/* BOTÃO SUBMIT */}
            <Button
              type="submit"
              className="w-full h-11"
              disabled={formState === 'submitting' || !allRequirementsMet() || password !== confirmPassword}
            >
              {formState === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>

      {/* FOOTER */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} PRATIC Proteção Veicular
        </p>
      </div>
    </div>
  );
}
