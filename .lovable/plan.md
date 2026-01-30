

## Plano: Reagendamento Completo via WhatsApp com 3 Dias de Opções

### Objetivo

Quando o cliente responde "REAGENDAR" na confirmação de agendamento, a IA deve:
1. Oferecer os próximos 3 dias úteis disponíveis (exceto domingo)
2. Coletar a escolha de data e período (manhã/tarde)
3. Criar automaticamente o novo serviço no painel
4. Cancelar o antigo serviço liberando o horário
5. Notificar o vistoriador sobre o reagendamento

### Arquivos a Modificar

**1. `supabase/functions/whatsapp-webhook/index.ts`**

### Alterações Detalhadas

#### 1.1 Atualizar REAGENDAMENTO_SYSTEM_PROMPT (~linha 379)

Modificar para usar apenas 3 dias em vez de 5:

```typescript
const REAGENDAMENTO_SYSTEM_PROMPT = `Você é o Assistente de Reagendamento da PRATIC.

## Sua Tarefa
Ajudar o cliente a escolher uma nova data e horário para o serviço.

## DATAS DISPONÍVEIS
Use EXATAMENTE as datas fornecidas no contexto.

## PERÍODOS
- *MANHÃ*: 08:00 às 12:00
- *TARDE*: 14:00 às 18:00

## Fluxo
1. Apresente as 3 opções de data
2. Peça para o cliente escolher (1, 2 ou 3)
3. Pergunte o período (manhã ou tarde)
4. Confirme o novo agendamento

## Resposta SEMPRE em JSON
{
  "etapa": "PERGUNTA_DATA" | "PERGUNTA_PERIODO" | "CONFIRMAR" | "FINALIZADO",
  "mensagem": "Mensagem para o cliente",
  "dados_coletados": {
    "data": "YYYY-MM-DD ou null",
    "periodo": "manha" | "tarde" | null,
    "hora": "HH:MM ou null"
  }
}`;
```

#### 1.2 Nova Função: getProximasDatasDisponiveis()

Adicionar função para calcular os próximos 3 dias úteis (pula domingo):

```typescript
function getProximasDatasDisponiveis(quantidade: number = 3): { data: string; diaSemana: string; formatada: string }[] {
  const resultado = [];
  const hoje = new Date();
  let diasAdicionados = 0;
  let offset = 1; // Começa de amanhã

  while (diasAdicionados < quantidade) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + offset);
    
    const diaSemana = data.getDay();
    
    // Pular domingo (0)
    if (diaSemana !== 0) {
      const dataStr = data.toISOString().split('T')[0];
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const diaFormatado = data.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      
      resultado.push({
        data: dataStr,
        diaSemana: diasSemana[diaSemana],
        formatada: `${diasSemana[diaSemana]}, ${diaFormatado}`
      });
      diasAdicionados++;
    }
    offset++;
  }
  
  return resultado;
}
```

#### 1.3 Modificar processarReagendamento() (~linha 1803)

Substituir a versão atual que apenas diz "equipe entrará em contato" por um fluxo completo:

```typescript
async function processarReagendamento(
  supabase: any,
  confirmacao: any,
  mensagemCliente: string,
  instancia: any
): Promise<Response> {
  console.log(`[whatsapp-webhook] Processando reagendamento para ${confirmacao.servico_id}`);
  
  const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
  const apiKey = Deno.env.get('EVOLUTION_API_KEY');
  
  // Buscar dados do serviço original
  const { data: servicoOriginal } = await supabase
    .from('servicos')
    .select(`
      id, tipo, data_agendada, hora_agendada, periodo,
      cep, logradouro, numero, complemento, bairro, cidade, uf,
      latitude, longitude, associado_id, veiculo_id, contrato_id,
      cotacao_id, local_vistoria, origem,
      associado:associados!servicos_associado_id_fkey(nome)
    `)
    .eq('id', confirmacao.servico_id)
    .single();

  if (!servicoOriginal) {
    const msg = "Desculpe, não encontrei os dados do seu agendamento. Por favor, entre em contato com nossa central.";
    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
    return new Response(JSON.stringify({ ok: false, error: 'servico_nao_encontrado' }), { headers: corsHeaders });
  }

  const nomeCliente = servicoOriginal.associado?.nome?.split(' ')[0] || 'Cliente';
  
  // Verificar se já está em fluxo de reagendamento (contexto_ia tem dados)
  const contextoAtual = confirmacao.contexto_ia || {};
  const etapaAtual = contextoAtual.etapa_reagendamento || 'INICIAL';
  const datasDisponiveis = contextoAtual.datas_disponiveis || getProximasDatasDisponiveis(3);
  
  // ETAPA INICIAL: Mostrar datas disponíveis
  if (etapaAtual === 'INICIAL') {
    const mensagemDatas = `Sem problemas, *${nomeCliente}*! 📅

