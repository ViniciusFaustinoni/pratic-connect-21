import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useEnviarConfirmacaoWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (servicoId: string) => {
      const { data, error } = await supabase.functions.invoke("enviar-confirmacao-manual", {
        body: { servico_id: servicoId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar confirmação");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vistorias-mapa"] });
      toast.success("Confirmação WhatsApp enviada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar confirmação: ${error.message}`);
    },
  });
}
