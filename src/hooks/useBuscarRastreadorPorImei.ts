import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Busca tri-fonte por IMEI: estoque local → Softruck → Rede Veículos.
 *
 * Reusa as edge functions `softruck-buscar-dispositivo` e `rede-veiculos-buscar-dispositivo`
 * que JÁ fazem upsert local em `rastreadores`. Por isso, depois de qualquer
 * "found", o registro existe localmente e pode ser vinculado.
 *
 * Retorna o `rastreador` local (após upsert) + a `origem` onde foi encontrado +
 * um flag `conflito` quando o IMEI já está instalado em outro veículo ativo.
 *
 * Canônico para uso no Monitoramento (Troca de Titularidade + Aprovação de Associados).
 */
export type OrigemRastreador = 'estoque' | 'softruck' | 'rede_veiculos';

export interface ResultadoBuscaImei {
  origem: OrigemRastreador;
  rastreador: {
    id: string;
    imei: string;
    codigo: string | null;
    plataforma: string | null;
    status: string | null;
    veiculo_id: string | null;
    associado_id: string | null;
  };
  conflito?: {
    veiculo_id: string;
    placa: string | null;
    associado_nome: string | null;
  };
}

async function fetchLocalPorImei(imei: string) {
  const { data } = await supabase
    .from('rastreadores')
    .select('id, imei, codigo, plataforma, status, veiculo_id, associado_id')
    .eq('imei', imei)
    .maybeSingle();
  return data;
}

async function checarConflito(
  rastreadorId: string,
  veiculoIdAlvo: string,
): Promise<ResultadoBuscaImei['conflito'] | undefined> {
  const { data: r } = await supabase
    .from('rastreadores')
    .select('veiculo_id, status')
    .eq('id', rastreadorId)
    .maybeSingle();
  if (!r?.veiculo_id) return undefined;
  if (r.veiculo_id === veiculoIdAlvo) return undefined;
  if (r.status !== 'instalado') return undefined;

  const { data: v } = await supabase
    .from('veiculos')
    .select('placa, status, associado:associados(nome)')
    .eq('id', r.veiculo_id)
    .maybeSingle();
  // Só bloqueia se o outro veículo ainda estiver ativo/em_uso
  if (!v || ['cancelado', 'inativo', 'vendido'].includes((v.status || '').toLowerCase())) {
    return undefined;
  }
  return {
    veiculo_id: r.veiculo_id,
    placa: v.placa || null,
    associado_nome: (v.associado as any)?.nome || null,
  };
}

export function useBuscarRastreadorPorImei() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoBuscaImei | null>(null);

  const buscar = async (imei: string, veiculoIdAlvo: string): Promise<ResultadoBuscaImei | null> => {
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const imeiLimpo = imei.trim();
      if (!/^\d{14,16}$/.test(imeiLimpo)) {
        setErro('IMEI inválido. Deve ter 14 a 16 dígitos numéricos.');
        return null;
      }

      // 1. Estoque local
      let local = await fetchLocalPorImei(imeiLimpo);
      let origem: OrigemRastreador = 'estoque';

      // Helper: chama a edge da Rede; se found (e não api_error mascarado), recarrega local
      const tentarRede = async (): Promise<boolean> => {
        try {
          const { data } = await supabase.functions.invoke('rede-veiculos-buscar-dispositivo', {
            body: { busca: imeiLimpo },
          });
          // Edge classifica erros: api_error/sync_disabled/api_unavailable/auth_error
          // não podem ser tratados como rastreador inexistente.
          if ((data as any)?.api_error || ((data as any)?.error_kind && (data as any).error_kind !== 'not_found')) {
            console.warn('[buscarImei] rede.api_error', (data as any)?.error_kind, (data as any)?.debug);
            return false;
          }
          if (data?.success && data?.found) {
            local = await fetchLocalPorImei(imeiLimpo);
            origem = 'rede_veiculos';
            return true;
          }
        } catch (e) {
          console.warn('[buscarImei] rede falhou', e);
        }
        return false;
      };

      // 2. Softruck (upsert local em caso de found)
      let softruckRespondeuFound = false;
      let softruckAssetEmOutroVeiculo = false;
      if (!local) {
        try {
          const { data } = await supabase.functions.invoke('softruck-buscar-dispositivo', {
            body: { busca: imeiLimpo },
          });
          if (data?.success && data?.found) {
            softruckRespondeuFound = true;
            local = await fetchLocalPorImei(imeiLimpo);
            origem = 'softruck';
            // Se o asset Softruck está vinculado a OUTRO veículo, não confiar cegamente —
            // dá uma chance pra Rede dizer que ESTE IMEI pertence ao veículo alvo.
            if (local?.veiculo_id && local.veiculo_id !== veiculoIdAlvo) {
              softruckAssetEmOutroVeiculo = true;
            }
          }
        } catch (e) {
          console.warn('[buscarImei] softruck falhou', e);
        }
      }

      // 3. Rede Veículos
      //    - se Softruck não achou: rota normal
      //    - se Softruck achou mas o asset está em outro veículo: ainda consulta Rede
      //      pra evitar o viés que cravou plataforma=softruck para TUM3D59 (caso 26/05/26).
      if (!local || softruckAssetEmOutroVeiculo) {
        await tentarRede();
      }

      if (!local) {
        setErro(`IMEI ${imeiLimpo} não foi encontrado no estoque local, Softruck ou Rede Veículos.`);
        return null;
      }

      // Se Softruck disse found mas o registro local já tem plataforma='rede_veiculos'
      // (porque a edge da Rede atualizou depois), preferir Rede como origem.
      if (softruckRespondeuFound && (local.plataforma || '').toLowerCase() === 'rede_veiculos') {
        origem = 'rede_veiculos';
      }

      // Re-derivar origem se já existia localmente
      if (origem === 'estoque' && (local.plataforma || '').toLowerCase().includes('softruck')) {
        // mantém 'estoque' — significa "já tínhamos o registro"
      }

      const conflito = await checarConflito(local.id, veiculoIdAlvo);

      await qc.invalidateQueries({ queryKey: ['rastreadores'] });

      const r: ResultadoBuscaImei = { origem, rastreador: local as any, conflito };
      setResultado(r);
      return r;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResultado(null);
    setErro(null);
  };

  return { buscar, reset, loading, erro, resultado };
}
