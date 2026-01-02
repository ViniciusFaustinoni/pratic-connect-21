import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertCircle, Mail, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

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
  const { user, signIn, signUp, signInWithMagicLink, loading: authLoading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
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
        setError('Email ou senha inválidos');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login');
      } else {
        setError(error.message);
      }
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
    const { error } = await signUp(signupEmail, signupPassword, signupNome);
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
          <Tabs defaultValue="magic" className="w-full">
            <CardHeader className="pb-4">
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
                        Entrando...
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