

# Replicar configurações de "Furto - Select Deságio Diesel" para as demais coberturas Deságio Diesel

## Diagnóstico

A cobertura base (coberturas table) já está idêntica em todas as 4 coberturas — mesmos valores, carência, franquia etc. A diferença está nas **regras de elegibilidade** (tabela `entity_eligibility_rules`):

| Regra | Furto (fonte) | 70% FIPE / PT / Roubo (destinos) |
|---|---|---|
| combustivel | flex | flex (ok) |
| regiao | mesma região | mesma região (ok) |
| tipo_uso | particular | particular (ok) |
| fipe_eligibility | **não existe** | existe (redundante) |
| fipe_range faixas | **1.5, 1.5, 2.25, 3, 3.75, 4.5...** | 1, 1, 1.5, 2, 2.5, 3... |

Duas diferenças concretas:
1. **Valores das faixas FIPE** estão diferentes (destinos usam valores menores)
2. **Regra `fipe_eligibility` extra** nos destinos que a fonte não tem

## Alteração

Uma única migration SQL que:

1. **Atualiza o `rule_config`** das regras `fipe_range` das 3 coberturas destino para usar exatamente as mesmas faixas da fonte (começando em R$1,50)
2. **Remove as regras `fipe_eligibility`** redundantes dos 3 destinos (a fonte não as tem)

### Coberturas afetadas

| ID | Nome |
|---|---|
| `0dc34e13...` | 70% FIPE - Select Deságio Diesel |
| `3c6b7279...` | Perda Total (PT) - Select Deságio Diesel |
| `e8768aa0...` | Roubo - Select Deságio Diesel |

### Valores das faixas (fonte: Furto)
0-5k: R$1,50 / 5-10k: R$1,50 / 10-15k: R$2,25 / 15-20k: R$3,00 / 20-25k: R$3,75 / ... incremento de R$0,75 por faixa até 175-180k: R$27,00

## Impacto
- 1 migration SQL (update + delete)
- 0 arquivos de código alterados
- As 3 coberturas passam a ter configurações idênticas à "Furto - Select Deságio Diesel"

