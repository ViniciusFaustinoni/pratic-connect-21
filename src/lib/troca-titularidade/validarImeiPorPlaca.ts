import { supabase } from '@/integrations/supabase/client';

/**
 * Validação placa ↔ IMEI no Aprovar do Monitoramento (Troca de Titularidade).
 *
 * Confirma que o IMEI digitado pelo operador está fisicamente vinculado à placa
 * desta cotação consultando, em ordem:
 *   1. Softruck — busca veículo pela placa, lê devices do veículo e checa IMEI.
 *   2. Fallback Rede Veículos — busca dispositivo por IMEI e confirma vínculo
 *      com o veiculoId local (rede-veiculos-buscar-dispositivo faz upsert).
 *
 * Sem fallback permissivo: se as duas fontes falharem por erro de rede/5xx,
 * retorna `apis_indisponiveis` para bloquear a aprovação.
 *
 * Logs com prefixo `[VALIDACAO_IMEI_PLACA]`.
 */

const TAG = '[VALIDACAO_IMEI_PLACA]';

export type ValidacaoOrigem = 'softruck' | 'rede_veiculos';

export type ResultadoValidacaoImei =
  | { ok: true; origem: ValidacaoOrigem; rastreadorId: string | null }
  | { ok: false; motivo: 'imei_invalido'; mensagem: string }
  | { ok: false; motivo: 'imei_em_outra_placa'; mensagem: string; placaOutra: string | null }
  | { ok: false; motivo: 'nao_encontrado'; mensagem: string }
  | { ok: false; motivo: 'apis_indisponiveis'; mensagem: string };

interface Params {
  placa: string | null | undefined;
  imei: string | null | undefined;
  veiculoIdAlvo: string;
}

