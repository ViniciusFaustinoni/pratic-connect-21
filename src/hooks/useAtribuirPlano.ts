import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AssociadoBusca {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  status: string;
  plano_id: string | null;
  plano_nome?: string;
}

export function useBuscarAssociados(termo: string) {
  return useQuery({
    queryKey: ['buscar-associados-atribuicao', termo],
    queryFn: async (): Promise<AssociadoBusca[]> => {
      if (!termo || termo.length < 2) return [];

      const cleaned = termo.replace(/\D/g, '');

      let query = supabase
        .from('associados')
        .select('id, nome, cpf, email, telefone, status, plano_id')
        .in('status', ['ativo', 'inadimplente', 'suspenso', 'em_analise', 'aprovado']);

      if (cleaned.length >= 3) {
        query = query.or(`nome.ilike.%${termo}%,cpf.ilike.%${cleaned}%,telefone.ilike.%${cleaned}%`);
      } else {
        query = query.ilike('nome', `%${termo}%`);
      }

      const { data, error } = await query.limit(10).order('nome');
      if (error) throw error;

      // Fetch plano names for results that have plano_id
      const planoIds = [...new Set((data || []).filter(a => a.plano_id).map(a => a.plano_id!))];
      let planosMap: Record<string, string> = {};
      if (planoIds.length > 0) {
        const { data: planos } = await supabase
          .from('planos')
          .select('id, nome')
          .in('id', planoIds);
        if (planos) {
          planosMap = Object.fromEntries(planos.map(p => [p.id, p.nome]));
        }
      }

      return (data || []).map(a => ({
        ...a,
        plano_nome: a.plano_id ? planosMap[a.plano_id] || 'Plano desconhecido' : undefined,
      })) as AssociadoBusca[];
    },
    enabled: termo.length >= 2,
  });
}

export function useAtribuirPlanoSemTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planoId, associadoId, planoNome }: { planoId: string; associadoId: string; planoNome: string }) => {
      // 1. Update associado plano_id
      const { error: errAssoc } = await supabase
        .from('associados')
        .update({ plano_id: planoId })
        .eq('id', associadoId);
      if (errAssoc) throw errAssoc;

      // 2. Get plano details for contract
      const { data: plano } = await supabase
        .from('planos')
        .select('*')
        .eq('id', planoId)
        .single();

      // 3. Get associado's vehicle
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id')
        .eq('associado_id', associadoId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 4. Create contract
      const numero = `CTR-${Date.now().toString(36).toUpperCase()}`;
      const { error: errContrato } = await supabase
        .from('contratos')
        .insert({
          numero,
          associado_id: associadoId,
          plano_id: planoId,
          veiculo_id: veiculo?.id || null,
          status: 'ativo',
          valor_mensal: plano?.valor_mensal || 0,
          valor_adesao: plano?.valor_adesao || 0,
        });
      if (errContrato) throw errContrato;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['associados'] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      toast.success(`Plano "${vars.planoNome}" atribuído com sucesso!`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao atribuir plano');
    },
  });
}

export function useAtribuirPlanoComTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planoId, associadoId, planoNome }: { planoId: string; associadoId: string; planoNome: string }) => {
      // 1. Get plano details
      const { data: plano } = await supabase
        .from('planos')
        .select('*')
        .eq('id', planoId)
        .single();

      // 2. Get associado's vehicle
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id')
        .eq('associado_id', associadoId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Create contract with pending status
      const numero = `CTR-${Date.now().toString(36).toUpperCase()}`;
      const { data: contrato, error: errContrato } = await supabase
        .from('contratos')
        .insert({
          numero,
          associado_id: associadoId,
          plano_id: planoId,
          veiculo_id: veiculo?.id || null,
          status: 'pendente_assinatura',
          valor_mensal: plano?.valor_mensal || 0,
          valor_adesao: plano?.valor_adesao || 0,
        })
        .select()
        .single();
      if (errContrato) throw errContrato;

      // 4. Invoke autentique edge function
      const { error: errFn } = await supabase.functions.invoke('autentique-create-by-token', {
        body: { contrato_id: contrato.id },
      });
      if (errFn) throw errFn;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['associados'] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      toast.success(`Termo de filiação enviado para assinatura do plano "${vars.planoNome}"!`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao enviar termo');
    },
  });
}
