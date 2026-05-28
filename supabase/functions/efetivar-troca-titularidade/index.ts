import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";
import {
  alterarAssociadoHinova,
  alterarSituacaoAssociadoHinova,
  alterarVeiculoHinova,
  buscarAssociadoComVeiculosPorCpf,
  buscarVeiculoPorChassi,
  buscarVeiculoPorPlaca,
  cadastrarAssociadoHinova,
  cadastrarOuAtualizarAssociadoHinova,
  cadastrarHistoricoAtendimentoHinova,
  cadastrarVeiculoHinova,
  escolherMelhorModeloHinova,
  getHinovaSession,
  HinovaNotFoundError,
  listarModelosHinova,
} from "../_shared/hinova-client.ts";
import { insertAuditLog } from '../_shared/auditLog.ts';
import { buildAssociadoPayload, variantesCodigoFipe } from '../_shared/hinova-payloads.ts';
import { resolverDiaVencimento } from '../_shared/vencimento-utils.ts';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// SOFTRUCK — Resolução resiliente do vehicleId + reaponte de usuário
// ============================================================
// Helper extraído para permitir reuso entre o fluxo principal e o modo
// `retry_softruck` (drenado pelo cron-softruck-troca-retry). Sem isso, casos
// como SRZ2E82 (28/05/26) ficavam efetivados localmente mas com vínculo
// errado na Softruck, porque o branch inline desistia quando
// `veiculos.softruck_vehicle_id` estava NULL.
async function resolverSoftruckVehicleId(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  veiculoId: string,
  rastreador: { id: string; imei: string | null; plataforma_device_id: string | null; plataforma_veiculo_id: string | null } | null,
  placa: string | null,
  // deno-lint-ignore no-explicit-any
  callSoftruck: (op: string, payload: unknown) => Promise<any>,
): Promise<string | null> {
  // 1) Cache local em veiculos
  const { data: veicSoft } = await supabase
    .from("veiculos")
    .select("softruck_vehicle_id")
    .eq("id", veiculoId)
    .maybeSingle();
  if ((veicSoft as any)?.softruck_vehicle_id) {
    return String((veicSoft as any).softruck_vehicle_id);
  }

  // 2) plataforma_veiculo_id do rastreador
  if (rastreador?.plataforma_veiculo_id) {
    const vId = String(rastreador.plataforma_veiculo_id);
    await supabase.from("veiculos").update({ softruck_vehicle_id: vId }).eq("id", veiculoId);
    return vId;
  }

  // Helper p/ extrair lista de JSON:API
  // deno-lint-ignore no-explicit-any
  const extractItems = (resp: any): any[] => {
    const inner = resp?.data ?? resp;
    const arr = inner?.data ?? inner;
    return Array.isArray(arr) ? arr : [];
  };
  // deno-lint-ignore no-explicit-any
  const extractVehicleIdFromDevice = (dev: any): string | null => {
    return (
      dev?.relationships?.vehicle?.id ||
      dev?.relationships?.vehicle?.data?.id ||
      null
    );
  };

  // 3) Lookup por deviceId
  if (rastreador?.plataforma_device_id) {
    try {
      const r = await callSoftruck("buscar-device-id", { deviceId: rastreador.plataforma_device_id });
      const items = extractItems(r);
      const dev = items[0] ?? (r as any)?.data?.data ?? (r as any)?.data;
      const vId = extractVehicleIdFromDevice(dev);
      if (vId) {
        await persistVehicleIdResolved(supabase, veiculoId, rastreador.id, String(vId));
        return String(vId);
      }
    } catch (e) {
      console.warn("[softruck-resolver] buscar-device-id falhou:", (e as Error)?.message);
    }
  }

  // 4) Lookup por IMEI
  if (rastreador?.imei) {
    try {
      const r = await callSoftruck("buscar-device-imei", { imei: rastreador.imei });
      const items = extractItems(r);
      const dev = items[0] ?? null;
      const vId = extractVehicleIdFromDevice(dev);
      if (vId) {
        await persistVehicleIdResolved(supabase, veiculoId, rastreador.id, String(vId));
        return String(vId);
      }
    } catch (e) {
      console.warn("[softruck-resolver] buscar-device-imei falhou:", (e as Error)?.message);
    }
  }

  // 5) Lookup por placa
  if (placa) {
    try {
      const r = await callSoftruck("buscar-veiculo-placa", { placa });
      const items = extractItems(r);
      const veh = items[0];
      const vId = veh?.id ? String(veh.id) : null;
      if (vId) {
        await persistVehicleIdResolved(supabase, veiculoId, rastreador?.id ?? null, vId);
        return vId;
      }
    } catch (e) {
      console.warn("[softruck-resolver] buscar-veiculo-placa falhou:", (e as Error)?.message);
    }
  }

  return null;
}

async function persistVehicleIdResolved(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  veiculoId: string,
  rastreadorId: string | null,
  vehicleId: string,
) {
  await supabase.from("veiculos").update({ softruck_vehicle_id: vehicleId }).eq("id", veiculoId);
  if (rastreadorId) {
    await supabase
      .from("rastreadores")
      .update({ plataforma_veiculo_id: vehicleId })
      .eq("id", rastreadorId);
  }
  console.log(`[softruck-resolver] vehicleId resolvido e persistido: veiculo=${veiculoId} vehicleId=${vehicleId}`);
}

/**
 * Executa o reaponte de usuário Softruck para a troca de titularidade:
 *   - resolve user_id do novo titular (busca por CPF/email → cria se não existir)
 *   - lista usuários atuais do veículo
 *   - remove vínculos antigos
 *   - cria vínculo novo
 *
 * Retorna `{ ok, status, etapa_falha?, msg? }`. Não enfileira sozinha — chamador
 * decide enqueue/log conforme contexto (fluxo principal vs retry).
 */
async function executarSoftruckTrocaVinculo(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  veiculoId: string,
  novoAssociadoId: string,
): Promise<
  | { ok: true; status: "feito" | "noop" | "sem_vehicle_id" | "sem_rastreador" | "sem_identificador_novo"; vehicleId?: string; userId?: string }
  | { ok: false; etapa: "resolve_user" | "listar" | "desassociar" | "associar" | "resolver_vehicle_id"; msg: string }
