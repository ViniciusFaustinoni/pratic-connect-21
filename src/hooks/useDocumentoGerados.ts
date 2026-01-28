import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentoGeradoView {
  id: string;
  template_id: string;
  associado_id: string;
  numero_documento: string | null;
  dados_utilizados: Record<string, unknown>;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  gerado_por: string | null;
  gerado_em: string;
  assinado: boolean;
  assinado_em: string | null;
  assinatura_ip: string | null;
  autentique_id: string | null;
  template?: {
    id: string;
    nome: string;
    codigo: string;
    categoria?: {
      id: string;
      nome: string;
      cor: string;
    } | null;
  } | null;
  associado?: {
    id: string;
    nome: string;
    cpf: string;
  } | null;
  gerado_por_profile?: {
    id: string;
    nome: string;
  } | null;
}

export interface FiltrosHistorico {
  periodo?: string;
  categoria?: string;
  busca?: string;
}

// Hook para buscar documentos gerados
export function useDocumentoGerados(filtros?: FiltrosHistorico) {
  return useQuery({
    queryKey: ['documento-gerados', filtros],
    queryFn: async () => {
      let query = supabase
        .from('documento_gerados')
        .select(`
          *,
          template:documento_templates(id, nome, codigo, categoria:documento_categorias(id, nome, cor)),
          associado:associados(id, nome, cpf),
          gerado_por_profile:profiles!documento_gerados_gerado_por_fkey(id, nome)
        `)
        .order('gerado_em', { ascending: false });
      
      // Aplicar filtros de período
      if (filtros?.periodo && filtros.periodo !== 'todos') {
        const agora = new Date();
        let dataInicio: Date | null = null;

        switch (filtros.periodo) {
          case 'hoje':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
          case '7dias':
            dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30dias':
            dataInicio = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'mes':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            break;
        }

        if (dataInicio) {
          query = query.gte('gerado_em', dataInicio.toISOString());
        }
      }

      // Aplicar filtro de categoria (via template)
      // Nota: filtro por categoria será feito no frontend pois o Supabase não suporta filtro nested direto
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let resultado = data as unknown as DocumentoGeradoView[];

      // Filtrar por categoria no frontend
      if (filtros?.categoria && filtros.categoria !== 'todos') {
        resultado = resultado.filter(
          (d) => d.template?.categoria?.nome === filtros.categoria
        );
      }

      // Filtrar por busca
      if (filtros?.busca && filtros.busca.length > 0) {
        const termoBusca = filtros.busca.toLowerCase();
        resultado = resultado.filter(
          (d) =>
            d.associado?.nome?.toLowerCase().includes(termoBusca) ||
            d.template?.nome?.toLowerCase().includes(termoBusca) ||
            d.numero_documento?.toLowerCase().includes(termoBusca)
        );
      }

      return resultado;
    },
  });
}

// Hook para estatísticas de documentos
export function useEstatisticasDocumentos() {
  return useQuery({
    queryKey: ['documento-estatisticas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento_gerados')
        .select('id, gerado_em, assinado');

      if (error) throw error;

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const total = data?.length || 0;
      const esteMes = data?.filter((d) => new Date(d.gerado_em) >= inicioMes).length || 0;
      const assinados = data?.filter((d) => d.assinado).length || 0;
      const pendentes = data?.filter((d) => !d.assinado).length || 0;

      return { total, esteMes, assinados, pendentes };
    },
  });
}

// Hook para deletar documento gerado
export function useDeleteDocumentoGerado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Primeiro buscar o documento para obter o path do arquivo
      const { data: doc } = await supabase
        .from('documento_gerados')
        .select('arquivo_url')
        .eq('id', id)
        .single();

      // Deletar do storage se existir
      if (doc?.arquivo_url) {
        try {
          // Extrair path do URL
          const urlParts = doc.arquivo_url.split('/documentos/');
          if (urlParts[1]) {
            await supabase.storage.from('documentos').remove([urlParts[1]]);
          }
        } catch (e) {
          console.warn('Erro ao remover arquivo do storage:', e);
        }
      }

      // Deletar registro
      const { error } = await supabase
        .from('documento_gerados')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Documento excluído!');
      queryClient.invalidateQueries({ queryKey: ['documento-gerados'] });
      queryClient.invalidateQueries({ queryKey: ['documento-estatisticas'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });
}
