import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { 
  verificarBloqueio, 
  registrarTentativa, 
  criarSessao, 
  detectarDispositivo,
  SESSION_TOKEN_KEY
} from '@/hooks/useAuthSession';

const emailSchema = z.string().email('Email inválido');
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
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

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFrom = location.state?.from?.pathname;
  
  const { user, profile, signIn, signInWithMagicLink, signInWithGoogle, getRedirectUrl, loading: authLoading } = useAuth();

  // Estados gerais
  const [activeTab, setActiveTab] = useState<'magic-link' | 'senha'>('senha');
  
  // Estados Magic Link
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  // Estados Login com Senha
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Estados de Bloqueio
  const [bloqueio, setBloqueio] = useState<{
    bloqueado: boolean;
    permanente: boolean;
    mensagem: string;
  } | null>(null);

  // Verificar bloqueio quando email muda (com debounce)
  useEffect(() => {
    const verificar = async () => {
      if (loginEmail && emailSchema.safeParse(loginEmail).success) {
        const resultado = await verificarBloqueio(loginEmail);
        if (resultado.bloqueado) {
          setBloqueio({
            bloqueado: true,
            permanente: resultado.permanente,
            mensagem: resultado.mensagem
          });
        } else {
          setBloqueio(null);
        }
      } else {
        setBloqueio(null);
      }
    };
    
    const debounce = setTimeout(verificar, 500);
    return () => clearTimeout(debounce);
  }, [loginEmail]);

  // Redirecionar se já autenticado
  useEffect(() => {
    if (!authLoading && user && profile) {
      const redirectTo = stateFrom || getRedirectUrl();
      navigate(redirectTo, { replace: true });
    }
  }, [user, profile, authLoading, navigate, stateFrom, getRedirectUrl]);

  // Loading inicial
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  // === HANDLERS ===

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicError(null);
    
    const emailResult = emailSchema.safeParse(magicEmail);
    if (!emailResult.success) {
      setMagicError('Digite um email válido');
      return;
    }

    setMagicLoading(true);
    
    try {
      const result = await signInWithMagicLink({ email: magicEmail });
      if (result.success) {
        setMagicSent(true);
        toast.success('Link enviado! Verifique seu email.');
      } else {
        setMagicError(result.error || 'Erro ao enviar link');
        toast.error(result.error || 'Erro ao enviar link');
      }
    } catch (error: any) {
      setMagicError(error.message || 'Erro ao enviar link');
      toast.error('Erro ao enviar link');
    } finally {
      setMagicLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Validar campos
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const firstError = result.error.errors[0];
      setLoginError(firstError.message);
      return;
    }

    // Verificar bloqueio antes de tentar
    const bloqueioResult = await verificarBloqueio(loginEmail);
    if (bloqueioResult.bloqueado) {
      setBloqueio({
        bloqueado: true,
        permanente: bloqueioResult.permanente,
        mensagem: bloqueioResult.mensagem
      });
      return;
    }

    setLoginLoading(true);

    try {
      const authResult = await signIn({ email: loginEmail, password: loginPassword });
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Erro ao fazer login');
      }
      
      // Buscar profile incluindo primeiro_acesso
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nome, tipo, primeiro_acesso')
        .eq('email', loginEmail.toLowerCase())
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao buscar profile:', profileError);
        throw new Error('Erro ao verificar perfil');
      }

      if (!userProfile) {
        throw new Error('Perfil não encontrado');
      }

      // Registrar sucesso
      await registrarTentativa(loginEmail, true);
      
      // Criar sessão customizada
      const tipoDispositivo = detectarDispositivo();
      const sessaoResult = await criarSessao(userProfile.id, tipoDispositivo);
      
      if (sessaoResult.success && sessaoResult.token) {
        localStorage.setItem(SESSION_TOKEN_KEY, sessaoResult.token);
      }

      // Verificar primeiro_acesso - redirecionar para definir senha
      if (userProfile.primeiro_acesso) {
        toast.success('Por favor, defina sua nova senha.');
        navigate('/definir-senha', { replace: true });
        return;
      }

      // Redirecionar conforme tipo de usuário
      const primeiroNome = userProfile.nome?.split(' ')[0] || 'usuário';
      toast.success(`Bem-vindo, ${primeiroNome}!`);

      if (userProfile.tipo === 'associado') {
        navigate('/app/home', { replace: true });
      } else {
        navigate(stateFrom || '/dashboard', { replace: true });
      }
      
    } catch (error: any) {
      // Registrar falha
      const tentativaResult = await registrarTentativa(loginEmail, false, 'senha_incorreta');
      
      if (tentativaResult.bloqueado) {
        setBloqueio({
          bloqueado: true,
          permanente: tentativaResult.permanente,
          mensagem: tentativaResult.permanente 
            ? 'Conta bloqueada permanentemente. Contate seu supervisor.'
            : `Conta bloqueada por ${tentativaResult.minutos} minutos.`
        });
      } else if (tentativaResult.tentativas_restantes > 0) {
        setLoginError(`Email ou senha inválidos. ${tentativaResult.tentativas_restantes} tentativa(s) restante(s).`);
      } else {
        setLoginError(error.message || 'Email ou senha inválidos');
      }
      
      toast.error('Erro ao fazer login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar com Google');
    }
  };

  const resetMagicLink = () => {
    setMagicSent(false);
    setMagicEmail('');
    setMagicError(null);
  };

  // === RENDER ===

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">SGA PRATIC 2.0</h1>
          <p className="text-muted-foreground mt-1">Sistema de Gestão de Associados</p>
        </div>

        {/* Card de Login */}
        <div className="bg-card rounded-xl shadow-lg border p-6">
          {/* Botão Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4"
            onClick={handleGoogleLogin}
          >
            <GoogleIcon />
            <span className="ml-2">Continuar com Google</span>
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mb-4">
            Só funciona se seu email já estiver cadastrado no sistema
          </p>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'magic-link' | 'senha')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
              <TabsTrigger value="senha">Senha</TabsTrigger>
            </TabsList>

            {/* Tab Magic Link */}
            <TabsContent value="magic-link">
              {magicSent ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Email enviado!</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Enviamos um link para <strong>{magicEmail}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Não recebeu? Verifique a caixa de spam ou{' '}
                    <button
                      type="button"
                      onClick={resetMagicLink}
                      className="text-primary underline hover:no-underline"
                    >
                      tente novamente
                    </button>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  {magicError && (
                    <Alert variant="destructive">
                      <AlertDescription>{magicError}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      disabled={magicLoading}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={magicLoading || !magicEmail}
                  >
                    {magicLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Magic Link
                      </>
                    )}
                  </Button>
                </form>
              )}
            </TabsContent>

            {/* Tab Senha */}
            <TabsContent value="senha">
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Alerta de Bloqueio */}
                {bloqueio?.bloqueado && (
                  <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Conta Bloqueada</AlertTitle>
                    <AlertDescription>
                      {bloqueio.mensagem}
                      {bloqueio.permanente && (
                        <p className="mt-2 text-sm">
                          Entre em contato com seu supervisor para desbloquear.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Erro de Login */}
                {loginError && !bloqueio?.bloqueado && (
                  <Alert variant="destructive">
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loginLoading || bloqueio?.bloqueado}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loginLoading || bloqueio?.bloqueado}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginLoading || !loginEmail || !loginPassword || bloqueio?.bloqueado}
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Associação de Proteção Veicular PRATIC
        </p>
      </div>
    </div>
  );
}