import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Check, X, Loader2, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SESSION_TOKEN_KEY } from '@/hooks/useAuthSession';

export default function DefinirSenha() {
  const navigate = useNavigate();
  
  const [carregando, setCarregando] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileTipo, setProfileTipo] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string>('');
  
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Validações
  const temMinimo = senha.length >= 8;
  const temMaiuscula = /[A-Z]/.test(senha);
  const temMinuscula = /[a-z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);
  const senhasIguais = senha === confirmarSenha && confirmarSenha.length > 0;
  
  const senhaValida = temMinimo && temMaiuscula && temMinuscula && temNumero && senhasIguais;

  // Força da senha
  const requisitosAtendidos = [temMinimo, temMaiuscula, temMinuscula, temNumero].filter(Boolean).length;
  const forcaSenha = requisitosAtendidos <= 1 ? 'fraca' : requisitosAtendidos <= 3 ? 'media' : 'forte';

  // Verificar se usuário pode acessar essa página
  useEffect(() => {
    const verificarAcesso = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/auth', { replace: true });
          return;
        }

        const email = session.user.email?.toLowerCase();
        if (!email) {
          navigate('/auth', { replace: true });
          return;
        }

        // Buscar profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, nome, primeiro_acesso, tipo')
          .eq('email', email)
          .maybeSingle();

        if (error || !profile) {
          navigate('/auth', { replace: true });
          return;
        }

        // Se não é primeiro acesso, redirecionar para dashboard
        if (!profile.primeiro_acesso) {
          const dest = profile.tipo === 'associado' ? '/app/home' : profile.tipo === 'agencia' ? '/agencia' : '/dashboard';
          navigate(dest, { replace: true });
          return;
        }

        setProfileId(profile.id);
        setProfileTipo(profile.tipo);
        setNomeUsuario(profile.nome?.split(' ')[0] || 'Usuário');
        setCarregando(false);
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        navigate('/auth', { replace: true });
      }
    };

    verificarAcesso();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!senhaValida || !profileId) return;
    
    setSalvando(true);
    
    try {
      // Atualizar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: senha
      });

      if (authError) throw authError;

      // Atualizar primeiro_acesso no banco
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ primeiro_acesso: false })
        .eq('id', profileId);

      if (dbError) throw dbError;

      // Registrar log
      await supabase.from('auth_logs').insert({
        profile_id: profileId,
        acao: 'senha_definida_primeiro_acesso',
        user_agent: navigator.userAgent,
        metadata: { primeiro_acesso: true }
      });

      toast.success('Senha definida com sucesso!');
      const destino = profileTipo === 'associado' ? '/app/home' : '/dashboard';
      navigate(destino, { replace: true });

    } catch (error: any) {
      console.error('Erro ao definir senha:', error);
      toast.error(error.message || 'Erro ao definir senha');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">SGA PRATIC 2.0</h1>
          <p className="text-sm text-muted-foreground">Sistema de Gestão de Associados</p>
        </div>

        <Card className="shadow-xl border">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Defina sua senha</CardTitle>
            <CardDescription>
              Olá, {nomeUsuario}! Crie uma senha segura para acessar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nova Senha */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nova senha</label>
                <div className="relative">
                  <Input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua nova senha"
                    disabled={salvando}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Indicador de Força */}
              {senha.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${requisitosAtendidos >= 1 ? (forcaSenha === 'fraca' ? 'bg-destructive' : forcaSenha === 'media' ? 'bg-yellow-500' : 'bg-green-500') : 'bg-muted'}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${requisitosAtendidos >= 2 ? (forcaSenha === 'media' ? 'bg-yellow-500' : 'bg-green-500') : 'bg-muted'}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${requisitosAtendidos >= 3 ? (forcaSenha === 'forte' ? 'bg-green-500' : 'bg-yellow-500') : 'bg-muted'}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${requisitosAtendidos >= 4 ? 'bg-green-500' : 'bg-muted'}`} />
                  </div>
                  <p className={`text-xs font-medium ${forcaSenha === 'fraca' ? 'text-destructive' : forcaSenha === 'media' ? 'text-yellow-600' : 'text-green-600'}`}>
                    Senha {forcaSenha === 'fraca' ? 'fraca' : forcaSenha === 'media' ? 'média' : 'forte'}
                  </p>
                </div>
              )}

              {/* Requisitos */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <RequisitoItem ok={temMinimo} texto="Mínimo 8 caracteres" />
                <RequisitoItem ok={temMaiuscula} texto="Uma letra maiúscula" />
                <RequisitoItem ok={temMinuscula} texto="Uma letra minúscula" />
                <RequisitoItem ok={temNumero} texto="Um número" />
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirmar senha</label>
                <div className="relative">
                  <Input
                    type={mostrarConfirmar ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Confirme sua nova senha"
                    disabled={salvando}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mostrarConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmarSenha.length > 0 && !senhasIguais && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>

              {/* Botão */}
              <Button
                type="submit"
                className="w-full"
                disabled={!senhaValida || salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Definir senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Associação de Proteção Veicular PRATIC
        </p>
      </div>
    </div>
  );
}

// Componente auxiliar para requisitos
function RequisitoItem({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-muted-foreground'}`}>
      {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      <span>{texto}</span>
    </div>
  );
}
