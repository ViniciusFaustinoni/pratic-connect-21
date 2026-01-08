import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PageState = 'loading' | 'invalid' | 'form' | 'success';

export default function AppCriarSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [estado, setEstado] = useState<PageState>('loading');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cpfCriado, setCpfCriado] = useState<string | null>(null);

  // Validar token ao carregar
  useEffect(() => {
    if (!token) {
      setEstado('invalid');
      setErro('Link inválido. Solicite um novo link pelo app.');
      return;
    }

    validarToken();
  }, [token]);

  const validarToken = async () => {
    try {
      // Verificar se token existe e é válido
      const { data, error } = await supabase
        .from('auth_tokens_primeiro_acesso')
        .select('id, expira_em, usado')
        .eq('token', token)
        .single();

      if (error || !data) {
        setEstado('invalid');
        setErro('Link inválido ou já utilizado.');
        return;
      }

      if (data.usado) {
        setEstado('invalid');
        setErro('Este link já foi utilizado. Faça login com sua senha.');
        return;
      }

      if (new Date(data.expira_em) < new Date()) {
        setEstado('invalid');
        setErro('Link expirado. Solicite um novo link pelo app.');
        return;
      }

      setEstado('form');
    } catch (err) {
      console.error('Erro ao validar token:', err);
      setEstado('invalid');
      setErro('Erro ao validar link. Tente novamente.');
    }
  };

  const validarSenha = (senha: string): string[] => {
    const erros: string[] = [];
    if (senha.length < 6) erros.push('Mínimo 6 caracteres');
    if (!/[0-9]/.test(senha)) erros.push('Pelo menos um número');
    return erros;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    // Validações
    const errosSenha = validarSenha(senha);
    if (errosSenha.length > 0) {
      setErro(errosSenha.join('. '));
      return;
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('app-criar-senha', {
        body: { token, senha }
      });

      if (error) throw error;

      if (!data.success) {
        setErro(data.error);
        return;
      }

      setCpfCriado(data.cpf);
      setEstado('success');
      toast.success('Senha criada com sucesso!');

    } catch (err: any) {
      console.error('Erro:', err);
      setErro('Erro ao criar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (cpf: string): string => {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const irParaLogin = () => {
    navigate('/app/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-primary/80">
      {/* Header */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4 pt-12">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
            <Shield className="h-12 w-12 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary-foreground">PRATIC</h1>
            <p className="text-sm text-primary-foreground/80">Proteção Veicular</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="w-full rounded-t-3xl bg-background px-6 pb-8 pt-6 shadow-2xl">
        <div className="mx-auto w-full max-w-sm">

          {/* ESTADO: LOADING */}
          {estado === 'loading' && (
            <div className="py-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">Validando link...</p>
            </div>
          )}

          {/* ESTADO: INVALID */}
          {estado === 'invalid' && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground">Link inválido</h2>
                  <p className="mt-2 text-muted-foreground">{erro}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full" onClick={irParaLogin}>
                  Ir para login
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Precisa de ajuda?{' '}
                  <a 
                    href="https://wa.me/5500000000000" 
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    Fale conosco
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* ESTADO: FORM */}
          {estado === 'form' && (
            <>
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-foreground">Crie sua senha</h2>
                <p className="text-sm text-muted-foreground">
                  Defina uma senha segura para acessar o app
                </p>
              </div>

              {erro && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showSenha ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      disabled={loading}
                      className="h-12 pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 hover:bg-transparent"
                      onClick={() => setShowSenha(!showSenha)}
                    >
                      {showSenha ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 6 caracteres, com pelo menos um número
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmar">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmar"
                      type={showConfirmar ? 'text' : 'password'}
                      placeholder="Confirme sua senha"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      disabled={loading}
                      className="h-12 pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 hover:bg-transparent"
                      onClick={() => setShowConfirmar(!showConfirmar)}
                    >
                      {showConfirmar ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full text-base font-semibold"
                  disabled={loading || !senha || !confirmarSenha}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar senha'
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ESTADO: SUCCESS */}
          {estado === 'success' && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground">Senha criada!</h2>
                  <p className="mt-2 text-muted-foreground">
                    Sua conta foi ativada com sucesso.
                  </p>
                </div>
              </div>

              {cpfCriado && (
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">Seu CPF para login:</p>
                  <p className="text-lg font-mono font-semibold mt-1">
                    {formatCPF(cpfCriado)}
                  </p>
                </div>
              )}

              <Button className="w-full h-12" onClick={irParaLogin}>
                Fazer login
              </Button>
            </div>
          )}

          {/* Versão */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Versão 2.0.1
          </p>
        </div>
      </div>
    </div>
  );
}
