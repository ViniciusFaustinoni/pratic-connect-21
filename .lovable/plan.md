
# Perguntar ao associado se quer iniciar o processo agora ou depois

## Resumo

Apos registrar o sinistro, a IA perguntara ao associado: "Quer dar entrada no processo agora ou prefere que a gente retorne amanha?". Dependendo da resposta, envia o link imediatamente ou deixa o cron D+1 cuidar.

## Mudancas

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

### 1. Capturar o token do link ao agendar contato (linhas 1001-1008)

Alterar a chamada para `agendar-contato-sinistro` para guardar o token retornado:

```text
// ANTES:
await supabase.functions.invoke("agendar-contato-sinistro", { ... });

// DEPOIS:
const agendarResp = await supabase.functions.invoke("agendar-contato-sinistro", { ... });
const linkToken = agendarResp?.data?.token || "";
```

### 2. Incluir link_evento na resposta da tool (linhas 1031-1035)

Adicionar o link do evento na resposta JSON que a IA recebe, para que ela possa envia-lo se o associado quiser:

```text
// ANTES:
return JSON.stringify({
  sucesso: true,
  protocolo: protocoloSin,
  message: "Sinistro registrado com sucesso!...",
});

// DEPOIS:
const siteUrl = Deno.env.get("SITE_URL") || "https://pratic-connect-21.lovable.app";
const linkEvento = linkToken ? `${siteUrl}/evento/${linkToken}` : "";

return JSON.stringify({
  sucesso: true,
  protocolo: protocoloSin,
  link_evento: linkEvento,
  message: `Sinistro registrado! Protocolo: *${protocoloSin}*...`,
});
```

### 3. Atualizar o system prompt -- secao POS-SINISTRO (linhas 307-319)

Adicionar instrucao para a IA perguntar se o associado quer iniciar o processo agora. A logica fica assim:

```text
## POS-SINISTRO: PERGUNTAR SOBRE LINK DO EVENTO (OBRIGATORIO!)
Apos registrar o sinistro com sucesso e o resultado conter "link_evento":
1. Primeiro, pergunte ao associado:
   "Quer dar entrada no processo do sinistro agora? Vou te enviar um link
    para voce completar as etapas (auto vistoria, B.O., agendamento).
    Ou prefere que a gente retorne amanha?"
2. Se o associado disser AGORA / SIM / QUERO:
   - Envie o link: "Aqui esta o link: [link_evento]. Valido por 72h."
   - Explique brevemente as etapas
3. Se disser DEPOIS / AMANHA / NAO AGORA:
   - Responda: "Sem problemas! Amanha de manha enviaremos o link 
     para voce dar continuidade."
   - O cron D+1 cuidara do envio
```

A pergunta sobre o link acontece ANTES da oferta de guincho. A ordem final do pos-sinistro sera:
1. Confirmar registro e protocolo
2. Perguntar: agora ou depois? (link do evento)
3. Oferecer guincho (se cobertura total + colisao)

### 4. Ajustar a secao de oferta de guincho

Mover a instrucao de oferta de guincho para APOS a pergunta do link, deixando claro que sao dois momentos distintos da conversa.

## Resultado esperado

Conversa exemplo:

```text
Maya: Sinistro registrado! Protocolo: SIN-20260217-0008.
      Quer dar entrada no processo agora? Envio um link para
      completar as etapas. Ou prefere que retorne amanha?

Associado: Agora!

Maya: Aqui esta o link: https://pratic.../evento/abc123
      Valido por 72h. Nele voce vai completar:
      1. Auto Vistoria (fotos do veiculo)
      2. Boletim de Ocorrencia
      3. Agendamento da vistoria presencial
      4. Pagamento da coparticipacao

      Voce precisa de um guincho agora? Podemos enviar para
      Estrada da Cafunda, 725...
```

## Arquivos alterados

1. `supabase/functions/whatsapp-webhook/index.ts` - capturar token, incluir na resposta, atualizar system prompt
