/**
 * Telemetria de clique abortado no stepper do Cadastro.
 *
 * Sempre que o analista CLICA num botão de aprovação que está
 * bloqueado por um gate, registramos:
 *   - `client_telemetry`  → endpoint `ui:aprovar-cadastro:bloqueado`
 *   - `logs_auditoria`    → ação `visualizar` com descrição `[CLIQUE_BLOQUEADO] ...`
 *
 * Throttle: 30s por (contratoId + motivosHash) — evita flood se o analista
 * clica várias vezes seguidas tentando entender o porquê.
 *
 * Motivação: padrão do bug LUIZ FERNANDO (RVP0I41) — clique sumiu silenciosamente
 * em `pointer-events-none`, edges nunca foram invocadas, sem rastro server-side.
 * Agora qualquer tentativa abortada deixa pegada.
 */
import { supabase } from '@/integrations/supabase/client';
import { registrarLog } from '@/hooks/useAuditLog';

const JANELA_THROTTLE_MS = 30_000;
const ultimoEnvio = new Map<string, number>();

function hashMotivos(motivos: string[]): string {
  return [...motivos].sort().join('|');
}

export interface CliqueBloqueadoParams {
  contratoId: string;
  subEtapa: 1 | 2;
  motivos: string[]; // ids dos gates ativos
}

export async function registrarCliqueBloqueado(
  params: CliqueBloqueadoParams,
): Promise<void> {
  const { contratoId, subEtapa, motivos } = params;
  if (!contratoId || motivos.length === 0) return;

  const chave = `${contratoId}|${subEtapa}|${hashMotivos(motivos)}`;
  const agora = Date.now();
  const ultimo = ultimoEnvio.get(chave) ?? 0;
  if (agora - ultimo < JANELA_THROTTLE_MS) return;
  ultimoEnvio.set(chave, agora);

  // Best-effort em paralelo — nada aqui pode quebrar a UI.
  void Promise.allSettled([
    enviarTelemetria(subEtapa, motivos),
    registrarLog({
      acao: 'visualizar',
      modulo: 'cadastro',
      descricao: `[CLIQUE_BLOQUEADO] sub-etapa ${subEtapa} — motivos: ${motivos.join(', ')}`,
      entidade_id: contratoId,
      tabela: 'contratos',
      dados_novos: { sub_etapa: subEtapa, motivos },
    }),
  ]).catch(() => void 0);
}

async function enviarTelemetria(
  subEtapa: 1 | 2,
  motivos: string[],
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const route =
      typeof window !== 'undefined' ? window.location.pathname : null;
    const window_start = new Date(
      Math.floor(Date.now() / 60_000) * 60_000,
    ).toISOString();

    await supabase.from('client_telemetry').insert({
      user_id: user.id,
      endpoint: 'ui:aprovar-cadastro:bloqueado',
      method: `subetapa_${subEtapa}`,
      status_bucket: motivos.join(','),
      count: 1,
      error_count: 1,
      avg_ms: 0,
      route,
      window_start,
    });
  } catch (e) {
    console.debug('[telemetria-clique-bloqueado] insert falhou', e);
  }
}
