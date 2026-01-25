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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle, FlaskConical, Copy, Check, User } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PrimeiroAcessoModal } from '@/components/app/PrimeiroAcessoModal';

// ============================================
// TIPOS E CONSTANTES
// ============================================
type LoginError = 
  | 'invalid_credentials'
  | 'cpf_not_found'
  | 'account_blocked'
  | 'account_suspended'
  | 'network_error'
  | 'unknown_error';

const ERROR_MESSAGES: Record<LoginError, string> = {
  invalid_credentials: 'CPF ou senha inválidos',
  cpf_not_found: 'CPF não encontrado. Verifique os dados.',
  account_blocked: 'Sua conta está bloqueada. Entre em contato conosco.',
  account_suspended: 'Sua conta está suspensa. Regularize sua situação.',
  network_error: 'Erro de conexão. Verifique sua internet.',
  unknown_error: 'Erro inesperado. Tente novamente.',
};

const STORAGE_KEY_REMEMBER_CPF = 'pratic_remember_cpf';
const WHATSAPP_SUPORTE = 'https://wa.me/5511999999999?text=Olá, preciso de ajuda para acessar o app PRATIC';

// ============================================
// CPF UTILITIES
// ============================================
function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
}

function unformatCPF(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidCPF(cpf: string): boolean {
  const numbers = unformatCPF(cpf);
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10])) return false;
  
  return true;
}

