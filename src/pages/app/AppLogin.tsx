import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAssociado } from '@/contexts/AssociadoContext';
import { TEST_CREDENTIALS } from '@/data/associadoTeste';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Loader2, AlertCircle, Mail } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import logoPratic from '@/assets/pratic-logo.png';

// ============================================
// TIPOS E CONSTANTES
// ============================================
type LoginError = 'invalid_credentials' | 'email_not_found' | 'account_blocked' | 'account_suspended' | 'network_error' | 'unknown_error';
const ERROR_MESSAGES: Record<LoginError, string> = {
  invalid_credentials: 'Email ou senha inválidos',
  email_not_found: 'Email não encontrado. Verifique os dados.',
  account_blocked: 'Sua conta está bloqueada. Entre em contato conosco.',
  account_suspended: 'Sua conta está suspensa. Regularize sua situação.',
  network_error: 'Erro de conexão. Verifique sua internet.',
  unknown_error: 'Erro inesperado. Tente novamente.'
};
const STORAGE_KEY_REMEMBER_EMAIL = 'pratic_remember_email';
const WHATSAPP_SUPORTE = 'https://wa.me/5521970048549?text=Olá, preciso de ajuda para acessar o app PRATIC';

// ============================================
// UTILITÁRIOS
// ============================================
function parseLoginError(errorMessage: string): LoginError {
  if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('incorretos') || errorMessage.includes('inválidos')) {
    return 'invalid_credentials';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('não encontrado')) {
    return 'email_not_found';
  }
  if (errorMessage.includes('blocked') || errorMessage.includes('bloqueado')) {
    return 'account_blocked';
  }
  if (errorMessage.includes('suspended') || errorMessage.includes('suspenso')) {
    return 'account_suspended';
  }
  if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    return 'network_error';
  }
  return 'unknown_error';
}

const emailSchema = z.string().email('Email inválido');

// ============================================
// COMPONENTE
// ============================================
export default function AppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    profile,
    signIn,
    loading: authLoading
  } = useAuth();
  const {
    isTestMode,
    loginTeste
  } = useAssociado();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | string | null>(null);

  // Carregar email salvo ao montar
  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_KEY_REMEMBER_EMAIL);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Redirect if already logged in as associado or test mode
  useEffect(() => {
    if (isTestMode) {
      navigate('/app/home', {
        replace: true
      });
      return;
    }
    if (user && profile?.tipo === 'associado') {
      const from = (location.state as any)?.from?.pathname || '/app/home';
      navigate(from, {
        replace: true
      });
    }
  }, [user, profile, navigate, location, isTestMode]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  };

  // Email + Senha Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailTrimmed = email.toLowerCase().trim();

    // 1. VERIFICAR LOGIN DE TESTE (manter compatibilidade)
    if (emailTrimmed === TEST_CREDENTIALS.cpf && password === TEST_CREDENTIALS.password) {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_REMEMBER_EMAIL, emailTrimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_REMEMBER_EMAIL);
      }
      loginTeste();
      toast.success('Login de teste realizado!');
      navigate('/app/home');
      return;
    }

    // 2. Validar email
    const emailResult = emailSchema.safeParse(emailTrimmed);
    if (!emailResult.success) {
      setError('invalid_credentials');
      return;
    }

    // 3. Validar senha
    if (!password || password.length < 6) {
      setError('invalid_credentials');
      return;
    }

    setLoading(true);
    try {
      console.log('[AppLogin] Fazendo login com email:', emailTrimmed);

      const result = await signIn({
        email: emailTrimmed,
        password
      });

      if (!result.success) {
        const errorMessage = result.error || 'Erro ao fazer login';
        const parsedError = parseLoginError(errorMessage);
        setError(parsedError);
      } else {
        // Login bem-sucedido - salvar email se "lembrar" estiver marcado
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEY_REMEMBER_EMAIL, emailTrimmed);
        } else {
          localStorage.removeItem(STORAGE_KEY_REMEMBER_EMAIL);
        }
      }
    } catch (err) {
      console.error('[AppLogin] Erro inesperado:', err);
      setError('unknown_error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrecisaAjuda = () => {
    window.open(WHATSAPP_SUPORTE, '_blank');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white flex flex-col justify-center p-6">
        
        {/* CABEÇALHO */}
        <div className="text-center mb-8">
          <img src={logoPratic} alt="PRATIC" className="h-20 w-auto mx-auto mb-4" />
          <p className="text-gray-600">Área do Associado</p>
        </div>

        {/* CARD DO FORMULÁRIO */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          
          {/* Erro geral */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {ERROR_MESSAGES[error as LoginError] || error}
              </AlertDescription>
            </Alert>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={loading}
                  className="h-12 pl-10 text-lg"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  className="h-12 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            {/* Checkbox Lembrar */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={checked => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Lembrar meu acesso
              </Label>
            </div>

            {/* Botão Entrar */}
            <Button
              type="submit"
              className="h-12 w-full text-base font-semibold bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>

        {/* LINKS AUXILIARES */}
        <div className="mt-6 text-center">
          <Link to="/app/forgot-password" className="block text-sm font-medium text-blue-600 hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        {/* RODAPÉ */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-gray-400">Versão 2.0</p>
          <button
            type="button"
            onClick={handlePrecisaAjuda}
            className="text-xs text-blue-600 hover:underline"
          >
            Precisa de ajuda?
          </button>
        </div>

        {/* Link para Sistema Interno */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            É funcionário?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:underline">
              Acesse o Sistema
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
