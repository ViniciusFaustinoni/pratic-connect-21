import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DadosCliente {
  nome: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  sexo: string | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
}

export interface DadosEndereco {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

export interface DadosVeiculo {
  placa: string | null;
  chassi: string | null;
  renavam: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  combustivel: string | null;
  categoria: string | null;
  especie: string | null;
  capacidade: string | null;
  potencia: string | null;
  cilindradas: string | null;
}

export interface DocumentoProcessado {
  tipo: string;
  legivel: boolean;
  confianca_geral: number;
  dados: Record<string, unknown>;
}

export interface ResultadoExtracao {
  documentos: DocumentoProcessado[];
  dados_consolidados: {
    cliente: DadosCliente;
    endereco: DadosEndereco;
    veiculo: DadosVeiculo;
  };
  campos_faltantes: string[];
  avisos: string[];
}

interface ExtrairDadosParams {
  urls: string[];
}

export function useExtrairDadosDocumentos() {
  return useMutation({
    mutationFn: async ({ urls }: ExtrairDadosParams): Promise<ResultadoExtracao> => {
      const { data, error } = await supabase.functions.invoke('extrair-dados-documentos', {
        body: { urls },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao processar documentos');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as ResultadoExtracao;
    },
  });
}