> {
  // Rastreador físico instalado (canônico). Sem ele, não há sentido em reapontar
  // vínculo de equipamento na plataforma.
  const { data: rastrInstalado } = await supabase
    .from("rastreadores")
    .select("id, imei, plataforma, plataforma_device_id, plataforma_veiculo_id, status")
    .eq("veiculo_id", veiculoId)
    .eq("status", "instalado")
    .maybeSingle();

  if (!rastrInstalado || ((rastrInstalado as any)?.plataforma || "").toLowerCase() !== "softruck") {
    return { ok: true, status: "sem_rastreador" };
  }

  // Hook de teste
  // deno-lint-ignore no-explicit-any
  const callSoftruck =
    (globalThis as any).__softruckTrocaVinculoOverride ??
    ((operation: string, payload: unknown) =>
      supabase.functions.invoke("softruck-api", { body: { operation, data: payload } }));

  // Resolve vehicleId com cadeia de fallback
  const { data: vRow } = await supabase
    .from("veiculos")
    .select("placa")
    .eq("id", veiculoId)
    .maybeSingle();

  const vehicleId = await resolverSoftruckVehicleId(
    supabase,
    veiculoId,
    rastrInstalado as any,
    (vRow as any)?.placa || null,
    callSoftruck,
  );

  if (!vehicleId) {
    return { ok: false, etapa: "resolver_vehicle_id", msg: "Não foi possível resolver vehicleId na Softruck (rastreador/IMEI/placa)" };
  }

  // Novo titular: dados pessoais
  const { data: novoAssoc } = await supabase
    .from("associados")
    .select("nome, cpf, email, telefone")
    .eq("id", novoAssociadoId)
    .maybeSingle();

  const cpfNovo = ((novoAssoc as any)?.cpf || "").replace(/\D/g, "");
  const emailNovo = (novoAssoc as any)?.email as string | undefined;
  const nomeNovo = (novoAssoc as any)?.nome as string | undefined;
  const telNovo = (novoAssoc as any)?.telefone as string | undefined;

  if (!cpfNovo && !emailNovo) {
    return { ok: true, status: "sem_identificador_novo" };
  }

  // deno-lint-ignore no-explicit-any
  const extractItems = (resp: any): any[] => {
    const inner = resp?.data ?? resp;
    const arr = inner?.data ?? inner;
    return Array.isArray(arr) ? arr : [];
  };

  // ===== Passo 1: resolver/criar usuário Softruck do novo titular =====
  let novoUserId: string | undefined;
  try {
    let found: any[] = [];
    if (cpfNovo) {
      const r1 = await callSoftruck("buscar-usuario", { cpf: cpfNovo });
      if ((r1 as any)?.error) throw new Error(JSON.stringify((r1 as any).error));
      found = extractItems(r1);
    }
    if (found.length === 0 && emailNovo) {
      const r2 = await callSoftruck("buscar-usuario", { email: emailNovo });
      if ((r2 as any)?.error) throw new Error(JSON.stringify((r2 as any).error));
      found = extractItems(r2);
    }
    if (found.length > 0) {
      novoUserId = String(found[0]?.id ?? found[0]?.user?.id);
    } else {
      const created = await callSoftruck("criar-usuario", {
        username: emailNovo || cpfNovo,
        email: emailNovo,
        nome: nomeNovo,
        telefone: telNovo,
        cpf: cpfNovo,
      });
      if ((created as any)?.error) throw new Error(JSON.stringify((created as any).error));
      const cItems = extractItems(created);
      novoUserId = String(
        cItems[0]?.id ?? (created as any)?.data?.data?.id ?? (created as any)?.data?.id ?? "",
      ) || undefined;
    }
    if (!novoUserId) throw new Error("user_id não retornado pela Softruck após buscar/criar");
  } catch (e) {
    return { ok: false, etapa: "resolve_user", msg: (e as Error)?.message ?? String(e) };
  }

  // ===== Passo 2: listar vínculos atuais =====
  let antigosAssocIds: string[] = [];
  let novoJaVinculado = false;
  try {
    const lst = await callSoftruck("listar-usuarios-veiculo", { vehicleId });
    if ((lst as any)?.error) throw new Error(JSON.stringify((lst as any).error));
    const items = extractItems(lst);
    for (const it of items) {
      const uid = String(it?.user?.id ?? it?.attributes?.user_id ?? "");
      const aid = String(it?.id ?? "");
      if (!aid) continue;
      if (uid && uid === novoUserId) novoJaVinculado = true;
      else antigosAssocIds.push(aid);
    }
    if (novoJaVinculado && antigosAssocIds.length === 0) {
      return { ok: true, status: "noop", vehicleId, userId: novoUserId };
    }
  } catch (e) {
    return { ok: false, etapa: "listar", msg: (e as Error)?.message ?? String(e) };
  }

  // ===== Passo 3: remover vínculos antigos =====
  try {
    for (const assocId of antigosAssocIds) {
      const del = await callSoftruck("desassociar-usuario-veiculo", { associationId: assocId });
      if ((del as any)?.error) throw new Error(JSON.stringify((del as any).error));
    }
  } catch (e) {
    return { ok: false, etapa: "desassociar", msg: (e as Error)?.message ?? String(e) };
  }

  // ===== Passo 4: associar novo (se faltar) =====
  if (!novoJaVinculado) {
    try {
      const created = await callSoftruck("associar-usuario-veiculo", { userId: novoUserId, vehicleId });
      if ((created as any)?.error) throw new Error(JSON.stringify((created as any).error));
    } catch (e) {
      return { ok: false, etapa: "associar", msg: (e as Error)?.message ?? String(e) };
    }
  }

  return { ok: true, status: "feito", vehicleId, userId: novoUserId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ success: false, error: "Configuração ausente" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { solicitacao_id, cenario_override, retry_sga, retry_softruck } = body;

    if (!solicitacao_id) {
      return new Response(JSON.stringify({ success: false, error: "solicitacao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: troca expirada não pode ser efetivada
    {
      const { data: trocaGuard } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("status")
        .eq("id", solicitacao_id)
        .maybeSingle();
      if (trocaGuard?.status === "expirada") {
        return new Response(JSON.stringify({ success: false, error: "Solicitação expirada — abrir nova cotação." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================
    // RETRY SOFTRUCK — reexecuta SOMENTE o reaponte de usuário na Softruck.
    //   Usado pelo cron-softruck-troca-retry para drenar sga_sync_queue
    //   onde etapa_parou começa com 'troca_titularidade:softruck_'.
    // ============================================
    if (retry_softruck) {
      console.log(`[efetivar-troca][retry-softruck] Iniciando retry para ${solicitacao_id}`);
      const { data: troca } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("id, status, novo_associado_id, veiculo_id")
        .eq("id", solicitacao_id)
        .maybeSingle();

      if (!troca || !troca.novo_associado_id || !troca.veiculo_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação sem novo titular/veículo para retry Softruck" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await executarSoftruckTrocaVinculo(supabase, troca.veiculo_id, troca.novo_associado_id);

      if (res.ok) {
        console.log(`[SOFTRUCK_TROCA_VINCULO_OK][retry] sol=${solicitacao_id} status=${res.status}`);
        // Limpa pendências dessa solicitação no sga_sync_queue
        await supabase
          .from("sga_sync_queue")
          .update({ status: "concluido", ultima_tentativa_em: new Date().toISOString(), erro_ultimo: null })
          .eq("origem", "troca_titularidade")
          .eq("veiculo_id", troca.veiculo_id)
          .eq("associado_id", troca.novo_associado_id)
          .in("status", ["pendente", "processando", "falha_permanente"])
          .like("etapa_parou", "troca_titularidade:softruck%");
        try {
          await insertAuditLog(supabase, {
            acao: "criar",
            modulo: "monitoramento",
            descricao: `[SOFTRUCK_TROCA_VINCULO_OK] retry sol=${solicitacao_id} status=${res.status}${(res as any).vehicleId ? ` vehicleId=${(res as any).vehicleId}` : ""}${(res as any).userId ? ` userId=${(res as any).userId}` : ""}`,
            tabela: "solicitacoes_troca_titularidade",
            registro_id: solicitacao_id,
            dados_novos: { retry: true, ...res },
          });
        } catch { /* não bloqueia */ }
        return new Response(
          JSON.stringify({ success: true, retry: "softruck", ...res }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        const etapaFila = res.etapa === "associar" ? "softruck_recriar_vinculo" : "softruck_reaponte_usuario";
        console.error(`[FALHA_SOFTRUCK_TROCA_VINCULO][retry] sol=${solicitacao_id} etapa=${res.etapa} msg=${res.msg}`);
        await supabase.from("sga_sync_queue").insert({
          associado_id: troca.novo_associado_id,
          veiculo_id: troca.veiculo_id,
          status: "pendente",
          etapa_parou: `troca_titularidade:${etapaFila}`,
          erro_ultimo: `[retry] ${res.etapa}: ${res.msg}`,
          origem: "troca_titularidade",
        });
        return new Response(
          JSON.stringify({ success: false, retry: "softruck", ...res }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ============================================
    // RETRY SGA — reexecuta só a etapa Hinova quando a troca já está efetivada/liberada
    // ============================================
    if (retry_sga) {
      console.log(`[efetivar-troca][retry-sga] Iniciando retry para ${solicitacao_id}`);
      const { data: troca, error: trocaErr } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("id, status, novo_associado_id, veiculo_id, associado_antigo_id, novo_titular_dados")
        .eq("id", solicitacao_id)
        .maybeSingle();

      if (trocaErr || !troca) {
        return new Response(JSON.stringify({ success: false, error: "Solicitação de troca não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!troca.novo_associado_id || !troca.veiculo_id) {
        return new Response(JSON.stringify({ success: false, error: "Troca ainda não foi efetivada — não há novo associado/veículo para sincronizar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dadosNovo = (troca.novo_titular_dados || {}) as Record<string, string>;
      const cpfLimpo = (dadosNovo.cpf || "").replace(/\D/g, "");
      const { data: vehicleData } = await supabase
        .from("veiculos").select("placa, chassi, renavam, marca, modelo, ano_fabricacao, ano_modelo, cor, valor_fipe, codigo_fipe, codigo_modelo_hinova").eq("id", troca.veiculo_id).maybeSingle();

      let sgaCodAss: number | null = null;
      let sgaCodVeic: number | null = null;
      try {
        // Garantir associado SGA
        try {
          const busca = await buscarAssociadoComVeiculosPorCpf(await getHinovaSession(supabase), cpfLimpo);
          sgaCodAss = busca.codigo_associado;
        } catch (e) {
          if (!(e instanceof HinovaNotFoundError)) throw e;
        }
        if (!sgaCodAss) {
          // Hinova exige endereço completo (logradouro/bairro/cidade/estado/cep) no /associado/cadastrar.
          // Carrega o associado local e usa buildAssociadoPayload (canônico do sga-hinova-sync) em vez
          // de montar payload truncado (corrige "O campo ESTADO ... inválido" no retry da fila e8af6e01…).
          const { data: assRow } = await supabase
            .from('associados')
            .select('*')
            .eq('id', troca.novo_associado_id)
            .maybeSingle();
          if (!assRow) throw new Error(`Associado local ${troca.novo_associado_id} não encontrado para payload SGA`);
          const payloadA = buildAssociadoPayload(assRow as any, { data_contrato_iso: assRow.created_at ?? null });
          const cad = await cadastrarOuAtualizarAssociadoHinova(supabase, payloadA);
          if (cad.motivo === 'codigo_associado_nao_encontrado') {
            throw new Error(`[CODIGO_ASSOCIADO_NAO_ENCONTRADO] ${cad.mensagem}`);
          }
          if (!cad.ok || !cad.codigo) throw new Error(`SGA cadastrarOuAtualizarAssociado: ${cad.errors.join("; ") || cad.mensagem}`);
          sgaCodAss = cad.codigo;
          console.log(`[retry-sga][SGA] associado ${cad.codigo} via ${cad.via}`);

        }
        await supabase.from("associados").update({
          codigo_hinova: sgaCodAss, sincronizado_hinova: true, sincronizado_hinova_em: new Date().toISOString(),
        }).eq("id", troca.novo_associado_id);

        // Veículo — localiza no Hinova (chassi → fallback placa)
        let codVeicAtual: number | null = null;
        let codAssVeic: number | null = null;
        if (vehicleData?.chassi) {
          try {
            const found = await buscarVeiculoPorChassi(supabase, vehicleData.chassi);
            if (found.found) {
              codVeicAtual = Number(found.found.codigo_veiculo) || null;
              codAssVeic = Number(found.found.codigo_associado) || null;
            }
          } catch (e) { console.warn("[retry-sga] buscaVeicChassi:", (e as Error).message); }
        }
        if (!codVeicAtual && vehicleData?.placa) {
          try {
            const placaLimpa = String(vehicleData.placa).replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const found = await buscarVeiculoPorPlaca(supabase, placaLimpa);
            if (found.found) {
              codVeicAtual = Number(found.found.codigo_veiculo) || null;
              codAssVeic = Number(found.found.codigo_associado) || null;
            }
          } catch (e) { console.warn("[retry-sga] buscaVeicPlaca:", (e as Error).message); }
        }

        if (codVeicAtual && codAssVeic === sgaCodAss) {
          // Idempotência: já vinculado ao novo titular
          sgaCodVeic = codVeicAtual;
        } else if (codVeicAtual) {
          // CAMINHO CANÔNICO — troca de titularidade via POST /alterar/veiculo.
          // Preserva codigo_veiculo e o histórico do veículo no Hinova.
          // transferir_agregados: regra ainda em definição. Quando definida,
          // passar array de codigo_voluntario aqui (ver sga-hinova-sync linha ~283).
          const ra = await alterarVeiculoHinova(supabase, {
            codigo_veiculo: codVeicAtual,
            codigo_associado: sgaCodAss,
          });
          if (!ra.ok) {
            throw new Error(
              `SGA alterarVeiculo (troca titularidade) falhou: ${(ra.errors || []).join('; ') || ra.mensagem || `HTTP ${ra.status}`}`
            );
          }
          sgaCodVeic = codVeicAtual;
        } else {
          // FALLBACK DEGENERADO — veículo não existe no Hinova (titular antigo
          // nunca foi sincronizado). Só nesse caso cai no caminho legado de
          // cadastrar como novo. Não roda mais alterarSituacaoVeiculo(cancelado).
          console.warn('[retry-sga] veículo não encontrado no Hinova — caindo no fallback de cadastrar');
          const codGrupo = await getConfiguracaoNumero(supabase, "sga_codigo_grupo_produto_padrao", 0);
          const basePayloadVeiculo = {
            codigo_associado: sgaCodAss,
            codigo_tipo_veiculo: 1,
            placa: vehicleData?.placa,
            chassi: vehicleData?.chassi,
            renavam: vehicleData?.renavam || undefined,
            marca: vehicleData?.marca || undefined,
            modelo: vehicleData?.modelo || undefined,
            ano_fabricacao: vehicleData?.ano_fabricacao || undefined,
            ano_modelo: vehicleData?.ano_modelo || undefined,
            cor: vehicleData?.cor || undefined,
            valor_fipe: vehicleData?.valor_fipe || undefined,
            codigo_grupo_produto: codGrupo || undefined,
          };

          let cadVeic;
          const codigoModeloPersistido = Number((vehicleData as any)?.codigo_modelo_hinova || 0) || null;
          if (codigoModeloPersistido) {
            cadVeic = await cadastrarVeiculoHinova(supabase, {
              ...basePayloadVeiculo,
              codigo_modelo: codigoModeloPersistido,
            });
          }

          if (!(cadVeic?.ok && cadVeic?.codigo)) {
            const variantesFipe = variantesCodigoFipe((vehicleData as any)?.codigo_fipe || null);
            for (const variante of variantesFipe) {
              cadVeic = await cadastrarVeiculoHinova(supabase, {
                ...basePayloadVeiculo,
                codigo_fipe: variante,
              });
              if (cadVeic.ok && cadVeic.codigo) break;

              const detalhe = `${(cadVeic.errors || []).join(' ')} ${cadVeic.mensagem || ''}`.toLowerCase();
              const ehErroDeModelo = detalhe.includes('modelo enviado') || (detalhe.includes('modelo') && detalhe.includes('encontrado'));
              if (!ehErroDeModelo) break;
            }
          }

          if (!(cadVeic?.ok && cadVeic?.codigo)) {
            const detalhe = `${(cadVeic?.errors || []).join(' ')} ${cadVeic?.mensagem || ''}`.toLowerCase();
            const ehErroDeModelo = detalhe.includes('modelo enviado') || (detalhe.includes('modelo') && detalhe.includes('encontrado'));
            if (ehErroDeModelo) {
              const lookup = await listarModelosHinova(supabase, {
                marca: String(vehicleData?.marca || '').trim(),
                texto: String(vehicleData?.modelo || '').trim(),
                ano: (vehicleData as any)?.ano_modelo || (vehicleData as any)?.ano_fabricacao || null,
                tipo_veiculo: 1,
              });
              const melhor = escolherMelhorModeloHinova(
                lookup.items,
                String(vehicleData?.modelo || ''),
                (vehicleData as any)?.ano_modelo || (vehicleData as any)?.ano_fabricacao || null,
              );
              if (melhor?.codigo_modelo) {
                cadVeic = await cadastrarVeiculoHinova(supabase, {
                  ...basePayloadVeiculo,
                  codigo_modelo: melhor.codigo_modelo,
                });
                if (cadVeic.ok && cadVeic.codigo) {
                  await supabase.from('veiculos').update({ codigo_modelo_hinova: melhor.codigo_modelo }).eq('id', troca.veiculo_id);
                }
              }
            }
          }

          if (!(cadVeic?.ok && cadVeic?.codigo)) throw new Error(`SGA cadastrarVeiculo (fallback troca titularidade): ${(cadVeic?.errors || []).join("; ") || cadVeic?.mensagem || 'payload sem código_fipe/codigo_modelo válido'}`);
          sgaCodVeic = cadVeic.codigo;
        }


        await supabase.from("veiculos").update({
          codigo_hinova: sgaCodVeic, sincronizado_hinova: true, sincronizado_hinova_em: new Date().toISOString(),
        }).eq("id", troca.veiculo_id);

        await supabase.from("solicitacoes_troca_titularidade").update({
          sga_status: "sincronizado",
          sga_erro: null,
          sga_codigo_associado_novo: sgaCodAss,
          sga_codigo_veiculo_novo: sgaCodVeic,
          sga_sincronizado_em: new Date().toISOString(),
        }).eq("id", solicitacao_id);

        return new Response(JSON.stringify({ success: true, retry: true, sga_status: "sincronizado", sga_codigo_associado_novo: sgaCodAss, sga_codigo_veiculo_novo: sgaCodVeic }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (sgaErr) {
        const msg = (sgaErr as Error)?.message || String(sgaErr);
        const acaoManual = msg.startsWith('[CODIGO_ASSOCIADO_NAO_ENCONTRADO]');
        const sgaStatusUpd = acaoManual ? 'falha_manual_codigo_nao_encontrado' : 'falha';
        console.error("[retry-sga] Falha:", msg, acaoManual ? '(ação manual)' : '');
        await supabase.from("solicitacoes_troca_titularidade").update({
          sga_status: sgaStatusUpd, sga_erro: msg,
        }).eq("id", solicitacao_id);
        // Marca fila pendente mais recente como falha_permanente quando exige ação manual,
        // para o cron-sga-retry não retentar em loop.
        if (acaoManual) {
          await supabase.from('sga_sync_queue')
            .update({ status: 'falha_permanente', erro_ultimo: msg })
            .eq('origem', 'troca_titularidade')
            .eq('associado_id', troca.novo_associado_id)
            .in('status', ['pendente', 'processando']);
        }
        return new Response(JSON.stringify({ success: false, error: msg, sga_status: sgaStatusUpd, acao_manual: acaoManual }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

    }

    console.log(`[efetivar-troca] Iniciando efetivação para solicitação ${solicitacao_id}`);

    // 1. Buscar solicitação — tenta primeiro a tabela nova (solicitacoes_troca_titularidade)
    //    e cai no fluxo legado (chat_solicitacoes_ia) só se não encontrar.
    let solicitacao: any = null;
    let solicitacaoSource: 'nova' | 'legada' = 'nova';

    {
      const { data: novaSol } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("*")
        .eq("id", solicitacao_id)
        .maybeSingle();

      if (novaSol) {
        // Mapeia para o shape esperado pelo restante da função (que foi escrito
        // para chat_solicitacoes_ia).
        solicitacao = {
          id: novaSol.id,
          associado_id: novaSol.associado_antigo_id,
          criado_por: novaSol.criado_por,
          dados: { veiculo_id: novaSol.veiculo_id },
          dados_novo_titular: novaSol.novo_titular_dados,
          resultado_protocolo: null,
        };
      } else {
        const { data: legacySol, error: solError } = await supabase
          .from("chat_solicitacoes_ia")
          .select("*")
          .eq("id", solicitacao_id)
          .maybeSingle();
        if (solError || !legacySol) {
          console.error("[efetivar-troca] Solicitação não encontrada:", solError);
          return new Response(JSON.stringify({ success: false, error: "Solicitação não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        solicitacao = legacySol;
        solicitacaoSource = 'legada';
      }
    }

    const dados = (solicitacao.dados as Record<string, unknown>) || {};
    const dadosNovoTitular: Record<string, string> = {
      ...((solicitacao.dados_novo_titular as Record<string, string> | null) || {}),
    };

    // Fallback: snapshot pode ter vindo sem CPF/nome/etc., mas se já há um
    // `novo_associado_id` vinculado, o registro de `associados` é a fonte da
    // verdade. Mescla preenchendo apenas campos vazios/ausentes.
    try {
      const novoAssocId = (solicitacao as any).novo_associado_id
        || (await supabase
          .from("solicitacoes_troca_titularidade")
          .select("novo_associado_id")
          .eq("id", solicitacao_id)
          .maybeSingle()).data?.novo_associado_id;
      if (novoAssocId) {
        const { data: assocReal } = await supabase
          .from("associados")
          .select("nome, cpf, email, telefone")
          .eq("id", novoAssocId)
          .maybeSingle();
        if (assocReal) {
          if (!dadosNovoTitular.cpf && assocReal.cpf) {
            dadosNovoTitular.cpf = String(assocReal.cpf).replace(/\D/g, "");
          }
          if (!dadosNovoTitular.nome && assocReal.nome) dadosNovoTitular.nome = assocReal.nome;
          if (!dadosNovoTitular.email && assocReal.email) dadosNovoTitular.email = assocReal.email;
          if (!dadosNovoTitular.telefone && assocReal.telefone) dadosNovoTitular.telefone = assocReal.telefone;
        }
      }
    } catch (e) {
      console.warn("[efetivar-troca] fallback novo_associado falhou:", (e as Error)?.message);
    }

    try {
      const cotacaoId = (solicitacao as any).cotacao_id
        || (await supabase
          .from("solicitacoes_troca_titularidade")
          .select("cotacao_id")
          .eq("id", solicitacao_id)
          .maybeSingle()).data?.cotacao_id;

      if (cotacaoId) {
        const { data: cotacaoReal } = await supabase
          .from("cotacoes")
          .select("nome_solicitante, cliente_cpf, email_solicitante, telefone1_solicitante")
          .eq("id", cotacaoId)
          .maybeSingle();

        if (cotacaoReal) {
          if (!dadosNovoTitular.cpf && cotacaoReal.cliente_cpf) {
            dadosNovoTitular.cpf = String(cotacaoReal.cliente_cpf).replace(/\D/g, "");
          }
          if (!dadosNovoTitular.nome && cotacaoReal.nome_solicitante) {
            dadosNovoTitular.nome = cotacaoReal.nome_solicitante;
          }
          if (!dadosNovoTitular.email && cotacaoReal.email_solicitante) {
            dadosNovoTitular.email = cotacaoReal.email_solicitante;
          }
          if (!dadosNovoTitular.telefone && cotacaoReal.telefone1_solicitante) {
            dadosNovoTitular.telefone = cotacaoReal.telefone1_solicitante;
          }
        }
      }
    } catch (e) {
      console.warn("[efetivar-troca] fallback cotacao falhou:", (e as Error)?.message);
    }

    if (!dadosNovoTitular?.cpf) {
      return new Response(JSON.stringify({ success: false, error: "Dados do novo titular incompletos (CPF obrigatório)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine cenário
    const resultadoProtocolo = (dados.resultado_protocolo as string) || (solicitacao.resultado_protocolo as string) || "";
    const cenario = cenario_override || (resultadoProtocolo.includes("TRC-DISP-") ? "A" : "B");
    console.log(`[efetivar-troca] Cenário: ${cenario} (source: ${solicitacaoSource})`);

    // 2. Buscar veículo
    let veiculoId = dados.veiculo_id as string;
    if (!veiculoId) {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", solicitacao.associado_id)
        .eq("status", "ativo")
        .limit(1);
      veiculoId = veiculos?.[0]?.id;
    }

    if (!veiculoId) {
      // Try any vehicle linked to the associado
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", solicitacao.associado_id)
        .order("created_at", { ascending: false })
        .limit(1);
      veiculoId = veiculos?.[0]?.id;
    }

    if (!veiculoId) {
      return new Response(JSON.stringify({ success: false, error: "Veículo não encontrado para o associado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[efetivar-troca] Veículo: ${veiculoId}`);

    // 3. Buscar/Criar associado do novo titular
    const cpfLimpo = dadosNovoTitular.cpf.replace(/\D/g, "");
    let novoAssociadoId: string;

    const { data: associadoExistente } = await supabase
      .from("associados")
      .select("id, status")
      .eq("cpf", cpfLimpo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (associadoExistente) {
      novoAssociadoId = associadoExistente.id;
      console.log(`[efetivar-troca] Associado existente encontrado: ${novoAssociadoId} (status: ${associadoExistente.status})`);

      // Reactivate if inactive
      if (associadoExistente.status !== "ativo") {
        await supabase
          .from("associados")
          .update({ status: "ativo", updated_at: new Date().toISOString() })
          .eq("id", novoAssociadoId);
        console.log(`[efetivar-troca] Associado reativado`);
      }
    } else {
      // Create new associado — copia endereço do novo_titular_dados (se enviado pelo
      // link público). Fallback adiado: depois que carregarmos contratoAnterior tentamos
      // herdar UF/CEP/cidade/bairro/logradouro para evitar erro "ESTADO inválido" no SGA.
      const ndt: Record<string, any> = (dadosNovoTitular as any) || {};
      const enderecoBase: Record<string, any> = {
        cep: (ndt.cep || '').toString().replace(/\D/g, '') || null,
        logradouro: ndt.logradouro || ndt.endereco || null,
        numero: ndt.numero || null,
        complemento: ndt.complemento || null,
        bairro: ndt.bairro || null,
        cidade: ndt.cidade || null,
        uf: ndt.uf || ndt.estado || null,
      };
      const { data: novoAssociado, error: criarError } = await supabase
        .from("associados")
        .insert({
          nome: dadosNovoTitular.nome,
          cpf: cpfLimpo,
          email: dadosNovoTitular.email || null,
          telefone: dadosNovoTitular.telefone || null,
          whatsapp: dadosNovoTitular.telefone || null,
          status: "ativo",
          ...enderecoBase,
        })
        .select("id")
        .single();

      if (criarError || !novoAssociado) {
        console.error("[efetivar-troca] Erro ao criar associado:", criarError);
        return new Response(JSON.stringify({ success: false, error: "Erro ao criar novo associado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      novoAssociadoId = novoAssociado.id;
      console.log(`[efetivar-troca] Novo associado criado: ${novoAssociadoId}`);
    }

    // 4. Buscar contrato ativo do titular anterior
    const { data: contratoAnterior } = await supabase
      .from("contratos")
      .select("id, plano_id, valor_mensal, cota_participacao, vendedor_id, dia_vencimento, veiculo_id, numero")
      .eq("associado_id", solicitacao.associado_id)
      .in("status", ["ativo", "pendente"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contratoAnterior) {
      console.warn("[efetivar-troca] Nenhum contrato ativo encontrado para o titular anterior, continuando sem herança de contrato");
    }

    // 4.0.1 Fonte canônica de dia_vencimento: a COTAÇÃO da troca (escolhida pelo novo titular).
    //        Contrato anterior é apenas fallback caso a cotação não tenha o campo.
    //        Sem isso, o `|| now.getDate()` quebrava o check constraint quando o contrato
    //        anterior não existia / não tinha dia_vencimento (caso ANDERSON/KPJ4994).
    let diaVencimentoCotacao: number | null = null;
    try {
      const cotIdParaVenc = (solicitacao as any).cotacao_id;
      if (cotIdParaVenc) {
        const { data: cotVenc } = await supabase
          .from("cotacoes")
          .select("dia_vencimento")
          .eq("id", cotIdParaVenc)
          .maybeSingle();
        if (cotVenc && typeof cotVenc.dia_vencimento === "number") {
          diaVencimentoCotacao = cotVenc.dia_vencimento;
        }
      }
    } catch (e) {
      console.warn("[efetivar-troca] Falha ao ler dia_vencimento da cotação:", (e as Error)?.message);
    }

    // 4.1 Fallback de endereço para o novo associado: se ainda estiver sem UF/CEP,
    //     herda do contrato anterior (snapshot que veio do CRLV/cotação).
    try {
      const { data: assocCheck } = await supabase
        .from("associados")
        .select("uf, cep, cidade, bairro, logradouro, numero, complemento")
        .eq("id", novoAssociadoId)
        .maybeSingle();
      if (assocCheck && contratoAnterior) {
        const { data: ctrFull } = await supabase
          .from("contratos")
          .select("cliente_uf, cliente_cep, cliente_cidade, cliente_bairro, cliente_logradouro, cliente_numero, cliente_complemento")
          .eq("id", contratoAnterior.id)
          .maybeSingle();
        if (ctrFull) {
          const patch: Record<string, unknown> = {};
          if (!assocCheck.uf && ctrFull.cliente_uf) patch.uf = ctrFull.cliente_uf;
          if (!assocCheck.cep && ctrFull.cliente_cep) patch.cep = String(ctrFull.cliente_cep).replace(/\D/g, '');
          if (!assocCheck.cidade && ctrFull.cliente_cidade) patch.cidade = ctrFull.cliente_cidade;
          if (!assocCheck.bairro && ctrFull.cliente_bairro) patch.bairro = ctrFull.cliente_bairro;
          if (!assocCheck.logradouro && ctrFull.cliente_logradouro) patch.logradouro = ctrFull.cliente_logradouro;
          if (!assocCheck.numero && ctrFull.cliente_numero) patch.numero = ctrFull.cliente_numero;
          if (!assocCheck.complemento && ctrFull.cliente_complemento) patch.complemento = ctrFull.cliente_complemento;
          if (Object.keys(patch).length) {
            await supabase.from("associados").update(patch).eq("id", novoAssociadoId);
            console.log(`[efetivar-troca] Endereço herdado do contrato anterior:`, Object.keys(patch));
          }
        }
      }
    } catch (e) {
      console.warn("[efetivar-troca] Fallback endereço falhou:", (e as Error)?.message);
    }

    // 5. Ler configurações
    const taxaTroca = await getConfiguracaoNumero(supabase, "taxa_troca_titularidade", 50);
    const carenciaPadrao = await getConfiguracaoNumero(supabase, "carencia_dias_padrao", 120);
    const carenciaCenarioA = await getConfiguracaoNumero(supabase, "carencia_troca_titularidade_cenario_a", 0);
    const carenciaVidrosDias = await getConfiguracaoNumero(supabase, "carencia_beneficio_vidros_dias", 120);

    const carenciaDias = cenario === "A" ? carenciaCenarioA : carenciaPadrao;
    const carenciaIsenta = carenciaDias === 0;

    console.log(`[efetivar-troca] Config: taxa=${taxaTroca}, carência=${carenciaDias} dias (isenta: ${carenciaIsenta}), vidros=${carenciaVidrosDias}`);

    // 6. Transferir veículo + LIMPAR cobertura suspensa por troca
    //    (motivo `troca_titularidade_em_andamento` foi setado quando a troca iniciou
    //     — após efetivada, a cobertura volta normal para o novo titular).
    const { error: transferError } = await supabase
      .from("veiculos")
      .update({
        associado_id: novoAssociadoId,
        em_troca_titularidade: false,
        troca_titularidade_id: null,
        troca_titularidade_iniciada_em: null,
        cobertura_suspensa: false,
        cobertura_suspensa_motivo: null,
        cobertura_suspensa_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", veiculoId);

    if (transferError) {
      console.error("[efetivar-troca][etapa=veiculo] Erro ao transferir veículo:", transferError);
      return new Response(JSON.stringify({
        success: false,
        etapa_falha: "veiculo",
        error: "Não foi possível transferir o veículo para o novo titular. Tente novamente; se persistir, contate o suporte.",
        motivo_tecnico: transferError.message,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[efetivar-troca] Veículo ${veiculoId} transferido para ${novoAssociadoId}`);

    // 6.1 RELIGAR COBERTURA + REAPONTAR RASTREADOR para o novo titular
    //     (o veículo já é conhecido — a proteção precisa voltar imediatamente após
    //      a troca, sem depender de nova instalação ou aprovação adicional).
    try {
      // Há rastreador físico instalado neste veículo?
      const { data: rastreadorAtivo } = await supabase
        .from("rastreadores")
        .select("id, associado_id")
        .eq("veiculo_id", veiculoId)
        .eq("status", "instalado")
        .maybeSingle();

      // Veículo exige rastreador? (Diesel / Carro≥30k / Moto≥9k)
      const { data: precisa } = await supabase.rpc("fn_veiculo_precisa_rastreador", {
        _veiculo_id: veiculoId,
      });
      const exigeRastreador = precisa === true;

      // Regra: cobertura_total quando exige rastreador E há rastreador instalado;
      //         cobertura_roubo_furto sempre que houver rastreador instalado
      //         (ou veículo sub-FIPE que não exige rastreador → R/F via autovistoria
      //          herdada). Na troca, o veículo já passou pelo Monitoramento da
      //          própria solicitação, então a cobertura volta integral.
      const coberturaUpdate: Record<string, unknown> = {
        cobertura_total: exigeRastreador ? !!rastreadorAtivo : true,
        cobertura_roubo_furto: true,
        updated_at: new Date().toISOString(),
      };

      const { error: covErr } = await supabase
        .from("veiculos")
        .update(coberturaUpdate)
        .eq("id", veiculoId);

      if (covErr) {
        console.warn("[efetivar-troca][cobertura] Falha ao religar cobertura:", covErr.message);
      } else {
        console.log(
          `[efetivar-troca][cobertura] Religada: cobertura_total=${coberturaUpdate.cobertura_total}, cobertura_roubo_furto=true (exigeRastreador=${exigeRastreador}, temRastreador=${!!rastreadorAtivo})`,
        );
      }

      // Reapontar rastreador instalado para o novo titular
      if (rastreadorAtivo && rastreadorAtivo.associado_id !== novoAssociadoId) {
        const { error: rastErr } = await supabase
          .from("rastreadores")
          .update({
            associado_id: novoAssociadoId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rastreadorAtivo.id);
        if (rastErr) {
          console.warn("[efetivar-troca][rastreador] Falha ao reapontar rastreador:", rastErr.message);
        } else {
          console.log(`[efetivar-troca][rastreador] Reapontado ${rastreadorAtivo.id} → ${novoAssociadoId}`);
        }
      }
    } catch (e) {
      console.warn("[efetivar-troca][religar] erro não-bloqueante:", (e as Error)?.message);
    }

    // 6.2 Dedup defensivo: cancelar contratos vivos de SOLICITAÇÕES anteriores
    //     já canceladas/expiradas para este veículo (gemini de contrato órfão).
    try {
      const { data: orfaos } = await supabase
        .from("contratos")
        .select("id, numero, origem_troca_titularidade_id, solicitacoes_troca_titularidade!inner(status)")
        .eq("veiculo_id", veiculoId)
        .in("status", ["pendente", "assinado", "ativo"])
        .neq("origem_troca_titularidade_id", solicitacao_id)
        .in("solicitacoes_troca_titularidade.status", ["cancelada", "expirada"]);

      const ids = (orfaos || []).map((c: any) => c.id);
      if (ids.length) {
        await supabase.from("contratos").update({
          status: "cancelado",
          data_cancelamento: now.toISOString(),
          updated_at: now.toISOString(),
        }).in("id", ids);
        console.log(`[efetivar-troca][dedup] Cancelados ${ids.length} contrato(s) órfão(s) de solicitações antigas`);
      }
    } catch (e) {
      console.warn("[efetivar-troca][dedup] erro não-bloqueante:", (e as Error)?.message);
    }

    // 6.3 Reaponte de vínculo cliente↔veículo na plataforma de rastreamento
    //     Roteia por rastreadores.plataforma do rastreador instalado:
    //       - 'softruck' (default) → sequência GET/DELETE/POST em associations/users.
    //       - 'rede_veiculos'      → desvincular + vincular cliente na Rede.
    //     Vehicle/device físico ficam INTOCADOS em ambos os caminhos.
    //     Falha não aborta a troca: enfileira em sga_sync_queue.
    //     Prefixos distintos na janela DELETE→POST:
    //       [FALHA_SOFTRUCK_RECRIAR_VINCULO] / [FALHA_REDE_REVINCULAR_CLIENTE]
    try {
      // Pré-condição 1: veículo exige rastreador?
      const { data: precisaRastr } = await supabase.rpc("fn_veiculo_precisa_rastreador", {
        _veiculo_id: veiculoId,
      });

      if (precisaRastr !== true) {
        console.log("[efetivar-troca][rastreador-vinculo] veículo não elegível a rastreador, pulando reaponte");
      } else {
        // Pré-condição 2: qual rastreador físico está instalado e em qual plataforma?
        const { data: rastrInstalado } = await supabase
          .from("rastreadores")
          .select("id, imei, plataforma, associado_id")
          .eq("veiculo_id", veiculoId)
          .eq("status", "instalado")
          .maybeSingle();

        const plataforma = ((rastrInstalado as any)?.plataforma || "").toLowerCase();
        const imeiInst = (rastrInstalado as any)?.imei as string | undefined;
        const rastrIdInst = (rastrInstalado as any)?.id as string | undefined;

        if (!rastrInstalado) {
          console.log(
            `[TROCA_VINCULO_SEM_RASTREADOR] veiculo=${veiculoId} elegível mas sem rastreador instalado — nada a reapontar`,
          );
        } else if (plataforma === "rede_veiculos") {
          // ============================================================
          // BRANCH REDE VEÍCULOS — reaproveita edges existentes
          // ============================================================
          const callRede =
            (globalThis as any).__redeTrocaVinculoOverride ??
            ((fn: string, body: unknown) => supabase.functions.invoke(fn, { body }));

          const enqueueRedeFalha = async (
            etapa: "rede_desvincular_cliente" | "rede_revincular_cliente",
            msg: string,
          ) => {
            try {
              // TODO[retry-rede-troca-vinculo]: cron-sga-retry ainda não drena esta etapa.
              const payload: Record<string, unknown> = {
                associado_id: novoAssociadoId,
                veiculo_id: veiculoId,
                status: "pendente",
                etapa_parou: `troca_titularidade:${etapa}`,
                erro_ultimo: msg,
                origem: "troca_titularidade",
              };
              if (etapa === "rede_revincular_cliente") payload.prioridade = "alta";
              await supabase.from("sga_sync_queue").insert(payload as any);
            } catch (qErr) {
              console.error("[efetivar-troca][rede-vinculo] falha ao enfileirar:", (qErr as Error)?.message);
            }
          };

          // ===== Passo A: desvincular cliente antigo na Rede =====
          try {
            const del = await callRede("rede-veiculos-desvincular-cliente", {
              rastreadorId: rastrIdInst,
              imei: imeiInst,
              motivo: "troca_titularidade",
              atualizarBancoLocal: false,
            });
            const delData = (del as any)?.data ?? del;
            if ((del as any)?.error) throw new Error(JSON.stringify((del as any).error));
            if (delData && delData.success === false) {
              throw new Error(delData.error || JSON.stringify(delData));
            }
          } catch (e) {
            const msg = (e as Error)?.message ?? String(e);
            console.error(
              `[FALHA_REDE_TROCA_VINCULO] passo=desvincular-cliente solicitacao=${solicitacao_id} veiculo=${veiculoId} rastreador=${rastrIdInst} imei=${imeiInst} erro=${msg}`,
            );
            await enqueueRedeFalha("rede_desvincular_cliente", `desvincular-cliente: ${msg}`);
            throw new Error("__rede_abort__");
          }

          // ===== Passo B: vincular cliente novo (janela DELETE→POST) =====
          try {
            if (!imeiInst) throw new Error("rastreador instalado sem IMEI");
            const vin = await callRede("rede-veiculos-vincular-cliente", {
              imei: imeiInst,
              veiculoId,
              associadoId: novoAssociadoId,
            });
            const vinData = (vin as any)?.data ?? vin;
            if ((vin as any)?.error) throw new Error(JSON.stringify((vin as any).error));
            if (vinData && vinData.success === false) {
              throw new Error(vinData.error || JSON.stringify(vinData));
            }
          } catch (e) {
            const msg = (e as Error)?.message ?? String(e);
            console.error(
              `[FALHA_REDE_REVINCULAR_CLIENTE] passo=vincular-cliente solicitacao=${solicitacao_id} veiculo=${veiculoId} rastreador=${rastrIdInst} imei=${imeiInst} novoAssoc=${novoAssociadoId} erro=${msg}`,
            );
            await enqueueRedeFalha("rede_revincular_cliente", `vincular-cliente: ${msg}`);
            throw new Error("__rede_abort__");
          }

          console.log(
            `[REDE_TROCA_VINCULO_OK] veiculoId=${veiculoId} rastreador=${rastrIdInst} imei=${imeiInst} novoAssoc=${novoAssociadoId}`,
          );

          try {
            await insertAuditLog(supabase, {
              acao: "criar",
              modulo: "monitoramento",
              descricao: `[REDE_TROCA_VINCULO_OK] veiculo_id=${veiculoId} imei=${imeiInst} → associado=${novoAssociadoId}`,
              tabela: "solicitacoes_troca_titularidade",
              registro_id: solicitacao_id,
              dados_novos: {
                origem: "rede_veiculos",
                veiculo_id: veiculoId,
                rastreador_id: rastrIdInst,
                imei: imeiInst,
                associado_novo: novoAssociadoId,
              },
            });
          } catch (logErr) {
            console.warn("[efetivar-troca][rede-vinculo] insertAuditLog falhou:", (logErr as Error)?.message);
          }
        } else {
          // ============================================================
          // BRANCH SOFTRUCK — agora delega ao helper canônico
          // executarSoftruckTrocaVinculo, que resolve vehicleId por fallback
          // (cache veiculos → rastreador.plataforma_veiculo_id → deviceId →
          // IMEI → placa) antes de seguir com o reaponte de usuário.
          // Falha não-bloqueante: enfileira em sga_sync_queue para o
          // cron-softruck-troca-retry drenar.
          // ============================================================
          const res = await executarSoftruckTrocaVinculo(supabase, veiculoId, novoAssociadoId);

          if (res.ok) {
            console.log(
              `[SOFTRUCK_TROCA_VINCULO_OK] sol=${solicitacao_id} status=${res.status}${(res as any).vehicleId ? ` vehicleId=${(res as any).vehicleId}` : ""}${(res as any).userId ? ` userId=${(res as any).userId}` : ""}`,
            );
            try {
              await insertAuditLog(supabase, {
                acao: "criar",
                modulo: "monitoramento",
                descricao: `[SOFTRUCK_TROCA_VINCULO_OK] sol=${solicitacao_id} status=${res.status}`,
                tabela: "solicitacoes_troca_titularidade",
                registro_id: solicitacao_id,
                dados_novos: res,
              });
            } catch (logErr) {
              console.warn("[efetivar-troca][softruck-vinculo] insertAuditLog falhou:", (logErr as Error)?.message);
            }
          } else {
            const etapaFila = res.etapa === "associar" ? "softruck_recriar_vinculo" : "softruck_reaponte_usuario";
            console.error(
              `[FALHA_SOFTRUCK_TROCA_VINCULO] sol=${solicitacao_id} etapa=${res.etapa} msg=${res.msg}`,
            );
            try {
              await supabase.from("sga_sync_queue").insert({
                associado_id: novoAssociadoId,
                veiculo_id: veiculoId,
                status: "pendente",
                etapa_parou: `troca_titularidade:${etapaFila}`,
                erro_ultimo: `${res.etapa}: ${res.msg}`,
                origem: "troca_titularidade",
              });
            } catch (qErr) {
              console.error("[efetivar-troca][softruck-vinculo] falha ao enfileirar:", (qErr as Error)?.message);
            }
          }
        }
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      if (
        msg !== "__softruck_abort__" &&
        msg !== "__softruck_done__" &&
        msg !== "__rede_abort__"
      ) {
        console.warn("[efetivar-troca][rastreador-vinculo] erro não-bloqueante:", msg);
      }
    }





    // 7. Criar contrato do novo titular
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    const numeroContrato = `TRC-${year}${month}${day}-${random}`;

    // Determine vendedor: from previous contract, or from solicitação creator
    let vendedorId = contratoAnterior?.vendedor_id || null;
    if (!vendedorId && solicitacao.criado_por) {
      // Try to use the consultant who created the request
      const { data: profileCriador } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", solicitacao.criado_por)
        .maybeSingle();
      vendedorId = profileCriador?.id || null;
    }

    const dataInicio = now.toISOString().split("T")[0];
    let dataFimCarencia: string | null = null;
    if (!carenciaIsenta && carenciaDias > 0) {
      const fimCarencia = new Date(now);
      fimCarencia.setDate(fimCarencia.getDate() + carenciaDias);
      dataFimCarencia = fimCarencia.toISOString().split("T")[0];
    }

    // Carência de vidros para troca de titularidade
    let dataCarenciaVidrosInicio: string | null = dataInicio;
    let dataCarenciaVidrosFim: string | null = null;
    if (carenciaVidrosDias > 0) {
      const fimVidros = new Date(now);
      fimVidros.setDate(fimVidros.getDate() + carenciaVidrosDias);
      dataCarenciaVidrosFim = fimVidros.toISOString().split("T")[0];
    }

    const contratoData: Record<string, unknown> = {
      numero: numeroContrato,
      associado_id: novoAssociadoId,
      veiculo_id: veiculoId,
      plano_id: contratoAnterior?.plano_id,
      valor_adesao: 0, // Troca de titularidade não tem adesão, tem taxa separada
      valor_mensal: contratoAnterior?.valor_mensal || 0,
      cota_participacao: contratoAnterior?.cota_participacao || null,
      // dia_vencimento: cotação (canônico) > contrato anterior (herança) > resolverDiaVencimento (rede de segurança)
      dia_vencimento: resolverDiaVencimento(
        diaVencimentoCotacao ?? contratoAnterior?.dia_vencimento,
        now,
      ).dia,
      vendedor_id: vendedorId,
      status: "ativo",
      data_inicio: dataInicio,
      data_ativacao: now.toISOString(),
      tipo_entrada: "troca_titularidade",
      origem_troca_titularidade_id: solicitacao_id,
      // Troca já passou por Cadastro + Monitoramento da própria solicitação ⇒
      // o contrato nasce APROVADO no Cadastro para liberar régua de cobrança.
      cadastro_aprovado: true,
      aprovado_em: now.toISOString(),
      aprovado_por: solicitacao.aprovado_monitoramento_por
        || solicitacao.aprovado_cadastro_por
        || solicitacao.criado_por
        || null,
      carencia_isenta: carenciaIsenta,
      carencia_motivo_isencao: carenciaIsenta ? `Cenário ${cenario}: carência dispensada na troca de titularidade` : null,
      // Carência de vidros e faróis
      data_carencia_vidros_inicio: dataCarenciaVidrosInicio,
      data_carencia_vidros_fim: dataCarenciaVidrosFim,
      carencia_vidros_isenta: false,
    };

    // Copy vehicle data for the contract snapshot
    const { data: veiculoData } = await supabase
      .from("veiculos")
      .select("placa, marca, modelo, ano_fabricacao, ano_modelo, cor, chassi, renavam, valor_fipe, codigo_fipe, codigo_modelo_hinova, codigo_sga_combustivel, codigo_sga_cor")
      .eq("id", veiculoId)
      .maybeSingle();

    if (veiculoData) {
      contratoData.veiculo_placa = veiculoData.placa;
      contratoData.veiculo_marca = veiculoData.marca;
      contratoData.veiculo_modelo = veiculoData.modelo;
      contratoData.veiculo_ano = veiculoData.ano_modelo;
      contratoData.veiculo_cor = veiculoData.cor;
      contratoData.veiculo_chassi = veiculoData.chassi;
      contratoData.veiculo_renavam = veiculoData.renavam;
      contratoData.veiculo_valor_fipe = veiculoData.valor_fipe;
    }

    // Copy client data
    contratoData.cliente_nome = dadosNovoTitular.nome;
    contratoData.cliente_cpf = cpfLimpo;
    contratoData.cliente_email = dadosNovoTitular.email || null;
    contratoData.cliente_telefone = dadosNovoTitular.telefone || null;

    // 7.0 IDEMPOTÊNCIA — se já existir contrato vinculado a esta solicitação,
    // reaproveita (UPDATE) em vez de criar duplicado. Cobre dois casos:
    //   (a) reprocessamento manual após falha;
    //   (b) contrato pré-existente criado por aprovar-proposta no link público.
    let novoContrato: { id: string; numero: string } | null = null;
    {
      const { data: existentes } = await supabase
        .from("contratos")
        .select("id, numero, status")
        .eq("origem_troca_titularidade_id", solicitacao_id)
        .order("created_at", { ascending: true });

      const ativosOuPendentes = (existentes || []).filter(
        (c: any) => c.status === "ativo" || c.status === "pendente" || c.status === "assinado",
      );

      if (ativosOuPendentes.length > 0) {
        // Mantém o mais antigo como vencedor; cancela os demais
        const vencedor = ativosOuPendentes[0];
        const { data: atualizado, error: updErr } = await supabase
          .from("contratos")
          .update({ ...contratoData, numero: vencedor.numero, updated_at: now.toISOString() })
          .eq("id", vencedor.id)
          .select("id, numero")
          .single();
        if (updErr || !atualizado) {
          console.error("[efetivar-troca][etapa=contrato_novo] Erro ao atualizar contrato existente:", updErr);
          // Rollback etapa 1
          await supabase.from("veiculos").update({
            associado_id: solicitacao.associado_id,
            em_troca_titularidade: true,
            troca_titularidade_id: solicitacao_id,
          }).eq("id", veiculoId);
          return new Response(JSON.stringify({
            success: false,
            etapa_falha: "contrato_novo",
            error: "Não foi possível preparar o contrato do novo titular. Tente novamente; se persistir, contate o suporte.",
            motivo_tecnico: updErr?.message,
          }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        novoContrato = atualizado;
        // Cancela quaisquer duplicatas
        const idsCancelar = ativosOuPendentes.slice(1).map((c: any) => c.id);
        if (idsCancelar.length) {
          await supabase.from("contratos").update({
            status: "cancelado",
            data_cancelamento: now.toISOString(),
            updated_at: now.toISOString(),
          }).in("id", idsCancelar);
          console.log(`[efetivar-troca] Cancelados ${idsCancelar.length} contrato(s) duplicado(s) da troca`);
        }
        console.log(`[efetivar-troca] Contrato existente reaproveitado: ${novoContrato.numero} (${novoContrato.id})`);
      } else {
        const { data: criado, error: contratoError } = await supabase
          .from("contratos")
          .insert(contratoData)
          .select("id, numero")
          .single();
        if (contratoError || !criado) {
          console.error("[efetivar-troca][etapa=contrato_novo] Erro ao criar contrato:", contratoError);
          // Rollback etapa 1
          await supabase.from("veiculos").update({
            associado_id: solicitacao.associado_id,
            em_troca_titularidade: true,
            troca_titularidade_id: solicitacao_id,
          }).eq("id", veiculoId);
          return new Response(JSON.stringify({
            success: false,
            etapa_falha: "contrato_novo",
            error: "Não foi possível criar o contrato do novo titular. Tente novamente; se persistir, contate o suporte.",
            motivo_tecnico: contratoError?.message,
          }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        novoContrato = criado;
        console.log(`[efetivar-troca] Contrato criado: ${novoContrato.numero} (${novoContrato.id})`);
      }
    }

    // 8. Encerrar contrato anterior (BLOQUEANTE — etapa 3)
    if (contratoAnterior) {
      const { error: cancelError } = await supabase
        .from("contratos")
        .update({
          status: "cancelado",
          data_cancelamento: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", contratoAnterior.id);

      if (cancelError) {
        console.error("[efetivar-troca][etapa=contrato_anterior] Falha ao encerrar contrato anterior:", cancelError);
        // Rollback etapas 1 e 2
        await supabase.from("contratos").update({
          status: "cancelado",
          data_cancelamento: now.toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", novoContrato.id);
        await supabase.from("veiculos").update({
          associado_id: solicitacao.associado_id,
          em_troca_titularidade: true,
          troca_titularidade_id: solicitacao_id,
        }).eq("id", veiculoId);
        return new Response(JSON.stringify({
          success: false,
          etapa_falha: "contrato_anterior",
          error: "Não foi possível encerrar o contrato do titular anterior. Tente novamente; se persistir, contate o suporte.",
          motivo_tecnico: cancelError.message,
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[efetivar-troca] Contrato anterior ${contratoAnterior.numero || contratoAnterior.id} encerrado`);

      // Register contract history
      await supabase.from("contratos_historico").insert({
        contrato_id: contratoAnterior.id,
        evento: "cancelado_troca_titularidade",
        descricao: `Contrato encerrado por troca de titularidade. Novo contrato: ${novoContrato.numero}`,
        dados: { novo_contrato_id: novoContrato.id, novo_associado_id: novoAssociadoId },
      });
    }

    // Register history for new contract
    await supabase.from("contratos_historico").insert({
      contrato_id: novoContrato.id,
      evento: "gerado_troca_titularidade",
      descricao: `Contrato gerado por troca de titularidade. Cenário ${cenario}.${contratoAnterior ? ` Contrato anterior: ${contratoAnterior.numero || contratoAnterior.id}` : ""}`,
      dados: { cenario, contrato_anterior_id: contratoAnterior?.id, solicitacao_id },
    });

    // 8.1 Cancelar antigo proprietário se ficou sem vínculos ativos
    // (regra canônica em fn_cancelar_associado_se_orfao: considera o UNIVERSO
    // TOTAL do associado — contratos ativo/assinado/pendente + veículos fora
    // de cancelado/vendido/transferido. Só cancela quando ambos = 0.)
    try {
      const { data: cancelado, error: cancErr } = await supabase.rpc(
        "fn_cancelar_associado_se_orfao",
        {
          _associado_id: solicitacao.associado_id,
          _motivo: `Troca de titularidade efetivada (Cenário ${cenario}) — sem vínculos ativos restantes`,
        },
      );
      if (cancErr) {
        console.warn("[efetivar-troca] fn_cancelar_associado_se_orfao:", cancErr.message);
        await insertAuditLog(supabase as any, {
          acao: 'criar',
          modulo: 'associados',
          descricao: `[FALHA_CANCELAR_ORFAO_POS_TROCA] rpc fn_cancelar_associado_se_orfao falhou: ${cancErr.message}`,
          registro_id: solicitacao.associado_id,
          tabela: 'associados',
          dados_novos: {
            solicitacao_id,
            associado_id: solicitacao.associado_id,
            cenario,
            erro: { message: cancErr.message, code: (cancErr as { code?: string }).code ?? null, details: (cancErr as { details?: string }).details ?? null },
          },
        });
      } else {
        // Read-back: confere status REAL no banco, não confia só no booleano.
        const { data: assocReal } = await supabase
          .from('associados')
          .select('status')
          .eq('id', solicitacao.associado_id)
          .maybeSingle();
        const statusReal = (assocReal as { status?: string } | null)?.status ?? 'desconhecido';
        console.log(
          `[efetivar-troca] Antigo proprietário ${solicitacao.associado_id}: rpc retornou ${cancelado ? 'cancelou' : 'manteve'} → status real='${statusReal}'`,
        );
        // Inconsistência rara: rpc disse que cancelou mas status não bateu.
        if (cancelado === true && statusReal !== 'cancelado') {
          await insertAuditLog(supabase as any, {
            acao: 'criar',
            modulo: 'associados',
            descricao: `[FALHA_CANCELAR_ORFAO_POS_TROCA] rpc retornou true mas status real='${statusReal}' (esperado 'cancelado')`,
            registro_id: solicitacao.associado_id,
            tabela: 'associados',
            dados_novos: { solicitacao_id, associado_id: solicitacao.associado_id, status_real: statusReal },
          });
        }

        // 8.1.1 Espelha cancelamento na Hinova (NÃO bloqueante).
        // Só dispara quando o local realmente cancelou (cancelado=true + statusReal='cancelado').
        // Falha não aborta a troca: log [FALHA_INATIVAR_ASSOCIADO_ANTIGO] + sga_sync_queue para retry.
        if (cancelado === true && statusReal === 'cancelado') {
          const { data: assocAntigoCodigo } = await supabase
            .from('associados')
            .select('codigo_hinova')
            .eq('id', solicitacao.associado_id)
            .maybeSingle();
          const codigoHinovaAntigo = (assocAntigoCodigo as { codigo_hinova?: number | null } | null)?.codigo_hinova ?? null;

          if (!codigoHinovaAntigo) {
            console.warn(
              `[INATIVAR_ANTIGO_SEM_CODIGO_HINOVA] associado ${solicitacao.associado_id} sem codigo_hinova — nada a fazer remoto`,
            );
          } else {
            // Fallback canônico: 2 (Hinova: 1=ativo, 2=inativo, 3=pendente).
            let codigoSituacaoInativo = Number.parseInt(Deno.env.get('HINOVA_CODIGO_SITUACAO_INATIVO') || '', 10);
            if (!Number.isFinite(codigoSituacaoInativo) || codigoSituacaoInativo <= 0) codigoSituacaoInativo = 2;

            // Hook de teste: permite mockar via globalThis sem refatoração maior.
            const inativar: typeof alterarSituacaoAssociadoHinova =
              (globalThis as any).__inativarAssociadoHinovaOverride ?? alterarSituacaoAssociadoHinova;

            let okRemoto = false;
            let msgFalha = '';
            let httpStatus = 0;
            let errsRemoto: string[] = [];
            try {
              const rs = await inativar(supabase, codigoHinovaAntigo, codigoSituacaoInativo);
              okRemoto = !!rs?.ok;
              httpStatus = rs?.status ?? 0;
              errsRemoto = rs?.errors ?? [];
              if (!okRemoto) {
                msgFalha = rs?.mensagem || (rs?.errors ?? []).join('; ') || `HTTP ${httpStatus}`;
              }
            } catch (remErr) {
              okRemoto = false;
              msgFalha = (remErr as Error)?.message || String(remErr);
            }

            if (okRemoto) {
              console.log(
                `[efetivar-troca][inativar-antigo] ✅ associado ${solicitacao.associado_id} (codigo_hinova=${codigoHinovaAntigo}) inativado na Hinova`,
              );
              try {
                await insertAuditLog(supabase as any, {
                  acao: 'criar',
                  modulo: 'associados',
                  descricao: `[INATIVAR_ANTIGO_OK] associado antigo inativado na Hinova após troca (codigo_hinova=${codigoHinovaAntigo})`,
                  registro_id: solicitacao.associado_id,
                  tabela: 'associados',
                  dados_novos: {
                    solicitacao_id,
                    associado_antigo_id: solicitacao.associado_id,
                    codigo_hinova: codigoHinovaAntigo,
                    codigo_situacao: codigoSituacaoInativo,
                  },
                });
              } catch (logErr) {
                console.warn('[efetivar-troca] insertAuditLog INATIVAR_ANTIGO_OK falhou:', logErr);
              }
            } else {
              console.error(
                `[FALHA_INATIVAR_ASSOCIADO_ANTIGO] associado ${solicitacao.associado_id} (codigo_hinova=${codigoHinovaAntigo}): ${msgFalha}`,
              );
              try {
                await insertAuditLog(supabase as any, {
                  acao: 'criar',
                  modulo: 'associados',
                  descricao: `[FALHA_INATIVAR_ASSOCIADO_ANTIGO] ${msgFalha}`,
                  registro_id: solicitacao.associado_id,
                  tabela: 'associados',
                  dados_novos: {
                    solicitacao_id,
                    associado_antigo_id: solicitacao.associado_id,
                    codigo_hinova: codigoHinovaAntigo,
                    codigo_situacao: codigoSituacaoInativo,
                    http_status: httpStatus,
                    errors: errsRemoto,
                    erro: msgFalha,
                  },
                });
              } catch (logErr) {
                console.warn('[efetivar-troca] insertAuditLog FALHA_INATIVAR_ASSOCIADO_ANTIGO falhou:', logErr);
              }
              // TODO[retry-inativar-antigo]: cron-sga-retry ainda não consome esta etapa.
              // A linha fica na fila para rastreabilidade/ação manual via painel SGA.
              try {
                await supabase.from('sga_sync_queue').insert({
                  veiculo_id: null,
                  associado_id: solicitacao.associado_id,
                  status: 'pendente',
                  etapa_parou: 'troca_titularidade:inativar_associado_antigo',
                  erro_ultimo: msgFalha,
                  origem: 'troca_titularidade',
                  codigo_associado_hinova: codigoHinovaAntigo,
                });
              } catch (qErr) {
                console.warn('[efetivar-troca] enqueue inativar-antigo falhou:', (qErr as Error)?.message || qErr);
              }
            }
          }
        }
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.warn("[efetivar-troca] erro cancelamento antigo:", msg);
      try {
        await insertAuditLog(supabase as any, {
          acao: 'criar',
          modulo: 'associados',
          descricao: `[FALHA_CANCELAR_ORFAO_POS_TROCA] exception: ${msg}`,
          registro_id: solicitacao.associado_id,
          tabela: 'associados',
          dados_novos: { solicitacao_id, associado_id: solicitacao.associado_id, exception: msg },
        });
      } catch (logErr) {
        console.warn('[efetivar-troca] insertAuditLog FALHA_CANCELAR_ORFAO falhou:', logErr);
      }
    }

    // 9. Sincronizar/Criar cliente ASAAS
    let asaasOk = false;
    try {
      const syncResp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ action: "sincronizar", associado_id: novoAssociadoId }),
      });
      const syncData = await syncResp.json();
      asaasOk = syncData.success === true;
      console.log(`[efetivar-troca] ASAAS sync: ${asaasOk ? "OK" : "falhou"}`, syncData);
    } catch (asaasErr) {
      console.error("[efetivar-troca] Erro ao sincronizar ASAAS (não bloqueante):", asaasErr);
    }

    // 10. Gerar cobrança da taxa de troca
    if (taxaTroca > 0) {
      try {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 5); // 5 dias para pagamento
        const dueDateStr = dueDate.toISOString().split("T")[0];

        const cobrancaResp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-cobrancas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            action: "criar",
            associado_id: novoAssociadoId,
            dados: {
              billingType: "UNDEFINED",
              value: taxaTroca,
              dueDate: dueDateStr,
              description: `Taxa de troca de titularidade - Contrato ${novoContrato.numero}`,
              externalReference: novoContrato.id,
            },
            tipo: "taxa_troca_titularidade",
            contrato_id: novoContrato.id,
          }),
        });
        const cobrancaData = await cobrancaResp.json();
        console.log(`[efetivar-troca] Cobrança taxa: ${cobrancaData.success ? "OK" : "falhou"}`, cobrancaData);
      } catch (cobrErr) {
        console.error("[efetivar-troca] Erro ao gerar cobrança da taxa (não bloqueante):", cobrErr);
      }
    }

    // 11. Atualizar solicitação com dados da efetivação
    const dadosAtualizados = {
      ...(typeof dados === "object" ? dados : {}),
      cenario,
      novo_associado_id: novoAssociadoId,
      novo_contrato_id: novoContrato.id,
      novo_contrato_numero: novoContrato.numero,
      contrato_anterior_id: contratoAnterior?.id || null,
      efetivado_em: now.toISOString(),
    };

    if (solicitacaoSource === 'legada') {
      await supabase
        .from("chat_solicitacoes_ia")
        .update({ dados: dadosAtualizados })
        .eq("id", solicitacao_id);
    }

    console.log(`[efetivar-troca] Solicitação atualizada com dados da efetivação`);

    // 12. Registrar histórico para ambos os associados
    const { data: associadoAntigo } = await supabase
      .from("associados")
      .select("nome")
      .eq("id", solicitacao.associado_id)
      .maybeSingle();

    // 12.a Payload dos eventos de histórico (saída + entrada)
    const historicoTrocaPayload = [
      {
        associado_id: solicitacao.associado_id,
        tipo: "troca_titularidade_saida",
        descricao: `Veículo transferido para ${dadosNovoTitular.nome} por troca de titularidade (Cenário ${cenario}).`,
        dados_novos: {
          novo_associado_id: novoAssociadoId,
          novo_contrato_id: novoContrato.id,
          veiculo_id: veiculoId,
          cenario,
        },
      },
      {
        associado_id: novoAssociadoId,
        tipo: "troca_titularidade_entrada",
        descricao: `Veículo recebido de ${associadoAntigo?.nome || "titular anterior"} por troca de titularidade (Cenário ${cenario}).`,
        dados_novos: {
          associado_anterior_id: solicitacao.associado_id,
          contrato_id: novoContrato.id,
          veiculo_id: veiculoId,
          cenario,
        },
      },
    ];

    // 12.b INSERT com try/catch — falha NÃO bloqueia a troca, mas é registrada em logs_auditoria
    // para evitar silenciamento (caso histórico do CHECK constraint defasado).
    try {
      const { error: histErr } = await supabase
        .from("associados_historico")
        .insert(historicoTrocaPayload);
      if (histErr) throw histErr;
    } catch (histCatch: any) {
      console.error(
        "[efetivar-troca][FALHA_REGISTRO_HISTORICO_TROCA]",
        {
          solicitacao_id,
          erro: histCatch?.message,
          codigo: histCatch?.code,
          details: histCatch?.details,
          hint: histCatch?.hint,
        },
      );
      // Log de defesa — usa 'criar' (compatível com CHECK atual do logs_auditoria.acao)
      // e prefixa a descrição para facilitar busca futura.
      await insertAuditLog(supabase as any, {
        acao: "criar",
        modulo: "associados",
        tabela: "associados_historico",
        descricao: `[FALHA_REGISTRO_HISTORICO_TROCA] Insert em associados_historico falhou na efetivação da troca ${solicitacao_id}: ${histCatch?.message || "erro desconhecido"}`,
        dados_novos: {
          solicitacao_id,
          erro: {
            message: histCatch?.message,
            code: histCatch?.code,
            details: histCatch?.details,
            hint: histCatch?.hint,
          },
          payload: historicoTrocaPayload,
        },
      }).then(({ error: logErr }) => {
        if (logErr) {
          console.error(
            "[efetivar-troca][FALHA_REGISTRO_LOG_AUDITORIA] log de defesa também falhou",
            logErr,
          );
        }
      });
      // Não relançar — passos 13+ (auditoria principal, WhatsApp, SGA) seguem.
    }

    // 13. Log de auditoria
    await insertAuditLog(supabase as any, {
      acao: "troca_titularidade_efetivada",
      modulo: "solicitacoes",
      descricao: `Troca de titularidade efetivada (Cenário ${cenario}). Novo titular: ${dadosNovoTitular.nome}. Contrato: ${novoContrato.numero}.`,
      dados_novos: {
        solicitacao_id,
        cenario,
        associado_anterior_id: solicitacao.associado_id,
        novo_associado_id: novoAssociadoId,
        veiculo_id: veiculoId,
        contrato_anterior_id: contratoAnterior?.id,
        novo_contrato_id: novoContrato.id,
        taxa_troca: taxaTroca,
        carencia_dias: carenciaDias,
        carencia_isenta: carenciaIsenta,
      },
    });

    // 14. Notificar novo titular via WhatsApp
    try {
      const telefoneNovo = dadosNovoTitular.telefone || null;
      if (telefoneNovo) {
        const telLimpo = telefoneNovo.replace(/\D/g, "");
        const telFmt = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;

        const placaVeiculo = veiculoData?.placa || "N/A";
        const modeloVeiculo = veiculoData?.modelo || "";
        const marcaVeiculo = veiculoData?.marca || "";
        const veiculoDescricao = `${marcaVeiculo} ${modeloVeiculo}`.trim() || "seu veículo";

        const mensagemBoasVindas = `Olá, ${dadosNovoTitular.nome}! 🎉\n\nSeja bem-vindo(a) à *Praticcar*!\n\nSeu veículo *${veiculoDescricao}* (placa *${placaVeiculo}*) foi registrado em seu nome com sucesso.\n\n📋 *Contrato:* ${novoContrato.numero}\n\nBaixe nosso app para acompanhar tudo sobre sua proteção veicular. Em caso de dúvidas, estamos à disposição!\n\nEquipe Praticcar 🚗`;

        // Template aprovado: troca_titularidade_aprovada
        // Vars: [primeiroNome, "MARCA MODELO PLACA"]
        const primeiroNomeNovo = (dadosNovoTitular.nome || '').split(' ')[0] || dadosNovoTitular.nome;
        const veiculoLabel = `${marcaVeiculo} ${modeloVeiculo} ${placaVeiculo}`.replace(/\s+/g, ' ').trim();
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            telefone: telFmt,
            mensagem: mensagemBoasVindas,
            template_name: "troca_titularidade_aprovada_v2",
            template_params: [primeiroNomeNovo, veiculoLabel],
            referencia_tipo: "troca_titularidade",
            referencia_id: solicitacao_id,
          }),
        });
        const sendData = await sendResp.json();
        console.log(`[efetivar-troca] WhatsApp novo titular: ${sendData.success ? "enviado" : "falhou"}`, sendData.error || "");
      } else {
        console.log("[efetivar-troca] Novo titular sem telefone — notificação WhatsApp não enviada");
        await insertAuditLog(supabase as any, {
          acao: "troca_titularidade_notificacao_ignorada",
          modulo: "solicitacoes",
          descricao: `Novo titular ${dadosNovoTitular.nome} sem telefone cadastrado — notificação WhatsApp não enviada.`,
          dados_novos: { solicitacao_id, novo_associado_id: novoAssociadoId },
        });
      }
    } catch (whatsErr) {
      console.error("[efetivar-troca] Erro ao notificar novo titular (não bloqueante):", whatsErr);
    }

    // 15. Sincronização SGA (Hinova) — não bloqueia o retorno em caso de erro;
    // grava status na tabela solicitacoes_troca_titularidade para retry posterior.
    let sgaStatus: 'sincronizado' | 'pendente' | 'falha' | 'nao_aplicavel' = 'nao_aplicavel';
    let sgaErro: string | null = null;
    let sgaCodigoAssociadoNovo: number | null = null;
    let sgaCodigoVeiculoNovo: number | null = null;

    try {
      const codAntigoExistente = (await supabase
        .from('associados').select('codigo_hinova').eq('id', solicitacao.associado_id).maybeSingle()
      ).data?.codigo_hinova as number | null | undefined;

      const veiculoChassi = veiculoData?.chassi || null;
      const veiculoPlaca = veiculoData?.placa || null;

      // 15.1 Garantir/criar novo associado no SGA
      let codigoAssociadoNovo: number | null = null;
      try {
        const buscaNovo = await buscarAssociadoComVeiculosPorCpf(
          await getHinovaSession(supabase),
          cpfLimpo,
        );
        codigoAssociadoNovo = buscaNovo.codigo_associado;
      } catch (e) {
        if (!(e instanceof HinovaNotFoundError)) throw e;
      }

      if (!codigoAssociadoNovo) {
        // Upsert idempotente + payload completo (Hinova exige endereço/estado).
        // Carrega associado local e usa buildAssociadoPayload — mesmo padrão do retry.
        const { data: assRow } = await supabase
          .from('associados').select('*').eq('id', novoAssociadoId).maybeSingle();
        if (!assRow) throw new Error(`Associado local ${novoAssociadoId} não encontrado para payload SGA`);
        const payloadA = buildAssociadoPayload(assRow as any, { data_contrato_iso: assRow.created_at ?? null });
        const cadAss = await cadastrarOuAtualizarAssociadoHinova(supabase, payloadA);
        if (cadAss.motivo === 'codigo_associado_nao_encontrado') {
          throw new Error(`[CODIGO_ASSOCIADO_NAO_ENCONTRADO] ${cadAss.mensagem}`);
        }
        if (!cadAss.ok || !cadAss.codigo) {
          throw new Error(`SGA cadastrarOuAtualizarAssociado falhou: ${cadAss.errors.join('; ') || cadAss.mensagem || cadAss.status}`);
        }
        codigoAssociadoNovo = cadAss.codigo;
        console.log(`[efetivar-troca][SGA] associado ${cadAss.codigo} via ${cadAss.via}`);

      } else {
        // Atualiza dados do associado existente (telefone/email)
        await alterarAssociadoHinova(supabase, {
          codigo_associado: codigoAssociadoNovo,
          nome: dadosNovoTitular.nome,
          email: dadosNovoTitular.email || undefined,
          telefone_celular: (dadosNovoTitular.telefone || '').replace(/\D/g, '') || undefined,
        }).catch((e) => console.warn('[efetivar-troca][SGA] alterarAssociado:', e?.message || e));
      }
      sgaCodigoAssociadoNovo = codigoAssociadoNovo;

      // Persiste código no associado local
      await supabase.from('associados').update({
        codigo_hinova: codigoAssociadoNovo,
        sincronizado_hinova: true,
        sincronizado_hinova_em: new Date().toISOString(),
      }).eq('id', novoAssociadoId);

      // 15.2 Localizar codigo_veiculo atual no SGA (chassi → fallback placa)
      let codigoVeiculoSga: number | null = null;
      let codigoAssociadoVeiculoAtual: number | null = null;
      if (veiculoChassi) {
        try {
          const found = await buscarVeiculoPorChassi(supabase, veiculoChassi);
          if (found.found) {
            codigoVeiculoSga = Number(found.found.codigo_veiculo) || null;
            codigoAssociadoVeiculoAtual = Number(found.found.codigo_associado) || null;
          }
        } catch (e) {
          console.warn('[efetivar-troca][SGA] buscarVeiculoPorChassi:', (e as Error).message);
        }
      }
      if (!codigoVeiculoSga && veiculoPlaca) {
        try {
          const placaLimpa = String(veiculoPlaca).replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const found = await buscarVeiculoPorPlaca(supabase, placaLimpa);
          if (found.found) {
            codigoVeiculoSga = Number(found.found.codigo_veiculo) || null;
            codigoAssociadoVeiculoAtual = Number(found.found.codigo_associado) || null;
          }
        } catch (e) {
          console.warn('[efetivar-troca][SGA] buscarVeiculoPorPlaca:', (e as Error).message);
        }
      }

      // 15.3 Já vinculado ao novo titular → idempotência
      const jaTransferido = codigoVeiculoSga && codigoAssociadoVeiculoAtual === codigoAssociadoNovo;

      if (jaTransferido) {
        sgaCodigoVeiculoNovo = codigoVeiculoSga;
      } else if (codigoVeiculoSga) {
        // 15.4 CAMINHO CANÔNICO — POST /alterar/veiculo
        // Apenas troca o associado vinculado; preserva codigo_veiculo e
        // o histórico Hinova do veículo. Substitui o antigo
        // alterarSituacaoVeiculo(cancelado) + cadastrarVeiculo(novo).
        //
        // transferir_agregados: regra ainda em definição. Quando definida,
        // passar array de codigo_voluntario aqui (ver sga-hinova-sync linha ~283).
        const ra = await alterarVeiculoHinova(supabase, {
          codigo_veiculo: codigoVeiculoSga,
          codigo_associado: codigoAssociadoNovo,
        });
        if (!ra.ok) {
          throw new Error(
            `SGA alterarVeiculo (troca titularidade) falhou: ${(ra.errors || []).join('; ') || ra.mensagem || `HTTP ${ra.status}`}`
          );
        }
        console.log(`[efetivar-troca][SGA] /alterar/veiculo OK: codigo_veiculo=${codigoVeiculoSga} → codigo_associado=${codigoAssociadoNovo}`);
        sgaCodigoVeiculoNovo = codigoVeiculoSga;
      } else {
        // 15.5 FALLBACK DEGENERADO — veículo não existe no Hinova.
        // Titular antigo nunca foi sincronizado. Só nesse caso cai no caminho
        // legado de cadastrar como novo. NÃO roda mais alterarSituacaoVeiculo(cancelado).
        console.warn('[efetivar-troca][SGA] veículo não encontrado no Hinova — fallback cadastrarVeiculo');
        const codigoGrupoProduto = await getConfiguracaoNumero(supabase, 'sga_codigo_grupo_produto_padrao', 0);
        const basePayloadVeiculo = {
          codigo_associado: codigoAssociadoNovo,
          codigo_tipo_veiculo: 1,
          placa: veiculoPlaca,
          chassi: veiculoChassi,
          renavam: veiculoData?.renavam || undefined,
          marca: veiculoData?.marca || undefined,
          modelo: veiculoData?.modelo || undefined,
          ano_fabricacao: veiculoData?.ano_fabricacao || undefined,
          ano_modelo: veiculoData?.ano_modelo || undefined,
          cor: veiculoData?.cor || undefined,
          valor_fipe: veiculoData?.valor_fipe || undefined,
          codigo_grupo_produto: codigoGrupoProduto || undefined,
        };

        let cadVeic;
        const codigoModeloPersistido = Number((veiculoData as any)?.codigo_modelo_hinova || 0) || null;

        if (codigoModeloPersistido) {
          cadVeic = await cadastrarVeiculoHinova(supabase, {
            ...basePayloadVeiculo,
            codigo_modelo: codigoModeloPersistido,
          });
        }

        if (!(cadVeic?.ok && cadVeic?.codigo)) {
          const variantesFipe = variantesCodigoFipe((veiculoData as any)?.codigo_fipe || null);
          for (const variante of variantesFipe) {
            cadVeic = await cadastrarVeiculoHinova(supabase, {
              ...basePayloadVeiculo,
              codigo_fipe: variante,
            });
            if (cadVeic.ok && cadVeic.codigo) break;

            const detalhe = `${(cadVeic.errors || []).join(' ')} ${cadVeic.mensagem || ''}`.toLowerCase();
            const ehErroDeModelo = detalhe.includes('modelo enviado') || (detalhe.includes('modelo') && detalhe.includes('encontrado'));
            if (!ehErroDeModelo) break;
          }
        }

        if (!(cadVeic?.ok && cadVeic?.codigo)) {
          const detalhe = `${(cadVeic?.errors || []).join(' ')} ${cadVeic?.mensagem || ''}`.toLowerCase();
          const ehErroDeModelo = detalhe.includes('modelo enviado') || (detalhe.includes('modelo') && detalhe.includes('encontrado'));

          if (ehErroDeModelo) {
            const lookup = await listarModelosHinova(supabase, {
              marca: String(veiculoData?.marca || '').trim(),
              texto: String(veiculoData?.modelo || '').trim(),
              ano: veiculoData?.ano_modelo || veiculoData?.ano_fabricacao || null,
              tipo_veiculo: 1,
            });
            const melhor = escolherMelhorModeloHinova(
              lookup.items,
              String(veiculoData?.modelo || ''),
              veiculoData?.ano_modelo || veiculoData?.ano_fabricacao || null,
            );

            if (melhor?.codigo_modelo) {
                cadVeic = await cadastrarVeiculoHinova(supabase, {
                  ...basePayloadVeiculo,
                  codigo_modelo: melhor.codigo_modelo,
                });

              if (cadVeic.ok && cadVeic.codigo) {
                await supabase
                  .from('veiculos')
                  .update({ codigo_modelo_hinova: melhor.codigo_modelo })
                  .eq('id', veiculoId);
              }
            }
          }
        }

        if (!(cadVeic?.ok && cadVeic?.codigo)) {
          throw new Error(`SGA cadastrarVeiculo (fallback troca titularidade) falhou: ${(cadVeic?.errors || []).join('; ') || cadVeic?.mensagem || cadVeic?.status || 'payload sem código_fipe/codigo_modelo válido'}`);
        }
        sgaCodigoVeiculoNovo = cadVeic.codigo;
      }


      // Persiste código no veículo local
      if (sgaCodigoVeiculoNovo) {
        await supabase.from('veiculos').update({
          codigo_hinova: sgaCodigoVeiculoNovo,
          sincronizado_hinova: true,
          sincronizado_hinova_em: new Date().toISOString(),
        }).eq('id', veiculoId);
      }

      // 15.6 Histórico de atendimento em ambos os associados
      const descSaida = `Troca de titularidade: veículo placa ${veiculoPlaca || '?'} transferido para ${dadosNovoTitular.nome} (CPF ${cpfLimpo}). Contrato ${novoContrato.numero}.`;
      const descEntrada = `Troca de titularidade: veículo placa ${veiculoPlaca || '?'} recebido de ${associadoAntigo?.nome || 'titular anterior'}. Contrato ${novoContrato.numero}.`;

      if (codAntigoExistente) {
        await cadastrarHistoricoAtendimentoHinova(supabase, {
          codigo_associado: Number(codAntigoExistente),
          descricao: descSaida,
        }).catch((e) => console.warn('[efetivar-troca][SGA] historico antigo:', e?.message || e));
      }
      await cadastrarHistoricoAtendimentoHinova(supabase, {
        codigo_associado: codigoAssociadoNovo,
        descricao: descEntrada,
      }).catch((e) => console.warn('[efetivar-troca][SGA] historico novo:', e?.message || e));

      sgaStatus = 'sincronizado';
      console.log('[efetivar-troca][SGA] ✅ Sincronização concluída');
    } catch (sgaErr) {
      sgaErro = (sgaErr as Error)?.message || String(sgaErr);
      const acaoManual = sgaErro.startsWith('[CODIGO_ASSOCIADO_NAO_ENCONTRADO]');
      sgaStatus = acaoManual ? 'falha_manual_codigo_nao_encontrado' : 'pendente';
      console.error('[efetivar-troca][SGA] ⚠️ Falha (não bloqueante):', sgaErro, acaoManual ? '(ação manual)' : '');

      // Enfileira na sga_sync_queue. Quando exige ação manual (CPF existe no Hinova
      // mas /buscar não retorna), grava como falha_permanente para o cron não retentar.
      await supabase.from('sga_sync_queue').insert({
        veiculo_id: veiculoId,
        associado_id: novoAssociadoId,
        status: acaoManual ? 'falha_permanente' : 'pendente',
        etapa_parou: acaoManual ? 'troca_titularidade:codigo_associado_nao_encontrado' : 'troca_titularidade',
        erro_ultimo: sgaErro,
        origem: 'troca_titularidade',
        codigo_associado_hinova: sgaCodigoAssociadoNovo,
        codigo_veiculo_hinova: sgaCodigoVeiculoNovo,
      }).then(({ error }) => {
        if (error) console.warn('[efetivar-troca][SGA] enqueue retry falhou:', error.message);
      });
    }


    // 16. Atualiza solicitacoes_troca_titularidade — marca como efetivada
    await supabase.from('solicitacoes_troca_titularidade').update({
      status: 'efetivada',
      efetivada_em: new Date().toISOString(),
      novo_associado_id: novoAssociadoId,
      sga_status: sgaStatus === 'nao_aplicavel' ? 'pendente' : sgaStatus,
      sga_erro: sgaErro,
      sga_codigo_associado_novo: sgaCodigoAssociadoNovo,
      sga_codigo_veiculo_novo: sgaCodigoVeiculoNovo,
      sga_sincronizado_em: sgaStatus === 'sincronizado' ? new Date().toISOString() : null,
    }).eq('id', solicitacao_id).then(({ error }) => {
      if (error) console.warn('[efetivar-troca] update solicitacoes_troca:', error.message);
    });

    console.log(`[efetivar-troca] ✅ Efetivação concluída com sucesso`);


    return new Response(
      JSON.stringify({
        success: true,
        cenario,
        novo_associado_id: novoAssociadoId,
        novo_contrato_id: novoContrato.id,
        novo_contrato_numero: novoContrato.numero,
        contrato_anterior_id: contratoAnterior?.id || null,
        taxa_troca: taxaTroca,
        carencia_dias: carenciaDias,
        carencia_isenta: carenciaIsenta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[efetivar-troca] Erro:", msg, error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
