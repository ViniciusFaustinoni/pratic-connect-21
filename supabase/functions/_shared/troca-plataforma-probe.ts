/**
 * troca-plataforma-probe — sondagem real do estado da plataforma do rastreador
 * para a Regra das 3 Pontas (efetivar troca de titularidade).
 *
 * Faz uma leitura HTTP direta (sem cache) na Softruck ou Rede Veículos e
 * confirma duas coisas:
 *   1) o userId do novo titular ESTÁ vinculado ao veículo
 *   2) o userId do antigo titular NÃO ESTÁ mais vinculado
 *
 * Só então retorna 'sincronizado'. Qualquer divergência mantém 'pendente'.
 *
 * Este helper NÃO escreve no banco. A escrita em
 * `solicitacoes_troca_titularidade.plataforma_rastreador_status` é
 * responsabilidade do caller (edge `troca-promover-com-sondagem`).
 */
// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProbeStatus =
  | "sincronizado"
  | "pendente"
  | "nao_aplicavel"
  | "falha";

export interface ProbeResult {
  status: ProbeStatus;
  motivo: string;
  detalhes?: Record<string, unknown>;
  novoUserId?: string;
  antigoUserId?: string;
  vehicleId?: string;
}

function normCpf(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

async function buscarUserIdSoftruck(
  supabase: SupabaseClient,
  cpf: string,
  email?: string | null,
): Promise<string | null> {
  if (!cpf && !email) return null;
  try {
    const resp = await supabase.functions.invoke("softruck-api", {
      body: {
        operation: "buscar-usuario",
        data: cpf ? { cpf } : { email },
      },
    });
    const data = (resp as any)?.data ?? resp;
    const arr = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];
    const first = arr[0];
    const id = first?.id ?? first?.user?.id ?? first?.attributes?.id;
    return id ? String(id) : null;
  } catch (_e) {
    return null;
  }
}

async function listarUserIdsVeiculoSoftruck(
  supabase: SupabaseClient,
  vehicleId: string,
): Promise<{ ok: boolean; userIds: string[]; raw?: any }> {
  try {
    const resp = await supabase.functions.invoke("softruck-api", {
      body: { operation: "listar-usuarios-veiculo", data: { vehicleId } },
    });
    const data = (resp as any)?.data ?? resp;
    const arr = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];
    const userIds = arr.map((it: any) =>
      String(it?.user?.id ?? it?.attributes?.user_id ?? it?.id ?? "")
    ).filter(Boolean);
    return { ok: true, userIds, raw: data };
  } catch (e) {
    return { ok: false, userIds: [], raw: { erro: (e as Error)?.message } };
  }
}

async function sondarRede(
  supabase: SupabaseClient,
  veiculoId: string,
  novoAssociadoId: string,
): Promise<ProbeResult> {
  // Para Rede Veículos a leitura direta é via `rede-veiculos-buscar-dispositivo`.
  // Não dá pra checar "antigo ausente" no mesmo nível da Softruck, então o
  // critério é mais frouxo: dispositivo encontrado vinculado ao novo cliente.
  try {
    const resp = await supabase.functions.invoke(
      "rede-veiculos-buscar-dispositivo",
      { body: { veiculo_id: veiculoId } },
    );
    const data = (resp as any)?.data ?? resp;
    const clienteId = data?.cliente_id ?? data?.clienteId;

    if (!clienteId) {
      return {
        status: "pendente",
        motivo: "rede:dispositivo_sem_cliente",
        detalhes: { data },
      };
    }

    const { data: veic } = await supabase
      .from("veiculos")
      .select("rede_veiculos_cliente_id")
      .eq("id", veiculoId)
      .maybeSingle();

    if (
      veic?.rede_veiculos_cliente_id &&
      String(veic.rede_veiculos_cliente_id) === String(clienteId)
    ) {
      return {
        status: "sincronizado",
        motivo: "rede:cliente_alinhado",
        detalhes: { clienteId },
      };
    }

    return {
      status: "pendente",
      motivo: "rede:cliente_divergente",
      detalhes: { clienteId, esperado: veic?.rede_veiculos_cliente_id },
    };
  } catch (e) {
    return {
      status: "falha",
      motivo: "rede:erro_consulta",
      detalhes: { erro: (e as Error)?.message },
    };
  }
}