Escolha uma das datas disponíveis:

*1️⃣* ${datasDisponiveis[0].formatada}
*2️⃣* ${datasDisponiveis[1].formatada}
*3️⃣* ${datasDisponiveis[2].formatada}

Responda com *1*, *2* ou *3* para escolher.`;

    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, mensagemDatas);
    await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagemDatas, "saida");
    
    // Atualizar contexto com etapa e datas
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        status: 'reagendando',
        contexto_ia: {
          ...contextoAtual,
          etapa_reagendamento: 'AGUARDANDO_DATA',
          datas_disponiveis: datasDisponiveis,
          servico_original: servicoOriginal
        }
      })
      .eq('id', confirmacao.id);
    
    return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_DATA' }), { headers: corsHeaders });
  }
  
  // ETAPA AGUARDANDO_DATA: Cliente escolheu data
  if (etapaAtual === 'AGUARDANDO_DATA') {
    const escolha = mensagemCliente.trim();
    let dataSelecionada = null;
    
    // Interpretar resposta (1, 2, 3 ou texto)
    if (['1', '01', 'um', 'primeira', 'primeiro'].some(v => escolha.toLowerCase().includes(v))) {
      dataSelecionada = datasDisponiveis[0];
    } else if (['2', '02', 'dois', 'segunda', 'segundo'].some(v => escolha.toLowerCase().includes(v))) {
      dataSelecionada = datasDisponiveis[1];
    } else if (['3', '03', 'três', 'tres', 'terceira', 'terceiro'].some(v => escolha.toLowerCase().includes(v))) {
      dataSelecionada = datasDisponiveis[2];
    }
    
    if (!dataSelecionada) {
      const msg = `Não entendi sua escolha. Por favor, responda *1*, *2* ou *3*:

*1️⃣* ${datasDisponiveis[0].formatada}
*2️⃣* ${datasDisponiveis[1].formatada}
*3️⃣* ${datasDisponiveis[2].formatada}`;
      
      await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
      return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_DATA', retry: true }), { headers: corsHeaders });
    }
    
    // Verificar se é sábado (horário reduzido)
    const dataObj = new Date(dataSelecionada.data + 'T12:00:00');
    const isSabado = dataObj.getDay() === 6;
    
    const mensagemPeriodo = isSabado
      ? `Ótimo! *${dataSelecionada.formatada}* selecionada.

⚠️ Aos sábados atendemos apenas pela *MANHÃ* (08:00 às 13:00).

Confirma o período da *MANHÃ*? Responda *SIM* ou digite outro dia.`
      : `Ótimo! *${dataSelecionada.formatada}* selecionada.

Qual período você prefere?

*1️⃣ MANHÃ* (08:00 às 12:00)
*2️⃣ TARDE* (14:00 às 18:00)

Responda *1* ou *2*.`;

    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, mensagemPeriodo);
    await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagemPeriodo, "saida");
    
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        contexto_ia: {
          ...contextoAtual,
          etapa_reagendamento: isSabado ? 'AGUARDANDO_CONFIRMACAO_SABADO' : 'AGUARDANDO_PERIODO',
          data_selecionada: dataSelecionada,
          is_sabado: isSabado
        }
      })
      .eq('id', confirmacao.id);
    
    return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_PERIODO' }), { headers: corsHeaders });
  }
  
  // ETAPA AGUARDANDO_PERIODO ou CONFIRMACAO_SABADO
  if (etapaAtual === 'AGUARDANDO_PERIODO' || etapaAtual === 'AGUARDANDO_CONFIRMACAO_SABADO') {
    const dataSelecionada = contextoAtual.data_selecionada;
    const isSabado = contextoAtual.is_sabado;
    const escolha = mensagemCliente.trim().toLowerCase();
    
    let periodo = null;
    let hora = null;
    
    if (isSabado) {
      // Sábado: só manhã
      if (['sim', 's', 'ok', 'confirmo', 'pode', 'manhã', 'manha', '1'].some(v => escolha.includes(v))) {
        periodo = 'manha';
        hora = '09:00';
      } else {
        // Cliente quer outro dia - voltar para seleção
        const msg = `Entendi! Vamos escolher outro dia então.

