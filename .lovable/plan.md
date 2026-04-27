## Demanda do Relato

A associada **MARIA JULIA FLORENCIO GOMES** relatou que, após a conclusão do cadastro, **não existe forma de alterar o método de pagamento da cobrança de adesão** (ex.: trocar PIX por Cartão de Crédito). Hoje, quando o associado ainda está fisicamente na sede e pede a troca, o atendente precisa fazer "manualmente" — não há ação no sistema.

## Diagnóstico técnico

- A forma de pagamento (`forma_pagamento`) é gravada **por cobrança**, principalmente em `cobrancas` e `asaas_cobrancas`. Não existe campo "padrão" no associado/contrato.
- A criação inicial é feita pela Edge Function `asaas-cobranca-adesao` com `billingType` (PIX | BOLETO | CREDIT_CARD | UNDEFINED).
- A Edge Function `asaas-cobrancas` hoje suporta `POST` (criar), `GET` (consultar) e `DELETE` (cancelar) — **não suporta alterar `billingType`** de uma cobrança existente.
- A API do Asaas permite atualizar uma cobrança **enquanto ela estiver `PENDING`** via `POST /v3/payments/{id}` com o novo `billingType`. Se já estiver `RECEIVED`/`CONFIRMED`, não é editável.
- A tela do associado (gestão) tem aba **Financeiro → Últimas Faturas** (`AssociadoDetalhe.tsx`, linhas 936+), que lista as cobranças mas não tem ação por linha.
- A tela do próprio associado (`AppBoletoDetalhe.tsx`) mostra o boleto/PIX, mas também não tem ação de troca.

## Plano de implementação

### 1) Edge Function: `asaas-cobranca-alterar-forma`
Nova função (ou nova `action` em `asaas-cobrancas`) que:
- Recebe `{ cobrancaId, novaForma: 'PIX' | 'BOLETO' | 'CREDIT_CARD' }`
- Valida permissão do chamador (RLS via cliente autenticado + verificação de acesso ao associado).
- Busca a cobrança em `cobrancas`/`asaas_cobrancas`, garante que está com status pendente (`PENDING` no Asaas, não pago localmente).
- **Estratégia padrão**: tenta `POST /payments/{asaas_id}` enviando apenas `billingType` novo. Se o Asaas retornar erro de campo imutável (alguns campos como `billingType` exigem recriação dependendo do estado), faz **fallback**: cancela a cobrança atual via `DELETE` e cria nova via mesma rotina do `asaas-cobranca-adesao` (mesmo valor, vencimento, contrato, cliente).
- Atualiza `cobrancas.forma_pagamento` e `asaas_cobrancas.forma_pagamento` no banco.
- Registra entrada em `associados_historico` com `tipo='forma_pagamento_alterada'`, descrição "Forma de pagamento alterada de X para Y" e `usuario_id`.
- Retorna os novos dados (linha de digitação do boleto, QR Code do PIX, ou link de checkout do cartão) para a UI exibir imediatamente.

### 2) Hook React: `useAlterarFormaPagamento`
Em `src/hooks/useCobrancas.ts` (ou novo arquivo). `useMutation` que invoca a edge function, invalida `['cobrancas-associado', id]`, `['resumo-financeiro', id]` e `['my-boletos']`, com toast de sucesso/erro.

### 3) UI — Tela de gestão (sede)
Em `src/pages/cadastro/AssociadoDetalhe.tsx`, na aba **Financeiro**:
- Adicionar uma coluna "Ações" na tabela "Últimas Faturas" com um botão "Alterar forma" (visível apenas quando a fatura está pendente e ainda não vencida/paga).
- Abrir um `Dialog` com um `RadioGroup` (PIX / BOLETO / CARTÃO) e botão "Confirmar alteração". Mostrar a forma atual destacada.
- Após confirmar, mostrar o novo PIX/boleto inline (modal com QR Code copiável ou linha digitável) — útil para imprimir/enviar enquanto o associado ainda está na sede.

### 4) UI — App do associado
Em `src/pages/app/AppBoletoDetalhe.tsx`, adicionar botão **"Alterar forma de pagamento"** no card do boleto pendente, acionando o mesmo fluxo (mesmo `Dialog`/hook). O associado pode trocar sozinho dentro do app.

### 5) Restrições e validações
- Só permite alterar quando a cobrança está **pendente** (`status` ∈ pendente/em_aberto/aguardando_pagamento) e **não vencida há mais de N dias** (configurável; default: permite até a data de vencimento).
- Se a cobrança já tiver tentativa de cartão recusada, manter histórico mas permitir nova tentativa.
- Cartão de crédito: redirecionar para o link de checkout do Asaas (`invoiceUrl`) — não capturar dados de cartão direto na UI.
- Bloquear alteração para cobranças `RECEIVED`/`CONFIRMED`/`OVERDUE` há mais de 30 dias (já vão para protesto/cobrança).

### 6) Permissões e auditoria
- Permissão de "alterar forma de pagamento" liberada por padrão para: Diretor, Gerente Comercial, Atendente, Financeiro, e o **próprio associado** (autenticado no app).
- Toda alteração registra em `associados_historico` com autor e timestamp.

## Arquivos afetados
- `supabase/functions/asaas-cobrancas/index.ts` — adicionar `action: 'alterar-forma'` (ou criar `asaas-cobranca-alterar-forma/index.ts` separada).
- `src/hooks/useCobrancas.ts` — novo hook `useAlterarFormaPagamento`.
- `src/components/cobrancas/AlterarFormaPagamentoDialog.tsx` — novo componente reutilizável.
- `src/pages/cadastro/AssociadoDetalhe.tsx` — coluna "Ações" + botão na tabela de faturas.
- `src/pages/app/AppBoletoDetalhe.tsx` — botão "Alterar forma de pagamento".
- Migração: nada novo (campos já existem); apenas garantir que `associados_historico` aceita o novo `tipo`.

## Resultado esperado
- Atendente consegue, em um clique, trocar a forma de pagamento da fatura de adesão (ou de qualquer mensalidade pendente) enquanto o associado ainda está na sede.
- O próprio associado consegue trocar pelo app antes do vencimento.
- Histórico completo de quem alterou e quando.
- Cobrança original é atualizada (ou recriada com mesmo valor/vencimento) no Asaas, sem duplicar débitos.
