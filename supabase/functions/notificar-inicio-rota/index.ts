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
    const { servico_id } = await req.json();
    
    if (!servico_id) {
      console.error("[notificar-inicio-rota] servico_id não fornecido");
      return new Response(
        JSON.stringify({ success: false, error: "servico_id é obrigatório" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[notificar-inicio-rota] Iniciando para serviço: ${servico_id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar dados completos do serviço
    const { data: servico, error: servicoError } = await supabase
      .from('servicos')
      .select(`
        id,
        tipo,
        status,
        data_agendada,
        hora_agendada,
        periodo,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        cep,
        observacoes,
        associado_id,
        veiculo_id,
        profissional_id,
        associado:associados(
          id,
          nome,
          telefone,
          whatsapp,
          email
        ),
        veiculo:veiculos(
          id,
          placa,
          marca,
          modelo,
          cor
        ),
        profissional:profiles!profissional_id(
          id,
          nome,
          whatsapp,
          telefone
        )
      `)
      .eq('id', servico_id)
      .single();

    if (servicoError || !servico) {
      console.error("[notificar-inicio-rota] Erro ao buscar serviço:", servicoError);
      return new Response(
        JSON.stringify({ success: false, error: "Serviço não encontrado" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`[notificar-inicio-rota] Serviço encontrado:`, {
      tipo: servico.tipo,
      status: servico.status,
      associado: servico.associado?.nome,
      profissional: servico.profissional?.nome
    });

    const associado = servico.associado as { id: string; nome: string; telefone: string; whatsapp?: string; email?: string } | null;
    const veiculo = servico.veiculo as { id: string; placa: string; marca?: string; modelo?: string; cor?: string } | null;
    const profissional = servico.profissional as { id: string; nome: string; whatsapp?: string; telefone?: string } | null;

    if (!associado) {
      console.error("[notificar-inicio-rota] Associado não encontrado");
      return new Response(
        JSON.stringify({ success: false, error: "Associado não encontrado" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (!profissional) {
      console.error("[notificar-inicio-rota] Profissional não encontrado");
      return new Response(
        JSON.stringify({ success: false, error: "Profissional não atribuído ao serviço" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const resultados = {
      cliente_notificado: false,
      profissional_notificado: false,
      erros: [] as string[]
    };

    // 2. Notificar o CLIENTE que o técnico está a caminho
    // Verificar se a notificação já foi enviada durante a atribuição automática (cron-atribuir-tarefas)
    // Se em_rota_em já estava definido ANTES do instalador clicar "Iniciar Rota", significa que
    // o cron já atribuiu com status em_rota e já enviou a notificação
    const { data: servicoAtual } = await supabase
      .from('servicos')
      .select('em_rota_em, created_at')
      .eq('id', servico_id)
      .single();

    // Se em_rota_em foi definido há mais de 30s, a notificação já foi enviada pelo cron
    const jaNotificadoPeloCron = (() => {
      if (!servicoAtual?.em_rota_em) return false;
      const emRotaEm = new Date(servicoAtual.em_rota_em).getTime();
      const agora = Date.now();
      // Se em_rota_em foi definido há mais de 30 segundos, o cron já notificou
      return (agora - emRotaEm) > 30000;
    })();

    const clienteTelefone = associado.whatsapp || associado.telefone;
    const profissionalTelefone = profissional.whatsapp || profissional.telefone;
    const profissionalTelefoneFormatado = profissionalTelefone 
      ? profissionalTelefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
      : 'Não informado';
    const profissionalWhatsappLink = profissionalTelefone 
      ? `https://wa.me/55${profissionalTelefone.replace(/\D/g, '')}`
      : 'Não disponível';
    
    if (clienteTelefone) {
      try {
        console.log(`[notificar-inicio-rota] Notificando cliente ${associado.nome} via notificar-cliente...`);
        
        const tipoServico = servico.tipo === 'instalacao' ? 'instalação' : 'vistoria';
        const periodoLabel = servico.periodo === 'manha' ? 'Manhã (08:00-12:00)' : servico.periodo === 'tarde' ? 'Tarde (14:00-18:00)' : 'A definir';
        
        const { error: notifyError } = await supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'tecnico_em_rota',
            associado_id: associado.id,
            dados: {
              tecnico_nome: profissional.nome,
              tecnico_telefone: profissionalTelefoneFormatado,
              tecnico_whatsapp_link: profissionalWhatsappLink,
              tipo_servico: tipoServico,
              periodo: periodoLabel,
              endereco: [
                servico.logradouro,
                servico.numero,
                servico.bairro,
                servico.cidade,
                servico.uf
              ].filter(Boolean).join(', ')
            }
          }
        });

        if (notifyError) {
          console.error("[notificar-inicio-rota] Erro ao notificar cliente:", notifyError);
          resultados.erros.push(`Erro ao notificar cliente: ${notifyError.message}`);
        } else {
          console.log(`[notificar-inicio-rota] ✓ Cliente notificado com sucesso`);
          resultados.cliente_notificado = true;
        }
      } catch (err) {
        console.error("[notificar-inicio-rota] Exceção ao notificar cliente:", err);
        resultados.erros.push(`Exceção ao notificar cliente: ${err.message}`);
      }
    } else {
      console.warn("[notificar-inicio-rota] Cliente sem telefone cadastrado");
      resultados.erros.push("Cliente sem telefone cadastrado");
    }

    // 3. Notificar o VISTORIADOR/INSTALADOR com os dados do cliente
    if (profissionalTelefone) {
      try {
        console.log(`[notificar-inicio-rota] Notificando profissional ${profissional.nome}...`);
        
        const tipoServico = servico.tipo === 'instalacao' ? 'INSTALAÇÃO' : 'VISTORIA';
        const periodoLabel = servico.periodo === 'manha' ? 'Manhã' : servico.periodo === 'tarde' ? 'Tarde' : 'Integral';
        
        // Montar endereço completo
        const enderecoParts = [
          servico.logradouro,
          servico.numero ? `nº ${servico.numero}` : null,
          servico.bairro,
          servico.cidade,
          servico.uf,
          servico.cep ? `CEP: ${servico.cep}` : null
        ].filter(Boolean);
        
        // Link direto para WhatsApp do cliente
        const clienteWhatsappLink = clienteTelefone 
          ? `https://wa.me/55${clienteTelefone.replace(/\D/g, '')}`
          : 'Não informado';
        
        // Formatar telefone para exibição
        const clienteTelefoneFormatado = clienteTelefone 
          ? clienteTelefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
          : 'Não informado';
        
        const mensagem = `📋 *NOVA TAREFA - ${tipoServico}*

👤 *Cliente:* ${associado.nome}
📞 *Telefone:* ${clienteTelefoneFormatado}
💬 *WhatsApp:* ${clienteWhatsappLink}

🚗 *Veículo:* ${veiculo ? `${veiculo.placa} - ${veiculo.marca || ''} ${veiculo.modelo || ''}`.trim() : 'Não informado'}

📍 *Endereço:*
${enderecoParts.join('\n')}

📅 *Data:* ${servico.data_agendada ? new Date(servico.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje'}
⏰ *Período:* ${periodoLabel}${servico.hora_agendada ? ` (${servico.hora_agendada})` : ''}

${servico.observacoes ? `📝 *Obs:* ${servico.observacoes}` : ''}

_Confirme sua chegada com o cliente!_`;

        const { error: whatsappError } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: profissionalTelefone,
            mensagem: mensagem
          }
        });

        if (whatsappError) {
          console.error("[notificar-inicio-rota] Erro ao enviar WhatsApp para profissional:", whatsappError);
          resultados.erros.push(`Erro ao notificar profissional: ${whatsappError.message}`);
        } else {
          console.log(`[notificar-inicio-rota] ✓ Profissional notificado com sucesso`);
          resultados.profissional_notificado = true;
        }
      } catch (err) {
        console.error("[notificar-inicio-rota] Exceção ao notificar profissional:", err);
        resultados.erros.push(`Exceção ao notificar profissional: ${err.message}`);
      }
    } else {
      console.warn("[notificar-inicio-rota] Profissional sem telefone cadastrado");
      resultados.erros.push("Profissional sem telefone cadastrado");
    }

    console.log(`[notificar-inicio-rota] Resultado final:`, resultados);

    return new Response(
      JSON.stringify({
        success: resultados.cliente_notificado || resultados.profissional_notificado,
        ...resultados
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[notificar-inicio-rota] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
