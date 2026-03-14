
# Análise da Lógica Existente — Conta Corrente do Vendedor Externo

## Como funciona hoje

A lógica de controle financeiro do vendedor externo está centralizada em `src/hooks/useContaCorrenteVendedor.ts`, na mutation `gerarLancamentosAtivacao`. Ela opera com base em 4 cenários derivados de duas variáveis: `valor_adesao > 0` (cobrou) e `tipo_instalacao === rota/volante` (volante).

### Os 4 cenários da ativação

| # | Cenário | Lançamentos gerados |
|---|---------|-------------------|
| 1 | **Cobra adesão + Rota** | Crédito adesão (% configurável) + Débito volante (R$ fixo) + Parcelas recorrentes |
| 2 | **Isenta adesão + Rota** | Débito volante (status `pendente`, abatido das recorrentes) + Parcelas recorrentes |
| 3 | **Isenta adesão + Base** | **Nenhum lançamento** (cenário neutro — `return` direto na linha 145) |
| 4 | **Cobra adesão + Base** | Crédito adesão + Parcelas recorrentes (sem débito volante) |

### Configurações utilizadas (tabela `configuracoes`)

- `comissao_ext_pct_adesao`: Percentual da adesão que vira crédito (default 100%)
- `comissao_ext_valor_volante`: Valor fixo do débito volante (default R$ 50)
- `comissao_ext_tipo_recorrente`: `fixo` ou `percentual`
- `comissao_ext_valor_recorrente`: Valor/percentual por parcela
- `comissao_ext_parcelas_recorrente`: Quantidade de parcelas

### Mecanismo de abatimento

Quando há débito volante e o associado paga a mensalidade, a mutation `confirmarParcelaRecorrente` abate automaticamente o valor do débito volante das parcelas recorrentes do vendedor até quitar.

## Problema identificado: `gerarLancamentosAtivacao` nunca é chamado

A mutation existe e está correta, mas **não é invocada em nenhum lugar do código**. Ou seja, quando um associado é ativado, os lançamentos na conta corrente do vendedor externo **não são gerados automaticamente**.

## Outros bloqueios pendentes (validações de adesão zero)

Além do `CotacaoFormDialog` (já corrigido no plano anterior), ainda existem **3 pontos** que bloqueiam adesão zero sem verificar se é vendedor externo:

| Arquivo | Linha | Bloqueio |
|---------|-------|----------|
| `EtapaResultado.tsx` | 289 | Botão "Iniciar Cadastro" desabilitado quando `valorAdesao <= 0` |
| `Cotacao.tsx` | 272 | `handleIniciarCadastro` retorna erro quando `valorAdesaoFinal <= 0` |
| `CotacaoFormDialog.tsx` | 2129-2134 | Mensagem de erro visual "não pode ser zero" sempre aparece |
| `CotacaoFormDialog.tsx` | 2168 | Botão submit desabilitado quando `valorAdesao <= 0` |

## Plano de correção

### 1. `CotacaoFormDialog.tsx` — Remover bloqueios visuais e de submit para cenário isento

- **Linha 2129**: Condicionar mensagem de erro: só exibir se `!isCenarioIsento`
- **Linha 2168**: Condicionar disabled do botão: `valorAdesao <= 0 && !isCenarioIsento`

### 2. `EtapaResultado.tsx` — Permitir adesão zero para externo

- Receber prop `isVendedorExterno` (ou `isCenarioIsento`)
- **Linha 289**: Condicionar disabled: permitir quando isento

### 3. `Cotacao.tsx` — Permitir adesão zero para externo

- **Linha 272**: Adicionar gate `if (!isVendedorExterno && valorAdesaoFinal <= 0)`

### 4. Integrar `gerarLancamentosAtivacao` no fluxo de ativação

A mutation precisa ser chamada quando o associado for ativado. O ponto natural de integração é no momento em que `adesao_paga` é marcado como `true` — seja no `EtapaPagamentoCotacao`

<lov-plan>
# Análise da Lógica Existente — Conta Corrente do Vendedor Externo

## Como funciona hoje

A lógica está em `src/hooks/useContaCorrenteVendedor.ts`, mutation `gerarLancamentosAtivacao`. Opera com 4 cenários:

| # | Cenário | Lançamentos gerados |
|---|---------|-------------------|
| 1 | **Cobra adesão + Rota** | Crédito adesão + Débito volante + Parcelas recorrentes |
| 2 | **Isenta adesão + Rota** | Débito volante (pendente, abatido das recorrentes) + Parcelas recorrentes |
| 3 | **Isenta adesão + Base** | Nenhum lançamento (return direto) |
| 4 | **Cobra adesão + Base** | Crédito adesão + Parcelas recorrentes |

Configurações em `configuracoes`: `comissao_ext_pct_adesao`, `comissao_ext_valor_volante`, `comissao_ext_tipo_recorrente`, `comissao_ext_valor_recorrente`, `comissao_ext_parcelas_recorrente`.

O abatimento automático do débito volante acontece via `confirmarParcelaRecorrente` quando o associado paga a mensalidade.

## Problema principal: `gerarLancamentosAtivacao` nunca é chamado

A mutation existe e está correta, mas **não é invocada em nenhum lugar do código**. Os lançamentos na conta corrente do vendedor externo não são gerados automaticamente na ativação.

## Bloqueios de adesão zero ainda pendentes

| Arquivo | Linha | Bloqueio |
|---------|-------|----------|
| `CotacaoFormDialog.tsx` | 2129 | Mensagem "não pode ser zero" sempre aparece |
| `CotacaoFormDialog.tsx` | 2168 | Botão submit desabilitado quando `valorAdesao <= 0` |
| `EtapaResultado.tsx` | 289 | Botão "Iniciar Cadastro" desabilitado |
| `Cotacao.tsx` | 272 | `handleIniciarCadastro` retorna erro |

## Plano de correção

### 1. `CotacaoFormDialog.tsx` — Remover bloqueios visuais para cenário isento
- Linha 2129: mensagem de erro só aparece se `!isCenarioIsento`
- Linha 2168: botão submit permite `valorAdesao <= 0` quando `isCenarioIsento`

### 2. `EtapaResultado.tsx` — Permitir adesão zero para externo
- Receber prop `isCenarioIsento` (boolean)
- Linha 289: condicionar disabled para permitir quando isento

### 3. `Cotacao.tsx` — Permitir adesão zero para externo
- Usar `usePermissions` para obter `isVendedorExterno`
- Linha 272: gate `if (!isVendedorExterno && valorAdesaoFinal <= 0)`

### 4. Integrar `gerarLancamentosAtivacao` no fluxo de ativação
O ponto natural é no `EtapaPagamentoCotacao.tsx`, após marcar `adesao_paga = true`. Quando o vendedor da cotação for externo:
- Buscar `vendedor_id` da cotação
- Verificar se é externo (perfil `vendedor_externo`)
- Chamar edge function ou inserir diretamente os lançamentos na `cc_vendedor_lancamentos`

Como isso roda no **link público** (sem auth do vendedor), a melhor abordagem é criar a lógica dentro da Edge Function `criar-instalacao-pos-pagamento`, que já tem service role e acesso a todos os dados. Após criar a instalação, verificar se o vendedor da cotação é externo e gerar os lançamentos.

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Condicionar erro visual e botão por `isCenarioIsento` |
| `src/components/cotacao/EtapaResultado.tsx` | Receber prop e condicionar botão |
| `src/pages/vendas/Cotacao.tsx` | Gate de adesão zero para externo |
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | Gerar lançamentos CC vendedor externo na ativação |
