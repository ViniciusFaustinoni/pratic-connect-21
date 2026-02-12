import { useMemo } from 'react';
import { useAditivos, type TermoAditivo, type RegraAditivo } from './useAditivos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface VeiculoParaAvaliacao {
  placa?: string;
  procedencia?: string;
  blindado?: boolean;
  valorFipe?: number;
  observacoes?: string;
}

function avaliarRegra(regra: RegraAditivo, veiculo: VeiculoParaAvaliacao, fipeLimite: number): boolean {
  if (!regra.ativo) return false;

  switch (regra.tipo) {
    case 'veiculo_0km':
      return !veiculo.placa || 
        veiculo.placa === '' || 
        veiculo.placa.startsWith('000') ||
        veiculo.procedencia === 'Novo (zero km)';
    
    case 'veiculo_blindado':
      if (veiculo.blindado) return true;
      const obs = (veiculo.observacoes || '').toLowerCase();
      return obs.includes('blindad') || obs.includes('blindagem');
    
    case 'fipe_acima_de':
      return (veiculo.valorFipe || 0) >= fipeLimite;
    
    default:
      return false;
  }
}

export function useAvaliarAditivos(veiculo: VeiculoParaAvaliacao | null) {
  const { data: aditivos = [], isLoading: loadingAditivos } = useAditivos(true);

  const { data: fipeLimite = 100000, isLoading: loadingConfig } = useQuery({
    queryKey: ['config-aditivo-fipe-limite'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'aditivo_fipe_limite')
        .single();
      return data ? Number(data.valor) : 100000;
    },
  });

  const resultado = useMemo(() => {
    if (!veiculo || !aditivos.length) return [];

    return aditivos.map((aditivo) => {
      const regras = (aditivo.regras || []) as RegraAditivo[];
      const regrasBatem = regras.some(r => avaliarRegra(r, veiculo, fipeLimite));
      return {
        aditivo,
        autoSelecionado: regrasBatem,
      };
    });
  }, [aditivos, veiculo, fipeLimite]);

  return {
    aditivosAvaliados: resultado,
    isLoading: loadingAditivos || loadingConfig,
    fipeLimite,
  };
}
