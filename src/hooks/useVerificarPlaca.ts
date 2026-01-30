import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Informações de uma cotação existente para a mesma placa
 */
export interface PlacaDuplicadaInfo {
  cotacaoId: string;
  numero: string;
  vendedorId: string;
  vendedorNome: string;
  createdAt: string;
  status: string;
}

/**
 * Normaliza a placa removendo caracteres especiais e convertendo para uppercase
 */
const normalizarPlaca = (placa: string): string => {
  return placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
};

/**
 * Verifica se existe cotação ativa para a placa informada
 * 
 * Regras:
 * - Cotações ativas: status = rascunho, enviada, aceita
 * - Período: últimos 7 dias
 * - Retorna dados do vendedor responsável se existir
 */
export function useVerificarPlacaDuplicada() {
  return useMutation({
    mutationFn: async (placa: string): Promise<PlacaDuplicadaInfo | null> => {
      const placaNormalizada = normalizarPlaca(placa);
      
      if (!placaNormalizada || placaNormalizada.length < 7) {
        return null;
      }
      
      // Calcula data limite (7 dias atrás)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 7);
      
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          id,
          numero,
          vendedor_id,
          created_at,
          status,
          vendedor:profiles!cotacoes_vendedor_id_fkey(id, nome)
        `)
        .eq('veiculo_placa', placaNormalizada)
        .in('status', ['rascunho', 'enviada', 'aceita'])
        .gte('created_at', dataLimite.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Erro ao verificar placa duplicada:', error);
        return null;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      const cotacao = data[0];
      // O join pode retornar array, então pegamos o primeiro elemento
      const vendedorArray = cotacao.vendedor as unknown as Array<{ id: string; nome: string }> | null;
      const vendedor = vendedorArray?.[0] || null;
      
      return {
        cotacaoId: cotacao.id,
        numero: cotacao.numero || '',
        vendedorId: cotacao.vendedor_id || '',
        vendedorNome: vendedor?.nome || 'Vendedor não identificado',
        createdAt: cotacao.created_at,
        status: cotacao.status || '',
      };
    },
  });
}
