import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Formatar tipo de documento para exibição
function formatarTipoDocumento(tipo: string): string {
  const tipos: Record<string, string> = {
    cnh: 'CNH',
    cpf: 'CPF',
    rg: 'RG',
    crlv: 'CRLV',
    comprovante_residencia: 'Comprovante de Residência',
    contrato_assinado: 'Contrato Assinado',
    foto_veiculo: 'Foto do Veículo',
    foto_hodometro: 'Foto do Hodômetro',
    nota_fiscal: 'Nota Fiscal',
    outro: 'Outro',
  };
  return tipos[tipo] || tipo;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[cron-lembrete-documentos] Iniciando verificação de documentos pendentes...");

    // Buscar documentos pendentes há mais de 3 dias (com prazo de 7 dias)
    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Buscar documentos solicitados pendentes
    const { data: docsPendentes, error: docsError } = await supabase
      .from("documentos_solicitados")
      .select(`
        id, 
        tipo_documento, 
        created_at,
        lembrete_enviado_em,
        associado_id,
        associados(id, nome, whatsapp, telefone, email)
      `)
      .eq("status", "pendente")
      .lt("created_at", tresDiasAtras.toISOString())
      .gt("created_at", seteDiasAtras.toISOString()); // Não enviar para documentos muito antigos

    if (docsError) {
      console.error("[cron-lembrete-documentos] Erro ao buscar documentos:", docsError);
      throw docsError;
    }

    console.log(`[cron-lembrete-documentos] ${docsPendentes?.length || 0} documentos pendentes encontrados`);

    if (!docsPendentes || docsPendentes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, lembretes_enviados: 0, mensagem: "Nenhum documento pendente para lembrar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agrupar por associado para enviar uma única mensagem
    const docsAgrupados: Record<string, { 
      associado: any; 
      documentos: string[]; 
      docIds: string[];
      diasRestantes: number;
    }> = {};

    for (const doc of docsPendentes) {
      const associado = doc.associados;
      if (!associado) continue;

      // Verificar se já enviou lembrete nas últimas 24h
      if (doc.lembrete_enviado_em) {
        const ultimoLembrete = new Date(doc.lembrete_enviado_em);
        const horasDesdeUltimoLembrete = (Date.now() - ultimoLembrete.getTime()) / (1000 * 60 * 60);
        if (horasDesdeUltimoLembrete < 24) {
          continue; // Pular - lembrete já enviado recentemente
        }
      }

      const associadoId = doc.associado_id;
      const createdAt = new Date(doc.created_at);
      const prazoFinal = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const diasRestantes = Math.ceil((prazoFinal.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      if (!docsAgrupados[associadoId]) {
        docsAgrupados[associadoId] = {
          associado,
          documentos: [],
          docIds: [],
          diasRestantes: diasRestantes,
        };
      }

      docsAgrupados[associadoId].documentos.push(formatarTipoDocumento(doc.tipo_documento));
      docsAgrupados[associadoId].docIds.push(doc.id);
      
      // Usar o menor prazo restante
      if (diasRestantes < docsAgrupados[associadoId].diasRestantes) {
        docsAgrupados[associadoId].diasRestantes = diasRestantes;
      }
    }

    let lembretesEnviados = 0;
    const erros: string[] = [];

    // Enviar lembretes
    for (const [associadoId, dados] of Object.entries(docsAgrupados)) {
      const { associado, documentos, docIds, diasRestantes } = dados;
      const telefone = associado.whatsapp || associado.telefone;

      if (!telefone) {
        console.log(`[cron-lembrete-documentos] Associado ${associado.nome} sem telefone`);
        continue;
      }

      try {
        // Enviar notificação
        const { error: notifError } = await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'lembrete_documentos',
            associado_id: associadoId,
            dados: {
              documentos: documentos.join(', '),
              dias_restantes: diasRestantes > 0 ? diasRestantes : 1,
            },
          },
        });

        if (notifError) {
          throw notifError;
        }

        // Atualizar data do lembrete enviado
        await supabase
          .from("documentos_solicitados")
          .update({ lembrete_enviado_em: new Date().toISOString() })
          .in("id", docIds);

        lembretesEnviados++;
        console.log(`[cron-lembrete-documentos] Lembrete enviado para ${associado.nome} (${documentos.length} docs)`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        erros.push(`${associado.nome}: ${errorMsg}`);
        console.error(`[cron-lembrete-documentos] Erro ao enviar lembrete para ${associado.nome}:`, err);
      }
    }

    console.log(`[cron-lembrete-documentos] Concluído: ${lembretesEnviados} lembretes enviados`);

    return new Response(
      JSON.stringify({
        success: true,
        lembretes_enviados: lembretesEnviados,
        total_pendentes: docsPendentes.length,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[cron-lembrete-documentos] Erro:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
