import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook silencioso que detecta prestadores com links ativos sem confirmação
 * de chegada após X horas (configurável) e notifica coordenadores/admins.
 * Roda a cada 15 minutos. Não exibe nada visualmente.
 */
export function useMonitorPrestadorSemResposta() {
  const alertasEnviadosRef = useRef<Set<string>>(new Set());

  const { data: limiteHoras } = useQuery({
    queryKey: ['config-prestador-horas-alerta'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'prestador_horas_alerta_sem_resposta')
        .maybeSingle();
      return parseFloat(data?.valor ?? '2') || 2;
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    const verificar = async () => {
      const limite = limiteHoras ?? 2;
      const cutoff = new Date(Date.now() - limite * 60 * 60 * 1000).toISOString();

      // Buscar links aguardando há mais de X horas e não expirados
      const { data: links } = await (supabase as any)
        .from('instalacao_prestador_links')
        .select('id, instalacao_id, prestador_id')
        .eq('status', 'aguardando')
        .lt('created_at', cutoff)
        .gt('expires_at', new Date().toISOString());

      if (!links?.length) return;

      for (const link of links) {
        if (alertasEnviadosRef.current.has(link.id)) continue;

        // Verificar se já existe notificação para este link
        const { count: existente } = await (supabase as any)
          .from('notificacoes')
          .select('id', { count: 'exact', head: true })
          .eq('referencia_id', link.id)
          .eq('tipo', 'prestador_sem_resposta');

        if ((existente ?? 0) > 0) {
          alertasEnviadosRef.current.add(link.id);
          continue;
        }

        // Buscar dados do prestador e da instalação
        const [{ data: prestador }, { data: instalacao }] = await Promise.all([
          (supabase as any)
            .from('prestadores_assistencia')
            .select('razao_social, nome_fantasia')
            .eq('id', link.prestador_id)
            .maybeSingle(),
          (supabase as any)
            .from('instalacoes')
            .select('cidade')
            .eq('id', link.instalacao_id)
            .maybeSingle(),
        ]);

        const nomePrestador = prestador?.nome_fantasia || prestador?.razao_social || 'Prestador';
        const cidade = instalacao?.cidade || 'cidade não informada';

        // Buscar coordenadores e admins
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['coordenador_monitoramento', 'admin', 'diretor']);

        if (!roles?.length) continue;

        const destinatarios = [...new Set(roles.map(r => r.user_id))];

        const notificacoes = destinatarios.map(userId => ({
          user_id: userId,
          tipo: 'prestador_sem_resposta',
          titulo: '⚠️ Prestador sem resposta',
          mensagem: `Instalação em ${cidade} aguardando confirmação do prestador ${nomePrestador} há mais de ${limite} horas.`,
          referencia_id: link.id,
          referencia_tipo: 'instalacao_prestador_link',
          lida: false,
          prioridade: 'alta',
        }));

        await (supabase as any)
          .from('notificacoes')
          .insert(notificacoes);

        alertasEnviadosRef.current.add(link.id);
        console.log('[MonitorPrestador] Alerta enviado para', destinatarios.length, 'destinatários - link:', link.id);
      }
    };

    verificar();
    const interval = setInterval(verificar, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [limiteHoras]);
}
