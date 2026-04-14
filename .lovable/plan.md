<final-text>## Plano definitivo para parar o loop da IA no WhatsApp

### O que eu encontrei
O problema não é só “memória da IA”. Há uma falha estrutural em camadas diferentes do fluxo.

**Evidências encontradas:**
1. **O contato do Vinícius está hoje como `em_conversa` e com `dados_cotacao = null`.**  
   Isso significa que o reset anterior foi “consumido” e a condição atual de reset (`status === 'novo' && !dados_cotacao`) já não está mais ativa.

2. **Existem várias mensagens de saída repetidas para o mesmo telefone sem mensagens de entrada correspondentes no período.**  
   No banco, para `5521992593830`, aparecem respostas da IA às `16:19`, `16:23` e `16:29`, mas **sem entradas do usuário registradas nesse mesmo intervalo**.  
   Isso indica que o backend está **reprocessando/delegando a mesma conversa mais de uma vez**, não apenas “lembrando”.

3. **O código atual não tem proteção forte contra duplicidade por `message_id`.**  
   Nos webhooks (`whatsapp-webhook` / `whatsapp-meta-webhook`) e no processador de fila (`processar-fila-ia`), a mesma mensagem pode voltar a acionar o agente se o evento chegar duplicado, for reenfileirado ou for reexecutado sinteticamente.

4. **O reset atual limpa só `agente_ia_contatos`, mas não corta a origem do reprocessamento.**  
   Se existir webhook duplicado, replay, ou item antigo/pendente em fila, o agente volta a ser acionado e muda o contato para `em_conversa` novamente.

5. **Há um erro de implementação anterior que precisa ser limpo:** foi criada uma migration com `UPDATE` pontual para um telefone específico. Isso não deve ficar em migration permanente.

### Conclusão
Os erros se acumularam porque cada correção anterior tratou um sintoma isolado:
- limpar `dados_cotacao`
- limpar histórico
- restaurar planos

Mas o defeito real está em **3 pontos ao mesmo tempo**:

```text
Entrada WhatsApp -> Webhook/Fila -> Agente -> Histórico/Estado
                     sem dedupe       responde   reset incompleto
```

Enquanto não houver **idempotência + corte real de contexto + limpeza de fila**, a IA pode continuar repetindo saudações e retomando conversas antigas.

---

## Correção que eu vou aplicar

### 1. Bloquear processamento duplicado por `message_id`
**Arquivos:**
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-meta-webhook/index.ts`
- `supabase/functions/processar-fila-ia/index.ts`

**Mudança:**
- Antes de delegar para o agente, verificar se aquela mensagem de entrada (`message_id`) já foi registrada/processada.
- Se já existir, **ignorar silenciosamente**.
- No processador da fila, impedir reprocessamento do mesmo item/mensagem.

**Objetivo:** parar respostas repetidas causadas por eventos duplicados ou replay interno.

---

### 2. Tornar o reset realmente definitivo
**Arquivos:**
- `supabase/functions/delete-cotacao/index.ts`
- `supabase/functions/agente-consultor-ia/index.ts`
- migration nova

**Mudança:**
Adicionar um marcador persistente de corte de contexto, por exemplo:
- `resetado_em` ou `ignorar_historico_ate`

Ao excluir a cotação:
- resetar `status`
- limpar `dados_cotacao`
- gravar esse timestamp de reset

No agente:
- ignorar qualquer histórico anterior a esse marco
- ignorar mensagens/fila anteriores ao reset

**Objetivo:** o lead volta a começar do zero mesmo que haja mensagens antigas no banco.

---

### 3. Cancelar fila pendente do telefone ao excluir cotação
**Arquivos:**
- `supabase/functions/delete-cotacao/index.ts`
- possivelmente migration para status de cancelamento/ignoradas

**Mudança:**
Ao excluir a cotação, também invalidar itens pendentes da `whatsapp_fila_ia` daquele telefone.

**Objetivo:** evitar que uma mensagem antiga seja processada depois do reset.

---

### 4. Parar de usar histórico “sujo” para iniciar conversa
**Arquivo:**
- `supabase/functions/agente-consultor-ia/index.ts`

**Mudança:**
- montar histórico apenas com mensagens posteriores ao marco de reset
- usar explicitamente `isPrimeiraMensagem` no prompt/comportamento
- evitar que o agente cumprimente de novo se a mesma mensagem for reprocessada
- não deixar “assistants old messages” puxarem a conversa anterior

**Objetivo:** impedir saudação duplicada e retomada indevida.

---

### 5. Remover a migration errada criada antes
**Arquivo a limpar/substituir:**
- `supabase/migrations/20260414162637_94369bb7-af75-4d63-9cc1-1dc757140a64.sql`

**Mudança:**
- remover essa alteração pontual do histórico de migrations
- fazer qualquer reset operacional diretamente no banco/função, não em migration fixa

**Objetivo:** evitar sujeira técnica e efeitos colaterais futuros.

---

## Validação após a correção
Vou validar em sequência:

1. Excluir a cotação do Vinícius
2. Confirmar no banco:
   - contato resetado
   - `dados_cotacao = null`
   - marco de reset gravado
   - fila antiga invalidada
3. Enviar **uma** nova mensagem de teste
4. Confirmar:
   - só **1** entrada registrada
   - só **1** delegação ao agente
   - só **1** resposta de saída
   - nenhuma repetição de saudação
5. Revisar logs das edge functions envolvidas

---

## Arquivos envolvidos
- `supabase/functions/agente-consultor-ia/index.ts`
- `supabase/functions/delete-cotacao/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-meta-webhook/index.ts`
- `supabase/functions/processar-fila-ia/index.ts`
- `supabase/migrations/...` (nova migration de reset/idempotência)
- limpeza da migration incorreta anterior

---

## Resultado esperado
Depois dessa correção, o comportamento ficará assim:

```text
cotação excluída
-> contato resetado
-> histórico antigo cortado
-> fila antiga invalidada
-> mensagem duplicada ignorada por message_id
-> próxima mensagem do lead inicia 1 conversa nova, 1 resposta única
```

Isso ataca a causa raiz do loop, em vez de só esconder o sintoma.</final-text>