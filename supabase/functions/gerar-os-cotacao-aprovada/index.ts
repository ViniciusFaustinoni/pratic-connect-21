// @ts-nocheck
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

    // 1. Buscar sinistro com veículo, associado e status da cota
    const { data: sinistro, error: errSinistro } = await supabase
      .from("sinistros")
      .select("id, protocolo, veiculo_id, associado_id, oficina_id, cota_paga, valor_cota_participacao")
      .eq("id", sinistro_id)
      .single();
    if (errSinistro || !sinistro) throw new Error("Sinistro não encontrado");
    if (!sinistro.oficina_id) throw new Error("Oficina não atribuída ao sinistro. Atribua fornecedores antes de gerar a OS.");

    // GUARD: só gera OS se a cota estiver paga ou se o associado for isento (valor 0)
    const isentoCota = !sinistro.valor_cota_participacao || Number(sinistro.valor_cota_participacao) === 0;
    if (!sinistro.cota_paga && !isentoCota) {
      return new Response(JSON.stringify({
        error: "Aguardando confirmação de pagamento da coparticipação. A OS será gerada automaticamente após o pagamento.",
        aguardando_pagamento: true,
      }), { status: 409, headers: corsHeaders });
    }


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

    // 7. Inserir itens — peças da cotação primeiro (precisamos do id para vincular MO)
    const orcamentoItens: any[] = vistoria?.itens_orcamento || [];

    // Peças da cotação aprovada
    const respostaItens = cotacao.resposta?.itens || [];
    const pecasParaInserir: any[] = [];
    for (const item of respostaItens) {
      if (item.disponibilidade === "indisponivel") continue;
      // Tenta achar a peça correspondente no orçamento original p/ herdar área/operação/flags
      const orcPeca = orcamentoItens.find(
        (o) => o.tipo === "peca" &&
          (o.descricao || "").toLowerCase().trim() === (item.descricao || item.nome || "").toLowerCase().trim()
      );
      pecasParaInserir.push({
        ordem_servico_id: os.id,
        tipo: "peca",
        descricao: item.descricao || item.nome,
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        valor_total: (item.valor_unitario || 0) * (item.quantidade || 1),
        aprovado: true,
        operacao: orcPeca?.operacao ?? "T",
        area_impacto: orcPeca?.area_impacto ?? null,
        flags: orcPeca?.flags ?? [],
      });
    }

    // Insere peças e captura ids para resolver peca_pai_id da MO
    const pecaIdByDescricao = new Map<string, string>();
    if (pecasParaInserir.length > 0) {
      const { data: pecasInseridas, error: errPecas } = await supabase
        .from("ordens_servico_itens")
        .insert(pecasParaInserir)
        .select("id, descricao");
      if (errPecas) console.error("Erro ao inserir peças:", errPecas.message);
      for (const p of pecasInseridas ?? []) {
        pecaIdByDescricao.set((p.descricao || "").toLowerCase().trim(), p.id);
      }
    }

    // MO e serviços do orçamento do regulador (vinculados à peça pai quando aplicável)
    const moParaInserir: any[] = [];
    for (const item of orcamentoItens) {
      if (item.tipo === "peca") continue; // peças vêm da cotação
      let peca_pai_id: string | null = null;
      if (typeof item.peca_pai_idx === "number") {
        const pecaPai = orcamentoItens[item.peca_pai_idx];
        if (pecaPai?.descricao) {
          peca_pai_id = pecaIdByDescricao.get(pecaPai.descricao.toLowerCase().trim()) ?? null;
        }
      }
      moParaInserir.push({
        ordem_servico_id: os.id,
        tipo: item.tipo || "servico",
        descricao: item.descricao || item.nome,
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        valor_total: (item.valor_unitario || 0) * (item.quantidade || 1),
        aprovado: true,
        operacao: item.operacao ?? null,
        area_impacto: item.area_impacto ?? null,
        horas: item.horas ?? null,
        flags: item.flags ?? [],
        peca_pai_id,
      });
    }
    if (moParaInserir.length > 0) {
      const { error: errMO } = await supabase.from("ordens_servico_itens").insert(moParaInserir);
      if (errMO) console.error("Erro ao inserir MO/serviços:", errMO.message);
    }

    const itensParaInserir = [...pecasParaInserir, ...moParaInserir];

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
