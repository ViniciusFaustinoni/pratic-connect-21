import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WhatsAppTemplate, WhatsAppTemplateCategoria } from '@/types/whatsapp';

/**
 * Processa um template substituindo as variáveis pelos valores fornecidos
 * Exemplo: "Olá {{nome}}" + { nome: "João" } => "Olá João"
 */
export function processarTemplate(
  mensagem: string,
  variaveis: Record<string, string>
): string {
  let resultado = mensagem;
  
  Object.entries(variaveis).forEach(([chave, valor]) => {
    resultado = resultado.replace(
      new RegExp(`\\{\\{${chave}\\}\\}`, 'g'),
      valor || ''
    );
  });
  
  return resultado;
}

/**
 * Hook para buscar templates de WhatsApp
 * @param categoria - Filtrar por categoria (opcional)
 */
export function useWhatsAppTemplates(categoria?: WhatsAppTemplateCategoria) {
  return useQuery({
    queryKey: ['whatsapp-templates', categoria],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('ativo', true)
        .order('categoria')
        .order('nome');

      if (categoria) {
        query = query.eq('categoria', categoria);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });
}

/**
 * Hook para buscar um template específico pelo código
 * @param codigo - Código único do template
 */
export function useWhatsAppTemplate(codigo: string) {
  return useQuery({
    queryKey: ['whatsapp-template', codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('codigo', codigo)
        .eq('ativo', true)
        .single();

      if (error) throw error;
      return data as WhatsAppTemplate;
    },
    enabled: !!codigo,
  });
}