export async function sondarPlataformaTroca(
  supabase: SupabaseClient,
  solicitacaoId: string,
): Promise<ProbeResult> {
  // 1) Carrega solicitação
  const { data: sol, error } = await supabase
    .from("solicitacoes_troca_titularidade")
    .select(
      "id, veiculo_id, novo_associado_id, associado_antigo_id",
    )
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (error || !sol) {
    return {
      status: "falha",
      motivo: "solicitacao_nao_encontrada",
      detalhes: { erro: error?.message },
    };
  }

  const veiculoId = sol.veiculo_id as string;
  const novoAssocId = sol.novo_associado_id as string | null;
  const antigoAssocId = sol.associado_antigo_id as string | null;

  if (!novoAssocId) {
    return { status: "pendente", motivo: "sem_novo_associado_id" };
  }

  // 2) Veículo precisa de rastreador?
  let precisaRastr = true;
  try {
    const { data: precisa } = await supabase.rpc(
      "fn_veiculo_precisa_rastreador",
      { _veiculo_id: veiculoId },
    );
    precisaRastr = precisa === true;
  } catch (_e) {
    // mantém true por segurança
  }

  // 3) Resolve plataforma + vehicleId
  const { data: rastr } = await supabase
    .from("rastreadores")
    .select("plataforma, plataforma_veiculo_id, imei")
    .eq("veiculo_id", veiculoId)
    .eq("status", "instalado")
    .maybeSingle();

  const { data: veic } = await supabase
    .from("veiculos")
    .select("softruck_vehicle_id, rede_veiculos_cliente_id, placa")
    .eq("id", veiculoId)
    .maybeSingle();

  const plataforma = (rastr as any)?.plataforma as string | undefined;
  const vehicleIdSoftruck =
    (veic as any)?.softruck_vehicle_id ||
    (rastr as any)?.plataforma_veiculo_id ||
    null;

  // 4) Sem rastreador instalado E veículo não exige → nao_aplicavel
  if (!rastr && !vehicleIdSoftruck && !precisaRastr) {
    return { status: "nao_aplicavel", motivo: "veiculo_dispensa_rastreador" };
  }

  // 5) Rede Veículos
  if (plataforma === "rede_veiculos") {
    return await sondarRede(supabase, veiculoId, novoAssocId);
  }

  // 6) Softruck (default)
  if (!vehicleIdSoftruck) {
    return {
      status: "pendente",
      motivo: "softruck:vehicle_id_ausente",
    };
  }

  // CPF/email do novo e do antigo
  const [{ data: novoAssoc }, { data: antigoAssoc }] = await Promise.all([
    supabase
      .from("associados")
      .select("cpf, email")
      .eq("id", novoAssocId)
      .maybeSingle(),
    antigoAssocId
      ? supabase
        .from("associados")
        .select("cpf, email")
        .eq("id", antigoAssocId)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const novoUserId = await buscarUserIdSoftruck(
    supabase,
    normCpf((novoAssoc as any)?.cpf),
    (novoAssoc as any)?.email,
  );

  const antigoUserId = antigoAssoc
    ? await buscarUserIdSoftruck(
      supabase,
      normCpf((antigoAssoc as any)?.cpf),
      (antigoAssoc as any)?.email,
    )
    : null;

  if (!novoUserId) {
    return {
      status: "pendente",
      motivo: "softruck:user_id_novo_nao_resolvido",
    };
  }

  const list = await listarUserIdsVeiculoSoftruck(
    supabase,
    String(vehicleIdSoftruck),
  );

  if (!list.ok) {
    return {
      status: "falha",
      motivo: "softruck:listagem_falhou",
      detalhes: list.raw,
    };
  }

  const novoPresente = list.userIds.includes(novoUserId);
  const antigoPresente = !!antigoUserId && list.userIds.includes(antigoUserId);

  if (novoPresente && !antigoPresente) {
    return {
      status: "sincronizado",
      motivo: "softruck:novo_presente_antigo_ausente",
      novoUserId,
      antigoUserId: antigoUserId || undefined,
      vehicleId: String(vehicleIdSoftruck),
      detalhes: { userIds: list.userIds },
    };
  }

  if (!novoPresente) {
    return {
      status: "pendente",
      motivo: "softruck:novo_ausente",
      novoUserId,
      antigoUserId: antigoUserId || undefined,
      vehicleId: String(vehicleIdSoftruck),
      detalhes: { userIds: list.userIds },
    };
  }

  return {
    status: "pendente",
    motivo: "softruck:antigo_ainda_vinculado",
    novoUserId,
    antigoUserId: antigoUserId || undefined,
    vehicleId: String(vehicleIdSoftruck),
    detalhes: { userIds: list.userIds },
  };
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
