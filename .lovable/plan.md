

# Remover Taxa Administrativa Mensal do Rateio

## Motivo
A taxa administrativa agora é configurada por plano (com faixas FIPE) no `PlanoFormSheet`. A seção global no Rateio é redundante.

## Alteração

### `src/pages/configuracoes/RateioConfig.tsx`
Remover o bloco das linhas 318–344 (o `Card` inteiro de "Taxa Administrativa Mensal").

Nenhum outro arquivo precisa ser alterado.

