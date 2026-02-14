import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutoCenterMetrica {
  auto_center_id: string;
  nome: string;
  marcas_atendidas: string[];
  total_cotacoes: number;
  total_aprovadas: number;
  total_pendentes: number;
  valor_total_aprovado: number;
  marcas_cotacoes: string[];
}

export function useRelatorioAutoCenters() {
  return useQuery({
    queryKey: ['relatorio_auto_centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evento_cotacoes_pecas')
        .select(`
          id, auto_center_id, status, valor_total, aprovada,
          auto_center:auto_centers(nome, marcas_atendidas),
          sinistro:sinistros!sinistro_id(veiculo:veiculos(marca))
        `);

      if (error) throw error;

      const mapa = new Map<string, AutoCenterMetrica>();

      for (const cot of data || []) {
        if (!cot.auto_center_id) continue;
        const ac = cot.auto_center as any;
        if (!mapa.has(cot.auto_center_id)) {
          mapa.set(cot.auto_center_id, {
            auto_center_id: cot.auto_center_id,
            nome: ac?.nome || 'Sem nome',
            marcas_atendidas: ac?.marcas_atendidas || [],
            total_cotacoes: 0,
            total_aprovadas: 0,
            total_pendentes: 0,
            valor_total_aprovado: 0,
            marcas_cotacoes: [],
          });
        }
        const m = mapa.get(cot.auto_center_id)!;
        m.total_cotacoes++;
        if (cot.aprovada) {
          m.total_aprovadas++;
          m.valor_total_aprovado += Number(cot.valor_total) || 0;
        } else if (cot.status === 'enviada' || cot.status === 'pendente' || cot.status === 'respondida') {
          m.total_pendentes++;
        }
        const marca = (cot.sinistro as any)?.veiculo?.marca;
        if (marca && !m.marcas_cotacoes.includes(marca)) {
          m.marcas_cotacoes.push(marca);
        }
      }

      return Array.from(mapa.values()).sort((a, b) => b.total_cotacoes - a.total_cotacoes);
    },
  });
}
