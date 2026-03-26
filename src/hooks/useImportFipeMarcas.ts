import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  success: boolean;
  totalInserted?: number;
  errors?: string[];
  error?: string;
}

export function useImportFipeMarcas() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tipos: string[]) => {
      const { data, error } = await supabase.functions.invoke<ImportResult>(
        'fipe-import-marcas',
        { body: { tipos } }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro na importação');
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['marcas_modelos'] });
      toast.success(`Importação concluída: ${data.totalInserted} registros processados`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} erros durante a importação`);
      }
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
