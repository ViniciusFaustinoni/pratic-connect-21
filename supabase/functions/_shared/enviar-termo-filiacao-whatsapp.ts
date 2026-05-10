// ============================================================
// Helper: enviarTermoFiliacaoWhatsApp
// Envia o link de assinatura do Termo de Filiação via WhatsApp
// usando template Meta com botão URL dinâmico (https://assina.ae/{{1}}),
// mesmo padrão dos demais templates de assinatura aprovados pela Meta.
//
// Ordem de templates:
//   1) termo_filiacao_assinatura_v2  (3 params: nome, veiculo, contrato)
//   2) assinatura_documento_v2       (2 params: nome, nomeDoc) — fallback
//
// Nunca lança erro: faz log e retorna { success: false, error } em
// caso de falha para não quebrar o fluxo de criação do contrato.
// ============================================================

interface EnviarTermoFiliacaoParams {
  contratoId: string;
  telefone?: string | null;
  nomeCompleto?: string | null;
  veiculoLabel?: string | null;   // ex: "HB20 - ABC1234"
  numeroContrato?: string | null; // ex: "PRT-2026-001234"
  autentiqueUrl: string;          // ex: https://assina.ae/abcd123
  vendedorTelefone?: string | null;
  vendedorNome?: string | null;
  tipoEntrada?: string | null;    // ex: 'troca_titularidade', 'adesao'
}

interface ResultadoEnvio {
  success: boolean;
  template_usado?: string;
  message_id?: string;
  error?: string;
  skipped?: boolean;
}

const PRIMARY_TEMPLATE = 'termo_filiacao_assinatura_v2';
const FALLBACK_TEMPLATE = 'assinatura_documento_v2';

function extrairToken(url: string): string | null {
  if (!url) return null;
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    const last = cleaned.split('/').pop();
    return last || null;
  } catch {
    return null;
  }
}

function primeiroNome(nome?: string | null): string {
  if (!nome) return 'Cliente';
  const parts = String(nome).trim().split(/\s+/);
  return parts[0] || 'Cliente';
}

export async function enviarTermoFiliacaoWhatsApp(
  supabase: any,
  params: EnviarTermoFiliacaoParams,
): Promise<ResultadoEnvio> {
  const tag = '[enviar-termo-filiacao-whatsapp]';
  try {
    if (!params.telefone) {
      console.warn(`${tag} skip: telefone ausente`, { contratoId: params.contratoId });
      return { success: false, skipped: true, error: 'telefone ausente' };
    }
    const token = extrairToken(params.autentiqueUrl);
    if (!token) {
      console.warn(`${tag} skip: token não extraído da url`, { url: params.autentiqueUrl });
      return { success: false, skipped: true, error: 'url autentique inválida' };
    }

    // Buscar templates aprovados (preferindo o primário)
    const { data: templates, error: tplErr } = await supabase
      .from('whatsapp_meta_templates')
      .select('nome, status')
      .in('nome', [PRIMARY_TEMPLATE, FALLBACK_TEMPLATE])
      .eq('status', 'APPROVED');

    if (tplErr) {
      console.warn(`${tag} erro ao buscar templates:`, tplErr.message);
    }

    const aprovadosSet = new Set((templates || []).map((t: any) => t.nome));
    let templateName: string;
    let templateParams: string[];

    const nome = primeiroNome(params.nomeCompleto);
    const veiculo = params.veiculoLabel || 'Veículo cadastrado';
    const numero = params.numeroContrato || 'Termo de Afiliação';

    if (aprovadosSet.has(PRIMARY_TEMPLATE)) {
      templateName = PRIMARY_TEMPLATE;
      templateParams = [nome, veiculo, numero];
    } else if (aprovadosSet.has(FALLBACK_TEMPLATE)) {
      templateName = FALLBACK_TEMPLATE;
      templateParams = [nome, `Termo de Afiliação ${numero}`];
    } else {
      console.warn(`${tag} skip: nenhum template aprovado disponível`);
      return { success: false, skipped: true, error: 'sem template aprovado' };
    }

    console.log(`${tag} enviando`, {
      contratoId: params.contratoId,
      telefone: params.telefone,
      template: templateName,
      token,
    });

    const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: params.telefone,
        mensagem: `Seu Termo de Filiação está pronto para assinatura: ${params.autentiqueUrl}`,
        template_name: templateName,
        template_params: templateParams,
        template_button_params: [token],
        referencia_tipo: 'termo_filiacao',
        referencia_id: params.contratoId,
        force_provider: 'meta_oficial',
      },
    });

    if (error) {
      console.error(`${tag} erro invoke whatsapp-send-text:`, error);
      return { success: false, template_usado: templateName, error: error.message };
    }
    if (data && data.success === false) {
      console.error(`${tag} send falhou:`, data.error);
      return { success: false, template_usado: templateName, error: data.error };
    }

    console.log(`${tag} enviado com sucesso`, { contratoId: params.contratoId, template: templateName });
    return {
      success: true,
      template_usado: templateName,
      message_id: data?.message_id || data?.mensagem_id,
    };
  } catch (err: any) {
    console.error(`${tag} exceção:`, err?.message || err);
    return { success: false, error: err?.message || 'erro desconhecido' };
  }
}
