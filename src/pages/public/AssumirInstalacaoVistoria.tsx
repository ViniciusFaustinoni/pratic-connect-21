import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssumirInstalacaoVistoria } from '@/hooks/useVistoriaLinkPublica';
import { supabase } from '@/integrations/supabase/client';

/**
 * Página intermediária pós-login que tenta assumir a instalação para o técnico autenticado.
 * - Se ninguém estiver atribuído ainda → atribui ao usuário e redireciona para /instalador/vistoria/:id.
 * - Se já estiver atribuído a outro → exibe aviso (sem login bypass, sem redirecionamento).
 */
export default function AssumirInstalacaoVistoria() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const assumirMut = useAssumirInstalacaoVistoria();

  const [estado, setEstado] = useState<'verificando' | 'sucesso' | 'ja_atribuido' | 'erro' | 'nao_logado'>(
    'verificando',
  );
  const [tecnicoNome, setTecnicoNome] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!token) {
        setEstado('erro');
        setErroMsg('Token inválido');
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        setEstado('nao_logado');
        return;
      }
      try {
        const res = await assumirMut.mutateAsync({ token });
        if (cancel) return;
        setRedirectTo(res.redirect_to);
        setEstado('sucesso');
        // Redireciona após pequena pausa
        setTimeout(() => {
          if (res.redirect_to) navigate(res.redirect_to, { replace: true });
        }, 800);
      } catch (err: any) {
        if (cancel) return;
        if (err?.alreadyAssigned) {
          setTecnicoNome(err.tecnico_nome || null);
          setEstado('ja_atribuido');
        } else {
          setErroMsg(err?.message || 'Erro ao assumir instalação');
          setEstado('erro');
        }
      }
    }
    run();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {estado === 'verificando' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Validando atribuição...</p>
          </>
        )}

        {estado === 'sucesso' && (
          <>
            <CheckCircle className="h-12 w-12 text-success mx-auto" />
            <h1 className="text-lg font-bold">Instalação atribuída a você</h1>
            <p className="text-sm text-muted-foreground">Redirecionando para a execução...</p>
            {redirectTo && (
              <Button onClick={() => navigate(redirectTo, { replace: true })} className="w-full">
                Continuar agora
              </Button>
            )}
          </>
        )}

        {estado === 'ja_atribuido' && (
          <>
            <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto" />
            <h1 className="text-lg font-bold">Instalação já atribuída</h1>
            <p className="text-sm text-muted-foreground">
              Esta instalação já foi atribuída a{' '}
              <span className="font-semibold">{tecnicoNome || 'outro técnico'}</span>.
              <br />
              Procure o monitoramento se for necessário trocar o responsável.
            </p>
            <Button variant="outline" onClick={() => navigate(`/vistoria/${token}`)} className="w-full">
              Voltar ao link da vistoria
            </Button>
          </>
        )}

        {estado === 'nao_logado' && (
          <>
            <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto" />
            <h1 className="text-lg font-bold">É necessário estar logado</h1>
            <Button
              onClick={() => {
                const callback = `/vistoria/${token}/assumir-instalacao`;
                window.location.href = `/auth?redirect=${encodeURIComponent(callback)}`;
              }}
              className="w-full"
            >
              Fazer login
            </Button>
          </>
        )}

        {estado === 'erro' && (
          <>
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-lg font-bold">Não foi possível assumir</h1>
            <p className="text-sm text-muted-foreground">{erroMsg}</p>
            <Button variant="outline" onClick={() => navigate(`/vistoria/${token}`)} className="w-full">
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
