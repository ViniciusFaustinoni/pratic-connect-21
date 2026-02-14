import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STATUS_ATIVOS = [
  'aguardando_entrada', 'aguardando_orcamento', 'aguardando_aprovacao',
  'em_execucao', 'aguardando_peca', 'pendente_assinatura',
];
const STATUS_FINALIZADOS = ['finalizado', 'concluido', 'entregue'];

export interface OficinaMetrica {
  oficina_id: string;
  nome: string;
  especialidades: string[];
  marcas_atendidas: string[];
  total_em_reparo: number;
  total_finalizadas: number;
  valor_total_orcamentos: number;
  tempo_medio_dias: number | null;
  marcas_os: Map<string, number>;
}

export function useRelatorioOficinas() {
  return useQuery({
    queryKey: ['relatorio_oficinas'],
    queryFn: async () => {
      const [ativosRes, finalizadasRes] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select('oficina_id, status, valor_orcamento, oficina:oficinas(id, nome_fantasia, razao_social, especialidades, marcas_atendidas), veiculo:veiculos(marca)')
          .in('status', STATUS_ATIVOS as any),
        supabase
          .from('ordens_servico')
          .select('oficina_id, tempo_total_dias, oficina:oficinas(id, nome_fantasia, razao_social, especialidades, marcas_atendidas)')
          .in('status', STATUS_FINALIZADOS as any)
          .not('tempo_total_dias', 'is', null),
      ]);

      if (ativosRes.error) throw ativosRes.error;
      if (finalizadasRes.error) throw finalizadasRes.error;

      const mapa = new Map<string, OficinaMetrica>();

      const getOrCreate = (oficina_id: string, oficina: any): OficinaMetrica => {
        if (!mapa.has(oficina_id)) {
          mapa.set(oficina_id, {
            oficina_id,
            nome: oficina?.nome_fantasia || oficina?.razao_social || 'Sem nome',
            especialidades: oficina?.especialidades || [],
            marcas_atendidas: oficina?.marcas_atendidas || [],
            total_em_reparo: 0,
            total_finalizadas: 0,
            valor_total_orcamentos: 0,
            tempo_medio_dias: null,
            marcas_os: new Map(),
          });
        }
        return mapa.get(oficina_id)!;
      };

      for (const os of ativosRes.data || []) {
        if (!os.oficina_id) continue;
        const m = getOrCreate(os.oficina_id, os.oficina);
        m.total_em_reparo++;
        m.valor_total_orcamentos += Number(os.valor_orcamento) || 0;
        const marca = (os.veiculo as any)?.marca || 'Desconhecida';
        m.marcas_os.set(marca, (m.marcas_os.get(marca) || 0) + 1);
      }

      const tempos = new Map<string, number[]>();
      for (const os of finalizadasRes.data || []) {
        if (!os.oficina_id) continue;
        getOrCreate(os.oficina_id, os.oficina);
        if (!tempos.has(os.oficina_id)) tempos.set(os.oficina_id, []);
        tempos.get(os.oficina_id)!.push(Number(os.tempo_total_dias));
      }

      // Count finalizadas
      for (const os of finalizadasRes.data || []) {
        if (!os.oficina_id) continue;
        mapa.get(os.oficina_id)!.total_finalizadas++;
      }

      for (const [id, t] of tempos) {
        const avg = t.reduce((a, b) => a + b, 0) / t.length;
        mapa.get(id)!.tempo_medio_dias = Math.round(avg * 10) / 10;
      }

      return Array.from(mapa.values()).sort((a, b) => b.total_em_reparo - a.total_em_reparo);
    },
  });
}
