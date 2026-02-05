import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================
interface LoginFormData {
  email: string;
  password: string;
}

type LoginError = 
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'too_many_requests'
  | 'network_error'
  | 'unknown_error';

// ============================================
// CONSTANTES
// ============================================
const ERROR_MESSAGES: Record<LoginError, string> = {
  invalid_credentials: 'E-mail ou senha incorretos',
  email_not_confirmed: 'E-mail não confirmado. Verifique sua caixa de entrada.',
  too_many_requests: 'Muitas tentativas. Aguarde alguns minutos.',
  network_error: 'Erro de conexão. Verifique sua internet.',
  unknown_error: 'Erro inesperado. Tente novamente.',
};

// ============================================
// ÍCONE GOOGLE
// ============================================
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// ============================================
// PÁGINA DE LOGIN — SISTEMA INTERNO
// ============================================
export default function LoginPage() {
  // ============================================
  // HOOKS E CONTEXT
  // ============================================
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, user, profile, loading: authLoading, isAssociado } = useAuth();

  // ============================================
  // ESTADOS DO FORMULÁRIO
  // ============================================
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [lembrarMe, setLembrarMe] = useState(false);

  // ============================================
  // ESTADOS DE VALIDAÇÃO EM TEMPO REAL
  // ============================================
  const [emailValido, setEmailValido] = useState<boolean | null>(null);
  const [senhaValida, setSenhaValida] = useState<boolean | null>(null);

  // ============================================
  // ESTADOS DE RATE LIMITING
  // ============================================
  const [tentativasRestantes, setTentativasRestantes] = useState<number | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [tempoRestante, setTempoRestante] = useState<number>(0);
  const [bloqueadoPermanente, setBloqueadoPermanente] = useState(false);

  // ============================================
  // REDIRECT SE JÁ AUTENTICADO
  // ============================================
  useEffect(() => {
    // Só redireciona quando tiver user E profile carregado
    if (!authLoading && user && profile) {
      if (profile.primeiro_acesso) {
        navigate('/definir-senha', { replace: true });
        return;
      }
      if (isAssociado) {
        navigate('/app/home', { replace: true });
        return;
      }
      const params = new URLSearchParams(location.search);
      const returnTo = params.get('returnTo') || '/dashboard';
      navigate(returnTo, { replace: true });
    }
  }, [authLoading, user, profile, isAssociado, navigate, location.search]);

  // ============================================
  // VERIFICAR BLOQUEIO AO DIGITAR EMAIL (DEBOUNCED)
  // ============================================
  useEffect(() => {
    if (!formData.email || !emailValido) return;
    
    const timeout = setTimeout(async () => {
      try {
        const response = await supabase.functions.invoke('auth-tentativas', {
          body: { action: 'verificar', email: formData.email.trim().toLowerCase() }
        });
        
        if (response.data?.bloqueado) {
          setBloqueado(true);
          setTempoRestante(response.data.minutos_restantes || 0);
          setBloqueadoPermanente(response.data.permanente || false);
        } else {
          setBloqueado(false);
          setBloqueadoPermanente(false);
        }
      } catch (err) {
        console.error('Erro ao verificar bloqueio:', err);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [formData.email, emailValido]);

  // ============================================
  // HANDLER GENÉRICO PARA INPUTS COM VALIDAÇÃO EM TEMPO REAL
  // ============================================
  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);

    // Validação em tempo real
    if (field === 'email') {
      if (!value.trim()) {
        setEmailValido(null);
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setEmailValido(emailRegex.test(value.trim()));
      }
    }
    
    if (field === 'password') {
      if (!value) {
        setSenhaValida(null);
      } else {
        setSenhaValida(value.length >= 6);
      }
    }
  };

  // ============================================
  // VALIDAÇÃO DO FORMULÁRIO
  // ============================================
  const validateForm = (): boolean => {
    const email = formData.email.trim().toLowerCase();
    if (!email) {
      setError('invalid_credentials');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('invalid_credentials');
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('invalid_credentials');
      return false;
    }
    return true;
  };

  // ============================================
  // PARSER DE ERROS SUPABASE
  // ============================================
  const parseSupabaseError = (errorMessage: string): LoginError => {
    if (errorMessage.includes('Invalid login credentials')) return 'invalid_credentials';
    if (errorMessage.includes('Email not confirmed')) return 'email_not_confirmed';
    if (errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) return 'too_many_requests';
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) return 'network_error';
    return 'unknown_error';
  };

  // ============================================
  // REGISTRAR TENTATIVA FALHA
  // ============================================
  const registrarTentativaFalha = async (email: string, motivo: string) => {
    try {
      const response = await supabase.functions.invoke('auth-tentativas', {
        body: { 
          action: 'registrar', 
          email: email.trim().toLowerCase(), 
          sucesso: false,
          motivo_falha: motivo
        }
      });
      
      if (response.data?.bloqueado) {
        setBloqueado(true);
        setTempoRestante(response.data.minutos || 0);
        setBloqueadoPermanente(response.data.permanente || false);
        setTentativasRestantes(null);
      } else if (response.data?.tentativas_restantes !== undefined) {
        setTentativasRestantes(response.data.tentativas_restantes);
      }
    } catch (err) {
      console.error('Erro ao registrar tentativa:', err);
    }
  };

  // ============================================
  // REGISTRAR TENTATIVA SUCESSO
  // ============================================
  const registrarTentativaSucesso = async (email: string) => {
    try {
      await supabase.functions.invoke('auth-tentativas', {
        body: { 
          action: 'registrar', 
          email: email.trim().toLowerCase(), 
          sucesso: true
        }
      });
      setTentativasRestantes(null);
      setBloqueado(false);
    } catch (err) {
      console.error('Erro ao registrar sucesso:', err);
    }
  };

  // ============================================
  // SUBMIT LOGIN EMAIL/SENHA
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm() || bloqueado) return;

    setIsSubmitting(true);

    try {
      const result = await signIn({ 
        email: formData.email.trim().toLowerCase(), 
        password: formData.password 
      });

      if (!result.success) {
        const errorType = parseSupabaseError(result.error || '');
        setError(errorType);
        await registrarTentativaFalha(formData.email, errorType);
        setIsSubmitting(false);
        return;
      }

      // Login bem-sucedido - registrar e aguardar useEffect fazer o redirect
      await registrarTentativaSucesso(formData.email);
      // NÃO fazer navigate aqui - o useEffect vai fazer quando profile carregar
      // Manter isSubmitting = true para mostrar loading até redirecionar

    } catch (err) {
      setError('unknown_error');
      await registrarTentativaFalha(formData.email, 'unknown_error');
      setIsSubmitting(false);
    }
    // NÃO colocar setIsSubmitting(false) no finally - mantém loading até redirect
  };

  // ============================================
  // LOGIN COM GOOGLE
  // ============================================
  const handleGoogleLogin = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        setError('unknown_error');
      }
    } catch (err) {
      setError('unknown_error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // LOADING STATE COM ANIMAÇÃO
  // ============================================
  // Loading state composto: inclui isSubmitting para cobrir o gap entre clique e onAuthStateChange
  const showLoadingScreen = authLoading || isSubmitting || (user && !profile);

  if (showLoadingScreen) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">
              {user ? 'Carregando dados...' : 'Verificando sessão'}
            </p>
            <p className="text-sm text-muted-foreground">Aguarde um momento...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      {/* LOGO E TÍTULO */}
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SGA PRATIC</h1>
        <p className="text-muted-foreground text-sm">Sistema de Gestão de Associados</p>
      </div>

      {/* CARD DE LOGIN */}
      <Card className="w-full max-w-md shadow-lg animate-in zoom-in-95 fade-in duration-500 delay-150">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Acesso ao Sistema</CardTitle>
          <CardDescription>
            Entre com suas credenciais para continuar
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ALERTA DE BLOQUEIO */}
          {bloqueado && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {bloqueadoPermanente 
                  ? 'Conta bloqueada permanentemente. Contate seu supervisor para desbloquear.'
                  : `Conta temporariamente bloqueada. Tente novamente em ${tempoRestante} minuto(s).`
                }
              </AlertDescription>
            </Alert>
          )}

          {/* ALERTA DE TENTATIVAS RESTANTES */}
          {tentativasRestantes !== null && tentativasRestantes <= 2 && !bloqueado && (
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                Atenção: {tentativasRestantes} tentativa(s) restante(s) antes do bloqueio.
              </AlertDescription>
            </Alert>
          )}

          {/* ALERTA DE ERRO */}
          {error && !bloqueado && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{ERROR_MESSAGES[error]}</AlertDescription>
            </Alert>
          )}

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CAMPO E-MAIL */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@pratic.com.br"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  disabled={isSubmitting || bloqueado}
                  className={cn(
                    "pl-10 pr-10 h-11 transition-colors duration-200",
                    emailValido === false && formData.email && "border-destructive focus-visible:ring-destructive",
                    emailValido === true && "border-green-500 focus-visible:ring-green-500"
                  )}
                  autoComplete="email"
                  autoFocus
                />
                {emailValido !== null && formData.email && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in zoom-in duration-200">
                    {emailValido ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              {emailValido === false && formData.email && (
                <p className="text-xs text-destructive animate-in fade-in duration-200">
                  Digite um e-mail válido
                </p>
              )}
            </div>

            {/* CAMPO SENHA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  disabled={isSubmitting || bloqueado}
                  className={cn(
                    "pl-10 pr-10 h-11 transition-colors duration-200",
                    senhaValida === false && formData.password && "border-destructive focus-visible:ring-destructive",
                    senhaValida === true && "border-green-500 focus-visible:ring-green-500"
                  )}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {senhaValida === false && formData.password && (
                <p className="text-xs text-destructive animate-in fade-in duration-200">
                  A senha deve ter no mínimo 6 caracteres
                </p>
              )}
            </div>

            {/* CHECKBOX LEMBRAR-ME */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lembrar-me" 
                checked={lembrarMe}
                onCheckedChange={(checked) => setLembrarMe(checked === true)}
                disabled={isSubmitting || bloqueado}
              />
              <Label 
                htmlFor="lembrar-me" 
                className="text-sm font-normal cursor-pointer select-none"
              >
                Lembrar-me
              </Label>
            </div>

            {/* BOTÃO ENTRAR */}
            <Button 
              type="submit" 
              className="w-full h-11 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
              disabled={isSubmitting || bloqueado || emailValido === false || senhaValida === false}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* DIVISOR */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                ou continue com
              </span>
            </div>
          </div>

          {/* BOTÃO GOOGLE */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || bloqueado}
          >
            <GoogleIcon />
            <span className="ml-2">Google</span>
          </Button>
        </CardContent>

        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            É associado?{' '}
            <Link to="/app/login" className="text-primary hover:underline font-medium transition-colors">
              Acesse o App do Associado
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* FOOTER */}
      <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} PRATIC Proteção Veicular
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
