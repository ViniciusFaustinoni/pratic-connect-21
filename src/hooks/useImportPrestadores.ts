import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PrestadorImport } from "@/lib/parsePrestador";

interface ImportResultado {
  linha: number;
  razao_social: string;
  sucesso: boolean;
  erro?: string;
  prestador_id?: string;
  valores_inseridos?: number;
}

interface ImportResponse {
  total: number;
  sucesso: number;
  erros: number;
  resultados: ImportResultado[];
}

export function useImportPrestadores() {
  const [isImporting, setIsImporting] = useState(false);
  const [resultado, setResultado] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importar = async (prestadores: PrestadorImport[]) => {
    setIsImporting(true);
    setError(null);
    setResultado(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("import-prestadores", {
        body: { prestadores },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResultado(data as ImportResponse);
      return data as ImportResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      throw err;
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setIsImporting(false);
    setResultado(null);
    setError(null);
  };

  return { importar, isImporting, resultado, error, reset };
}
