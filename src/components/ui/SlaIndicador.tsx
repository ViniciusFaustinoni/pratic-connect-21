import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface SlaIndicadorProps {
  criadoEm: string;
  tipoServico: string;
  tipoDeslocamento?: string;
  className?: string;
}

// Exported utility for external filtering
export function calcularPercentualSla(
  criadoEm: string,
  prazoHoras: number,
): { percentual: number; restanteMs: number } {
  const inicio = new Date(criadoEm).getTime();
  const prazoMs = prazoHoras * 60 * 60 * 1000;
  const prazoFinal = inicio + prazoMs;
  const restanteMs = prazoFinal - Date.now();
  const percentual = prazoMs > 0 ? (restanteMs / prazoMs) * 100 : 0;
  return { percentual, restanteMs };
}

// Shared hook for SLA config
export function useSlaConfig() {
  return useQuery({
    queryKey: ['config-sla-prazos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['sla_horas_instalacao', 'sla_horas_manutencao', 'viagem_sla_horas']);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        instalacao: parseFloat(map.sla_horas_instalacao) || 48,
        manutencao: parseFloat(map.sla_horas_manutencao) || 24,
        viagem: parseFloat(map.viagem_sla_horas) || 72,
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}

function formatarRestante(ms: number): string {
  if (ms <= 0) return 'VENCIDO';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getSlaTipo(tipo: string): 'instalacao' | 'manutencao' {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('manutencao') || t.includes('manutenção') || t.includes('retirada')) {
    return 'manutencao';
  }
  return 'instalacao';
}

export function SlaIndicador({ criadoEm, tipoServico, className }: SlaIndicadorProps) {
  const { data: config } = useSlaConfig();
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const resultado = useMemo(() => {
    if (!config) return null;
    const slaTipo = getSlaTipo(tipoServico);
    const prazoHoras = slaTipo === 'manutencao' ? config.manutencao : config.instalacao;
    const { percentual, restanteMs } = calcularPercentualSla(criadoEm, prazoHoras);
    return { percentual, restanteMs, texto: formatarRestante(restanteMs) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, criadoEm, tipoServico, agora]);

  if (!resultado) return null;

  const { percentual, texto } = resultado;

  let colorClasses: string;
  if (percentual > 50) {
    colorClasses = 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400';
  } else if (percentual > 25) {
    colorClasses = 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400';
  } else if (percentual > 0) {
    colorClasses = 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400';
  } else {
    colorClasses = 'bg-red-700/20 text-red-800 border-red-700/40 dark:text-red-300 font-bold';
  }

  return (
    <Badge variant="outline" className={`gap-1 text-[10px] px-1.5 py-0.5 ${colorClasses} ${className || ''}`}>
      <Clock className="h-2.5 w-2.5" />
      {texto}
    </Badge>
  );
}
