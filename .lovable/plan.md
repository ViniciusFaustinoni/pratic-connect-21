

# Implementar Step 7 — Conclusão do Wizard de Substituição

## Problema
O step 7 (Aprovação) é um stub estático. Após enviar para aprovação, o consultor não recebe feedback nem acompanhamento em tempo real.

## Solução

### 1. Criar `src/components/substituicao/StepConclusao.tsx`
Componente funcional com:

- **Polling automático**: `useQuery` com `refetchInterval: 10000` buscando o registro da substituição pelo `substituicaoId` na tabela `substituicoes_veiculo` (campos `status`, `motivo_rejeicao`, `veiculo_novo_placa`, `veiculo_novo_modelo`, `taxa_substituicao`, `veiculo_antigo_placa`, `data_fim_carencia`)
- **Indicador visual**: ícone animado de sucesso (CheckCircle2 verde), loading (Loader2 spinning), ou erro (XCircle vermelho) conforme status
- **Resumo da operação**: card com nome do associado, placa antiga → placa/modelo novo, taxa paga
- **Status em tempo real** mapeado assim:
  - `aguardando_aprovacao` → "Aguardando processamento" (spinner)
  - `aprovada` → "Em processamento" (spinner)
  - `efetivada` → "Concluída com sucesso" (check verde)
  - `rejeitada` → "Falha no processamento" (X vermelho + motivo_rejeicao)
- **Alerta de cobertura**: se `data_fim_carencia` está no futuro, exibir Alert amarelo destacado "Veículo em período de carência até DD/MM/YYYY"
- **Botões condicionais**:
  - Status `efetivada`: "Ver ficha do associado" (navigate para `/cadastro/associados/:id`) + "Nova operação" (navigate para `/cadastro/associados`)
  - Status `rejeitada`: "Tentar novamente" (volta ao step 6)
- O polling para quando status é `efetivada`, `rejeitada` ou `cancelada_pelo_associado`

Props: `substituicaoId`, `associadoId`, `associadoNome`, `veiculoAntigoPlaca`, `onRetry` (volta ao step 6)

### 2. Atualizar `src/pages/cadastro/SubstituicaoVeiculoPage.tsx`
- Importar `StepConclusao`
- No `handleFinanceiroConfirmar`: adicionar `setCurrentStep(7)` após `completeStep(6)`
- Substituir o stub do step 7 pela renderização de `<StepConclusao>` passando as props necessárias
- Adicionar handler `handleRetry` que volta ao step 6

