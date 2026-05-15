import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type AvisoSGATipo = Database['public']['Enums']['aviso_sga_tipo'];
export type AvisoSGADecisao = Database['public']['Enums']['aviso_sga_decisao'];

export interface RegistrarAvisoInput {
  tipo: AvisoSGATipo;
  titulo: string;
  mensagem?: string;
  decisao: AvisoSGADecisao;
  motivo?: string;
  cpf?: string | null;
  placa?: string | null;
  cotacao_id?: string | null;
  contrato_id?: string | null;
  associado_id?: string | null;
  detalhes?: Record<string, unknown>;
}

/**
 * Registra um aviso SGA + decisão do usuário.
 * Usado pelos modais "Ignorar e Prosseguir" do fluxo de cotação.
 * O conteúdo será posteriormente concatenado no campo `observacao`
 * do veículo enviado ao SGA Hinova.
 */
export function useRegistrarAvisoSGA() {
  return useMutation({
    mutationFn: async (input: RegistrarAvisoInput) => {
      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      let nome: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome')
          .eq('user_id', user.id)
          .maybeSingle();
        nome = profile?.nome ?? user.email ?? null;
      }
      const { data, error } = await supabase
        .from('cotacao_avisos_sga')
        .insert({
          tipo: input.tipo,
          titulo: input.titulo,
          mensagem: input.mensagem ?? null,
          decisao: input.decisao,
          motivo: input.motivo ?? null,
          cpf: input.cpf ? input.cpf.replace(/\D/g, '') : null,
          placa: input.placa ? input.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null,
          cotacao_id: input.cotacao_id ?? null,
          contrato_id: input.contrato_id ?? null,
          associado_id: input.associado_id ?? null,
          detalhes: (input.detalhes ?? {}) as any,
          decidido_por: user?.id ?? null,
          decidido_por_nome: nome,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
  });
}
