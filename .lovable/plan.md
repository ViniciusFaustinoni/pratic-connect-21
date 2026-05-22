## Objetivo

Corrigir o pagamento por cartão de crédito no link público de adesão. Hoje o botão "Pagar com Cartão" abre `https://www.asaas.com/c/pay_xxx`, que não é uma URL de pagamento válida no ASAAS. O correto é abrir o `invoiceUrl` (`https://www.asaas.com/i/{shortId}`) que a própria API ASAAS já retorna na criação da cobrança.

Caso impactado confirmado: placa **LSW8130**, contrato `CTR-20260522194347-H9HV8B`, cobrança ASAAS `pay_fzap7eptk36ird03` (PIX funcionando, cartão quebrado).

## Mudanças

### 1. `supabase/functions/asaas-cobranca-adesao/index.ts`

**Linha 326** — trocar a construção do link de pagamento para usar o `invoiceUrl` real:
```ts
// antes
const linkPagamento = `https://www.asaas.com/c/${cobrancaData.id}`;
// depois
const linkPagamento = cobrancaData.invoiceUrl || null;
```

**Linhas 386-394** — no branch de duplicata (race condition), parar de remontar `/c/${asaas_id}`. Buscar o `invoiceUrl` real do ASAAS via `GET /payments/{id}` antes de responder. Se a busca falhar, retornar `null` em `link_pagamento` e deixar o front cair no `invoice_url`/PIX em vez de abrir uma URL quebrada.

### 2. `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`

**Linha 166** — ao reusar cobrança existente do banco, parar de chutar `https://www.asaas.com/c/${asaas_id}`. Quando a cobrança existente não tiver `invoice_url` armazenado, chamar `asaas-cobrancas` (`action: 'buscar'`) para obter o `invoiceUrl` atualizado do ASAAS. Sem isso, deixar o botão de cartão desabilitado com mensagem clara em vez de abrir URL inválida.

**Linhas 197-200** — inverter prioridade do fallback:
```ts
// antes
const linkPagamentoFinal =
  data.link_pagamento ||
  data.invoice_url ||
  (data.asaas_id ? `https://www.asaas.com/c/${data.asaas_id}` : undefined);
// depois
const linkPagamentoFinal = data.invoice_url || data.link_pagamento || undefined;
```
Remover o fallback `/c/${asaas_id}` por completo — ele só esconde a falha real.

### 3. Persistir `invoice_url` em `asaas_cobrancas`

Hoje a tabela `asaas_cobrancas` não guarda o `invoiceUrl`. Adicionar coluna `invoice_url text` e gravá-la em:
- `asaas-cobranca-adesao` (criação inicial)
- `asaas-alterar-forma-pagamento` (linhas 170-184, já retorna `invoiceUrl` no JSON mas não persiste)
- `asaas-webhook` (quando ASAAS confirma/atualiza a cobrança, opcional)

Isso evita o GET extra no ASAAS toda vez que o link público re-abre.

### 4. Saneamento manual do caso LSW8130

Após o deploy, chamar `GET https://api.asaas.com/v3/payments/pay_fzap7eptk36ird03` pelo edge function existente (`asaas-cobrancas` action `buscar`) e gravar o `invoiceUrl` retornado na cobrança `a813af2c-740c-4fab-aaf3-8b7052668a63`. O cliente Pedro Henrique consegue concluir o pagamento por cartão sem precisar gerar nova cobrança.

## Verificação

1. Reabrir o link público de pagamento da cotação `1c4eedee-994d-4099-a02c-ab3b3826d334` e confirmar que o botão "Pagar com Cartão" abre uma URL `asaas.com/i/{shortId}` (não `/c/pay_xxx`).
2. Criar uma cotação nova de teste, ir até pagamento, confirmar mesmo comportamento.
3. Verificar que o fluxo PIX continua intacto (não tocamos no PIX QR/copia-e-cola).
4. Verificar que `asaas_cobrancas.invoice_url` está populado para a cobrança nova.

## Fora de escopo

- Não vou mexer no fluxo de webhook de pagamento (`asaas-webhook`) além de opcionalmente gravar o `invoice_url`.
- Não vou tocar em cobranças recorrentes (mensalidades) — o bug é específico do link público de adesão.
- Não vou alterar a integração com o ASAAS em si (API key, secrets, ambiente) — está tudo correto, é só URL formatada errada no nosso lado.