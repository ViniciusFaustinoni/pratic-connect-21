## Plano: comissão de adesão em dinheiro para vendedor do tipo Agência

### Objetivo
Quando o vendedor de origem for do tipo `agencia` e a cobrança for de **taxa de adesão** recebida em **dinheiro**, a comissão deve nascer já quitada:

```text
Gerar comissão -> status paga imediatamente -> exibir badge informativo
```

Essa regra será exceção apenas para adesão em dinheiro de agência; as demais comissões continuam no fluxo normal de conferência/pagamento.

---

## 1. Ajustar a geração automática das comissões

Arquivo/migration da função:

- `public.fn_gerar_comissoes_por_pagamento(p_cobranca_id)`

### Regra nova
Durante o insert em `comissoes`, detectar:

```text
v_cobranca.tipo = adesao / taxa_adesao
v_cobranca.forma_pagamento = CASH / dinheiro
role_destinatario = agencia
```

Quando verdadeiro:

```text
status = 'paga'
pago_em = data_pagamento da cobrança ou now()
observacoes = informação de que a comissão foi quitada automaticamente por adesão em dinheiro recebida pela agência
calculo_snapshot.autopagamento_agencia_adesao_dinheiro = true
```

### Importante
A comissão continuará sendo registrada normalmente, com grade, plano, regra, parcela, valores e snapshot. A diferença será somente o estado inicial e a marcação auditável.

---

## 2. Garantir que apenas agência receba esse tratamento

A exceção será aplicada quando a regra remunerada for do perfil:

```text
role_destinatario = 'agencia'
```

Não será aplicada para:

```text
vendedor_clt
vendedor_externo
supervisor_vendas
gerente_comercial
```

Mesmo que a cobrança seja adesão em dinheiro, esses perfis seguem como `pendente`.

---

## 3. Padronizar helpers de status/badge

Arquivo:

- `src/lib/comissoes-filtros.ts`

Adicionar helpers reutilizáveis:

```text
isComissaoAutoPagaAgenciaAdesaoDinheiro(item)
getComissaoStatusLabel(item)
getComissaoStatusBadgeVariant(item)
```

A detecção usará preferencialmente:

```text
calculo_snapshot.autopagamento_agencia_adesao_dinheiro = true
```

Com fallback por segurança:

```text
role_destinatario = agencia
tipo_comissao = adesao
status = paga
observacoes contém indicação de adesão/dinheiro/agência
```

---

## 4. Exibir badge informativo nas telas de comissões

Atualizar:

- `src/pages/comissoes/Pagamentos.tsx`
- `src/pages/comissoes/Relatorio.tsx`
- `src/components/comissoes/ComissoesDetalhesModal.tsx`
- `src/components/comissoes/ComissaoDetalhesPagamentoModal.tsx`

### Visual esperado
Onde hoje aparece apenas:

```text
paga
```

Para esse caso aparecerá algo como:

```text
Paga
Autoquitada: adesão em dinheiro da agência
```

ou um badge secundário:

```text
Paga automaticamente
```

No modal de detalhes, adicionar um alerta informativo explicando:

```text
Esta comissão foi marcada como paga automaticamente porque se trata de taxa de adesão recebida em dinheiro por agência.
```

---

## 5. Ajustar dados carregados pelos hooks

Atualizar os selects para carregar os campos necessários à detecção:

- `calculo_snapshot`
- `observacoes`
- `role_destinatario`
- `tipo_comissao`
- `status`
- `pago_em`

Hooks envolvidos:

- `src/hooks/useComissoesDashboard.ts`
- `src/hooks/useRelatorioComissoes.ts`
- `src/hooks/usePagamentosComissoes.ts`
- `src/hooks/useComissaoDetalhesPagamento.ts`

---

## 6. Conferir recibo e ação de pagamento

Na tela de Pagamentos:

- comissão autoquitada deve mostrar ação de recibo, não botão `Pagar`;
- deve entrar nos totais de `Pago no período`;
- não deve entrar em `A pagar`;
- filtro por status `Paga` deve encontrá-la.

---

## 7. Validação esperada

### Cenário 1: agência + adesão + dinheiro
- Gerar pagamento de taxa de adesão em dinheiro.
- Comissão do perfil `agencia` nasce com status `paga`.
- `pago_em` fica preenchido.
- Tela mostra badge informativo de autoquitação.

### Cenário 2: agência + adesão + PIX/boleto/cartão
- Comissão segue fluxo normal como `pendente`.

### Cenário 3: vendedor/supervisor/gerente + adesão em dinheiro
- Não autoquita.
- Continua no fluxo normal.

### Cenário 4: Dashboard/Relatório/Pagamentos
- Filtros por período, status e tipo continuam funcionando.
- Comissão autoquitada aparece como paga nos três módulos.

### Cenário 5: detalhes
- Modal mostra alerta explicando a regra especial.