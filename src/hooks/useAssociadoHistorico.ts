import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TipoEvento, EventoHistorico } from '@/components/cadastro/TimelineHistorico';

// Legacy interface for backward compatibility
export interface HistoricoItem {
  id: string;
  tipo: 'documento' | 'veiculo' | 'instalacao' | 'sinistro' | 'assistencia' | 'cadastro' | 'status';
  titulo: string;
  descricao?: string;
  data: string;
  icone: 'file' | 'car' | 'wrench' | 'alert' | 'phone' | 'user' | 'check' | 'x';
  cor: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
}

export function useAssociadoHistorico(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['associado-historico', associadoId],
    queryFn: async (): Promise<EventoHistorico[]> => {
      if (!associadoId) return [];

      const items: EventoHistorico[] = [];

      // Fetch documents
      const { data: documentos } = await supabase
        .from('documentos')
        .select('id, tipo, status, created_at, data_analise, nome_arquivo')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (documentos) {
        documentos.forEach((doc) => {
          // Document uploaded
          items.push({
            id: `doc-upload-${doc.id}`,
            tipo: 'documento_enviado',
            descricao: `Documento ${doc.tipo.toUpperCase()} enviado: ${doc.nome_arquivo}`,
            data: doc.created_at,
          });

          // Document analyzed
          if (doc.data_analise) {
            const tipoEvento: TipoEvento = doc.status === 'aprovado' ? 'documento_aprovado' : 'documento_reprovado';
            items.push({
              id: `doc-analise-${doc.id}`,
              tipo: tipoEvento,
              descricao: `Documento ${doc.tipo.toUpperCase()} ${doc.status === 'aprovado' ? 'aprovado' : 'reprovado'}`,
              data: doc.data_analise,
            });
          }
        });
      }

      // Fetch vehicles
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, created_at')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (veiculos) {
        veiculos.forEach((v) => {
          items.push({
            id: `veiculo-${v.id}`,
            tipo: 'veiculo_adicionado',
            descricao: `Veículo cadastrado: ${v.placa} - ${v.modelo}`,
            data: v.created_at,
          });
        });
      }

      // Fetch installations
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('id, status, created_at, data_agendada')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (instalacoes) {
        instalacoes.forEach((inst) => {
          const tipoEvento: TipoEvento = inst.status === 'concluida' ? 'instalacao_concluida' : 
            inst.status === 'cancelada' ? 'instalacao_cancelada' : 'instalacao_agendada';
          items.push({
            id: `instalacao-${inst.id}`,
            tipo: tipoEvento,
            descricao: `Instalação ${inst.status === 'concluida' ? 'concluída' : inst.status === 'cancelada' ? 'cancelada' : 'agendada'} para ${new Date(inst.data_agendada).toLocaleDateString('pt-BR')}`,
            data: inst.created_at,
          });
        });
      }

      // Fetch claims (sinistros)
      const { data: sinistros } = await supabase
        .from('sinistros')
        .select('id, tipo, status, protocolo, created_at')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (sinistros) {
        sinistros.forEach((sin) => {
          items.push({
            id: `sinistro-${sin.id}`,
            tipo: 'sinistro_aberto',
            descricao: `Sinistro aberto - ${sin.tipo}. Protocolo: ${sin.protocolo}`,
            data: sin.created_at,
          });
        });
      }

      // Fetch assistance calls
      const { data: chamados } = await supabase
        .from('chamados_assistencia')
        .select('id, tipo_servico, status, protocolo, created_at')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (chamados) {
        chamados.forEach((ch) => {
          const tipoEvento: TipoEvento = ch.status === 'concluido' ? 'chamado_concluido' : 'chamado_aberto';
          items.push({
            id: `chamado-${ch.id}`,
            tipo: tipoEvento,
            descricao: `Chamado de assistência - ${ch.tipo_servico}. Protocolo: ${ch.protocolo}`,
            data: ch.created_at,
          });
        });
      }

      // Sort by date descending
      items.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      return items;
    },
    enabled: !!associadoId,
  });
}
