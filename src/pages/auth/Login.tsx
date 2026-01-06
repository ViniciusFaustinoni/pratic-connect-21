import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { signIn, signInWithGoogle, user, loading: authLoading, isAssociado } = useAuth();

  // ============================================
  // ESTADOS
  // ============================================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // REDIRECT SE JÁ AUTENTICADO
  // ============================================
  useEffect(() => {
    if (!authLoading && user) {
      // Verificar tipo de usuário
      if (isAssociado) {
        // Associado tentando acessar sistema interno → redirecionar para app
        navigate('/app', { replace: true });
        return;
      }

      // Funcionário autenticado → redirecionar para returnTo ou dashboard
      const params = new URLSearchParams(location.search);
      const returnTo = params.get('returnTo') || '/dashboard';
      navigate(returnTo, { replace: true });
    }
  }, [authLoading, user, isAssociado, navigate, location.search]);

  // ============================================
  // VALIDAÇÃO DE EMAIL
  // ============================================
  const isValidEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // ============================================
  // SUBMIT LOGIN EMAIL/SENHA
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!email.trim()) {
      setError('Digite seu e-mail');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Digite um e-mail válido');
      return;
    }

    if (!password) {
      setError('Digite sua senha');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn({ 
        email: email.trim().toLowerCase(), 
        password 
      });

      if (!result.success) {
        setError(result.error || 'Erro ao fazer login');
        return;
      }

      // Sucesso - redirect será feito pelo useEffect
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
      console.error('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
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
        setError(result.error || 'Erro ao conectar com Google. Tente novamente.');
      }
      // Redirect será feito pelo Supabase OAuth
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
      console.error('Google login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      {/* ============================================ */}
      {/* LOGO E TÍTULO */}
      {/* ============================================ */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SGA PRATIC</h1>
        <p className="text-muted-foreground text-sm">Sistema de Gestão de Associados</p>
      </div>

      {/* ============================================ */}
      {/* CARD DE LOGIN */}
      {/* ============================================ */}
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Acesso ao Sistema</CardTitle>
          <CardDescription>
            Entre com suas credenciais para continuar
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ============================================ */}
          {/* ALERTA DE ERRO */}
          {/* ============================================ */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ============================================ */}
          {/* FORMULÁRIO */}
          {/* ============================================ */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CAMPO E-MAIL */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "pl-10 h-11",
                    error && !email && "border-destructive focus-visible:ring-destructive"
                  )}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* CAMPO SENHA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "pl-10 pr-10 h-11",
                    error && !password && "border-destructive focus-visible:ring-destructive"
                  )}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* BOTÃO ENTRAR */}
            <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* ============================================ */}
          {/* DIVISOR */}
          {/* ============================================ */}
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

          {/* ============================================ */}
          {/* BOTÃO GOOGLE */}
          {/* ============================================ */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
          >
            <GoogleIcon />
            Google
          </Button>
        </CardContent>

        <CardFooter>
          {/* ============================================ */}
          {/* LINK PARA APP DO ASSOCIADO */}
          {/* ============================================ */}
          <p className="text-sm text-muted-foreground text-center w-full">
            É associado?{' '}
            <Link to="/app/login" className="text-primary hover:underline font-medium">
              Acesse o App do Associado
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <div className="mt-8 text-center">
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
