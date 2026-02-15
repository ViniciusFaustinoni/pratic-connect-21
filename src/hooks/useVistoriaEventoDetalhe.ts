import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useVistoriaEventoDetalhe(vistoriaId: string | undefined) {
  return useQuery({
    queryKey: ['vistoria-evento-detalhe', vistoriaId],
    queryFn: async () => {
      if (!vistoriaId) throw new Error('ID não informado');

      // 1. Buscar vistoria com sinistro, associado, veiculo
      const { data: vistoria, error } = await supabase
        .from('vistorias_evento' as any)
        .select(`
          *,
          sinistro:sinistros!vistorias_evento_sinistro_id_fkey(
            id, protocolo, tipo, status, data_ocorrencia, created_at, descricao,
            local_descricao, local_ocorrencia, cidade_ocorrencia, estado_ocorrencia,
            condutor_nome, condutor_cnh, condutor_relacao,
            associado:associados!sinistros_associado_id_fkey(
              id, nome, cpf, telefone, email, plano_id, whatsapp
            ),
            veiculo:veiculos!sinistros_veiculo_id_fkey(
              id, placa, marca, modelo, ano_modelo, cor, chassi, valor_fipe
            )
          )
        `)
        .eq('id', vistoriaId)
        .single();

      if (error) throw error;
      if (!vistoria) throw new Error('Vistoria não encontrada');

      const sinistro = (vistoria as any).sinistro;
      const associado = sinistro?.associado;

      // 2. Buscar plano do associado
      let plano = null;
      if (associado?.plano_id) {
        const { data: planoData } = await supabase
          .from('planos')
          .select('id, nome, categoria')
          .eq('id', associado.plano_id)
          .single();
        plano = planoData;
      }

      // 3. Buscar link do evento (dados das etapas)
      let linkEvento = null;
      if (sinistro?.id) {
        const { data: links } = await supabase
          .from('sinistro_evento_links' as any)
          .select('*')
          .eq('sinistro_id', sinistro.id)
          .order('created_at', { ascending: false })
          .limit(1);
        linkEvento = links?.[0] || null;
      }

      // 4. Buscar última cobrança para status de adimplência
      let adimplente = null;
      if (associado?.id) {
        const { data: cobrancas } = await supabase
          .from('asaas_cobrancas')
          .select('status, data_vencimento')
          .eq('associado_id', associado.id)
          .eq('status', 'OVERDUE')
          .limit(1);
        adimplente = !cobrancas?.length;
      }

      return {
        vistoria: vistoria as any,
        sinistro,
        associado: associado ? { ...associado, plano, adimplente } : null,
        veiculo: sinistro?.veiculo || null,
        linkEvento: linkEvento as any,
      };
    },
    enabled: !!vistoriaId,
  });
}
