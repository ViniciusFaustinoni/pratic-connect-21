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
  /** True quando mais de um associado ativo compartilha este telefone. */
  multiplos_cadastros: boolean;
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

function normalizarNome(n: string | null | undefined): string {
  return (n || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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
      const rows = (pausas ?? []) as Array<Omit<TransbordoAtivo, 'associado_id' | 'nome' | 'avatar_url' | 'multiplos_cadastros'>>;
      if (!rows.length) return [];

      // Carrega TODOS os associados e indexa por variante de telefone como LISTA
      // (um mesmo número pode pertencer a mais de um cadastro — familiares etc.).
      const { data: assocs } = await supabase
        .from('associados')
        .select('id, nome, telefone, whatsapp, avatar_url')
        .or('telefone.not.is.null,whatsapp.not.is.null');

      type Assoc = { id: string; nome: string | null; avatar_url: string | null };
      const lookup = new Map<string, Assoc[]>();
      (assocs ?? []).forEach((a: any) => {
        const visto = new Set<string>();
        for (const t of [a.telefone, a.whatsapp]) {
          for (const v of variantesTelefone(t)) {
            if (visto.has(v)) continue;
            visto.add(v);
            const arr = lookup.get(v) ?? [];
            if (!arr.some((x) => x.id === a.id)) {
              arr.push({ id: a.id, nome: a.nome ?? null, avatar_url: a.avatar_url ?? null });
            }
            lookup.set(v, arr);
          }
        }
      });

      // Nome real do contato no WhatsApp (fonte preferencial para desambiguar)
      const telVariantesAll = Array.from(
        new Set(rows.flatMap((r) => variantesTelefone(r.telefone)))
      );
      const contatosNome = new Map<string, string>();
      if (telVariantesAll.length) {
        const { data: contatos } = await sb
          .from('agente_ia_contatos')
          .select('telefone, nome')
          .in('telefone', telVariantesAll);
        (contatos ?? []).forEach((c: any) => {
          if (c.nome) {
            for (const v of variantesTelefone(c.telefone)) contatosNome.set(v, c.nome);
          }
        });
      }

      return rows.map((r) => {
        const variantes = variantesTelefone(r.telefone);
        const candidatosSet = new Map<string, Assoc>();
        for (const v of variantes) {
          for (const a of lookup.get(v) ?? []) candidatosSet.set(a.id, a);
        }
        const candidatos = Array.from(candidatosSet.values());

        let nomeContato: string | null = null;
        for (const v of variantes) {
          const n = contatosNome.get(v);
          if (n) { nomeContato = n; break; }
        }

        const multiplos = candidatos.length > 1;
        let escolhido: Assoc | null = null;

        if (candidatos.length === 1) {
          escolhido = candidatos[0];
        } else if (multiplos && nomeContato) {
          const alvo = normalizarNome(nomeContato);
          escolhido =
            candidatos.find((c) => normalizarNome(c.nome) === alvo) ??
            candidatos.find((c) => {
              const n = normalizarNome(c.nome);
              return !!n && (n.startsWith(alvo) || alvo.startsWith(n));
            }) ?? null;
        }

        return {
          ...r,
          associado_id: escolhido?.id ?? null,
          // Quando há ambiguidade não resolvida, prefere o nome que veio da conversa
          nome: escolhido?.nome ?? nomeContato ?? null,
          avatar_url: escolhido?.avatar_url ?? null,
          multiplos_cadastros: multiplos,
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
