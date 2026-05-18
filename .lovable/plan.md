## Objetivo

Exibir o **Chassi** do veículo no card "Veículo" da tela `Monitoramento › Aprovação de Associados › Detalhes` (Análise de Instalação).

## Alterações

**Arquivo:** `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`

1. **Linha 57** — Incluir `chassi` no select do veículo:
   ```ts
   veiculo:veiculo_id(id, placa, chassi, marca, modelo, ano_modelo, cor, valor_fipe, combustivel, cobertura_roubo_furto, cobertura_total)
   ```

2. **Linhas 527-552** — Adicionar campo Chassi no grid do card Veículo (logo após Placa), ajustando o grid para `sm:grid-cols-5` para acomodar os 5 campos (Placa, Chassi, Veículo, Ano, Instalador) sem espremer. Exibe `veiculo?.chassi || '---'` em fonte mono.

Nenhuma mudança de banco, edge function ou lógica — apenas leitura/exibição.
