import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getHojeBrasilia } from '@/lib/date-utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

/**
 * Hook idempotente para garantir que o turno de hoje existe quando o profissional está em serviço.
 * 
 * Cenários cobertos:
 * - Profissional clica "Iniciar Serviço" → turno criado
 * - Profissional reabre o app com em_servico=true → turno recuperado/criado
 * - Profissional volta do background → turno verificado
 * 
 * Regras:
 * - Se turno de hoje já existe e está ativo/em_almoco → reutiliza (não sobrescreve inicio_turno)
 * - Se turno de hoje existe e está encerrado → reativa (status='ativo', limpa fim_turno)
 * - Se turno de hoje não existe → cria novo com inicio_turno=agora
 */
export function useGarantirTurno(emServico: boolean) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);
  const lastDateRef = useRef<string>('');
  const [debitoBloqueado, setDebitoBloqueado] = useState(false);
  const [mensagemDebito, setMensagemDebito] = useState<string | null>(null);
  const garantirTurnoMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Sem perfil');

      const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');

      // Verificar se já existe turno para hoje
      const { data: turnoExistente, error: fetchError } = await supabase
        .from('turnos_profissionais')
        .select('id, inicio_turno, status')
        .eq('profissional_id', profile.id)
        .eq('data', hoje)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (turnoExistente) {
        if (turnoExistente.status === 'encerrado') {
          // Reativar turno encerrado
          const { error } = await supabase
            .from('turnos_profissionais')
            .update({ status: 'ativo', fim_turno: null })
            .eq('id', turnoExistente.id);
          if (error) throw error;
          console.log('[useGarantirTurno] Turno reativado:', turnoExistente.id);
        } else {
          console.log('[useGarantirTurno] Turno já existe e está ativo/em_almoco:', turnoExistente.id);
        }
        return turnoExistente.id;
      }

      // Criar novo turno — buscar saldo do dia anterior e verificar débito
      const { data: turnoAnterior } = await supabase
        .from('turnos_profissionais')
        .select('minutos_extras, minutos_faltantes, saldo_anterior_minutos')
        .eq('profissional_id', profile.id)
        .lt('data', hoje)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();

      const saldoDoDia = turnoAnterior
        ? (turnoAnterior.minutos_extras || 0) - (turnoAnterior.minutos_faltantes || 0)
        : 0;
      const saldoAcumulado = saldoDoDia + (turnoAnterior?.saldo_anterior_minutos || 0);

      // Verificar limite de débito
      const { data: configLimite } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'jornada_limite_debito_horas')
        .maybeSingle();
      
      const limiteHoras = parseFloat(configLimite?.valor || '0');
      if (limiteHoras > 0 && saldoAcumulado < 0 && Math.abs(saldoAcumulado) > limiteHoras * 60) {
        const horas = Math.floor(Math.abs(saldoAcumulado) / 60);
        const mins = Math.abs(saldoAcumulado) % 60;
        throw new Error(`DEBITO_BLOQUEIO:Você possui ${horas}h ${mins}min de débito acumulado. Entre em contato com o coordenador para regularizar antes de iniciar um novo turno.`);
      }

      const { data: novoTurno, error: insertError } = await supabase
        .from('turnos_profissionais')
        .insert({
          profissional_id: profile.id,
          data: hoje,
          inicio_turno: new Date().toISOString(),
          status: 'ativo',
          saldo_anterior_minutos: saldoAcumulado,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      console.log('[useGarantirTurno] Novo turno criado:', novoTurno.id);
      return novoTurno.id;
    },
    onSuccess: () => {
      setDebitoBloqueado(false);
      setMensagemDebito(null);
      queryClient.invalidateQueries({ queryKey: ['turno-profissional'] });
      queryClient.invalidateQueries({ queryKey: ['jornadas-profissionais'] });
    },
    onError: (error) => {
      const msg = error.message || '';
      if (msg.startsWith('DEBITO_BLOQUEIO:')) {
        const mensagem = msg.replace('DEBITO_BLOQUEIO:', '');
        setDebitoBloqueado(true);
        setMensagemDebito(mensagem);
        toast.error(mensagem);
      } else {
        console.error('[useGarantirTurno] Erro:', error);
      }
    },
  });

  const garantir = useCallback(() => {
    if (!profile?.id || garantirTurnoMutation.isPending) return;
    garantirTurnoMutation.mutate();
  }, [profile?.id, garantirTurnoMutation]);

  // Efeito principal: garantir turno quando emServico=true
  useEffect(() => {
    const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');
    
    if (emServico && profile?.id) {
      // Rodar se é a primeira vez ou se o dia mudou
      if (!hasRunRef.current || lastDateRef.current !== hoje) {
        hasRunRef.current = true;
        lastDateRef.current = hoje;
        garantir();
      }
    } else {
      hasRunRef.current = false;
    }
  }, [emServico, profile?.id, garantir]);

  // Também garantir ao voltar do background (visibilitychange)
  useEffect(() => {
    if (!emServico || !profile?.id) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useGarantirTurno] App voltou ao foreground - verificando turno');
        garantir();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [emServico, profile?.id, garantir]);

  return {
    garantirTurno: garantir,
    isGarantindo: garantirTurnoMutation.isPending,
    debitoBloqueado,
    mensagemDebito,
  };
}
