import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
    queryFn: async (): Promise<HistoricoItem[]> => {
      if (!associadoId) return [];

      const items: HistoricoItem[] = [];

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
            tipo: 'documento',
            titulo: `Documento ${doc.tipo.toUpperCase()} enviado`,
            descricao: doc.nome_arquivo,
            data: doc.created_at,
            icone: 'file',
            cor: 'blue',
          });

          // Document analyzed
          if (doc.data_analise) {
            items.push({
              id: `doc-analise-${doc.id}`,
              tipo: 'documento',
              titulo: `Documento ${doc.tipo.toUpperCase()} ${doc.status === 'aprovado' ? 'aprovado' : 'reprovado'}`,
              data: doc.data_analise,
              icone: doc.status === 'aprovado' ? 'check' : 'x',
              cor: doc.status === 'aprovado' ? 'green' : 'red',
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
            tipo: 'veiculo',
            titulo: `Veículo cadastrado`,
            descricao: `${v.placa} - ${v.modelo}`,
            data: v.created_at,
            icone: 'car',
            cor: 'purple',
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
          items.push({
            id: `instalacao-${inst.id}`,
            tipo: 'instalacao',
            titulo: `Instalação ${inst.status === 'concluida' ? 'concluída' : 'agendada'}`,
            descricao: `Para ${new Date(inst.data_agendada).toLocaleDateString('pt-BR')}`,
            data: inst.created_at,
            icone: 'wrench',
            cor: inst.status === 'concluida' ? 'green' : 'yellow',
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
            tipo: 'sinistro',
            titulo: `Sinistro aberto - ${sin.tipo}`,
            descricao: `Protocolo: ${sin.protocolo}`,
            data: sin.created_at,
            icone: 'alert',
            cor: 'red',
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
          items.push({
            id: `chamado-${ch.id}`,
            tipo: 'assistencia',
            titulo: `Chamado de assistência - ${ch.tipo_servico}`,
            descricao: `Protocolo: ${ch.protocolo} - ${ch.status}`,
            data: ch.created_at,
            icone: 'phone',
            cor: ch.status === 'concluido' ? 'green' : 'yellow',
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
