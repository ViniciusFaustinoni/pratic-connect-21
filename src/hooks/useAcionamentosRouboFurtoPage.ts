import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AcionamentoFilters {
  status?: string;
  tipo_origem?: string;
}

export function useAcionamentosTodos(filters: AcionamentoFilters = {}) {
  return useQuery({
    queryKey: ['acionamentos', 'todos', filters],
    queryFn: async () => {
      let query = supabase
        .from('acionamentos_roubo_furto')
        .select(`
          *,
          veiculo:veiculos(id, placa, marca, modelo),
          rastreador:rastreadores(id, codigo, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao),
          associado:associados(id, nome, telefone, whatsapp)
        `)
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.tipo_origem) {
        query = query.eq('tipo_origem', filters.tipo_origem);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useAcionamentosContadores() {
  return useQuery({
    queryKey: ['acionamentos', 'contadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acionamentos_roubo_furto')
        .select('status, created_at, encerrado_em');

      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const solicitados = data?.filter(a => a.status === 'solicitado').length || 0;
      const ativos = data?.filter(a => ['autorizado', 'enviado', 'confirmado'].includes(a.status || '')).length || 0;
      const encerradosHoje = data?.filter(a => {
        if (a.status !== 'encerrado' || !a.encerrado_em) return false;
        return new Date(a.encerrado_em) >= hoje;
      }).length || 0;
      const totalMes = data?.filter(a => {
        if (!a.created_at) return false;
        return new Date(a.created_at) >= inicioMes;
      }).length || 0;

      return { solicitados, ativos, encerradosHoje, totalMes };
    },
    refetchInterval: 30000,
  });
}

export function useAutorizarAcionamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (acionamentoId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase
        .from('acionamentos_roubo_furto')
        .update({
          status: 'autorizado',
          autorizado_por: profile?.id,
          autorizado_por_nome: profile?.nome,
          autorizado_em: new Date().toISOString(),
        })
        .eq('id', acionamentoId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acionamentos'] });
      toast({
        title: "✅ Acionamento Autorizado",
        description: "O acionamento foi autorizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao Autorizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
