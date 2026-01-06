import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertCircle, Mail, CheckCircle2, Lock } from 'lucide-react';
import { z } from 'zod';
import { 
  isLocked, 
  getRemainingLockTimeSeconds, 
  recordFailedAttempt, 
  resetAttempts,
  getAttemptsRemaining 
} from '@/lib/login-rate-limit';

const emailSchema = z.string().email('Email inválido');

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const signupSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function Auth() {
  const { user, profile, signIn, signUp, signInWithMagicLink, signInWithGoogle, loading: authLoading, getRedirectUrl } = useAuth();
  const location = useLocation();
  const stateFrom = (location.state as { from?: { pathname: string } })?.from?.pathname;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  
  // Lockout state
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);
  
  // Magic link form
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupNome, setSignupNome] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Check lockout status and start countdown timer
  useEffect(() => {
    if (!loginEmail) {
      setAccountLocked(false);
      setLockTimeRemaining(0);
      return;
    }

    const checkLockStatus = () => {
      if (isLocked(loginEmail)) {
        setAccountLocked(true);
        setLockTimeRemaining(getRemainingLockTimeSeconds(loginEmail));
      } else {
        setAccountLocked(false);
        setLockTimeRemaining(0);
      }
    };

    checkLockStatus();

    // Update countdown every second when locked
    const interval = setInterval(() => {
      if (isLocked(loginEmail)) {
        const remaining = getRemainingLockTimeSeconds(loginEmail);
        setLockTimeRemaining(remaining);
        if (remaining <= 0) {
          setAccountLocked(false);
          setError(null);
        }
      } else {
        setAccountLocked(false);
        setLockTimeRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loginEmail]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && profile) {
    // Usa a URL de origem se existir, senão usa o redirect por tipo de usuário
    const redirectTo = stateFrom || getRedirectUrl();
    return <Navigate to={redirectTo} replace />;
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const validation = emailSchema.safeParse(magicLinkEmail);
    if (!validation.success) {
      setError('Por favor, insira um email válido');
      return;
    }
    
    setIsLoading(true);
    const { error } = await signInWithMagicLink(magicLinkEmail);
    setIsLoading(false);
    
    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
    }
  };

  const formatLockTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Check if account is locked
    if (isLocked(loginEmail)) {
      const remaining = getRemainingLockTimeSeconds(loginEmail);
      setAccountLocked(true);
      setLockTimeRemaining(remaining);
      setError(`Conta bloqueada. Tente novamente em ${formatLockTime(remaining)}.`);
      return;
    }
    
    const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        const { isNowLocked, attemptsRemaining } = recordFailedAttempt(loginEmail);
        
        if (isNowLocked) {
          setAccountLocked(true);
          setLockTimeRemaining(getRemainingLockTimeSeconds(loginEmail));
          setError('Muitas tentativas falhas. Conta bloqueada por 15 minutos.');
        } else {
          setError(`Email ou senha inválidos. ${attemptsRemaining} tentativa${attemptsRemaining !== 1 ? 's' : ''} restante${attemptsRemaining !== 1 ? 's' : ''}.`);
        }
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login');
      } else {
        setError(error.message);
      }
    } else {
      // Login successful, reset attempts
      resetAttempts(loginEmail);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const validation = signupSchema.safeParse({
      nome: signupNome,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });
    
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, { nome: signupNome });
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este email já está cadastrado');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('Cadastro realizado! Verifique seu email para confirmar a conta.');
      setSignupNome('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
    }
  };

  const resetMagicLink = () => {
    setMagicLinkSent(false);
    setMagicLinkEmail('');
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    
    if (error) {
      setError('Erro ao conectar com o Google. Tente novamente.');
    }
  };

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="tracking-tight-magic text-2xl font-bold text-foreground">SGA PRATIC 2.0</h1>
          <p className="tracking-tight-magic text-sm text-muted-foreground">Sistema de Gestão de Associados</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="tracking-tight-magic flex w-full items-center justify-center gap-3 border-border bg-background hover:bg-muted"
            >
              <GoogleIcon />
              <span className="text-foreground">Continuar com Google</span>
            </Button>
            
            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="tracking-tight-magic bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>
          </CardHeader>

          <Tabs defaultValue="magic" className="w-full">
            <CardHeader className="pb-4 pt-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="magic" className="tracking-tight-magic text-xs sm:text-sm">Magic Link</TabsTrigger>
                <TabsTrigger value="login" className="tracking-tight-magic text-xs sm:text-sm">Senha</TabsTrigger>
                <TabsTrigger value="signup" className="tracking-tight-magic text-xs sm:text-sm">Cadastrar</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="tracking-tight-magic">{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="mb-4 border-accent bg-accent/10">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <AlertDescription className="tracking-tight-magic text-accent">{success}</AlertDescription>
                </Alert>
              )}

              {/* Magic Link Tab */}
              <TabsContent value="magic" className="mt-0">
                {magicLinkSent ? (
                  <div className="py-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                      <Mail className="h-8 w-8 text-accent" />
                    </div>
                    <h3 className="tracking-tight-magic mb-2 text-lg font-semibold text-foreground">
                      Verifique seu email
                    </h3>
                    <p className="tracking-tight-magic mb-4 text-sm text-muted-foreground">
                      Enviamos um link mágico para <span className="font-medium text-foreground">{magicLinkEmail}</span>. 
                      Clique no link para entrar automaticamente.
                    </p>
                    <Button
                      variant="outline"
                      onClick={resetMagicLink}
                      className="tracking-tight-magic"
                    >
                      Usar outro email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-email" className="tracking-tight-magic text-muted-foreground">
                        Email
                      </Label>
                      <Input
                        id="magic-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={magicLinkEmail}
                        onChange={(e) => setMagicLinkEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="tracking-tight-magic"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="tracking-tight-magic w-full bg-primary hover:bg-primary/90" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Enviar Magic Link
                        </>
                      )}
                    </Button>
                    <p className="tracking-tight-magic text-center text-xs text-muted-foreground">
                      Você receberá um link no seu email para entrar sem senha
                    </p>
                  </form>
                )}
              </TabsContent>

              {/* Password Login Tab */}
              <TabsContent value="login" className="mt-0">
                {accountLocked && lockTimeRemaining > 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <Lock className="h-4 w-4" />
                    <AlertDescription className="tracking-tight-magic">
                      Conta bloqueada por segurança. Tente novamente em{' '}
                      <span className="font-bold">{formatLockTime(lockTimeRemaining)}</span>
                    </AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="tracking-tight-magic text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="tracking-tight-magic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="tracking-tight-magic text-muted-foreground">
                      Senha
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading || accountLocked}
                      className="tracking-tight-magic"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="tracking-tight-magic w-full" 
                    disabled={isLoading || accountLocked}
                  >
                    {isLoading ? (
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
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-nome" className="tracking-tight-magic text-muted-foreground">
                      Nome completo
                    </Label>
                    <Input
                      id="signup-nome"
                      type="text"
                      placeholder="Seu nome"
                      value={signupNome}
                      onChange={(e) => setSignupNome(e.target.value)}
                      required
                      disabled={isLoading}
                      className="tracking-tight-magic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="tracking-tight-magic text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="tracking-tight-magic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="tracking-tight-magic text-muted-foreground">
                      Senha
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="tracking-tight-magic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm" className="tracking-tight-magic text-muted-foreground">
                      Confirmar senha
                    </Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="tracking-tight-magic"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="tracking-tight-magic w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      'Criar conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="tracking-tight-magic mt-6 text-center text-xs text-muted-foreground">
          Associação de Proteção Veicular PRATIC
        </p>
      </div>
    </div>
  );
}