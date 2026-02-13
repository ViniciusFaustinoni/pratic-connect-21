import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustosCategoria {
  tipo: 'peca' | 'mao_de_obra' | 'servico_terceiro';
  quantidade: number;
  valor: number;
  itens: number;
}

export interface CustosPorTipoSinistro {
  tipoSinistro: string;
  peca: number;
  mao_de_obra: number;
  servico_terceiro: number;
  total: number;
}

export interface CustosMensal {
  mes: number;
  ano: number;
  mesLabel: string;
  peca: number;
  mao_de_obra: number;
  servico_terceiro: number;
  total: number;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TIPO_SINISTRO_LABELS: Record<string, string> = {
  colisao: 'Colisão',
  roubo_furto: 'Roubo/Furto',
  incendio: 'Incêndio',
  fenomenos_naturais: 'Fenôm. Naturais',
  terceiros: 'Terceiros',
  vidros: 'Vidros',
  pane_mecanica: 'Pane Mecânica',
  pane_eletrica: 'Pane Elétrica',
};

export function useCustosReparos(ano: number) {
  return useQuery({
    queryKey: ['custos-reparos', ano],
    queryFn: async () => {
      const inicioAno = `${ano}-01-01`;
      const fimAno = `${ano}-12-31T23:59:59`;

      // Buscar itens de OS vinculadas a sinistros
      const { data: itens, error } = await supabase
        .from('ordens_servico_itens')
        .select(`
          id,
          tipo,
          valor_unitario,
          quantidade,
          valor_total,
          ordem_servico:ordens_servico!inner(
            id,
            numero,
            status,
            created_at,
            sinistro_id,
            oficina_id,
            sinistro:sinistros(id, tipo, tipo_dano)
          )
        `)
        .gte('ordem_servico.created_at', inicioAno)
        .lte('ordem_servico.created_at', fimAno);

      if (error) throw error;

      // Filtrar apenas OS concluídas/pagas com sinistro
      const itensValidos = (itens || []).filter(item => {
        const os = item.ordem_servico as any;
        return os && 
               ['concluido', 'pago', 'aprovado', 'finalizado'].includes(os.status) && 
               os.sinistro_id;
      });

      // Agrupar por categoria
      const porCategoria: Record<string, CustosCategoria> = {
        peca: { tipo: 'peca', quantidade: 0, valor: 0, itens: 0 },
        mao_de_obra: { tipo: 'mao_de_obra', quantidade: 0, valor: 0, itens: 0 },
        servico_terceiro: { tipo: 'servico_terceiro', quantidade: 0, valor: 0, itens: 0 },
      };

      // Agrupar por tipo de sinistro
      const porTipoSinistro: Record<string, CustosPorTipoSinistro> = {};

      // Agrupar por mês
      const porMes: Record<string, CustosMensal> = {};

      itensValidos.forEach(item => {
        const tipo = item.tipo as 'peca' | 'mao_de_obra' | 'servico_terceiro';
        const valorTotal = item.valor_total || 0;
        const quantidade = item.quantidade || 0;
        const os = item.ordem_servico as any;
        const sinistro = os?.sinistro;
        const tipoSinistro = sinistro?.tipo || 'outros';
        const createdAt = new Date(os.created_at);
        const mes = createdAt.getMonth() + 1;
        const mesKey = `${ano}-${mes}`;

        // Por categoria
        if (porCategoria[tipo]) {
          porCategoria[tipo].valor += valorTotal;
          porCategoria[tipo].quantidade += quantidade;
          porCategoria[tipo].itens += 1;
        }

        // Por tipo de sinistro
        if (!porTipoSinistro[tipoSinistro]) {
          porTipoSinistro[tipoSinistro] = {
            tipoSinistro,
            peca: 0,
            mao_de_obra: 0,
            servico_terceiro: 0,
            total: 0,
          };
        }
        porTipoSinistro[tipoSinistro][tipo] += valorTotal;
        porTipoSinistro[tipoSinistro].total += valorTotal;

        // Por mês
        if (!porMes[mesKey]) {
          porMes[mesKey] = {
            mes,
            ano,
            mesLabel: MESES[mes - 1],
            peca: 0,
            mao_de_obra: 0,
            servico_terceiro: 0,
            total: 0,
          };
        }
        porMes[mesKey][tipo] += valorTotal;
        porMes[mesKey].total += valorTotal;
      });

      // Calcular totais
      const totalGeral = Object.values(porCategoria).reduce((s, c) => s + c.valor, 0);
      const totalItens = Object.values(porCategoria).reduce((s, c) => s + c.itens, 0);

      // Preparar arrays ordenados
      const categorias = Object.values(porCategoria);
      const tiposSinistro = Object.values(porTipoSinistro)
        .sort((a, b) => b.total - a.total)
        .map(ts => ({
          ...ts,
          tipoSinistroLabel: TIPO_SINISTRO_LABELS[ts.tipoSinistro] || ts.tipoSinistro,
        }));
      const meses = Object.values(porMes).sort((a, b) => a.mes - b.mes);

      return {
        categorias,
        tiposSinistro,
        meses,
        totalGeral,
        totalItens,
        ticketMedio: totalItens > 0 ? totalGeral / totalItens : 0,
      };
    },
  });
}
