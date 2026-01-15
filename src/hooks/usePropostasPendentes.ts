import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Contrato = Database['public']['Tables']['contratos']['Row'];
type Associado = Database['public']['Tables']['associados']['Row'];
type Plano = Database['public']['Tables']['planos']['Row'];

export interface DocumentoAnexado {
  id: string;
  tipo: string;
  arquivo_nome: string | null;
  arquivo_url: string;
  status: string;
  created_at: string;
}

export interface VistoriaFotoInfo {
  id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

export interface VistoriaInfo {
  id: string;
  status: string;
  tipo: string;
  fotos: VistoriaFotoInfo[];
}

export interface PropostaPendente {
  id: string;
  numero: string | null;
  data_assinatura: string | null;
  valor_mensal: number | null;
  status: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  veiculo_placa: string | null;
  veiculo_modelo: string | null;
  veiculo_marca: string | null;
  veiculo_ano: number | null;
  veiculo_cor: string | null;
  dia_vencimento: number | null;
  associado_id: string | null;
  cotacao_id: string | null;
  associado: Associado | null;
  plano: { nome: string; valor_mensal: number } | null;
  vendedor: { nome: string | null } | null;
  documentos: DocumentoAnexado[];
  tem_documento_pendente: boolean;
  associado_status: string | null;
  vistoria: VistoriaInfo | null;
}

export interface PropostaStats {
  aguardando: number;
  emAnalise: number;
  aprovadosHoje: number;
  reprovadosHoje: number;
}

// ============================================
// QUERY: Buscar propostas pendentes
// ============================================
export function usePropostasPendentes() {
  return useQuery({
    queryKey: ['propostas-pendentes'],
    queryFn: async (): Promise<PropostaPendente[]> => {
      // Buscar contratos assinados
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero,
          data_assinatura,
          valor_mensal,
          status,
          cliente_nome,
          cliente_cpf,
          cliente_telefone,
          cliente_email,
          veiculo_placa,
          veiculo_modelo,
          veiculo_marca,
          veiculo_ano,
          veiculo_cor,
          dia_vencimento,
          associado_id,
          cotacao_id,
          plano_id,
          vendedor_id
        `)
        .eq('status', 'assinado')
        .order('data_assinatura', { ascending: true });

      if (error) throw error;

      // Para cada contrato, buscar dados relacionados
      const propostasComRelacoes = await Promise.all(
        (contratos || []).map(async (contrato) => {
          // Buscar associado
          let associado = null;
          if (contrato.associado_id) {
            const { data } = await supabase
              .from('associados')
              .select('*')
              .eq('id', contrato.associado_id)
              .single();
            associado = data;
          }

          // Buscar plano
          let plano = null;
          if (contrato.plano_id) {
            const { data } = await supabase
              .from('planos')
              .select('nome, valor_mensal')
              .eq('id', contrato.plano_id)
              .single();
            plano = data;
          }

          // Buscar vendedor
          let vendedor = null;
          if (contrato.vendedor_id) {
            const { data } = await supabase
              .from('profiles')
              .select('nome')
              .eq('id', contrato.vendedor_id)
              .single();
          vendedor = data;
          }

          // Buscar documentos anexados via cotacao_id
          let documentos: DocumentoAnexado[] = [];
          if (contrato.cotacao_id) {
            const { data: docs } = await supabase
              .from('contratos_documentos')
              .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
              .eq('cotacao_id', contrato.cotacao_id)
              .order('created_at', { ascending: false });
            documentos = (docs || []) as DocumentoAnexado[];
          }

          // Verificar se há documentos pendentes
          let temDocumentoPendente = false;
          if (contrato.associado_id) {
            const { count } = await supabase
              .from('documentos_solicitados')
              .select('*', { count: 'exact', head: true })
              .eq('associado_id', contrato.associado_id)
              .eq('status', 'pendente');
            temDocumentoPendente = (count || 0) > 0;
          }

          // Buscar vistoria vinculada ao contrato
          let vistoria: VistoriaInfo | null = null;
          const { data: vistoriaData } = await supabase
            .from('vistorias')
            .select(`
              id,
              status,
              tipo,
              fotos:vistoria_fotos(id, tipo, arquivo_url, created_at)
            `)
            .eq('contrato_id', contrato.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (vistoriaData) {
            vistoria = {
              id: vistoriaData.id,
              status: vistoriaData.status || 'pendente',
              tipo: vistoriaData.tipo || 'auto_vistoria',
              fotos: (vistoriaData.fotos || []) as VistoriaFotoInfo[],
            };
          }

          return {
            ...contrato,
            associado,
            plano,
            vendedor,
            documentos,
            tem_documento_pendente: temDocumentoPendente,
            associado_status: associado?.status || null,
            vistoria,
          } as PropostaPendente;
        })
      );

      return propostasComRelacoes;
    },
    staleTime: 30000, // 30 segundos
  });
}

// ============================================
// QUERY: Buscar proposta específica
// ============================================
export function useProposta(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['proposta', contratoId],
    queryFn: async (): Promise<PropostaPendente | null> => {
      if (!contratoId) return null;

      const { data: contrato, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero,
          data_assinatura,
          valor_mensal,
          status,
          cliente_nome,
          cliente_cpf,
          cliente_telefone,
          cliente_email,
          veiculo_placa,
          veiculo_modelo,
          veiculo_marca,
          veiculo_ano,
          veiculo_cor,
          dia_vencimento,
          associado_id,
          cotacao_id,
          plano_id,
          vendedor_id
        `)
        .eq('id', contratoId)
        .single();

      if (error) throw error;
      if (!contrato) return null;

      // Buscar dados relacionados
      let associado = null;
      if (contrato.associado_id) {
        const { data } = await supabase
          .from('associados')
          .select('*')
          .eq('id', contrato.associado_id)
          .single();
        associado = data;
      }

      let plano = null;
      if (contrato.plano_id) {
        const { data } = await supabase
          .from('planos')
          .select('nome, valor_mensal')
          .eq('id', contrato.plano_id)
          .single();
        plano = data;
      }

      let vendedor = null;
      if (contrato.vendedor_id) {
        const { data } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', contrato.vendedor_id)
          .single();
        vendedor = data;
      }

      // Buscar documentos anexados via cotacao_id
      let documentos: DocumentoAnexado[] = [];
      if (contrato.cotacao_id) {
        const { data: docs } = await supabase
          .from('contratos_documentos')
          .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
          .eq('cotacao_id', contrato.cotacao_id)
          .order('created_at', { ascending: false });
        documentos = (docs || []) as DocumentoAnexado[];
      }

      // Verificar se há documentos pendentes
      let temDocumentoPendente = false;
      if (contrato.associado_id) {
        const { count } = await supabase
          .from('documentos_solicitados')
          .select('*', { count: 'exact', head: true })
          .eq('associado_id', contrato.associado_id)
          .eq('status', 'pendente');
        temDocumentoPendente = (count || 0) > 0;
      }

      // Buscar vistoria vinculada ao contrato
      let vistoria: VistoriaInfo | null = null;
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select(`
          id,
          status,
          tipo,
          fotos:vistoria_fotos(id, tipo, arquivo_url, created_at)
        `)
        .eq('contrato_id', contratoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vistoriaData) {
        vistoria = {
          id: vistoriaData.id,
          status: vistoriaData.status || 'pendente',
          tipo: vistoriaData.tipo || 'auto_vistoria',
          fotos: (vistoriaData.fotos || []) as VistoriaFotoInfo[],
        };
      }

      return {
        ...contrato,
        associado,
        plano,
        vendedor,
        documentos,
        tem_documento_pendente: temDocumentoPendente,
        associado_status: associado?.status || null,
        vistoria,
      } as PropostaPendente;
    },
    enabled: !!contratoId,
  });
}

