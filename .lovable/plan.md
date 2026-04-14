

## Plano: Agente reconhecer associados e informar numero de atendimento

### Problema
Quando um associado (ativo, base antiga ou novo) entra em contato via WhatsApp, o agente "Vinicius" tenta iniciar fluxo de venda/cotacao. Deveria reconhecer que ja e associado e informar o numero correto de atendimento (conectado na Meta API).

### Alteracoes

**Edge Function `agente-consultor-ia/index.ts`**

Apos a deteccao de diretor (secao 4), adicionar deteccao de associado:

1. **Buscar na tabela `associados`** usando `telLimpo` e variantes contra `telefone` e `whatsapp`
2. Se encontrar, marcar `isAssociado = true` e guardar nome e status
3. **Buscar numero de atendimento Meta**: consultar `whatsapp_meta_config` (ativo = true) para obter o `phone_number_id`, e complementar buscando o numero real do sender via `whatsapp-get-sender` (ownerJid da Evolution) ou formatar o phone_number_id da Meta
4. **System prompt condicional para associados**: nao vender, nao fazer cotacao. Apenas:
   - Reconhecer pelo nome: "Ola, [nome]! Sou o Vinicius da PRATICCAR"
   - Informar que para atendimento, deve entrar em contato pelo numero conectado na Meta (numero de atendimento principal)
   - Pode tirar duvidas simples sobre a associacao

### Prioridade de deteccao
```text
telefone recebido
  └─ e diretor? → fluxo diretoria
  └─ e associado? → informar numero de atendimento (NAO vender)
  └─ lead → fluxo de vendas/cotacao
```

### Detalhes tecnicos

A busca de associado usa:
```sql
SELECT nome, status, telefone, whatsapp FROM associados
WHERE telefone IN (variantes) OR whatsapp IN (variantes)
LIMIT 1
```

Para obter o numero de atendimento, buscar na `whatsapp_meta_config` o `phone_number_id` e fazer lookup via Graph API (`GET /v21.0/{phone_number_id}`) para obter o `display_phone_number`, ou usar o numero da instancia Evolution (`whatsapp_instancias.telefone`). Fallback: buscar via `whatsapp-get-sender`.

### Arquivos editados
- `supabase/functions/agente-consultor-ia/index.ts` — adicionar deteccao de associado entre diretor e lead, system prompt especifico, busca do numero de atendimento