*1️⃣* ${datasDisponiveis[0].formatada}
*2️⃣* ${datasDisponiveis[1].formatada}
*3️⃣* ${datasDisponiveis[2].formatada}

Responda *1*, *2* ou *3*.`;
        
        await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
        
        await supabase.from('confirmacoes_agendamento')
          .update({ 
            contexto_ia: { ...contextoAtual, etapa_reagendamento: 'AGUARDANDO_DATA' }
          })
          .eq('id', confirmacao.id);
        
        return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_DATA' }), { headers: corsHeaders });
      }
    } else {
      // Dias úteis: manhã ou tarde
      if (['1', 'um', 'manhã', 'manha', 'primeira'].some(v => escolha.includes(v))) {
        periodo = 'manha';
        hora = '09:00';
      } else if (['2', 'dois', 'tarde', 'segunda'].some(v => escolha.includes(v))) {
        periodo = 'tarde';
        hora = '15:00';
      }
    }
    
    if (!periodo) {
      const msg = `Não entendi. Por favor, responda *1* para MANHÃ ou *2* para TARDE.`;
      await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
      return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_PERIODO', retry: true }), { headers: corsHeaders });
    }
    
    // CRIAR NOVO SERVIÇO
    const servicoOriginal = contextoAtual.servico_original;
    const tipoServico = servicoOriginal.tipo === 'instalacao' 
      ? 'instalação do rastreador' 
      : servicoOriginal.tipo === 'vistoria' 
        ? 'vistoria veicular' 
        : 'serviço';
    
    const { data: novoServico, error: erroNovoServico } = await supabase
      .from('servicos')
      .insert({
        tipo: servicoOriginal.tipo,
        status: 'agendada',
        data_agendada: dataSelecionada.data,
        hora_agendada: hora,
        periodo: periodo,
        permite_encaixe: true,
        local_vistoria: servicoOriginal.local_vistoria,
        cep: servicoOriginal.cep,
        logradouro: servicoOriginal.logradouro,
        numero: servicoOriginal.numero,
        complemento: servicoOriginal.complemento,
        bairro: servicoOriginal.bairro,
        cidade: servicoOriginal.cidade,
        uf: servicoOriginal.uf,
        latitude: servicoOriginal.latitude,
        longitude: servicoOriginal.longitude,
        associado_id: servicoOriginal.associado_id,
        veiculo_id: servicoOriginal.veiculo_id,
        contrato_id: servicoOriginal.contrato_id,
        cotacao_id: servicoOriginal.cotacao_id,
        origem: 'reagendamento_whatsapp',
        observacoes: `Reagendado via WhatsApp. Serviço original: ${confirmacao.servico_id}`
      })
      .select()
      .single();

    if (erroNovoServico) {
      console.error('[whatsapp-webhook] Erro ao criar novo serviço:', erroNovoServico);
      const msg = "Ocorreu um erro ao reagendar. Por favor, entre em contato com nossa central 0800 980 0001.";
      await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
      return new Response(JSON.stringify({ ok: false, error: erroNovoServico.message }), { headers: corsHeaders });
    }
    
    // CANCELAR SERVIÇO ORIGINAL
    await supabase
      .from('servicos')
      .update({ 
        status: 'cancelada',
        confirmacao_whatsapp: 'reagendado',
        profissional_id: null,
        observacoes: `Reagendado via WhatsApp para ${dataSelecionada.data}. Novo serviço: ${novoServico.id}`
      })
      .eq('id', confirmacao.servico_id);
    
    // ATUALIZAR CONFIRMAÇÃO
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        status: 'reagendada',
        novo_servico_id: novoServico.id,
        contexto_ia: {
          ...contextoAtual,
          etapa_reagendamento: 'FINALIZADO',
          novo_servico_id: novoServico.id
        }
      })
      .eq('id', confirmacao.id);
    
    // MENSAGEM DE CONFIRMAÇÃO
    const periodoTexto = periodo === 'manha' ? 'MANHÃ (08:00-12:00)' : 'TARDE (14:00-18:00)';
    const mensagemFinal = `Pronto, *${nomeCliente}*! ✅

