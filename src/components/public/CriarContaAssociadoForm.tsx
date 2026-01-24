import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, KeyRound, Loader2, Rocket, Check, X, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CriarContaAssociadoFormProps {
  associadoId: string;
  nomeAssociado: string;
  emailCadastrado?: string;
  onSuccess?: () => void;
}

// Função para mascarar email (segurança)
const mascarEmail = (email?: string): string => {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [user, domain] = parts;
  const maskedUser = user.length > 2 
    ? user[0] + '***' + user[user.length - 1]
    : user[0] + '***';
  return `${maskedUser}@${domain}`;
};

export function CriarContaAssociadoForm({ associadoId, nomeAssociado, emailCadastrado }: CriarContaAssociadoFormProps) {
  const navigate = useNavigate();
  const [usarEmailCadastrado, setUsarEmailCadastrado] = useState(!!emailCadastrado);
  const [emailCustomizado, setEmailCustomizado] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Email efetivo a ser usado
  const emailFinal = usarEmailCadastrado ? emailCadastrado : emailCustomizado;

  // Validações
  const emailValido = emailFinal ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFinal) : false;
  const senhaMinimo = senha.length >= 6;
  const senhaTemNumero = /[0-9]/.test(senha);
  const senhasConferem = senha === confirmarSenha && confirmarSenha.length > 0;
  const formValido = emailValido && senhaMinimo && senhaTemNumero && senhasConferem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValido || !emailFinal) {
      setErro('Preencha todos os campos corretamente');
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      // 1. Chamar edge function para criar usuário
      const { data, error } = await supabase.functions.invoke('app-criar-conta-cliente', {
        body: { associadoId, email: emailFinal.toLowerCase().trim(), senha }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar conta');

      // 2. Fazer login automático com as credenciais recém-criadas
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: emailFinal.toLowerCase().trim(),
        password: senha
      });

      if (loginError) {
        // Se falhar login automático, redirecionar para login manual
        toast.success('Conta criada! Faça login com seu email.');
        navigate('/app/login');
        return;
      }

      toast.success('Bem-vindo ao PRATIC!');
      navigate('/app/home');

    } catch (err: any) {
      console.error('Erro ao criar conta:', err);
      setErro(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const RequisitoItem = ({ ok, texto }: { ok: boolean; texto: string }) => (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <X className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={ok ? 'text-success' : 'text-muted-foreground'}>{texto}</span>
    </div>
  );

  return (
    <Card className="bg-card/80 backdrop-blur-xl border-primary/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" />
          Criar sua Conta
        </CardTitle>
        <CardDescription>
          Olá, {nomeAssociado.split(' ')[0]}! Escolha seu email e senha para acessar o app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de Email */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Qual email deseja usar?
            </Label>
            
            <RadioGroup 
              value={usarEmailCadastrado ? 'cadastrado' : 'outro'} 
              onValueChange={(value) => setUsarEmailCadastrado(value === 'cadastrado')}
              className="space-y-2"
            >
              {emailCadastrado && (
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                  <RadioGroupItem value="cadastrado" id="email-cadastrado" className="mt-0.5" />
                  <Label htmlFor="email-cadastrado" className="cursor-pointer flex-1">
                    <span className="font-medium">Usar email cadastrado</span>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {mascarEmail(emailCadastrado)}
                    </p>
                  </Label>
                </div>
              )}
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                <RadioGroupItem value="outro" id="email-outro" className="mt-0.5" />
                <Label htmlFor="email-outro" className="cursor-pointer flex-1">
                  <span className="font-medium">Usar outro email</span>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Informar um email diferente
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {/* Campo para email customizado */}
            {!usarEmailCadastrado && (
              <div className="space-y-2 pt-2">
                <Input
                  id="email-custom"
                  type="email"
                  placeholder="seu@email.com"
                  value={emailCustomizado}
                  onChange={(e) => setEmailCustomizado(e.target.value)}
                  disabled={loading}
                  className="bg-background/50"
                />
                {emailCustomizado && !emailValido && (
                  <p className="text-xs text-destructive">Digite um email válido</p>
                )}
              </div>
            )}
          </div>

          {/* Campo Senha */}
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Crie sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={loading}
                className="bg-background/50 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setMostrarSenha(!mostrarSenha)}
              >
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Requisitos da senha */}
            {senha && (
              <div className="space-y-1 pt-1">
                <RequisitoItem ok={senhaMinimo} texto="Mínimo 6 caracteres" />
                <RequisitoItem ok={senhaTemNumero} texto="Pelo menos um número" />
              </div>
            )}
          </div>

          {/* Campo Confirmar Senha */}
          <div className="space-y-2">
            <Label htmlFor="confirmar">Confirmar Senha</Label>
            <Input
              id="confirmar"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Digite novamente"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              disabled={loading}
              className="bg-background/50"
            />
            {confirmarSenha && !senhasConferem && (
              <p className="text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>

          {/* Erro */}
          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {/* Botão Submit */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !formValido}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando sua conta...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Criar Conta e Acessar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