function sanPlaca(p?: string | null) {
  return (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function sanImei(i?: string | null) {
  return (i || '').replace(/\D/g, '');
}
function mascararImei(i: string) {
  if (i.length < 6) return i;
  return `${i.slice(0, 3)}***${i.slice(-3)}`;
}

async function checarConflitoLocal(imei: string, veiculoIdAlvo: string) {
  const { data: r } = await supabase
    .from('rastreadores')
    .select('id, veiculo_id, status')
    .eq('imei', imei)
    .maybeSingle();
  if (!r?.veiculo_id || r.veiculo_id === veiculoIdAlvo) return null;
  if ((r.status || '').toLowerCase() !== 'instalado') return null;
  const { data: v } = await supabase
    .from('veiculos')
    .select('placa, status')
    .eq('id', r.veiculo_id)
    .maybeSingle();
  if (!v || ['cancelado', 'inativo', 'vendido'].includes((v.status || '').toLowerCase())) return null;
  return { rastreadorId: r.id, placaOutra: v.placa || null };
}

export async function validarImeiPorPlaca({ placa, imei, veiculoIdAlvo }: Params): Promise<ResultadoValidacaoImei> {
  const placaSan = sanPlaca(placa);
  const imeiSan = sanImei(imei);
  const placaAtualLabel = placaSan || '(sem placa)';

  if (!/^\d{14,16}$/.test(imeiSan)) {
    return { ok: false, motivo: 'imei_invalido', mensagem: 'IMEI inválido. Deve ter 14 a 16 dígitos numéricos.' };
  }
  if (!veiculoIdAlvo) {
    return { ok: false, motivo: 'apis_indisponiveis', mensagem: 'Veículo da troca não identificado.' };
  }

  // Conflito local antes de chamar externas: IMEI já instalado em outro veículo ativo.
  const conflitoLocal = await checarConflitoLocal(imeiSan, veiculoIdAlvo);
  if (conflitoLocal) {
    console.log(TAG, 'conflito_local', { imei: mascararImei(imeiSan), placaOutra: conflitoLocal.placaOutra });
    return {
      ok: false,
      motivo: 'imei_em_outra_placa',
      mensagem: `IMEI ${imeiSan} está vinculado à placa ${conflitoLocal.placaOutra || '(desconhecida)'}, não bate com a placa ${placaAtualLabel} desta cotação`,
      placaOutra: conflitoLocal.placaOutra,
    };
  }
  // ===== 0) Estoque local: rastreador já cadastrado e identificado =====
  // Se o IMEI existe localmente como Softruck/Rede em estoque (ou já apontado para este veículo),
  // não precisamos depender das APIs externas — é fonte canônica.
  // Guard Anderson-like: pra origem='rede_veiculos' EXIGIMOS plataforma_device_id NOT NULL.
  // Sem ID externo, o rastreador foi criado por upsert legado e a Rede pode não tê-lo
  // sincronizado — cai pra API pra confirmar.
  try {
    const { data: rLocal0 } = await supabase
      .from('rastreadores')
      .select('id, veiculo_id, status, plataforma, plataforma_device_id')
      .eq('imei', imeiSan)
      .maybeSingle();
    if (rLocal0) {
      const plataforma = (rLocal0.plataforma || '').toLowerCase();
      const status = (rLocal0.status || '').toLowerCase();
      const livre = !rLocal0.veiculo_id || rLocal0.veiculo_id === veiculoIdAlvo
        || ['estoque', 'em_estoque', 'disponivel', 'disponível'].includes(status);
      const origem: ValidacaoOrigem | null =
        plataforma === 'rede_veiculos' ? 'rede_veiculos'
        : plataforma === 'softruck' ? 'softruck'
        : null;
      const idsOk = origem === 'rede_veiculos' ? !!rLocal0.plataforma_device_id : true;
      if (origem && livre && idsOk) {
        console.log(TAG, 'estoque_local_ok', { imei: mascararImei(imeiSan), plataforma, status });
        return { ok: true, origem, rastreadorId: rLocal0.id };
      }
      if (origem === 'rede_veiculos' && !idsOk) {
        console.warn(TAG, 'estoque_local_rede_sem_ids', { imei: mascararImei(imeiSan), id: rLocal0.id });
      }
    }
  } catch (e) {
    console.warn(TAG, 'estoque_local_falhou', e);
  }


  let softruckFalhou = false;
  let softruckPlacaEncontrada = false;

  // ===== 1) Softruck por placa → devices =====
  if (placaSan) {
    try {
      console.log(TAG, 'softruck.buscar-veiculo-placa', { placa: placaSan, imei: mascararImei(imeiSan) });
      const { data: porPlaca, error: ePlaca } = await supabase.functions.invoke('softruck-api', {
        body: { operation: 'buscar-veiculo-placa', data: { placa: placaSan } },
      });
      if (ePlaca) throw ePlaca;
      const lista = (porPlaca as any)?.data?.data || (porPlaca as any)?.data || [];
      const vehicleId = Array.isArray(lista) && lista[0]?.id ? lista[0].id : null;

      if (vehicleId) {
        softruckPlacaEncontrada = true;
        const { data: porId, error: eId } = await supabase.functions.invoke('softruck-api', {
          body: { operation: 'buscar-veiculo-id', data: { veiculoId: vehicleId } },
        });
        if (eId) throw eId;
        // Resposta padrão JSON:API: included[] com devices ou relationships
        const payload = (porId as any)?.data ?? porId;
        const included: any[] = payload?.included || [];
        const devices = included.filter((i: any) => i?.type === 'device' || i?.type === 'devices');
        const match = devices.find((d: any) => sanImei(d?.attributes?.imei) === imeiSan);
        if (match) {
          console.log(TAG, 'softruck.match_ok', { placa: placaSan, imei: mascararImei(imeiSan) });
          // Faz upsert local via softruck-buscar-dispositivo para garantir rastreadores.id
          let rastreadorId: string | null = null;
          try {
            await supabase.functions.invoke('softruck-buscar-dispositivo', { body: { busca: imeiSan } });
            const { data: rLocal } = await supabase.from('rastreadores').select('id').eq('imei', imeiSan).maybeSingle();
            rastreadorId = rLocal?.id || null;
          } catch (e) {
            console.warn(TAG, 'softruck.upsert_local_falhou', e);
          }
          return { ok: true, origem: 'softruck', rastreadorId };
        }
        // Placa existe na Softruck mas IMEI digitado não está entre os devices dela.
        // Verifica se o IMEI existe em outra placa Softruck → caso B.
        try {
          const { data: porImei } = await supabase.functions.invoke('softruck-api', {
            body: { operation: 'buscar-device-imei', data: { imei: imeiSan } },
          });
          const listaImei = (porImei as any)?.data?.data || (porImei as any)?.data || [];
          const devOutro = Array.isArray(listaImei) ? listaImei[0] : null;
          const placaOutra = devOutro?.relationships?.vehicle?.data?.id
            ? (devOutro?.included?.find?.((i: any) => i?.type === 'vehicle')?.attributes?.plate || null)
            : (devOutro?.attributes?.vehicle_plate || null);
          if (devOutro) {
            console.log(TAG, 'softruck.imei_em_outra_placa', { imei: mascararImei(imeiSan), placaOutra });
            return {
              ok: false,
              motivo: 'imei_em_outra_placa',
              mensagem: `IMEI ${imeiSan} está vinculado à placa ${placaOutra || '(desconhecida)'}, não bate com a placa ${placaAtualLabel} desta cotação`,
              placaOutra,
            };
          }
        } catch (e) {
          console.warn(TAG, 'softruck.buscar-device-imei_falhou', e);
        }
      }
    } catch (e) {
      console.warn(TAG, 'softruck.erro', e);
      softruckFalhou = true;
    }
  }

  // ===== 2) Fallback Rede Veículos por IMEI =====
  let redeFalhou = false;
  let redeEncontrou = false;
  try {
    console.log(TAG, 'rede.buscar-dispositivo', { imei: mascararImei(imeiSan) });
    const { data, error } = await supabase.functions.invoke('rede-veiculos-buscar-dispositivo', {
      body: { busca: imeiSan },
    });
    if (error) throw error;
    if ((data as any)?.success && (data as any)?.found) {
      redeEncontrou = true;
      // Upsert local já feito pela edge. Lê vínculo:
      const { data: rLocal } = await supabase
        .from('rastreadores')
        .select('id, veiculo_id, status')
        .eq('imei', imeiSan)
        .maybeSingle();
      if (rLocal?.veiculo_id && rLocal.veiculo_id === veiculoIdAlvo) {
        console.log(TAG, 'rede.match_ok', { imei: mascararImei(imeiSan) });
        return { ok: true, origem: 'rede_veiculos', rastreadorId: rLocal.id };
      }
      if (rLocal?.veiculo_id && (rLocal.status || '').toLowerCase() === 'instalado') {
        const { data: vOutro } = await supabase
          .from('veiculos')
          .select('placa, status')
          .eq('id', rLocal.veiculo_id)
          .maybeSingle();
        const ativoOutro = vOutro && !['cancelado', 'inativo', 'vendido'].includes((vOutro.status || '').toLowerCase());
        if (ativoOutro) {
          return {
            ok: false,
            motivo: 'imei_em_outra_placa',
            mensagem: `IMEI ${imeiSan} está vinculado à placa ${vOutro?.placa || '(desconhecida)'}, não bate com a placa ${placaAtualLabel} desta cotação`,
            placaOutra: vOutro?.placa || null,
          };
        }
      }
      // Encontrado na Rede mas sem vínculo de veículo → não bate com a placa atual.
      // Sem confirmação de vínculo placa↔IMEI: trata como não encontrado para a placa.
    }
  } catch (e) {
    console.warn(TAG, 'rede.erro', e);
    redeFalhou = true;
  }

  // ===== Conclusão =====
  if (softruckFalhou && redeFalhou) {
    return {
      ok: false,
      motivo: 'apis_indisponiveis',
      mensagem: 'Não foi possível validar o IMEI agora. Tente novamente em alguns minutos.',
    };
  }

  // Pelo menos uma fonte respondeu, mas IMEI não casou com a placa.
  console.log(TAG, 'nao_encontrado', {
    imei: mascararImei(imeiSan),
    placa: placaAtualLabel,
    softruckPlacaEncontrada,
    redeEncontrou,
  });
  return {
    ok: false,
    motivo: 'nao_encontrado',
    mensagem: 'IMEI não encontrado na Softruck nem na Rede Veículos',
  };
}