// ============================================
// QUERY: Estatísticas de propostas
// ============================================
export function usePropostaStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['propostas-stats'],
    queryFn: async (): Promise<PropostaStats> => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();

      // Buscar contratos assinados (aguardando)
      const { count: aguardando } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'assinado');

      // Buscar contratos em análise (pendente é usado para em análise)
      const { count: emAnalise } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      // Buscar contratos aprovados hoje
      const { count: aprovadosHoje } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .gte('data_ativacao', hojeISO);

      // Buscar contratos cancelados hoje (usado como reprovados)
      const { count: reprovadosHoje } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelado')
        .gte('updated_at', hojeISO);

      return {
        aguardando: aguardando || 0,
        emAnalise: emAnalise || 0,
        aprovadosHoje: aprovadosHoje || 0,
        reprovadosHoje: reprovadosHoje || 0,
      };
    },
    staleTime: 30000,
  });
}

// ============================================
// MUTATION: Aprovar proposta
// ============================================
export function useAprovarProposta() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (contratoId: string) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      const agora = new Date().toISOString();

      // 1. Buscar contrato com dados do associado e veículo
      const { data: contrato, error: fetchError } = await supabase
        .from('contratos')
        .select(`
          id,
          associado_id,
          plano_id,
          valor_mensal,
          dia_vencimento,
          associado:associados (
            id,
            nome,
            dia_vencimento,
            logradouro,
            numero,
            bairro,
            cidade,
            uf,
            cep
          )
        `)
        .eq('id', contratoId)
        .single();

      if (fetchError) throw fetchError;
      if (!contrato?.associado_id) throw new Error('Associado não encontrado');

      const associadoId = contrato.associado_id;
      const diaVencimento = contrato.dia_vencimento || (contrato.associado as any)?.dia_vencimento || 15;

      // 2. Atualizar CONTRATO para ativo
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({
          status: 'ativo',
          data_ativacao: agora,
          aprovado_por: profile.id,
          aprovado_em: agora,
        })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      // 3. Atualizar ASSOCIADO para ativo
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'ativo',
          data_adesao: agora.split('T')[0],
          data_ativacao: agora,
          aprovado_por: profile.id,
          aprovado_em: agora,
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

      // 4. Registrar histórico
      await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          contrato_id: contratoId,
          tipo: 'status_alterado',
          descricao: 'Proposta aprovada. Associado ativado.',
          usuario_id: profile.id,
        });

      // 5. Buscar veículo do associado para criar instalação
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo')
        .eq('associado_id', associadoId)
        .limit(1);

      // 6. Criar INSTALAÇÃO pendente (se tiver veículo)
      if (veiculos && veiculos.length > 0) {
        const associadoData = contrato.associado as any;
        await supabase
          .from('instalacoes')
          .insert({
            associado_id: associadoId,
            veiculo_id: veiculos[0].id,
            status: 'pendente',
            logradouro: associadoData?.logradouro || null,
            numero: associadoData?.numero || null,
            bairro: associadoData?.bairro || null,
            cidade: associadoData?.cidade || null,
            uf: associadoData?.uf || null,
            cep: associadoData?.cep || null,
          } as any);
      }

      // 7. Buscar plano para criar cobranças
      const { data: plano } = await supabase
        .from('planos')
        .select('valor_adesao')
        .eq('id', contrato.plano_id)
        .single();

      const hoje = new Date();
      
      // Cobrança de adesão (se houver valor)
      if (plano?.valor_adesao && plano.valor_adesao > 0) {
        const dataVencimentoAdesao = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 dias
        await supabase
          .from('cobrancas')
          .insert({
            associado_id: associadoId,
            tipo: 'adesao',
            descricao: 'Taxa de adesão',
            valor: plano.valor_adesao,
            data_vencimento: dataVencimentoAdesao.toISOString().split('T')[0],
            data_emissao: hoje.toISOString().split('T')[0],
            status: 'pendente',
          } as any);
      }

      // Primeira mensalidade (usar valor do contrato)
      if (contrato.valor_mensal && contrato.valor_mensal > 0) {
        let dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento);
        if (dataVencimento <= hoje) {
          dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVencimento);
        }

        const mesAno = dataVencimento.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        await supabase
          .from('cobrancas')
          .insert({
            associado_id: associadoId,
            tipo: 'mensalidade',
            referencia_mes: dataVencimento.getMonth() + 1,
            referencia_ano: dataVencimento.getFullYear(),
            descricao: `Mensalidade ${mesAno}`,
            valor: contrato.valor_mensal,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            data_emissao: hoje.toISOString().split('T')[0],
            status: 'pendente',
          } as any);
      }

      return { 
        contratoId, 
        associadoId,
        mensagem: 'Associado ativado! Instalação criada e cobrança gerada.'
      };
    },
    onSuccess: () => {
      toast.success('Proposta aprovada! Associado ativado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['proposta'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
    },
    onError: (error) => {
      console.error('Erro ao aprovar proposta:', error);
      toast.error('Erro ao aprovar proposta. Tente novamente.');
    },
  });
}

