import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STATUS_ATIVOS_OS = [
  'aguardando_entrada', 'aguardando_orcamento', 'aguardando_aprovacao',
  'em_execucao', 'aguardando_peca', 'pendente_assinatura',
];

export function useRelatorioGeral() {
  return useQuery({
    queryKey: ['relatorio_geral'],
    queryFn: async () => {
      const [osRes, cotRes, chamRes] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select('id, status, valor_orcamento, veiculo:veiculos(marca)')
          .in('status', STATUS_ATIVOS_OS as any),
        supabase
          .from('evento_cotacoes_pecas')
          .select('id, status')
          .in('status', ['enviada', 'pendente', 'respondida'] as any),
        supabase
          .from('chamados_assistencia')
          .select('id, status')
          .in('status', ['aberto', 'em_andamento'] as any),
      ]);

      if (osRes.error) throw osRes.error;
      if (cotRes.error) throw cotRes.error;
      if (chamRes.error) throw chamRes.error;

      const totalVeiculosReparo = osRes.data?.length || 0;
      const valorTotalOrcamentos = osRes.data?.reduce((s, os) => s + (Number(os.valor_orcamento) || 0), 0) || 0;
      const totalCotacoes = cotRes.data?.length || 0;
      const totalChamados = chamRes.data?.length || 0;

      // OS por marca
      const marcaCount = new Map<string, number>();
      for (const os of osRes.data || []) {
        const marca = (os.veiculo as any)?.marca || 'Desconhecida';
        marcaCount.set(marca, (marcaCount.get(marca) || 0) + 1);
      }
      const osPorMarca = Array.from(marcaCount.entries())
        .map(([marca, total]) => ({ marca, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

      return { totalVeiculosReparo, valorTotalOrcamentos, totalCotacoes, totalChamados, osPorMarca };
    },
  });
}
