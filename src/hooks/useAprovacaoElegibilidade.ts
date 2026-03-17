import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AprovacaoElegibilidade {
  id: string;
  cotacao_id: string;
  plano_id: string;
  solicitante_id: string;
  marca: string;
  modelo: string;
  ano: number;
  combustivel: string;
  placa: string | null;
  motivo_bloqueio: string;
  observacao_regra: string | null;
  justificativa: string;
  status: 'pendente' | 'aprovado' | 'recusado';
  aprovador_id: string | null;
  observacao_aprovador: string | null;
  respondido_em: string | null;
  supervisor_check: boolean;
  supervisor_id: string | null;
  supervisor_check_em: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  cotacao?: {
    id: string;
    numero: string;
    nome_solicitante: string | null;
    telefone1_solicitante: string | null;
    veiculo_placa: string | null;
    status: string;
  } | null;
  plano?: {
    id: string;
    nome: string;
    linha: string | null;
  } | null;
  solicitante?: {
    nome: string;
    email: string;
  } | null;
  supervisor?: {
    nome: string;
  } | null;
}

/**
 * Lista solicitações de elegibilidade com filtro de status.
 */
export function useListarAprovacoesElegibilidade(statusFilter?: string) {
  return useQuery({
    queryKey: ['aprovacoes-elegibilidade', statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('aprovacoes_elegibilidade')
        .select(`
          *,
          cotacao:cotacoes!cotacao_id(id, numero, nome_solicitante, telefone1_solicitante, veiculo_placa, status),
          plano:planos!plano_id(id, nome, linha),
          solicitante:profiles!solicitante_id(nome, email),
          supervisor:profiles!supervisor_id(nome)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AprovacaoElegibilidade[];
    },
  });
}

/**
 * Verifica se já existe aprovação concedida para cotação+plano.
 */
export function useAprovacoesElegibilidadePorCotacao(cotacaoId?: string) {
  return useQuery({
    queryKey: ['aprovacoes-elegibilidade-cotacao', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return [];
      const { data, error } = await (supabase as any)
        .from('aprovacoes_elegibilidade')
        .select('id, plano_id, status')
        .eq('cotacao_id', cotacaoId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!cotacaoId,
  });
}

/**
 * Cria solicitação de autorização de elegibilidade.
 */
export function useCriarSolicitacaoElegibilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      cotacao_id: string;
      plano_id: string;
      marca: string;
      modelo: string;
      ano: number;
      combustivel: string;
      placa?: string;
      motivo_bloqueio: string;
      observacao_regra?: string;
      justificativa: string;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) throw new Error('Usuário não autenticado');

      const userId = currentUser.user.id;

      // ── Verificar restrições absolutas ──
      const { data: restricoesRows } = await (supabase as any)
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['restricao_mudanca_linha', 'restricao_depreciacao_cobertura_100', 'restricao_blindado_absoluta']);

      const restricoes = Object.fromEntries((restricoesRows || []).map((r: any) => [r.chave, r.valor]));

      if (restricoes.restricao_blindado_absoluta !== 'false' && data.motivo_bloqueio?.toLowerCase().includes('blindado')) {
        throw new Error('Veículos blindados não são autorizados em nenhuma hipótese.');
      }
      if (restricoes.restricao_mudanca_linha !== 'false' && data.motivo_bloqueio?.toLowerCase().includes('mudança de linha')) {
        throw new Error('Mudança de linha de produto não é autorizada.');
      }
      if (restricoes.restricao_depreciacao_cobertura_100 !== 'false' && data.motivo_bloqueio?.toLowerCase().includes('depreciação')) {
        throw new Error('Veículos com depreciação não podem ser cadastrados em planos com cobertura 100%.');
      }

      // ── Verificar limite de solicitações por faixa de vendas ──
      const now = new Date();
      const inicioMesAtual = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Contar solicitações do consultor no mês corrente
      const { count: solicitacoesMes } = await (supabase as any)
        .from('aprovacoes_elegibilidade')
        .select('id', { count: 'exact', head: true })
        .eq('solicitante_id', userId)
        .gte('created_at', inicioMesAtual);

      // Buscar vendas confirmadas do mês anterior
      const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0);
      const { count: vendasMesAnterior } = await (supabase as any)
        .from('cotacoes')
        .select('id', { count: 'exact', head: true })
        .eq('vendedor_id', userId)
        .eq('status', 'confirmada')
        .gte('created_at', mesAnterior.toISOString())
        .lte('created_at', fimMesAnterior.toISOString());

      // Ler faixas de vendas da configuração
      const { data: faixasRow } = await (supabase as any)
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'excecao_faixas_vendas')
        .maybeSingle();

      let permitidas = 0;
      try {
        const faixas = JSON.parse(faixasRow?.valor || '[]');
        const vendas = vendasMesAnterior || 0;
        for (const faixa of faixas) {
          if (vendas >= faixa.min && (faixa.max === null || vendas <= faixa.max)) {
            permitidas = faixa.permitidas;
            break;
          }
        }
      } catch { /* use default 0 */ }

      if ((solicitacoesMes || 0) >= permitidas) {
        throw new Error(`Limite de ${permitidas} solicitação(ões) de exceção atingido para este mês. Suas vendas no mês anterior: ${vendasMesAnterior || 0}.`);
      }

      const { error } = await (supabase as any)
        .from('aprovacoes_elegibilidade')
        .insert({
          ...data,
          solicitante_id: userId,
        });

      if (error) throw error;

      // Criar notificações para diretoria e supervisão
      // Buscar usuários com permissão
      const { data: notifUsers } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['diretor', 'supervisor_vendas']);

      if (notifUsers?.length) {
        const notificacoes = notifUsers.map((u: any) => ({
          user_id: u.user_id,
          tipo: 'elegibilidade_pendente',
          titulo: 'Solicitação de Elegibilidade',
          mensagem: `Solicitação de autorização para ${data.marca} ${data.modelo} ${data.ano} — plano bloqueado por restrição de modelo`,
          link: '/aprovacoes-elegibilidade',
        }));

        await (supabase as any).from('notificacoes').insert(notificacoes);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade-cotacao'] });
      toast.success('Solicitação de autorização enviada à diretoria!');
    },
    onError: () => {
      toast.error('Erro ao enviar solicitação de autorização');
    },
  });
}

/**
 * Aprovar solicitação (diretoria).
 */
export function useAprovarElegibilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, observacao, solicitante_id }: {
      id: string;
      observacao?: string;
      solicitante_id: string;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('aprovacoes_elegibilidade')
        .update({
          status: 'aprovado',
          observacao_aprovador: observacao || null,
          aprovador_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Notificar solicitante
      await (supabase as any).from('notificacoes').insert({
        user_id: solicitante_id,
        tipo: 'elegibilidade_aprovada',
        titulo: 'Elegibilidade Aprovada',
        mensagem: 'Sua solicitação de autorização de elegibilidade foi aprovada pela diretoria',
        link: '/aprovacoes-elegibilidade',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade-cotacao'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Elegibilidade aprovada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao aprovar elegibilidade');
    },
  });
}

/**
 * Recusar solicitação (diretoria).
 */
export function useRecusarElegibilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, observacao, solicitante_id }: {
      id: string;
      observacao?: string;
      solicitante_id: string;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('aprovacoes_elegibilidade')
        .update({
          status: 'recusado',
          observacao_aprovador: observacao || null,
          aprovador_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Notificar solicitante
      await (supabase as any).from('notificacoes').insert({
        user_id: solicitante_id,
        tipo: 'elegibilidade_recusada',
        titulo: 'Elegibilidade Recusada',
        mensagem: 'Sua solicitação de autorização de elegibilidade foi recusada pela diretoria',
        link: '/aprovacoes-elegibilidade',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade-cotacao'] });
      toast.success('Solicitação de elegibilidade recusada');
    },
    onError: () => {
      toast.error('Erro ao recusar elegibilidade');
    },
  });
}

/**
 * Double-check da supervisão.
 */
export function useDoubleCheckElegibilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('aprovacoes_elegibilidade')
        .update({
          supervisor_check: true,
          supervisor_id: currentUser.user?.id || null,
          supervisor_check_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Notificação de reforço para a diretoria
      const { data: diretores } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'diretor');

      if (diretores?.length) {
        const notificacoes = diretores.map((d: any) => ({
          user_id: d.user_id,
          tipo: 'elegibilidade_double_check',
          titulo: 'Double-check da Supervisão',
          mensagem: 'A supervisão revisou e confirmou uma solicitação de elegibilidade pendente',
          link: '/aprovacoes-elegibilidade',
        }));

        await (supabase as any).from('notificacoes').insert(notificacoes);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-elegibilidade'] });
      toast.success('Revisão confirmada!');
    },
    onError: () => {
      toast.error('Erro ao confirmar revisão');
    },
  });
}
