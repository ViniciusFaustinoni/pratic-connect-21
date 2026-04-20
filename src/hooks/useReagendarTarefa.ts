import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PeriodoCanonico } from "@/lib/periodo-utils";

export interface ReagendarTarefaInput {
  servicoId: string;
  novaData: string; // 'yyyy-MM-dd'
  novoPeriodo: PeriodoCanonico;
  motivo?: string;
  enviarWhatsapp?: boolean;
}

/**
 * Reagenda manualmente uma tarefa (vistoria/instalação) atribuída no mapa
 * de monitoramento, atualizando todas as tabelas envolvidas (servicos,
 * vistorias, agendamentos_base) e opcionalmente disparando WhatsApp de
 * reconfirmação ao associado. Sempre por PERÍODO — sem horário fixo.
 */
export function useReagendarTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, novaData, novoPeriodo, motivo, enviarWhatsapp }: ReagendarTarefaInput) => {
      // 1) Buscar serviço para descobrir vínculos
      const { data: servico, error: errServ } = await supabase
        .from("servicos")
        .select("id, data_agendada, hora_agendada, periodo, observacoes, vistoria_origem_id, instalacao_origem_id, associado_id")
        .eq("id", servicoId)
        .maybeSingle();

      if (errServ) throw errServ;
      if (!servico) throw new Error("Serviço não encontrado");

      const dataAnterior = servico.data_agendada;
      const periodoAnterior = servico.periodo || servico.hora_agendada || "?";

      const obsLog = [
        servico.observacoes || "",
        `\n[Reagendamento manual ${new Date().toLocaleString("pt-BR")}] de ${dataAnterior || "?"} ${periodoAnterior} → ${novaData} ${novoPeriodo}${motivo ? ` · Motivo: ${motivo}` : ""}`,
      ].join("").trim();

      // 2) Atualiza servicos
      const { error: errUpdServ } = await supabase
        .from("servicos")
        .update({
          data_agendada: novaData,
          hora_agendada: null,
          periodo: novoPeriodo as any,
          observacoes: obsLog,
          ...(dataAnterior && !servico.observacoes?.includes("data_agendada_original")
            ? { data_agendada_original: dataAnterior as any }
            : {}),
          confirmacao_whatsapp: null as any,
        })
        .eq("id", servicoId);

      if (errUpdServ) throw errUpdServ;

      // 3) Vistoria vinculada
      if (servico.vistoria_origem_id) {
        await supabase
          .from("vistorias")
          .update({
            data_agendada: novaData,
            hora_agendada: null,
          })
          .eq("id", servico.vistoria_origem_id);
      }

      // 4) Instalação vinculada
      if (servico.instalacao_origem_id) {
        await supabase
          .from("instalacoes")
          .update({
            data_agendada: novaData,
            hora_agendada: null,
            periodo: novoPeriodo,
          } as any)
          .eq("id", servico.instalacao_origem_id);
      }

      // 5) WhatsApp (best-effort)
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