Sua *${tipoServico}* foi reagendada com sucesso:

📅 *${dataSelecionada.formatada}*
⏰ Período: *${periodoTexto}*
📍 ${servicoOriginal.logradouro}, ${servicoOriginal.numero} - ${servicoOriginal.bairro}

Um técnico será designado e você receberá uma nova confirmação no dia.

Obrigado pela compreensão! 🚗`;

    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, mensagemFinal);
    await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagemFinal, "saida");
    
    console.log(`[whatsapp-webhook] ✅ Reagendamento concluído: ${novoServico.id}`);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      action: 'reagendamento_concluido',
      novo_servico_id: novoServico.id,
      data: dataSelecionada.data,
      periodo
    }), { headers: corsHeaders });
  }
  
  // Fallback
  return new Response(JSON.stringify({ ok: true, etapa: 'desconhecida' }), { headers: corsHeaders });
}
```

#### 1.4 Modificar handleConfirmacaoAgendamento() (~linha 1690)

Atualizar para passar corretamente para o fluxo de reagendamento quando cliente quer reagendar:

```typescript
// Dentro da função, após detectar intencao === 'REAGENDAR':
if (resultado.intencao === 'REAGENDAR') {
  // Atualizar confirmação para status "reagendando"
  await supabase.from('confirmacoes_agendamento')
    .update({ 
      status: 'reagendando',
      resposta_recebida_em: new Date().toISOString(),
      resposta_cliente: mensagemCliente,
      contexto_ia: {
        ...confirmacao.contexto_ia,
        etapa_reagendamento: 'INICIAL'
      }
    })
    .eq('id', confirmacao.id);
  
  // Chamar fluxo de reagendamento
  return await processarReagendamento(supabase, confirmacao, mensagemCliente, instancia);
}
```

#### 1.5 Atualizar Detecção de Fluxo de Reagendamento (~linha 2050)

No fluxo principal, verificar se telefone está em processo de reagendamento:

```typescript
// Antes de processar como mensagem normal, verificar se está reagendando
const { data: confirmacaoReagendando } = await supabase
  .from('confirmacoes_agendamento')
  .select('*')
  .eq('telefone', telefone)
  .eq('status', 'reagendando')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (confirmacaoReagendando) {
  console.log(`[whatsapp-webhook] Continuando fluxo de reagendamento para ${telefone}`);
  return await processarReagendamento(supabase, confirmacaoReagendando, mensagemTexto, instancia);
}
```

### Resumo das Alterações

| Componente | Alteração | Descrição |
|------------|-----------|-----------|
| `REAGENDAMENTO_SYSTEM_PROMPT` | Atualizado | Usar 3 dias, não 5 |
| `getProximasDatasDisponiveis()` | Nova função | Calcula próximos 3 dias úteis |
| `processarReagendamento()` | Reescrito | Fluxo completo com coleta de data/período |
| `handleConfirmacaoAgendamento()` | Modificado | Iniciar corretamente o fluxo de reagendamento |
| Detecção no serve() | Adicionado | Detectar se telefone está em reagendamento |

### Fluxo Visual

```text
Cliente: "não posso hoje"
           |
           v
    Detecta REAGENDAR
           |
           v
    Mostra 3 datas:
    1️⃣ Terça, 04/02
    2️⃣ Quarta, 05/02
    3️⃣ Quinta, 06/02
           |
           v
    Cliente: "2"
           |
           v
    Pergunta período:
    1️⃣ MANHÃ
    2️⃣ TARDE
           |
           v
    Cliente: "1"
           |
           v
    Cria novo serviço
    Cancela antigo
    Libera horário
           |
           v
    "Reagendado com sucesso!
    📅 Quarta, 05/02
    ⏰ MANHÃ (08:00-12:00)"
```

### Testes Recomendados

1. Enviar confirmação de agendamento (cron)
2. Responder "quero reagendar"
3. Escolher opção 2
4. Escolher manhã
5. Verificar no painel se novo serviço foi criado
6. Verificar se serviço antigo foi cancelado

