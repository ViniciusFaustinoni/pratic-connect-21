

# Plano: Fluxo de inclusão de veículo deve avançar automaticamente para contrato

## Problema
Após preencher os dados do veículo, selecionar plano e salvar a cotação no contexto de **inclusão de veículo**, o sistema fica parado no Cotador Rápido mostrando os botões genéricos (WhatsApp, Gerar Contrato, Email). O vendedor precisa clicar manualmente em "Gerar Contrato" para prosseguir. O fluxo de inclusão deveria avançar automaticamente para a próxima etapa.

## Solução
No `handleSalvarEEnviarWhatsApp`, quando `isInclusaoVeiculo` for `true` e a cotação for salva com sucesso, navegar automaticamente para a tela de contratação (`/vendas/contratos/novo?cotacao=${cotacaoSalva.id}`) em vez de ficar parado no cotador.

## Alteração

### `src/pages/vendas/Cotador.tsx`
- Após a linha ~901 (`toast.success`), adicionar condição:
  - Se `isInclusaoVeiculo && cotacaoData?.id`, navegar para `/vendas/contratos/novo?cotacao=${cotacaoData.id}` automaticamente
  - Caso contrário, manter comportamento atual (ficar no cotador com botões de ação)

## Arquivo modificado
- `src/pages/vendas/Cotador.tsx`

