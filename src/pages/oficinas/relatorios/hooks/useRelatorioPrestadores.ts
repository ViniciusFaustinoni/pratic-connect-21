import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PrestadorMetrica {
  prestador_id: string;
  nome: string;
  total_chamados: number;
  tipos_servico: Map<string, number>;
  tipo_principal: string;
  tempo_medio_horas: number | null;
  marcas_atendidas: string[];
}

export function useRelatorioPrestadores() {
  return useQuery({
    queryKey: ['relatorio_prestadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(`
          id, prestador_id, tipo_servico, status, data_abertura, data_conclusao,
          prestador_nome,
          veiculo:veiculos(marca)
        `);

      if (error) throw error;

      const mapa = new Map<string, PrestadorMetrica>();

      for (const ch of data || []) {
        const key = ch.prestador_id || ch.prestador_nome || 'desconhecido';
        if (!mapa.has(key)) {
          mapa.set(key, {
            prestador_id: key,
            nome: ch.prestador_nome || 'Sem nome',
            total_chamados: 0,
            tipos_servico: new Map(),
            tipo_principal: '',
            tempo_medio_horas: null,
            marcas_atendidas: [],
          });
        }
        const m = mapa.get(key)!;
        m.total_chamados++;

        const tipo = ch.tipo_servico || 'Outros';
        m.tipos_servico.set(tipo, (m.tipos_servico.get(tipo) || 0) + 1);

        const marca = (ch.veiculo as any)?.marca;
        if (marca && !m.marcas_atendidas.includes(marca)) {
          m.marcas_atendidas.push(marca);
        }
      }

      // Calculate tempo medio and tipo principal
      const tempos = new Map<string, number[]>();
      for (const ch of data || []) {
        const key = ch.prestador_id || ch.prestador_nome || 'desconhecido';
        if (ch.data_abertura && ch.data_conclusao) {
          if (!tempos.has(key)) tempos.set(key, []);
          const diff = (new Date(ch.data_conclusao).getTime() - new Date(ch.data_abertura).getTime()) / (1000 * 60 * 60);
          if (diff > 0) tempos.get(key)!.push(diff);
        }
      }

      for (const [id, m] of mapa) {
        // tipo principal
        let maxCount = 0;
        for (const [tipo, count] of m.tipos_servico) {
          if (count > maxCount) { maxCount = count; m.tipo_principal = tipo; }
        }
        // tempo medio
        const t = tempos.get(id);
        if (t && t.length > 0) {
          m.tempo_medio_horas = Math.round(t.reduce((a, b) => a + b, 0) / t.length * 10) / 10;
        }
      }

      // Tipo de serviço agregado para gráfico
      const tipoGlobal = new Map<string, number>();
      for (const ch of data || []) {
        const tipo = ch.tipo_servico || 'Outros';
        tipoGlobal.set(tipo, (tipoGlobal.get(tipo) || 0) + 1);
      }
      const chamadosPorTipo = Array.from(tipoGlobal.entries())
        .map(([tipo, total]) => ({ tipo, total }))
        .sort((a, b) => b.total - a.total);

      return {
        prestadores: Array.from(mapa.values()).sort((a, b) => b.total_chamados - a.total_chamados),
        chamadosPorTipo,
      };
    },
  });
}
