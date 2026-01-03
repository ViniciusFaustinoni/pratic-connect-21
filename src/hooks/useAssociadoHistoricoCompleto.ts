import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TipoEvento, EventoHistorico } from '@/components/cadastro/TimelineHistorico';

// Tipos do histórico persistido
interface HistoricoPersistido {
  id: string;
  associado_id: string;
  tipo: string;
  descricao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  documento_id: string | null;
  veiculo_id: string | null;
  instalacao_id: string | null;
  contrato_id: string | null;
  usuario_id: string | null;
  created_at: string;
  usuario?: { nome: string } | null;
}

// Mapeamento de tipos do banco para tipos do componente
const tipoDbParaTimeline: Record<string, TipoEvento> = {
  'associado_criado': 'associado_criado',
  'status_alterado': 'status_alterado',
  'dados_atualizados': 'dados_atualizados',
  'documento_enviado': 'documento_enviado',
  'documento_aprovado': 'documento_aprovado',
  'documento_reprovado': 'documento_reprovado',
  'veiculo_adicionado': 'veiculo_adicionado',
  'veiculo_removido': 'veiculo_removido',
  'instalacao_agendada': 'instalacao_agendada',
  'instalacao_concluida': 'instalacao_concluida',
  'instalacao_cancelada': 'instalacao_cancelada',
  'boleto_gerado': 'boleto_gerado',
  'boleto_pago': 'boleto_pago',
  'boleto_cancelado': 'boleto_cancelado',
  'chamado_aberto': 'chamado_aberto',
  'chamado_concluido': 'chamado_concluido',
  'sinistro_aberto': 'sinistro_aberto',
  'sinistro_atualizado': 'sinistro_atualizado',
  'sinistro_encerrado': 'sinistro_encerrado',
  'contrato_assinado': 'contrato_assinado',
  'observacao_adicionada': 'observacao_adicionada',
};

export function useAssociadoHistoricoCompleto(associadoId: string | undefined) {
  const queryClient = useQueryClient();

  // Query principal: buscar histórico persistido + eventos calculados
  const query = useQuery({
    queryKey: ['associado-historico-completo', associadoId],
    queryFn: async (): Promise<EventoHistorico[]> => {
      if (!associadoId) return [];

      const items: EventoHistorico[] = [];

      // 1. Buscar histórico persistido da tabela associados_historico
      const { data: historicoPersistido } = await supabase
        .from('associados_historico')
        .select(`
          *,
          usuario:profiles(nome)
        `)
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (historicoPersistido) {
        (historicoPersistido as HistoricoPersistido[]).forEach((item) => {
          const tipoTimeline = tipoDbParaTimeline[item.tipo] || 'observacao_adicionada';
          items.push({
            id: `hist-${item.id}`,
            tipo: tipoTimeline,
            descricao: item.descricao,
            data: item.created_at,
            usuario: item.usuario ? { id: item.usuario_id || '', nome: item.usuario.nome } : undefined,
            dados_anteriores: item.dados_anteriores as Record<string, string> | undefined,
            dados_novos: item.dados_novos as Record<string, string> | undefined,
          });
        });
      }

      // 2. Buscar documentos (eventos calculados)
      const { data: documentos } = await supabase
        .from('documentos')
        .select('id, tipo, status, created_at, data_analise, nome_arquivo')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (documentos) {
        documentos.forEach((doc) => {
          // Documento enviado
          items.push({
            id: `doc-upload-${doc.id}`,
            tipo: 'documento_enviado',
            descricao: `Documento ${doc.tipo.toUpperCase()} enviado: ${doc.nome_arquivo}`,
            data: doc.created_at,
          });

          // Documento analisado
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

      // 3. Buscar veículos
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

      // 4. Buscar instalações
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

      // 5. Buscar sinistros
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

      // 6. Buscar chamados de assistência
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

      // Ordenar por data decrescente e remover duplicatas
      const uniqueItems = items.reduce((acc, item) => {
        if (!acc.some(i => i.id === item.id)) {
          acc.push(item);
        }
        return acc;
      }, [] as EventoHistorico[]);

      uniqueItems.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      return uniqueItems;
    },
    enabled: !!associadoId,
  });

  // Mutation para adicionar observação
  const adicionarObservacao = useMutation({
    mutationFn: async (descricao: string) => {
      if (!associadoId) throw new Error('ID do associado não informado');
      
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.user?.id || '')
        .single();

      const { error } = await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          tipo: 'observacao_adicionada',
          descricao,
          usuario_id: profile?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associado-historico-completo', associadoId] });
    },
  });

  return {
    ...query,
    adicionarObservacao,
  };
}
