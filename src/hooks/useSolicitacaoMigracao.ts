import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMigracaoConfig } from './useConteudosSistema';

// ============================================
// Verificar bloqueios de migração por CPF
// ============================================

interface BloqueioResult {
  bloqueado: boolean;
  tipo?: 'debito' | 'vinculo_ativo';
  mensagem?: string;
}

export function useVerificarBloqueiosMigracao(cpf: string | undefined) {
  return useQuery({
    queryKey: ['migracao-bloqueios', cpf],
    queryFn: async (): Promise<BloqueioResult> => {
      if (!cpf) return { bloqueado: false };

      const cpfLimpo = cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) return { bloqueado: false };

      // Formatar CPF para busca (XXX.XXX.XXX-XX)
      const cpfFormatado = `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9)}`;

      // 1. Verificar vínculo ativo
      const { data: associadoAtivo } = await supabase
        .from('associados')
        .select('id, nome')
        .eq('cpf', cpfFormatado)
        .eq('status', 'ativo')
        .maybeSingle();

      if (associadoAtivo) {
        return {
          bloqueado: true,
          tipo: 'vinculo_ativo',
          mensagem: `Este CPF já possui um vínculo ativo na Praticcar (${associadoAtivo.nome}). Não é possível abrir uma migração para um associado já ativo. Verifique se o caso se enquadra em outra operação (Inclusão de veículo, Troca de titularidade, etc.).`,
        };
      }

      // 2. Verificar débitos pendentes (buscar associado inativo/cancelado com débitos)
      const { data: associadosAnteriores } = await supabase
        .from('associados')
        .select('id')
        .eq('cpf', cpfFormatado)
        .neq('status', 'ativo');

      if (associadosAnteriores && associadosAnteriores.length > 0) {
        const ids = associadosAnteriores.map(a => a.id);
        
        const { data: debitos } = await supabase
          .from('cobrancas')
          .select('id')
          .in('associado_id', ids)
          .eq('status', 'vencido')
          .limit(1);

        if (debitos && debitos.length > 0) {
          return {
            bloqueado: true,
            tipo: 'debito',
            mensagem: 'Este CPF possui débitos pendentes com a Praticcar que precisam ser quitados antes de qualquer nova filiação. Oriente o cliente a regularizar a situação financeira.',
          };
        }
      }

      return { bloqueado: false };
    },
    enabled: !!cpf && cpf.replace(/\D/g, '').length === 11,
    staleTime: 1000 * 30,
  });
}

// ============================================
// Criar solicitação de migração (via cotação)
// ============================================

interface CriarSolicitacaoData {
  cotacao_id: string;
  associado_cpf: string;
  associado_nome?: string;
  veiculo_placa?: string;
  associacao_origem: string;
  prazo_resposta_horas: number;
  documentos: Array<{
    tipo: 'comprovante_pagamento' | 'boleto_referencia';
    arquivo_url: string;
    nome_arquivo: string;
    cpf_detectado?: string;
    placa_detectada?: string;
    legivel?: boolean;
    validacao_ok?: boolean;
    validacao_erro?: string;
  }>;
}

// ============================================
// Criar solicitação de migração direta (sem cotação)
// ============================================

interface CriarSolicitacaoDiretaData {
  associado_cpf: string;
  associado_nome?: string;
  veiculo_placa?: string;
  associacao_origem: string;
  prazo_resposta_horas: number;
  consultor_id?: string;
  documentos: Array<{
    tipo: 'comprovante_pagamento' | 'boleto_referencia';
    arquivo_url: string;
    nome_arquivo: string;
    cpf_detectado?: string;
    placa_detectada?: string;
    legivel?: boolean;
    validacao_ok?: boolean;
    validacao_erro?: string;
  }>;
}

export function useCriarSolicitacaoMigracao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CriarSolicitacaoData) => {
      // Get current user profile id
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Create solicitação
      const { data: solicitacao, error: solError } = await supabase
        .from('solicitacoes_migracao')
        .insert({
          cotacao_id: data.cotacao_id,
          associado_cpf: data.associado_cpf,
          associado_nome: data.associado_nome || null,
          veiculo_placa: data.veiculo_placa || null,
          associacao_origem: data.associacao_origem,
          consultor_id: profile.id,
          prazo_resposta_horas: data.prazo_resposta_horas,
          status: 'pendente',
        })
        .select('id')
        .single();

      if (solError) throw solError;

      // Insert documents
      if (data.documentos.length > 0) {
        const docs = data.documentos.map(doc => ({
          solicitacao_id: solicitacao.id,
          tipo: doc.tipo,
          arquivo_url: doc.arquivo_url,
          nome_arquivo: doc.nome_arquivo,
          cpf_detectado: doc.cpf_detectado || null,
          placa_detectada: doc.placa_detectada || null,
          legivel: doc.legivel ?? true,
          validacao_ok: doc.validacao_ok ?? null,
          validacao_erro: doc.validacao_erro || null,
        }));

        const { error: docError } = await supabase
          .from('solicitacoes_migracao_documentos')
          .insert(docs);

        if (docError) throw docError;
      }

      return solicitacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao-migracao'] });
    },
  });
}

// ============================================
// Criar solicitação de migração direta (sem cotação)
// ============================================

export function useCriarSolicitacaoMigracaoDireta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CriarSolicitacaoDiretaData) => {
      // Get current user profile id (the operator)
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Create solicitação without cotacao_id
      const { data: solicitacao, error: solError } = await supabase
        .from('solicitacoes_migracao')
        .insert({
          cotacao_id: null as any,
          associado_cpf: data.associado_cpf,
          associado_nome: data.associado_nome || null,
          veiculo_placa: data.veiculo_placa || null,
          associacao_origem: data.associacao_origem,
          consultor_id: data.consultor_id || null,
          prazo_resposta_horas: data.prazo_resposta_horas,
          status: 'pendente',
          origem_entrada: 'direta',
        } as any)
        .select('id')
        .single();

      if (solError) throw solError;

      // Insert documents
      if (data.documentos.length > 0) {
        const docs = data.documentos.map(doc => ({
          solicitacao_id: solicitacao.id,
          tipo: doc.tipo,
          arquivo_url: doc.arquivo_url,
          nome_arquivo: doc.nome_arquivo,
          cpf_detectado: doc.cpf_detectado || null,
          placa_detectada: doc.placa_detectada || null,
          legivel: doc.legivel ?? true,
          validacao_ok: doc.validacao_ok ?? null,
          validacao_erro: doc.validacao_erro || null,
        }));

        const { error: docError } = await supabase
          .from('solicitacoes_migracao_documentos')
          .insert(docs);

        if (docError) throw docError;
      }

      return solicitacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao-migracao'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-migracao-admin'] });
    },
  });
}

// ============================================
// Buscar solicitação de migração por cotação (polling)
// ============================================

export function useSolicitacaoMigracaoByCotacao(cotacaoId: string | undefined) {
  return useQuery({
    queryKey: ['solicitacao-migracao', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;

      const { data, error } = await supabase
        .from('solicitacoes_migracao')
        .select(`
          *,
          documentos:solicitacoes_migracao_documentos(*)
        `)
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 5s while pending
      if (data && data.status === 'pendente') return 5000;
      return false;
    },
  });
}
