import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OficinaImportProcessada } from '@/lib/parseOficina';

export interface ImportResult {
  linha: number;
  cnpj: string;
  razaoSocial: string;
  sucesso: boolean;
  erro?: string;
}

export interface ImportSummary {
  total: number;
  sucesso: number;
  erros: number;
  resultados: ImportResult[];
}

/**
 * Hook para importar oficinas em lote
 */
export function useImportOficinas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      oficinas: OficinaImportProcessada[]
    ): Promise<ImportSummary> => {
      const resultados: ImportResult[] = [];
      const oficinasValidas = oficinas.filter((o) => o.valida);

      // Buscar CNPJs já existentes no banco
      const cnpjs = oficinasValidas.map((o) => o.dados.cnpj);
      const { data: existentes } = await supabase
        .from('oficinas')
        .select('cnpj')
        .in('cnpj', cnpjs);

      const cnpjsExistentes = new Set(existentes?.map((e) => e.cnpj) || []);

      // Processar cada oficina
      for (const oficina of oficinasValidas) {
        const { linha, dados } = oficina;

        // Verificar se CNPJ já existe no banco
        if (cnpjsExistentes.has(dados.cnpj)) {
          resultados.push({
            linha,
            cnpj: dados.cnpj,
            razaoSocial: dados.razao_social,
            sucesso: false,
            erro: 'CNPJ já cadastrado no sistema',
          });
          continue;
        }

        // Inserir oficina
        const { error } = await supabase.from('oficinas').insert({
          razao_social: dados.razao_social,
          nome_fantasia: dados.nome_fantasia,
          cnpj: dados.cnpj,
          cep: dados.cep || null,
          logradouro: dados.logradouro || null,
          numero: dados.numero || null,
          bairro: dados.bairro || null,
          telefone: dados.telefone || null,
          cidade: dados.cidade,
          estado: dados.estado,
          status: 'ativo',
          especialidades: [],
        });

        if (error) {
          resultados.push({
            linha,
            cnpj: dados.cnpj,
            razaoSocial: dados.razao_social,
            sucesso: false,
            erro: error.message,
          });
        } else {
          resultados.push({
            linha,
            cnpj: dados.cnpj,
            razaoSocial: dados.razao_social,
            sucesso: true,
          });
          // Adicionar ao set para evitar duplicatas no mesmo lote
          cnpjsExistentes.add(dados.cnpj);
        }
      }

      const sucesso = resultados.filter((r) => r.sucesso).length;
      const erros = resultados.filter((r) => !r.sucesso).length;

      return {
        total: resultados.length,
        sucesso,
        erros,
        resultados,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      if (data.sucesso > 0) {
        toast.success(`${data.sucesso} oficina(s) importada(s) com sucesso!`);
      }
      if (data.erros > 0) {
        toast.warning(`${data.erros} oficina(s) não puderam ser importadas.`);
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao importar oficinas: ' + error.message);
    },
  });
}

/**
 * Hook para verificar CNPJs existentes no banco
 */
export function useVerificarCNPJs() {
  return useMutation({
    mutationFn: async (cnpjs: string[]): Promise<Set<string>> => {
      const { data } = await supabase
        .from('oficinas')
        .select('cnpj')
        .in('cnpj', cnpjs);

      return new Set(data?.map((e) => e.cnpj) || []);
    },
  });
}
