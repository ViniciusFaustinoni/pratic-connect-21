import { useMemo } from "react";
import { differenceInDays, isToday } from "date-fns";
import { AtivacaoItem, Etapa } from "@/components/ativacao/AtivacaoCard";

interface AtivacaoMetrics {
  emProcesso: number;
  aguardandoCliente: number;
  slaEstourado: number;
  ativadosHoje: number;
  tempoMedio: number;
}

export function useAtivacaoMetrics(
  items: AtivacaoItem[],
  etapas: Etapa[]
): AtivacaoMetrics {
  return useMemo(() => {
    const etapasMap = new Map(etapas.map(e => [e.id, e]));
    
    // Em processo = todos exceto 'ativo'
    const emProcesso = items.filter(i => i.etapa !== 'ativo').length;
    
    // Aguardando cliente = documentos + pagamento
    const aguardandoCliente = items.filter(
      i => i.etapa === 'documentos' || i.etapa === 'pagamento'
    ).length;
    
    // SLA estourado = items onde dias > sla da etapa
    const slaEstourado = items.filter(item => {
      const etapa = etapasMap.get(item.etapa);
      if (!etapa?.sla) return false;
      const dias = differenceInDays(new Date(), new Date(item.entrou_etapa_em));
      return dias > etapa.sla;
    }).length;
    
    // Ativados hoje = items que entraram em 'ativo' hoje
    const ativadosHoje = items.filter(
      i => i.etapa === 'ativo' && isToday(new Date(i.entrou_etapa_em))
    ).length;
    
    // Tempo médio = média de dias desde criação até ativo
    const ativos = items.filter(i => i.etapa === 'ativo');
    const tempoMedio = ativos.length > 0
      ? ativos.reduce((acc, item) => {
          const dias = differenceInDays(
            new Date(item.entrou_etapa_em),
            new Date(item.created_at)
          );
          return acc + dias;
        }, 0) / ativos.length
      : 0;
    
    return {
      emProcesso,
      aguardandoCliente,
      slaEstourado,
      ativadosHoje,
      tempoMedio: Math.round(tempoMedio * 10) / 10, // 1 casa decimal
    };
  }, [items, etapas]);
}
