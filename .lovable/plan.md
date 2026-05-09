## Problema

No fluxo público de cotação, a aba **Cartão** mostra o botão **"Pagar com Cartão"** cinza/desabilitado. Em produção, o usuário não consegue clicar.

## Causa raiz

`src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` desabilita o botão com:

```tsx
disabled={!cobranca?.linkPagamento}
```

`linkPagamento` é populado de duas origens:

1. **Cobrança nova** (edge function `asaas-cobranca-adesao`, linha 436): retorna `link_pagamento`. **OK.**
2. **Cobrança existente** (front-end, linha 166): monta `https://www.asaas.com/c/${asaas_id}`. **OK.**
3. **Race condition na edge function** (linhas 383-399): retorna sucesso **sem** os campos `link_pagamento`, `invoice_url` ou `asaas_id` no shape esperado pelo front. **Bug.**

Quando o front cai no caminho 3 (duplicate-handler), `data.link_pagamento` e `data.invoice_url` ficam `undefined`, `linkPagamento` é falsy, e o botão fica desabilitado para sempre — exatamente o sintoma reportado.

Além disso, nada garante que `linkPagamento` exista após o fluxo: se algum dia `asaas_id` vier `null`, o botão também trava.

## Correção

### 1. Edge function `asaas-cobranca-adesao` (caminho race)
No `return` da linha 383, incluir também:
- `link_pagamento: \`https://www.asaas.com/c/${cobrancaExistenteDup.asaas_id}\``
- `invoice_url` (se houver)

Assim qualquer caminho da edge devolve um link de pagamento.

### 2. Front-end `EtapaPagamentoCotacao.tsx`
- Após `criarCobranca`, montar `linkPagamento` com fallback robusto:
  ```ts
  linkPagamento:
    data.link_pagamento ||
    data.invoice_url ||
    (data.asaas_id ? `https://www.asaas.com/c/${data.asaas_id}` : undefined),
  ```
- Trocar a condição do botão para `disabled={!cobranca}` (qualquer cobrança válida abre o link Asaas, que oferece PIX e Cartão na mesma página).
- Quando `linkPagamento` estiver vazio mas `cobranca?.id` existir, usar `https://www.asaas.com/i/${cobranca.id}` como último fallback é arriscado — em vez disso, exibir mensagem amigável "Não foi possível abrir o link de pagamento. Recarregue a página." e logar.

## Validação

1. Abrir cotação pública de produção que esteja na etapa 12 (Pagamento).
2. Aba **Cartão** deve renderizar o botão **azul/ativo**.
3. Clicar abre `https://www.asaas.com/c/{asaas_id}` em nova aba com opção de Cartão e PIX.
4. Repetir após reload (cobrança existente) — deve continuar ativo.
5. Console sem `data.link_pagamento` undefined.

## Fora de escopo

- Não criar nova cobrança só para cartão (mantém `billingType: UNDEFINED`, que já permite ambos).
- Sem mudanças em DB/migrations.
- Sem alterações na régua de cobrança/recorrência.