function parseLoginError(errorMessage: string): LoginError {
  if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('incorretos') || errorMessage.includes('inválidos')) {
    return 'invalid_credentials';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('não encontrado')) {
    return 'cpf_not_found';
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

const cpfSchema = z.string().length(11, 'CPF deve ter 11 dígitos');
const isDev = import.meta.env.DEV;

// ============================================
// COMPONENTE
// ============================================
export default function AppLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, loading: authLoading } = useAuth();
  const { isTestMode, loginTeste } = useAssociado();

  // Form state
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | string | null>(null);

  // Modal states
  const [modalPrimeiroAcesso, setModalPrimeiroAcesso] = useState(false);
  const [modalContaTeste, setModalContaTeste] = useState(false);
  const [loadingContaTeste, setLoadingContaTeste] = useState(false);
  const [testCredentials, setTestCredentials] = useState<{ cpf: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'cpf' | 'password' | null>(null);

  // Carregar CPF salvo ao montar
  useEffect(() => {
    const savedCpf = localStorage.getItem(STORAGE_KEY_REMEMBER_CPF);
    if (savedCpf) {
      setCpf(formatCPF(savedCpf));
      setRememberMe(true);
    }
  }, []);

  // Redirect if already logged in as associado or test mode
  useEffect(() => {
    if (isTestMode) {
      navigate('/app/home', { replace: true });
      return;
    }
    if (user && profile?.tipo === 'associado') {
      const from = (location.state as any)?.from?.pathname || '/app/home';
      navigate(from, { replace: true });
    }
  }, [user, profile, navigate, location, isTestMode]);


  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
    setError(null);
  };

  // CPF + Senha Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCPF = unformatCPF(cpf);

    // 1. VERIFICAR LOGIN DE TESTE
    if (rawCPF === TEST_CREDENTIALS.cpf && password === TEST_CREDENTIALS.password) {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_REMEMBER_CPF, rawCPF);
      } else {
        localStorage.removeItem(STORAGE_KEY_REMEMBER_CPF);
      }
      loginTeste();
      toast.success('Login de teste realizado!');
      navigate('/app/home');
      return;
    }

    const cpfResult = cpfSchema.safeParse(rawCPF);
    if (!cpfResult.success || !isValidCPF(rawCPF)) {
      setError('invalid_credentials');
      return;
    }

    if (!password || password.length < 6) {
      setError('invalid_credentials');
      return;
    }

    setLoading(true);

    try {
      // PASSO 1: Buscar email real do associado pelo CPF
      console.log('[AppLogin] Buscando email pelo CPF:', rawCPF);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('cpf', rawCPF)
        .eq('tipo', 'associado')
        .maybeSingle();

      // Se CPF não encontrado na base
      if (profileError) {
        console.error('[AppLogin] Erro ao buscar profile:', profileError);
        setError('network_error');
        setLoading(false);
        return;
      }

      if (!profile?.email) {
        console.log('[AppLogin] CPF não encontrado na base:', rawCPF);
        setError('cpf_not_found');
        setLoading(false);
        return;
      }

      console.log('[AppLogin] Email encontrado:', profile.email);

      // PASSO 2: Fazer login com o email real encontrado
      const result = await signIn({ 
        email: profile.email.toLowerCase().trim(), 
        password 
      });

      if (!result.success) {
        const errorMessage = result.error || 'Erro ao fazer login';
        const parsedError = parseLoginError(errorMessage);
        setError(parsedError);
      } else {
        // Login bem-sucedido - salvar CPF se "lembrar" estiver marcado
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEY_REMEMBER_CPF, rawCPF);
        } else {
          localStorage.removeItem(STORAGE_KEY_REMEMBER_CPF);
        }
      }
    } catch (err) {
      console.error('[AppLogin] Erro inesperado:', err);
      setError('unknown_error');
    } finally {
      setLoading(false);
    }
  };

  // Handle creating test account
  const handleCriarContaTeste = async () => {
    setLoadingContaTeste(true);
    setTestCredentials(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-test-user');

      if (error) throw error;

      if (data?.cpf && data?.password) {
        setTestCredentials({
          cpf: data.cpf,
          password: data.password,
        });
        toast.success('Conta de teste criada com sucesso!');
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      console.error('Erro ao criar conta teste:', err);
      toast.error(err.message || 'Erro ao criar conta de teste');
    } finally {
      setLoadingContaTeste(false);
    }
  };

  const copyToClipboard = async (text: string, field: 'cpf' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field === 'cpf' ? 'CPF' : 'Senha'} copiado!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const useTestCredentials = () => {
    if (testCredentials) {
      setCpf(formatCPF(testCredentials.cpf));
      setPassword(testCredentials.password);
      setModalContaTeste(false);
      toast.success('Credenciais preenchidas! Clique em Entrar.');
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
          <h1 className="text-4xl font-bold text-blue-600">PRATIC</h1>
          <p className="text-gray-600 mt-2">Área do Associado</p>
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
            {/* Campo CPF */}
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-sm font-medium text-gray-700">
                CPF
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCPFChange}
                  disabled={loading}
                  className="h-12 pl-10 text-lg tracking-wide"
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
                  onChange={(e) => {
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
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label 
                htmlFor="remember" 
                className="text-sm text-gray-600 cursor-pointer"
              >
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
        <div className="mt-6 text-center space-y-3">
          <Link
            to="/app/forgot-password"
            className="block text-sm font-medium text-blue-600 hover:underline"
          >
            Esqueci minha senha
          </Link>
          <button
            type="button"
            onClick={() => setModalPrimeiroAcesso(true)}
            className="block w-full text-sm font-medium text-blue-600 hover:underline"
          >
            Primeiro acesso? Criar senha
          </button>
        </div>

        {/* CREDENCIAIS DE TESTE - Apenas em DEV */}
        {isDev && (
          <div className="mt-6 rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-4">
            <div className="flex items-center gap-2 text-yellow-700">
              <FlaskConical className="h-4 w-4" />
              <span className="text-sm font-medium">ACESSO DE TESTE</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-yellow-800">
              <p><strong>CPF:</strong> {TEST_CREDENTIALS.cpfFormatted}</p>
              <p><strong>Senha:</strong> {TEST_CREDENTIALS.password}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full border-yellow-500 text-yellow-700 hover:bg-yellow-100"
              onClick={() => {
                setCpf(TEST_CREDENTIALS.cpfFormatted);
                setPassword(TEST_CREDENTIALS.password);
                toast.success('Credenciais preenchidas!');
              }}
            >
              Usar credenciais de teste
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-yellow-700 hover:bg-yellow-100"
              onClick={() => setModalContaTeste(true)}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Criar Conta de Teste (Supabase)
            </Button>
          </div>
        )}

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

      {/* Modal Primeiro Acesso */}
      <PrimeiroAcessoModal 
        open={modalPrimeiroAcesso} 
        onClose={() => setModalPrimeiroAcesso(false)} 
      />

      {/* Modal Conta de Teste */}
      <Dialog open={modalContaTeste} onOpenChange={setModalContaTeste}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-orange-500" />
              Conta de Teste
            </DialogTitle>
            <DialogDescription>
              Crie uma conta de teste para desenvolvimento. Esta funcionalidade está disponível apenas em ambiente de desenvolvimento.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!testCredentials ? (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg bg-orange-50 p-4 text-center">
                  <p className="text-sm text-orange-700">
                    Será criado um usuário associado fictício com dados de teste para você poder explorar todas as funcionalidades do app.
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleCriarContaTeste}
                  disabled={loadingContaTeste}
                >
                  {loadingContaTeste ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="mr-2 h-4 w-4" />
                      Criar Conta de Teste
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-center text-sm font-medium text-foreground">
                  Conta criada com sucesso!
                </p>

                <div className="space-y-3">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">CPF</p>
                        <p className="font-mono font-medium">{formatCPF(testCredentials.cpf)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(testCredentials.cpf, 'cpf')}
                      >
                        {copiedField === 'cpf' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Senha</p>
                        <p className="font-mono font-medium">{testCredentials.password}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(testCredentials.password, 'password')}
                      >
                        {copiedField === 'password' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={useTestCredentials}
                >
                  Usar estas credenciais
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setModalContaTeste(false);
                setTestCredentials(null);
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