// ============================================
// MUTATION: Solicitar documentos
// ============================================
interface SolicitarDocumentosParams {
  contratoId: string;
  associadoId: string;
  documentos: string[];
  observacoes: string;
}

export function useSolicitarDocumentos() {
  const queryClient = useQueryClient();
  const { profile } = useAuth(); // Usar profile.id (da tabela profiles)

  return useMutation({
    mutationFn: async ({ contratoId, associadoId, documentos, observacoes }: SolicitarDocumentosParams) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      // 1. Criar registros na tabela documentos_solicitados
      const docsParaInserir = documentos.map((tipo) => ({
        associado_id: associadoId,
        contrato_id: contratoId,
        tipo_documento: tipo,
        status: 'pendente',
        solicitado_por: profile.id,
        observacao_solicitacao: observacoes || null,
      }));

      const { error: docsError } = await supabase
        .from('documentos_solicitados')
        .insert(docsParaInserir);

      if (docsError) {
        console.error('Erro ao criar docs solicitados:', docsError);
        throw docsError;
      }

      // 2. Atualizar status do associado
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'documentacao_pendente' as any,
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

      // 3. Registrar histórico (usando profile.id que referencia profiles)
      const { error: historicoError } = await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          contrato_id: contratoId,
          tipo: 'status_alterado',
          descricao: `Documentos solicitados: ${documentos.join(', ')}. ${observacoes || ''}`,
          usuario_id: profile.id,
        });

      if (historicoError) {
        console.warn('Erro ao registrar histórico (não crítico):', historicoError);
        // Não falhar por causa do histórico
      }

      return { contratoId, associadoId };
    },
    onSuccess: () => {
      toast.success('Documentos solicitados! O cliente será notificado no link de acompanhamento.');
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['docs-solicitados'] });
    },
    onError: (error) => {
      console.error('Erro ao solicitar documentos:', error);
      toast.error('Erro ao enviar solicitação. Tente novamente.');
    },
  });
}

