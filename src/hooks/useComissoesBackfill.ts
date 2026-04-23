import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BackfillParams {
  data_inicio?: string;
  data_fim?: string;
  contrato_id?: string;
  vendedor_id?: string;
  dry_run?: boolean;
  limite?: number;
}

export interface BackfillResult {
  ok: boolean;
  dry_run: boolean;
  total_cobrancas: number;
  total_comissoes_geradas: number;
  erros: Array<{ cobranca_id: string; erro: string }>;
}

export function useComissoesBackfill() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<BackfillResult | null>(null);

  async function executar(params: BackfillParams = {}) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<BackfillResult>(
        "comissoes-backfill",
        { body: { dry_run: true, limite: 500, ...params } }
      );
      if (error) throw error;
      setResultado(data ?? null);
      if (data?.ok) {
        const acao = data.dry_run ? "Simulação" : "Backfill";
        toast.success(
          `${acao}: ${data.total_cobrancas} cobranças, ${data.total_comissoes_geradas} comissões geradas`
        );
      }
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(`Falha no backfill: ${msg}`);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { executar, loading, resultado };
}
