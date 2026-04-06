

# Plano: Inclusão de veículo deve usar fluxo etapa-por-etapa

## Problema
Ao iniciar uma "Inclusão de Veículo", o sistema navega para `/vendas/cotador` (Cotador Rápido), que é uma página plana com todos os campos visíveis de uma vez. Os outros tipos de entrada (troca de titularidade, migração) abrem dialogs/menus com etapas. A cotação normal usa `/vendas/cotacao` com stepper de 4 etapas. A inclusão deveria seguir esse mesmo padrão de etapas, não o cotador rápido.

## Solução
Redirecionar a inclusão de veículo para `/vendas/cotacao` (CotacaoPage com stepper) em vez de `/vendas/cotador`, passando `associado_id` e `tipo_entrada=inclusao` como query params. O CotacaoPage já tem o fluxo de 4 etapas (Dados do Associado → Veículo → Critérios → Resultado).

## Alterações

### 1. `src/components/vendas/OutrasEntradasMenu.tsx`
- Linha 247: trocar navegação de `/vendas/cotador?associado_id=...&tipo_entrada=inclusao` para `/vendas/cotacao?associado_id=...&tipo_entrada=inclusao`

### 2. `src/pages/vendas/Cotacao.tsx` (CotacaoPage)
- Ler `associado_id` e `tipo_entrada` dos query params via `useSearchParams`
- Quando `tipo_entrada=inclusao`, pré-preencher os dados do associado (buscar nome, email, telefone do banco) e pular a etapa 1, indo direto para a etapa 2 (Veículo)
- Exibir banner contextual "Inclusão de segundo veículo para [Nome]"
- Após salvar cotação na etapa 4, redirecionar automaticamente para `/vendas/contratos/novo?cotacao=${id}` (como já faz o Cotador)

### 3. `src/App.tsx`
- Remover ou ajustar a rota especial que renderiza `<Cotador />` em `/vendas/cotador` para inclusão, já que não será mais necessária

## Arquivos modificados
- `src/components/vendas/OutrasEntradasMenu.tsx`
- `src/pages/vendas/Cotacao.tsx`
- `src/App.tsx` (limpeza)