// ============================================
// MUTATION: Reprovar proposta
// ============================================
interface ReprovarPropostaParams {
  contratoId: string;
  associadoId: string;
  motivo: string;
  justificativa: string;
}

export function useReprovarProposta() {
  const queryClient = useQueryClient();
  const { profile } = useAuth(); // Usar profile.id (da tabela profiles)

  return useMutation({
    mutationFn: async ({ contratoId, associadoId, motivo, justificativa }: ReprovarPropostaParams) => {
      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Atualizar contrato (usar 'cancelado' pois 'reprovado' não existe no enum)
      const { error: contratoError } = await supabase
        .from('contratos')
        .update({
          status: 'cancelado',
          motivo_cancelamento: `REPROVADO - ${motivo}: ${justificativa}`,
        })
        .eq('id', contratoId);

      if (contratoError) throw contratoError;

      // Atualizar associado
      const { error: associadoError } = await supabase
        .from('associados')
        .update({
          status: 'reprovado' as any,
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

      // Registrar histórico (usando profile.id)
      const { error: historicoError } = await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          contrato_id: contratoId,
          tipo: 'status_alterado',
          descricao: `Proposta reprovada. Motivo: ${motivo}. ${justificativa || ''}`,
          usuario_id: profile.id,
        });

      if (historicoError) {
        console.warn('Erro ao registrar histórico (não crítico):', historicoError);
      }

      return { contratoId, associadoId };
    },
    onSuccess: () => {
      toast.success('Proposta reprovada.');
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (error) => {
      console.error('Erro ao reprovar proposta:', error);
      toast.error('Erro ao reprovar proposta. Tente novamente.');
    },
  });
}
