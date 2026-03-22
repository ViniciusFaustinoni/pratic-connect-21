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
// PÁGINA DE LOGIN — SISTEMA INTERNO
// ============================================
export default function LoginPage() {
  // ============================================
  // HOOKS E CONTEXT
  // ============================================
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, profile, loading: authLoading, initialized, isAssociado } = useAuth();

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
  // REDIRECT SE JÁ AUTENTICADO
  // ============================================
  useEffect(() => {
    // Só redireciona quando o contexto estiver totalmente inicializado
    if (initialized && !authLoading && user && profile) {
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
  }, [initialized, authLoading, user, profile, isAssociado, navigate, location.search]);

  // ============================================

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
  // SUBMIT LOGIN EMAIL/SENHA
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const result = await signIn({ 
        email: formData.email.trim().toLowerCase(), 
        password: formData.password 
      });

      if (!result.success) {
        const errorType = parseSupabaseError(result.error || '');
        setError(errorType);
        setIsSubmitting(false);
        return;
      }

      // Login bem-sucedido - aguardar useEffect fazer o redirect
      // Manter isSubmitting = true para mostrar loading até redirecionar

    } catch (err) {
      setError('unknown_error');
      setIsSubmitting(false);
    }
    // NÃO colocar setIsSubmitting(false) no finally - mantém loading até redirect
  };

  // ============================================
  // LOADING STATE COM ANIMAÇÃO
  // ============================================
  // Loading state composto: mantém loading até initialized para evitar flickering no redirect
  const showLoadingScreen = authLoading || isSubmitting || (user && !profile) || !initialized;

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

          {/* ALERTA DE ERRO */}
          {error && (
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
