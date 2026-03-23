import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useJornadaTrabalho } from './useJornadaTrabalho';
import { getHojeBrasilia } from '@/lib/date-utils';

/**
 * Hook silencioso que detecta vistoriadores em turno ativo sem serviços concluídos
 * e envia notificação ao coordenador/admin. Roda a cada 5 minutos.
 * Não exibe nada visualmente para o vistoriador.
 */
export function useMonitorImprodutividade() {
  const { profile } = useAuth();
  const { turno } = useJornadaTrabalho();
  const alertaEnviadoRef = useRef<string | null>(null);

  // Config: horas de alerta
  const { data: limiteHoras } = useQuery({
    queryKey: ['config-alerta-improdutividade'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'jornada_horas_alerta_improdutividade')
        .maybeSingle();
      return parseFloat(data?.valor ?? '2') || 2;
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (!profile?.id || !turno) return;

    const verificar = async () => {
      // Só verificar turno ativo (não em almoço, não encerrado)
      if (turno.status !== 'ativo' || !turno.inicio_turno) return;

      // Calcular tempo ativo em minutos
      const inicio = new Date(turno.inicio_turno).getTime();
      // Descontar tempo de almoço se houve
      let tempoAlmoco = 0;
      if (turno.inicio_almoco && turno.fim_almoco) {
        tempoAlmoco = new Date(turno.fim_almoco).getTime() - new Date(turno.inicio_almoco).getTime();
      }
      const tempoAtivoMs = Date.now() - inicio - tempoAlmoco;
      const tempoAtivoMinutos = tempoAtivoMs / (1000 * 60);

      const limiteMinutos = (limiteHoras ?? 2) * 60;
      if (tempoAtivoMinutos < limiteMinutos) return;

      // Verificar serviços concluídos no dia
      const hojeStr = getHojeBrasilia().toISOString().split('T')[0];
      const { count } = await supabase
        .from('servicos')
        .select('id', { count: 'exact', head: true })
        .eq('profissional_id', profile.id)
        .eq('status', 'concluido')
        .gte('concluido_em', `${hojeStr}T00:00:00`)
        .lte('concluido_em', `${hojeStr}T23:59:59`);

      if ((count ?? 0) > 0) return;

      // Já enviou alerta para este turno?
      if (alertaEnviadoRef.current === turno.id) return;

      // Verificar se já existe notificação para este turno
      const { count: existente } = await (supabase as any)
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('referencia_id', turno.id)
        .eq('tipo', 'improdutividade_vistoriador');

      if ((existente ?? 0) > 0) {
        alertaEnviadoRef.current = turno.id;
        return;
      }

      // Buscar coordenadores e admins
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['coordenador_monitoramento', 'admin', 'diretor']);

      if (!roles?.length) return;

      const destinatarios = [...new Set(roles.map(r => r.user_id))];
      const nomeVistoriador = profile.nome || 'Vistoriador';
      const horasAtivo = Math.floor(tempoAtivoMinutos / 60);
      const minsAtivo = Math.round(tempoAtivoMinutos % 60);

      // Inserir notificações
      const notificacoes = destinatarios.map(userId => ({
        user_id: userId,
        tipo: 'improdutividade_vistoriador',
        titulo: '⚠️ Vistoriador improdutivo',
        mensagem: `${nomeVistoriador} está há ${horasAtivo}h${minsAtivo > 0 ? ` ${minsAtivo}min` : ''} em turno ativo sem nenhum serviço concluído.`,
        referencia_id: turno.id,
        referencia_tipo: 'turno',
        lida: false,
      }));

      await (supabase as any)
        .from('notificacoes')
        .insert(notificacoes);

      alertaEnviadoRef.current = turno.id;
      console.log('[MonitorImprodutividade] Alerta enviado para', destinatarios.length, 'destinatários');
    };

    // Verificar imediatamente e depois a cada 5 minutos
    verificar();
    const interval = setInterval(verificar, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [profile?.id, turno?.id, turno?.status, turno?.inicio_turno, limiteHoras]);
}
