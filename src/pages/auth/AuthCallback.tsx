import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  criarSessao, 
  detectarDispositivo, 
  SESSION_TOKEN_KEY 
} from '@/hooks/useAuthSession';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [mensagem, setMensagem] = useState('Verificando autenticação...');

  useEffect(() => {
    const processarCallback = async () => {
      try {
        // Pequeno delay para UX
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 1. Capturar sessão do Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          throw new Error('Sessão inválida ou expirada');
        }

        const email = session.user.email?.toLowerCase();
        if (!email) {
          throw new Error('Email não encontrado na sessão');
        }

        setMensagem('Verificando usuário...');

        // 2. Buscar profile pelo email
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, nome, tipo, ativo, bloqueado, primeiro_acesso')
          .eq('email', email)
          .maybeSingle();

        if (profileError) {
          console.error('Erro ao buscar profile:', profileError);
          throw new Error('Erro ao verificar usuário');
        }

        if (!profile) {
          // Email não cadastrado no sistema
          await supabase.auth.signOut();
          throw new Error('Email não cadastrado no sistema. Contate seu supervisor.');
        }

        if (!profile.ativo) {
          await supabase.auth.signOut();
          throw new Error('Usuário inativo. Contate seu supervisor.');
        }

        if (profile.bloqueado) {
          await supabase.auth.signOut();
          throw new Error('Usuário bloqueado. Contate seu supervisor.');
        }

        setMensagem('Criando sessão...');

        // 3. Criar sessão customizada
        const tipoDispositivo = detectarDispositivo();
        const { success, token, error: sessaoError } = await criarSessao(
          profile.id, 
          tipoDispositivo
        );

        if (!success || !token) {
          console.error('Erro ao criar sessão:', sessaoError);
          throw new Error('Erro ao criar sessão');
        }

        // 4. Salvar token
        localStorage.setItem(SESSION_TOKEN_KEY, token);

        // 5. Sucesso!
        setStatus('success');
        setMensagem('Login realizado com sucesso!');

        // 6. Aguardar e redirecionar
        setTimeout(() => {
          // Verificar primeiro acesso
          if (profile.primeiro_acesso) {
            navigate('/definir-senha', { replace: true });
            return;
          }
          
          // Redirecionar conforme tipo
          if (profile.tipo === 'associado') {
            navigate('/app/home', { replace: true });
          } else if (profile.tipo === 'prestador') {
            navigate('/instalador', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1000);

      } catch (error) {
        console.error('Erro no callback:', error);
        setStatus('error');
        setMensagem(error instanceof Error ? error.message : 'Erro ao processar autenticação');
        
        // Aguardar 3 segundos e voltar pro login
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      }
    };

    processarCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="bg-card rounded-2xl shadow-xl border p-8 max-w-md w-full mx-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg text-foreground">{mensagem}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg text-foreground font-medium">{mensagem}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecionando...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-lg text-destructive font-medium">{mensagem}</p>
            <p className="text-sm text-muted-foreground mt-2">Voltando para o login...</p>
          </>
        )}
      </div>
    </div>
  );
}
