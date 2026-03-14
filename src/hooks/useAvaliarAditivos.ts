import { useMemo } from 'react';
import { useAditivos, type TermoAditivo, type RegraAditivo } from './useAditivos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VeiculoParaAvaliacao {
  placa?: string;
  procedencia?: string;
  valorFipe?: number;
  observacoes?: string;
  blindado?: boolean;
  combustivel?: string;
  tipo?: 'carro' | 'moto';
  tipoUso?: string;
  instalacaoMesmoDia?: boolean;
  grupo?: string;
  categoriaVeiculo?: string; // 'leilao' | 'chassi_remarcado' | 'ex_taxi' | 'placa_vermelha'
  rastreadorTerceiros?: boolean;
  proprietarioNome?: string;
  associadoNome?: string;
}

export interface ContratoParaAvaliacao {
  emReativacao?: boolean;
  inadimplenciaDias?: number;
}

export interface SinistroParaAvaliacao {
  tipoEvento?: string;
  comBombeiros?: boolean;
  reparoAprovado?: boolean;
}

export interface BeneficiosContratados {
  codigos: string[]; // e.g. ['VIDROS_FAROIS', 'KIT_GAS', 'TERCEIROS_40', 'CARRO_RESERVA_7', ...]
}

function avaliarRegra(
  regra: RegraAditivo,
  veiculo: VeiculoParaAvaliacao,
  fipeLimite: number,
  configRastreador?: { fipeMinCarro: number; fipeMinMoto: number },
  beneficios?: BeneficiosContratados,
  contrato?: ContratoParaAvaliacao,
  sinistro?: SinistroParaAvaliacao,
): boolean {
  if (!regra.ativo) return false;

  switch (regra.tipo) {
    case 'veiculo_0km':
      return !veiculo.placa || 
        veiculo.placa === '' || 
        veiculo.placa.startsWith('000') ||
        veiculo.procedencia === 'Novo (zero km)';
    
    case 'fipe_acima_de':
      return (veiculo.valorFipe || 0) >= fipeLimite;
    
    case 'evento_vidros':
      // Avaliação real é feita no backend (edge function)
      return false;
    
    case 'veiculo_blindado':
      return veiculo.blindado === true;

    // ===== REGRAS POR CARACTERÍSTICA DO VEÍCULO =====

    case 'rastreador_obrigatorio': {
      const fipe = veiculo.valorFipe || 0;
      const combustivel = (veiculo.combustivel || '').toLowerCase();
      // Diesel → sempre exige
      if (combustivel === 'diesel') return true;
      // Moto com FIPE >= limite moto
      if (veiculo.tipo === 'moto') {
        const limMoto = configRastreador?.fipeMinMoto ?? 9000;
        return fipe >= limMoto;
      }
      // Carro/passeio com FIPE >= limite carro
      const limCarro = configRastreador?.fipeMinCarro ?? 30000;
      return fipe >= limCarro;
    }

    case 'rastreador_movel':
      return veiculo.instalacaoMesmoDia === false;

    case 'veiculo_aplicativo': {
      const uso = (veiculo.tipoUso || '').toLowerCase();
      return uso.includes('app') || uso.includes('uber') || uso.includes('táxi') || uso.includes('taxi') || uso.includes('aplicativo');
    }

    // ===== REGRAS POR BENEFÍCIO CONTRATADO =====

    case 'beneficio_vidros':
      return (beneficios?.codigos || []).some(c => c.includes('VIDROS'));

    case 'beneficio_kit_gas':
      return (beneficios?.codigos || []).some(c => c.includes('KIT_GAS'));

    case 'beneficio_danos_terceiros':
      return (beneficios?.codigos || []).some(c => c.includes('TERCEIROS'));

    case 'beneficio_carro_reserva':
      return (beneficios?.codigos || []).some(c => c.includes('CARRO_RESERVA'));

    case 'beneficio_reboque_excedente':
      return (beneficios?.codigos || []).some(c => c.includes('REBOQUE_EXCEDENTE'));

    case 'beneficio_carencia_zero':
      return (beneficios?.codigos || []).some(c => c.includes('CARENCIA_ZERO'));

    // ===== REGRAS POR SINISTRO/EVENTO =====

    case 'evento_sub_rogacao':
      return !!sinistro?.tipoEvento;

    case 'evento_aprovacao_conserto':
      return sinistro?.reparoAprovado === true;

    case 'evento_incendio':
      return sinistro?.tipoEvento?.toLowerCase().includes('incêndio') === true && sinistro?.comBombeiros === false;

    // ===== REGRAS POR GRUPO/CATEGORIA ESPECIAL =====

    case 'grupo_raridades_especial': {
      const grupo = (veiculo.grupo || '').toLowerCase();
      return grupo.includes('raridade') || grupo.includes('especial');
    }

    case 'categoria_depreciacao': {
      const cat = (veiculo.categoriaVeiculo || '').toLowerCase();
      return cat.includes('leilao') || cat.includes('leilão') || cat.includes('chassi_remarcado') || cat.includes('ex_taxi') || cat.includes('placa_vermelha');
    }

    // ===== GESTÃO DE EQUIPAMENTO =====

    case 'rastreador_terceiros':
      return veiculo.rastreadorTerceiros === true;

    // ===== MANUTENÇÃO/ATUALIZAÇÃO =====

    case 'opcao_atualizacao_fipe':
      return true; // Sempre disponível para formalização

    case 'vistoria_reativacao':
      return contrato?.emReativacao === true || (contrato?.inadimplenciaDias || 0) > 5;

    // ===== PROPRIEDADE TERCEIRA =====

    case 'anuencia_proprietario': {
      const prop = (veiculo.proprietarioNome || '').trim().toLowerCase();
      const assoc = (veiculo.associadoNome || '').trim().toLowerCase();
      return prop !== '' && assoc !== '' && prop !== assoc;
    }

    default:
      return false;
  }
}

export function useAvaliarAditivos(
  veiculo: VeiculoParaAvaliacao | null,
  beneficios?: BeneficiosContratados,
  contrato?: ContratoParaAvaliacao,
  sinistro?: SinistroParaAvaliacao,
) {
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

  const { data: configRastreador } = useQuery({
    queryKey: ['config-rastreador-avaliacao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['operacional_fipe_minimo_rastreador', 'operacional_fipe_minimo_rastreador_moto']);
      const map: Record<string, string> = {};
      (data || []).forEach(r => { map[r.chave] = r.valor; });
      return {
        fipeMinCarro: Number(map['operacional_fipe_minimo_rastreador']) || 30000,
        fipeMinMoto: Number(map['operacional_fipe_minimo_rastreador_moto']) || 9000,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const resultado = useMemo(() => {
    if (!veiculo || !aditivos.length) return [];

    return aditivos.map((aditivo) => {
      const regras = (aditivo.regras || []) as RegraAditivo[];
      const regrasBatem = regras.some(r => avaliarRegra(r, veiculo, fipeLimite, configRastreador, beneficios, contrato, sinistro));
      return {
        aditivo,
        autoSelecionado: regrasBatem,
      };
    });
  }, [aditivos, veiculo, fipeLimite, configRastreador, beneficios, contrato, sinistro]);

  return {
    aditivosAvaliados: resultado,
    isLoading: loadingAditivos || loadingConfig,
    fipeLimite,
  };
}
