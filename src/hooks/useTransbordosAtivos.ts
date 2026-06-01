import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TransbordoAtivo {
  telefone: string;
  pausada_ate: string;
  motivo: string;
  created_at: string;
  updated_at: string;
  associado_id: string | null;
  nome: string | null;
  avatar_url: string | null;
}

const normalizar = (t: string | null | undefined) => (t || '').replace(/\D/g, '');

function variantesTelefone(tel: string): string[] {
  const d = normalizar(tel);
  if (!d) return [];
  const set = new Set<string>([d]);
  if (d.startsWith('55') && d.length >= 12) set.add(d.slice(2));
  else if (d.length >= 10) set.add('55' + d);
  return Array.from(set);
}

export function useTransbordosAtivos() {
  return useQuery({
    queryKey: ['transbordos-ativos'],
    refetchInterval: 15_000,
    staleTime: 10_000,
    queryFn: async (): Promise<TransbordoAtivo[]> => {
      const sb: any = supabase;
      const { data: pausas, error } = await sb
        .from('whatsapp_ia_pausas')
        .select('telefone, pausada_ate, motivo, created_at, updated_at')
        .gt('pausada_ate', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (pausas ?? []) as Array<Omit<TransbordoAtivo, 'associado_id' | 'nome' | 'avatar_url'>>;
      if (!rows.length) return [];

      // Junta com associados pelo telefone/whatsapp (normalizando)
      const { data: assocs } = await supabase
        .from('associados')
        .select('id, nome, telefone, whatsapp, avatar_url')
        .or('telefone.not.is.null,whatsapp.not.is.null');

      const lookup = new Map<string, { id: string; nome: string; avatar_url: string | null }>();
      (assocs ?? []).forEach((a: any) => {
        for (const t of [a.telefone, a.whatsapp]) {
          for (const v of variantesTelefone(t)) {
            if (!lookup.has(v)) lookup.set(v, { id: a.id, nome: a.nome, avatar_url: a.avatar_url ?? null });
          }
        }
      });

      return rows.map((r) => {
        let match: { id: string; nome: string; avatar_url: string | null } | undefined;
        for (const v of variantesTelefone(r.telefone)) {
          match = lookup.get(v);
          if (match) break;
        }
        return {
          ...r,
          associado_id: match?.id ?? null,
          nome: match?.nome ?? null,
          avatar_url: match?.avatar_url ?? null,
        };
      });
    },
  });
}

/** Conclui o transbordo: expira a pausa, marca corte de contexto e devolve a IA ao ar. */
export function useConcluirTransbordo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (telefone: string) => {
      const tel = normalizar(telefone);
      if (!tel) throw new Error('telefone inválido');
      const agora = new Date().toISOString();
      const sb: any = supabase;

      // 1) Expira a pausa + marca corte de contexto
      const { error: pErr } = await sb
        .from('whatsapp_ia_pausas')
        .update({
          pausada_ate: agora,
          contexto_cortado_em: agora,
          motivo: 'encerrado_humano',
          updated_at: agora,
        })
        .in('telefone', variantesTelefone(tel));
      if (pErr) throw pErr;

      // 2) Devolve o controle à IA no agente_consultor_contatos (se existir)
      try {
        await sb
          .from('agente_consultor_contatos')
          .update({ status: 'ativo' })
          .in('telefone', variantesTelefone(tel));
      } catch (_e) {
        // Não-bloqueante — pode não haver contato registrado
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transbordos-ativos'] });
      qc.invalidateQueries({ queryKey: ['chat-ia-transbordo-ativo'] });
      qc.invalidateQueries({ queryKey: ['ia-pausa'] });
    },
  });
}
