import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReagendarTarefaInput {
  servicoId: string;
  novaData: string; // 'yyyy-MM-dd'
  novaHora: string; // 'HH:mm'
  motivo?: string;
  enviarWhatsapp?: boolean;
}

/**
 * Reagenda manualmente uma tarefa (vistoria/instalação) atribuída no mapa
 * de monitoramento, atualizando todas as tabelas envolvidas (servicos,
 * vistorias, agendamentos_base) e opcionalmente disparando WhatsApp de
 * reconfirmação ao associado.
 */
export function useReagendarTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, novaData, novaHora, motivo, enviarWhatsapp }: ReagendarTarefaInput) => {
      // Normaliza hora HH:mm -> HH:mm:ss
      const horaSql = novaHora.length === 5 ? `${novaHora}:00` : novaHora;
      const periodo = Number(novaHora.slice(0, 2)) < 12 ? "manha" : "tarde";

      // 1) Buscar serviço para descobrir vínculos
      const { data: servico, error: errServ } = await supabase
        .from("servicos")
        .select("id, data_agendada, hora_agendada, observacoes, vistoria_origem_id, instalacao_origem_id, associado_id")
        .eq("id", servicoId)
        .maybeSingle();

      if (errServ) throw errServ;
      if (!servico) throw new Error("Serviço não encontrado");

      const dataAnterior = servico.data_agendada;
      const horaAnterior = servico.hora_agendada;

      const obsLog = [
        servico.observacoes || "",
        `\n[Reagendamento manual ${new Date().toLocaleString("pt-BR")}] de ${dataAnterior || "?"} ${horaAnterior || ""} → ${novaData} ${novaHora}${motivo ? ` · Motivo: ${motivo}` : ""}`,
      ].join("").trim();

      // 2) Atualiza servicos
      const { error: errUpdServ } = await supabase
        .from("servicos")
        .update({
          data_agendada: novaData,
          hora_agendada: horaSql,
          periodo: periodo as any,
          observacoes: obsLog,
          // marca data original na primeira vez (preserva)
          ...(dataAnterior && !servico.observacoes?.includes("data_agendada_original")
            ? { data_agendada_original: dataAnterior as any }
            : {}),
          // limpa confirmação para forçar nova confirmação se for o caso
          confirmacao_whatsapp: null as any,
        })
        .eq("id", servicoId);

      if (errUpdServ) throw errUpdServ;

      // 3) Atualiza vistoria vinculada (se houver)
      if (servico.vistoria_origem_id) {
        await supabase
          .from("vistorias")
          .update({
            data_agendada: novaData,
            hora_agendada: horaSql,
          })
          .eq("id", servico.vistoria_origem_id);
      }

      // 4) Atualiza instalação vinculada (se houver)
      if (servico.instalacao_origem_id) {
        await supabase
          .from("instalacoes")
          .update({
            data_agendada: novaData,
            hora_agendada: horaSql,
          } as any)
          .eq("id", servico.instalacao_origem_id);
      }

      // 5) Disparar WhatsApp de reconfirmação (best-effort, não trava o sucesso)
      if (enviarWhatsapp) {
        try {
          await supabase.functions.invoke("enviar-confirmacao-manual", {
            body: { servico_id: servicoId },
          });
        } catch (e) {
          console.warn("[reagendar] envio whatsapp falhou", e);
        }
      }

      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vistorias-mapa"] });
      queryClient.invalidateQueries({ queryKey: ["mapa-base-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["fila-base-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-base"] });
      queryClient.invalidateQueries({ queryKey: ["vistorias"] });
      toast.success("Tarefa reagendada com sucesso");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao reagendar: ${err.message}`);
    },
  });
}
