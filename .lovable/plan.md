

# Correção: Calculadora Não Aplica Regras de Elegibilidade e FIPE Mínimo

## Problema

A Calculadora de Preço exibe planos Especial e Especial Plus para um Renault Scenic 2004 com FIPE R$ 13.132, que deveria ser rejeitado por:
1. **FIPE abaixo do mínimo global** (R$ 15.000) — a calculadora não verifica `perfil_veiculo_fipe_minimo`
2. **Whitelist de elegibilidade** — a calculadora não consulta a tabela `plano_elegibilidade_modelos`, que o cotador usa para negar veículos não listados

O cotador aplica ambas as verificações. A calculadora ignora as duas.

## Correções

### 1. Adicionar verificação de FIPE mínimo global na calculadora
No `CalculadoraPreco.tsx`, importar `useConfigLimitesVeiculo` e, no início da função `calcular()`, bloquear cálculo quando o valor FIPE estiver abaixo de `fipeMinimo`. Exibir mensagem informativa ao consultor.

### 2. Adicionar verificação de elegibilidade por modelo (whitelist)
No `CalculadoraPreco.tsx`:
- Buscar `plano_elegibilidade_modelos` (mesma query do cotador)
- Replicar a função `verificarElegibilidadeModelo` do cotador (ou extraí-la para um utilitário compartilhado)
- No loop de planos, quando a placa foi consultada (marca/modelo conhecidos), filtrar planos cuja whitelist nega o veículo
- Quando não há placa (cálculo manual sem marca/modelo), manter o comportamento atual (sem filtro de elegibilidade, pois não há dados do veículo)

### 3. Feedback visual
Quando FIPE abaixo do mínimo: exibir alerta "Veículo fora do perfil aceito (FIPE abaixo de R$ 15.000)" em vez da lista de planos.

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/planos/CalculadoraPreco.tsx` | Adicionar `useConfigLimitesVeiculo`, query de elegibilidade, e lógica de filtragem |

