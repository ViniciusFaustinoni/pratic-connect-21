import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BeneficioAdicionalCotacao {
  id: string;
  codigo: string;
  nome: string;
  preco: number;
  categoria: string;
  descricao: string | null;
  linhas_permitidas: string[] | null;
}

/**
 * Busca benefícios adicionais ativos do banco para uso em cotação/substituição.
 * Substitui os arrays BENEFICIOS[] e FAIXAS_TERCEIROS hardcoded.
 */
export function useBeneficiosAdicionaisCotacao() {
  return useQuery({
    queryKey: ['beneficios_adicionais_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios_adicionais')
        .select('id, codigo, nome, preco, categoria, descricao')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data || []) as BeneficioAdicionalCotacao[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Retorna benefícios separados entre gerais e faixas de terceiros,
 * formatados para uso nos componentes StepBeneficios e StepFinanceiro.
 */
export function useBeneficiosSeparados() {
  const { data: todos, isLoading } = useBeneficiosAdicionaisCotacao();

  const beneficios = (todos || []).filter(b => b.categoria !== 'Terceiros');
  const faixasTerceiros = (todos || []).filter(b => b.categoria === 'Terceiros');

  // Mapa de preços por código (para compatibilidade com StepFinanceiro)
  const precosMap: Record<string, { nome: string; preco: number }> = {};
  for (const b of beneficios) {
    const key = codigoParaChave(b.codigo);
    precosMap[key] = { nome: b.nome, preco: b.preco };
  }

  // Faixas de terceiros como map por valor
  const terceirosMap: Record<string, { nome: string; preco: number }> = {};
  for (const f of faixasTerceiros) {
    const valor = extrairValorTerceiros(f.codigo);
    terceirosMap[valor] = { nome: formatarNomeTerceiros(f), preco: f.preco };
  }

  return { beneficios, faixasTerceiros, precosMap, terceirosMap, isLoading };
}

// Converte código do banco para chave usada nos componentes
function codigoParaChave(codigo: string): string {
  const mapa: Record<string, string> = {
    'VIDROS_FAROIS': 'cobertura_vidros',
    'REBOQUE_1000KM': 'reboque_1000km',
    'REBOQUE_EXCEDENTE': 'reboque_excedente',
    'KIT_GAS': 'kit_gas',
    'CARRO_RESERVA_7': 'carro_reserva_7',
    'CARRO_RESERVA_15': 'carro_reserva_15',
    'CARRO_RESERVA_30': 'carro_reserva_30',
    'RASTREADOR': 'rastreador_adicional',
    'COMBO_APP_CARRO': 'fipe_100_app',
    'CLUBE_GAS': 'clube_gas',
    'PROTECAO_PASSAGEIROS': 'protecao_passageiros',
  };
  return mapa[codigo] || codigo.toLowerCase();
}

function extrairValorTerceiros(codigo: string): string {
  // TERCEIROS_15 → 15000, TERCEIROS_40 → 40000, etc.
  const match = codigo.match(/TERCEIROS_(\d+)/);
  if (match) return String(parseInt(match[1]) * 1000);
  return codigo;
}

function formatarNomeTerceiros(b: BeneficioAdicionalCotacao): string {
  const match = b.codigo.match(/TERCEIROS_(\d+)/);
  if (match) {
    const valor = parseInt(match[1]) * 1000;
    return `R$ ${valor.toLocaleString('pt-BR')}`;
  }
  return b.nome;
}
