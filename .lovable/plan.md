

## Diagnóstico: Meta Webhook não processa mensagens de usuários com IA

### Problema

O webhook da Meta (`whatsapp-meta-webhook/index.ts`) possui apenas **2 fluxos**:
1. Verificar se é resposta de **prestador** (despacho reboque)
2. Registrar mensagem no banco

**Falta completamente**: todo o fluxo de IA que existe no webhook Evolution (`whatsapp-webhook/index.ts`, ~400 linhas), que inclui:
- Vincular mídia a documentos pendentes (sinistro/cadastro)
- Processar respostas de confirmação de agendamento
- Identificar associado pelo telefone
- Identificar leads
- Identificar número desconhecido e pedir CPF
- Processar mensagem com IA (Maya) para associados ativos
- Tool calls loop (criar sinistro, assistência, etc.)

### Solução

Replicar no `whatsapp-meta-webhook/index.ts` o fluxo completo pós-prestador, **reutilizando** as mesmas funções do webhook Evolution via chamada interna à edge function `whatsapp-webhook` (delegação), ou replicando a lógica adaptada.

**Abordagem recomendada: Delegação interna**

Após verificar que a mensagem NÃO é de prestador, o meta-webhook delega o processamento para o webhook Evolution chamando internamente a edge function existente, passando os dados normalizados. Isso evita duplicar ~3000 linhas de código e mantém a lógica de IA centralizada.

```text
Meta Webhook recebe msg
  → Processa status de template (já existe)
  → Processa resposta prestador (já existe)
  → Se NÃO processado:
      → Chamar internamente whatsapp-webhook via fetch
         com payload adaptado (telefone, texto, tipo, mídia)
      → Usar flag "provedor: meta" para que as respostas
         sejam enviadas via whatsapp-send-text (que já roteia)
```

### Detalhes da implementação

**`supabase/functions/whatsapp-meta-webhook/index.ts`** — Adicionar após o bloco de prestador (linha ~435):

1. Se `foiProcessado === false`, chamar uma nova função `processarMensagemUsuario()` que:
   - Normaliza o telefone (variantes com/sem DDI 55)
   - Busca associado ativo pelo telefone
   - Se não encontrar, busca lead
   - Se não encontrar, pede CPF
   - Se encontrar associado, chama a edge function `whatsapp-ia-responder` (já existente) ou invoca diretamente `whatsapp-webhook` com os dados formatados

2. Para envio de respostas, usar `enviarWhatsApp()` que já existe no arquivo (chama `whatsapp-send-text`, que roteia automaticamente entre Evolution e Meta)

3. Para IA, invocar a edge function existente que já tem todo o fluxo de tools (criar sinistro, assistência, etc.)

### Escopo

- Modificar apenas `supabase/functions/whatsapp-meta-webhook/index.ts`
- Adicionar ~150 linhas de lógica de delegação
- Reutilizar `enviarWhatsApp()` já existente no arquivo
- Reutilizar lógica de normalização de telefone
- Não duplicar o system prompt nem as tools — delegar para o webhook Evolution

