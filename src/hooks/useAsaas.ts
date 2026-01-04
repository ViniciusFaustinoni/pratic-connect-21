import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CriarClienteParams {
  associado_id: string;
  dados?: {
    nome: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    postalCode?: string;
    city?: string;
    state?: string;
  };
}

interface CriarCobrancaParams {
  billingType: 'BOLETO' | 'PIX' | 'UNDEFINED';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  tipo?: string;
  competencia?: string;
  veiculo_id?: string;
  contrato_id?: string;
  desconto?: number;
  associado_id: string;
}

export function useAsaas() {
  const queryClient = useQueryClient();

  // Sincronizar/Criar cliente no ASAAS
  const sincronizarCliente = useMutation({
    mutationFn: async (associado_id: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-clientes', {
        body: { action: 'sincronizar', associado_id },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao sincronizar cliente');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-clientes'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sincronizar cliente: ${error.message}`);
    },
  });

  // Criar cliente no ASAAS
  const criarCliente = useMutation({
    mutationFn: async ({ associado_id, dados }: CriarClienteParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-clientes', {
        body: { action: 'criar', associado_id, dados },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao criar cliente');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-clientes'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar cliente: ${error.message}`);
    },
  });

  // Buscar cliente ASAAS por associado_id
  const useBuscarCliente = (associado_id: string | undefined) => {
    return useQuery({
      queryKey: ['asaas-clientes', associado_id],
      queryFn: async () => {
        if (!associado_id) return null;
        
        const { data, error } = await supabase
          .from('asaas_clientes')
          .select('*')
          .eq('associado_id', associado_id)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
      enabled: !!associado_id,
    });
  };

  // Criar cobrança no ASAAS
  const criarCobranca = useMutation({
    mutationFn: async (params: CriarCobrancaParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-cobrancas', {
        body: { 
          action: 'criar', 
          associado_id: params.associado_id,
          dados: {
            billingType: params.billingType,
            value: params.value,
            dueDate: params.dueDate,
            description: params.description,
            externalReference: params.externalReference,
          },
          tipo: params.tipo,
          competencia: params.competencia,
          desconto: params.desconto,
          veiculo_id: params.veiculo_id,
          contrato_id: params.contrato_id,
        },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao criar cobrança');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar cobrança: ${error.message}`);
    },
  });

  // Buscar cobrança
  const buscarCobranca = useMutation({
    mutationFn: async ({ asaas_id, cobranca_id }: { asaas_id?: string; cobranca_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('asaas-cobrancas', {
        body: { action: 'buscar', asaas_id, cobranca_id },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao buscar cobrança');
      
      return data;
    },
  });

  // Cancelar cobrança
  const cancelarCobranca = useMutation({
    mutationFn: async (asaas_id: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cobrancas', {
        body: { action: 'cancelar', asaas_id },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao cancelar cobrança');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      toast.success('Cobrança cancelada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar cobrança: ${error.message}`);
    },
  });

  // Gerar segunda via
  const gerarSegundaVia = useMutation({
    mutationFn: async (asaas_id: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cobrancas', {
        body: { action: 'segunda_via', asaas_id },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao gerar segunda via');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['asaas-cobrancas'] });
      if (data.boletoUrl) {
        window.open(data.boletoUrl, '_blank');
      }
      toast.success('Segunda via gerada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar segunda via: ${error.message}`);
    },
  });

  // Listar cobranças do associado
  const useListarCobrancas = (associado_id: string | undefined) => {
    return useQuery({
      queryKey: ['asaas-cobrancas', associado_id],
      queryFn: async () => {
        if (!associado_id) return [];
        
        const { data, error } = await supabase
          .from('asaas_cobrancas')
          .select('*, associado:associados(nome, cpf)')
          .eq('associado_id', associado_id)
          .order('data_vencimento', { ascending: false });

        if (error) throw error;
        return data || [];
      },
      enabled: !!associado_id,
    });
  };

  return {
    // Clientes
    sincronizarCliente,
    criarCliente,
    useBuscarCliente,
    
    // Cobranças
    criarCobranca,
    buscarCobranca,
    cancelarCobranca,
    gerarSegundaVia,
    useListarCobrancas,
  };
}
