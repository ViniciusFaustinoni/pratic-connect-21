import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  criarSessao, 
  detectarDispositivo,
  SESSION_TOKEN_KEY
} from '@/hooks/useAuthSession';

const emailSchema = z.string().email('Email inválido');
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});


export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFrom = location.state?.from?.pathname;
  
  const { user, profile, signIn, signInWithMagicLink, getRedirectUrl, loading: authLoading } = useAuth();

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
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    senha?: string;
    geral?: string;
  }>({});
  

  // Validação de formato de email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Função de validação completa
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    const trimmedEmail = loginEmail.trim();
    
    // Validação Email
    if (!trimmedEmail) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(trimmedEmail)) {
      newErrors.email = 'Formato de email inválido';
    }
    
    // Validação Senha (APENAS na aba senha, não no Magic Link)
    if (activeTab === 'senha') {
      const trimmedSenha = loginPassword.trim();
      if (!trimmedSenha) {
        newErrors.senha = 'Senha é obrigatória';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


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
    
    // Prevenir múltiplas submissões simultâneas
    if (isSubmittingLogin || loginLoading) {
      return;
    }
    
    setIsSubmittingLogin(true);
    setErrors({}); // Limpar erros anteriores

    // Validar PRIMEIRO - se falhar, NÃO continua
    if (!validateForm()) {
      return;
    }


    setLoginLoading(true);

    try {
      const authResult = await signIn({ email: loginEmail, password: loginPassword });
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Erro ao fazer login');
      }
      
      // Buscar usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setErrors({ geral: 'Erro ao fazer login' });
        return;
      }

      // Buscar profile por user_id (mais confiável que email)
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nome, tipo, primeiro_acesso')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile) {
        console.error('Erro ao buscar profile:', profileError);
        // Fallback: vai para dashboard
        toast.success('Bem-vindo!');
        navigate('/dashboard', { replace: true });
        return;
      }

      
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
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('Invalid login credentials')) {
        setErrors({ geral: 'Email ou senha incorretos' });
      } else if (errorMessage.includes('Email not confirmed')) {
        setErrors({ geral: 'Email não confirmado. Verifique sua caixa de entrada.' });
      } else {
        setErrors({ geral: 'Erro ao fazer login. Tente novamente.' });
      }
      
      console.error('Erro no login:', error);
      toast.error('Erro ao fazer login');
    } finally {
      setLoginLoading(false);
      setIsSubmittingLogin(false);
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
          <img 
            src="/logos/logo-full-light.png" 
            alt="PRATIC Car" 
            className="h-20 mx-auto mb-4 dark:hidden"
          />
          <img 
            src="/logos/logo-full-dark.png" 
            alt="PRATIC Car" 
            className="h-20 mx-auto mb-4 hidden dark:block"
          />
          
          <p className="text-muted-foreground mt-1">Sistema de Gestão de Associados</p>
        </div>

        {/* Card de Login */}
        <div className="bg-card rounded-xl shadow-lg border p-6">

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

                {/* Erro Geral de Login */}
                {errors.geral && !bloqueio?.bloqueado && (
                  <Alert variant="destructive" className="animate-in fade-in duration-200">
                    <AlertDescription>{errors.geral}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => {
                  const value = e.target.value;
                  setLoginEmail(value);
                  
                  // Limpar erro somente quando formato ficar válido
                  if (value && errors.email) {
                    if (validateEmail(value)) {
                      setErrors(prev => ({ ...prev, email: undefined }));
                    }
                  }
                }}
                onBlur={() => {
                  // Validar ao sair do campo (se tiver conteúdo)
                  if (loginEmail && !validateEmail(loginEmail)) {
                    setErrors(prev => ({ ...prev, email: 'Formato de email inválido' }));
                  }
                }}
                disabled={loginLoading || bloqueio?.bloqueado}
                className={errors.email ? 'border-destructive' : ''}
              />
                  {errors.email && (
                    <p className="text-sm text-destructive animate-in fade-in duration-200">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (errors.senha) {
                          setErrors(prev => ({ ...prev, senha: undefined }));
                        }
                      }}
                      className={cn(
                        "pl-10 pr-10",
                        errors.senha && "border-destructive focus:border-destructive focus:ring-destructive"
                      )}
                      disabled={loginLoading || bloqueio?.bloqueado}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.senha && (
                    <p className="text-sm text-destructive flex items-center gap-1 animate-in fade-in duration-200">
                      <AlertCircle className="h-4 w-4" />
                      {errors.senha}
                    </p>
                  )}
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
                  disabled={loginLoading || isSubmittingLogin || !loginEmail || !loginPassword || bloqueio?.bloqueado}
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