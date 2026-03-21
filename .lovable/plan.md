

# Plano: Conta Corrente Unificada para Vendedor Externo, Supervisor Externo e Agência

## Contexto Atual

Já existe `ContaCorrenteVendedor` em `/perfil/conta-corrente` com 3 cards (Saldo Atual, A Receber Mês, Antecipações) e extrato da tabela `cc_vendedor_lancamentos`. Precisa ser reformulado para atender o pedido.

## 1. Reformular `ContaCorrenteVendedor.tsx`

### Dashboard: trocar os 3 cards por 4 novos
- **A Receber este mês**: `cc_vendedor_lancamentos` WHERE status IN ('pendente','a_pagar') AND mês atual, tipo='credito'
- **Já Recebido este mês**: WHERE status='pago' AND data_pagamento no mês atual, tipo='credito'
- **Total a Receber**: WHERE status IN ('pendente','a_pagar'), tipo='credito' (todos os períodos)
- **Total Histórico Recebido**: WHERE status='pago', tipo='credito' (todos os períodos)

### Extrato: enriquecer colunas
- Data de geração (data_lancamento)
- Tipo: exibir "Adesão" ou "Mensalidade (Xª parcela)" baseado em `categoria` e `parcela_numero`
- Nome do associado: já existe no campo `descricao`, mas buscar via join com `associados` usando `associado_id`
- Plano: buscar via contrato → plano (join `contrato_id` → `contratos.plano_id` → `planos.nome`)
- Valor da comissão (`valor_liquido`)
- Status com cores: 🟡 Pendente/A Pagar, 🟢 Pago (+ data pagamento), 🔴 Cancelado/Estorno (+ motivo via `observacao_pagamento`)

### Filtros adicionais
- Tipo: Adesão / Mensalidade / Todos (filtra por `categoria`)
- Busca por nome do associado (busca texto no campo `descricao` ou join)
- Manter período e status existentes

### Exportação CSV
- Adicionar botão "Exportar CSV" ao lado do PDF existente

## 2. Atualizar Hook `useContaCorrenteVendedor.ts`

- Adicionar query de resumo com os 4 KPIs (substituir `vw_cc_vendedor_saldo`)
- Alterar query de lançamentos para fazer join com `associados(nome)` e `contratos(plano_id, planos(nome))` via `associado_id` e `contrato_id`
- Adicionar filtro por `categoria` e busca texto

## 3. Sidebar: ampliar visibilidade

Em `AppSidebar.tsx`, a condição `(permissions.isVendedorOnly || permissions.isPerfilLimitado)` já cobre vendedor externo. Verificar se supervisor externo e agência também entram -- caso contrário, adicionar `isSupervisorExterno` e role `agencia` à condição.

## 4. Notificações

Criar trigger SQL ou lógica no edge function de pagamento:
- Quando `cc_vendedor_lancamentos.status` muda para `pago` → inserir na tabela `notificacoes` (se existir) com mensagem "Sua comissão de R$ XX,00 referente à venda de [Associado] foi paga em [Data]"
- Quando `status` muda para `cancelado` → notificação de estorno com motivo

Verificar se tabela `notificacoes` já existe no sistema.

## 5. Nenhuma alteração no banco de dados necessária

A tabela `cc_vendedor_lancamentos` já tem todos os campos necessários. Os joins são feitos via `associado_id` e `contrato_id` existentes. Os 4 KPIs são calculados por query agregada.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/financeiro/ContaCorrenteVendedor.tsx` | Reformular: 4 cards, extrato enriquecido, filtros, CSV |
| `src/hooks/useContaCorrenteVendedor.ts` | Query com joins, filtro categoria/busca, 4 KPIs |
| `src/components/layout/AppSidebar.tsx` | Ampliar visibilidade para supervisor externo e agência |
| SQL (trigger ou migration) | Notificação automática ao mudar status para pago/cancelado |

