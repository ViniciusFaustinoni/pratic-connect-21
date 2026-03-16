import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  chamadoId: string;
  chamadoStatus: string;
}

type DespachoFase = 'contactando' | 'aguardando' | 'urgente' | 'atribuido' | null;

export function BadgeDespachoStatus({ chamadoId, chamadoStatus }: Props) {
  const [fase, setFase] = useState<DespachoFase>(null);

  const { data: despacho } = useQuery({
    queryKey: ['despacho-status', chamadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('despacho_reboque')
        .select('id, status, hora_disparo, hora_limite, total_enviados, total_aceites, prestador_atribuido_id')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: ['aguardando_aceites', 'prestador_a_caminho', 'prestador_despachado', 'em_atendimento'].includes(chamadoStatus),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!despacho) {
      setFase(null);
      return;
    }

    if (despacho.status === 'atribuido') {
      setFase('atribuido');
      return;
    }

    if (despacho.status === 'expirado') {
      setFase('urgente');
      return;
    }

    if (despacho.status === 'aguardando') {
      const limite = new Date(despacho.hora_limite);
      const agora = new Date();

      if (agora > limite) {
        setFase('urgente');
        return;
      }

      if ((despacho.total_aceites || 0) > 0) {
        setFase('aguardando');
      } else {
        setFase('contactando');
      }
    }
  }, [despacho]);

  // Realtime subscription
  useEffect(() => {
    if (!despacho?.id) return;

    const channel = supabase
      .channel(`despacho-badge-${despacho.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'despacho_reboque',
        filter: `id=eq.${despacho.id}`,
      }, () => {
        // Refetch on change
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [despacho?.id]);

  // Timer to check expiration
  useEffect(() => {
    if (!despacho || despacho.status !== 'aguardando') return;

    const timer = setInterval(() => {
      const limite = new Date(despacho.hora_limite);
      if (new Date() > limite) {
        setFase('urgente');
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [despacho]);

  if (!fase) return null;

  const config: Record<string, { label: string; className: string; sublabel?: string }> = {
    contactando: {
      label: 'Contactando Prestadores',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    aguardando: {
      label: 'Aguardando Orçamentos',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    urgente: {
      label: '🚨 CHAMADO URGENTE',
      className: 'bg-destructive text-destructive-foreground animate-pulse',
    },
    atribuido: {
      label: 'Atribuído',
      className: 'bg-green-100 text-green-800 border-green-300',
      sublabel: 'Em Andamento',
    },
  };

  const c = config[fase];

  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge className={cn('text-[10px] px-1.5 py-0', c.className)}>
        {c.label}
      </Badge>
      {c.sublabel && (
        <span className="text-[10px] text-muted-foreground font-medium">{c.sublabel}</span>
      )}
    </div>
  );
}
