import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sinistro_id, cotacao_id } = await req.json();
    if (!sinistro_id || !cotacao_id) {
      return new Response(JSON.stringify({ error: "sinistro_id e cotacao_id obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar sinistro com veículo e associado
    const { data: sinistro, error: errSinistro } = await supabase
      .from("sinistros")
      .select("id, protocolo, veiculo_id, associado_id, oficina_id")
      .eq("id", sinistro_id)
      .single();
    if (errSinistro || !sinistro) throw new Error("Sinistro não encontrado");
    if (!sinistro.oficina_id) throw new Error("Oficina não atribuída ao sinistro. Atribua fornecedores antes de gerar a OS.");

    // 1b. Buscar prestadores vinculados ao sinistro
    const { data: prestadoresVinculados } = await supabase
      .from("sinistro_prestadores")
      .select("prestador:prestadores(id, nome, especialidades)")
      .eq("sinistro_id", sinistro_id);
    const nomesPrestadores = (prestadoresVinculados || [])
      .map((p: any) => p.prestador?.nome)
      .filter(Boolean);

    // 2. Buscar cotação aprovada
    const { data: cotacao, error: errCotacao } = await supabase
      .from("evento_cotacoes_pecas")
      .select("id, auto_center_id, resposta, valor_total, itens")
      .eq("id", cotacao_id)
      .single();
    if (errCotacao || !cotacao) throw new Error("Cotação não encontrada");

    // 3. Buscar vistoria concluída do sinistro para etapas e orçamento
    const { data: vistoria } = await supabase
      .from("vistorias")
      .select("id, itens_orcamento, etapas_reparo")
      .eq("sinistro_id", sinistro_id)
      .eq("status", "concluida")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Buscar veículo e associado para WhatsApp
    const [veiculoRes, associadoRes] = await Promise.all([
      supabase.from("veiculos").select("placa, marca, modelo").eq("id", sinistro.veiculo_id).single(),
      supabase.from("associados").select("nome, whatsapp, telefone").eq("id", sinistro.associado_id).single(),
    ]);
    const veiculo = veiculoRes.data;
    const associado = associadoRes.data;

    // 5. Preparar etapas de reparo como checkpoints
    const etapasReparo = (vistoria?.etapas_reparo || []).map((etapa: any) => ({
      nome: typeof etapa === "string" ? etapa : etapa.nome || etapa,
      status: "pendente",
      atualizado_em: null,
    }));

    // 6. Criar OS
    const observacoesOS = nomesPrestadores.length > 0
      ? `OS gerada automaticamente a partir do evento ${sinistro.protocolo}. Prestadores vinculados: ${nomesPrestadores.join(', ')}`
      : `OS gerada automaticamente a partir do evento ${sinistro.protocolo}`;

    const { data: os, error: errOS } = await supabase
      .from("ordens_servico")
      .insert({
        numero: "",
        sinistro_id,
        oficina_id: sinistro.oficina_id,
        veiculo_id: sinistro.veiculo_id,
        associado_id: sinistro.associado_id,
        auto_center_id: cotacao.auto_center_id,
        cotacao_aprovada_id: cotacao.id,
        etapas_reparo: etapasReparo,
        status: "aguardando_entrada",
        observacoes: observacoesOS,
      })
      .select("id, numero")
      .single();
    if (errOS) throw new Error("Erro ao criar OS: " + errOS.message);

    // 7. Inserir itens — peças da cotação + MO/serviços do orçamento
    const itensParaInserir: any[] = [];

    // Peças da cotação aprovada
    const respostaItens = cotacao.resposta?.itens || [];
    for (const item of respostaItens) {
      if (item.disponibilidade === "indisponivel") continue;
      itensParaInserir.push({
        ordem_servico_id: os.id,
        tipo: "peca",
        descricao: item.descricao || item.nome,
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        valor_total: (item.valor_unitario || 0) * (item.quantidade || 1),
        aprovado: true,
      });
    }

    // MO e serviços do orçamento do regulador
    const orcamentoItens = vistoria?.itens_orcamento || [];
    for (const item of orcamentoItens) {
      if (item.tipo === "peca") continue; // peças vêm da cotação
      itensParaInserir.push({
        ordem_servico_id: os.id,
        tipo: item.tipo || "servico",
        descricao: item.descricao || item.nome,
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        valor_total: (item.valor_unitario || 0) * (item.quantidade || 1),
        aprovado: true,
      });
    }

    if (itensParaInserir.length > 0) {
      const { error: errItens } = await supabase.from("ordens_servico_itens").insert(itensParaInserir);
      if (errItens) console.error("Erro ao inserir itens:", errItens.message);
    }

    // Calcular valor total da OS
    const valorTotal = itensParaInserir.reduce((sum, i) => sum + (i.valor_total || 0), 0);
    await supabase.from("ordens_servico").update({ valor_orcamento: valorTotal }).eq("id", os.id);

    // 8. Registrar histórico
    await supabase.from("ordens_servico_historico").insert({
      ordem_servico_id: os.id,
      status_novo: "aguardando_entrada",
      observacao: `OS gerada automaticamente após aprovação da cotação de peças. Evento: ${sinistro.protocolo}`,
    });

    // 9. Enviar WhatsApp ao associado
    if (associado && (associado.whatsapp || associado.telefone) && veiculo) {
      const telefone = associado.whatsapp || associado.telefone;
      const primeiroNome = associado.nome?.split(" ")[0] || "Associado";
      const mensagem = `Olá ${primeiroNome}, confirmamos tudo! As peças para o reparo do seu veículo ${veiculo.placa} já foram cotadas e aprovadas, e em breve serão enviadas para a oficina. Acompanhe cada etapa do reparo — vamos te atualizar sobre cada passo!`;

      try {
        const whatsappUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send-text`;
        await fetch(whatsappUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            telefone,
            mensagem,
            template_name: 'sinistro_atualizado',
            template_params: [primeiroNome, veiculo.placa, 'Peças aprovadas e sendo providenciadas! Acompanhe cada etapa do reparo.'],
          }),
        });
      } catch (e) {
        console.error("Erro ao enviar WhatsApp:", e);
      }
    }

    // 10. Agendar mensagem de follow-up 15min após (via cron-contato-sinistro)
    if (associado && (associado.whatsapp || associado.telefone) && veiculo) {
      const telefone15 = associado.whatsapp || associado.telefone;
      const nome15 = associado.nome?.split(" ")[0] || "Associado";
      const agendadoPara = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const mensagem15 = `${nome15}, aqui é a Pratic Car novamente! 😊 Só confirmando: o pagamento da sua cota foi processado, as peças já estão sendo providenciadas junto ao fornecedor aprovado, e a oficina já está preparada para receber seu veículo ${veiculo.placa}. Vamos te acompanhar em cada etapa do reparo — qualquer novidade, avisamos por aqui! 🚗`;

      try {
        await supabase.from("sinistro_contatos_agendados").insert({
          sinistro_id,
          tipo: "pos_os_gerada",
          telefone: telefone15,
          agendado_para: agendadoPara,
          mensagem_enviada: mensagem15,
          status: "agendado",
        });
      } catch (e) {
        console.error("Erro ao agendar mensagem 15min:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, os_id: os.id, os_numero: os.numero }), { headers: corsHeaders });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
