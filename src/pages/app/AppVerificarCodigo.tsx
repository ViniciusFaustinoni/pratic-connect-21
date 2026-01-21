import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function AppVerificarCodigo() {
  const navigate = useNavigate();
  const location = useLocation();

  const { cpf, tipo, canalEnvio, destinoMascarado, expiraEm } = location.state || {};

  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [success, setSuccess] = useState(false);

  // Calcular tempo restante
  useEffect(() => {
    if (!expiraEm) return;

    const calcularTempo = () => {
      const agora = new Date().getTime();
      const expira = new Date(expiraEm).getTime();
      const diff = Math.max(0, Math.floor((expira - agora) / 1000));
      setTempoRestante(diff);
    };

    calcularTempo();
    const interval = setInterval(calcularTempo, 1000);
    return () => clearInterval(interval);
  }, [expiraEm]);

  // Redirecionar se não tiver dados
  useEffect(() => {
    if (!cpf || !tipo) {
      navigate('/app/forgot-password', { replace: true });
    }
  }, [cpf, tipo, navigate]);

  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
  };

  const handleReenviar = async () => {
    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('app-auth-token/solicitar', {
        body: { cpf, tipo }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Código reenviado!');
      // Atualizar tempo de expiração
      if (data.expira_em) {
        const novaExpiracao = new Date(data.expira_em).getTime();
        const agora = new Date().getTime();
        setTempoRestante(Math.max(0, Math.floor((novaExpiracao - agora) / 1000)));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao reenviar código';
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (codigo.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }

    if (novaSenha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não conferem');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('app-auth-token/confirmar', {
        body: { cpf, codigo, nova_senha: novaSenha }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setSuccess(true);
      toast.success(data.mensagem);

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/app/login', { replace: true });
      }, 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar código';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {tipo === 'primeiro_acesso' ? 'Conta Criada!' : 'Senha Alterada!'}
            </h2>
            <p className="text-muted-foreground">
              Redirecionando para o login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => navigate('/app/forgot-password')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <CardTitle className="text-2xl font-bold">
            Verificar Código
          </CardTitle>
          <CardDescription>
            Digite o código de 6 dígitos enviado para {destinoMascarado || 'seu contato'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Código OTP */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Código de Verificação</label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={codigo}
                  onChange={setCodigo}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Timer e reenvio */}
              <div className="text-center text-sm">
                {tempoRestante > 0 ? (
                  <span className="text-muted-foreground">
                    Código expira em {formatarTempo(tempoRestante)}
                  </span>
                ) : (
                  <span className="text-destructive">Código expirado</span>
                )}
              </div>

              <Button
                type="button"
                variant="link"
                size="sm"
                className="w-full"
                onClick={handleReenviar}
                disabled={isResending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isResending ? 'animate-spin' : ''}`} />
                Reenviar código
              </Button>
            </div>

            {/* Nova senha */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Digite a senha novamente"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || codigo.length !== 6 || tempoRestante === 0}
            >
              {isLoading ? 'Verificando...' : tipo === 'primeiro_acesso' ? 'Criar Conta' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
