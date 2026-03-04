

# Plano: Consultar faturas ASAAS no assistente do app

## Problema
A tool `get_boletos_pendentes` consulta a tabela `cobrancas` (legado). As faturas reais estão na tabela `asaas_cobrancas`. O mesmo para `get_historico_pagamentos`.

## Mudança

### Arquivo: `supabase/functions/assistente-chat/index.ts`

**1. `get_boletos_pendentes` (linhas 424-449):**
Trocar query de `cobrancas` para `asaas_cobrancas`, incluindo campos de pagamento:

```typescript
case "get_boletos_pendentes": {
  const { data, error } = await supabase
    .from("asaas_cobrancas")
    .select("id, valor, data_vencimento, status, competencia, boleto_url, pix_copia_cola, linha_digitavel")
    .eq("associado_id", associadoId)
    .in("status", ["PENDING", "OVERDUE"])
    .order("data_vencimento", { ascending: true });

  if (!data || data.length === 0) {
    return JSON.stringify({ message: "Você está em dia! Não há faturas em aberto. ✅" });
  }

  // Retornar com boleto_url, pix_copia_cola e linha_digitavel para a IA apresentar
}
```

**2. `get_historico_pagamentos` (linhas 451-475):**
Trocar para `asaas_cobrancas` com status `RECEIVED` ou `CONFIRMED`.

**3. System prompt (linha 40):**
Ajustar instrução de boletos para mencionar que deve incluir link do boleto e PIX copia-e-cola quando disponíveis.

### Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `supabase/functions/assistente-chat/index.ts` | Trocar queries para `asaas_cobrancas` em `get_boletos_pendentes` e `get_historico_pagamentos`; ajustar system prompt |

