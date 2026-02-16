import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useEventosAguardandoAnalise() {
  return useQuery({
    queryKey: ['eventos-aguardando-analise'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id,
          tipo,
          data_ocorrencia,
          created_at,
          status,
          associado:associados!sinistros_associado_id_fkey(id, nome, cpf, telefone, email, plano_id, created_at),
          veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo, ano_modelo, cor, valor_fipe, chassi)
        `)
        .eq('status', 'aguardando_analise')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch regulador name from vistorias_evento
      const enriched = await Promise.all((data || []).map(async (s: any) => {
        const { data: vistoria } = await supabase
          .from('vistorias_evento' as any)
          .select('regulador_nome')
          .eq('sinistro_id', s.id)
          .eq('status', 'concluida')
          .order('concluida_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        return { ...s, regulador_nome: (vistoria as any)?.regulador_nome || 'N/A' };
      }));

      return enriched;
    },
  });
}

export function useEventosContadores() {
  return useQuery({
    queryKey: ['eventos-contadores'],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();
      
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const inicioMesISO = inicioMes.toISOString();

      const [aguardando, aprovadosHoje, reprovadosHoje, aprovadosMes, reprovadosMes, pendentesVistoria] = await Promise.all([
        supabase.from('sinistros').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_analise'),
        supabase.from('sinistros').select('id', { count: 'exact', head: true }).eq('status', 'aprovado').gte('updated_at', hojeISO),
        supabase.from('sinistros').select('id', { count: 'exact', head: true }).eq('status', 'reprovado').gte('updated_at', hojeISO),
        supabase.from('sinistros').select('id', { count: 'exact', head: true }).eq('status', 'aprovado').gte('updated_at', inicioMesISO),
        supabase.from('sinistros').select('id', { count: 'exact', head: true }).eq('status', 'reprovado').gte('updated_at', inicioMesISO),
        supabase.from('sinistros').select('id', { count: 'exact', head: true }).in('status', ['comunicado', 'em_analise', 'documentacao_pendente', 'aguardando_vistoria'] as any),
      ]);

      return {
        aguardando: aguardando.count || 0,
        analisadosHoje: (aprovadosHoje.count || 0) + (reprovadosHoje.count || 0),
        aprovadosMes: aprovadosMes.count || 0,
        reprovadosMes: reprovadosMes.count || 0,
        pendentesVistoria: pendentesVistoria.count || 0,
      };
    },
  });
}
