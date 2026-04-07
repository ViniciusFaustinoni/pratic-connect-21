

# Plano: Clonar 18 planos Select para linha Lançamento

## Situação Atual

**Linha SELECT** (18 planos): Basic, Premium, Exclusive — cada um com variantes Deságio 70%, Deságio 75%, Diesel, Diesel Deságio 70%, Diesel Deságio 75%.

**Linha LANÇAMENTO** (3 planos): Basic, Exclusive, Premium — sem variantes Deságio ou Diesel.

## O que será feito

Criar **15 novos planos** na linha Lançamento (os 3 base já existem), clonando a estrutura da Select com as seguintes diferenças:

| Configuração | Select | Lançamento |
|---|---|---|
| `product_line_id` | `66f8d697...` (SELECT) | `4ed27b6d...` (LANÇAMENTO) |
| `fipe_minima` | `0.00` | `50000.00` |
| Nome | "Select X" | "Lançamento X" |
| Coberturas | Select (9 variantes) | Lançamento (9 coberturas fixas) |
| Benefícios | Por tier | Mesmo do tier correspondente |

### 15 planos novos

```text
Lançamento Basic - Deságio 75%
Lançamento Basic - Deságio 70%
Lançamento Basic Diesel
Lançamento Basic Diesel - Deságio 75%
Lançamento Basic Diesel - Deságio 70%
Lançamento Premium - Deságio 75%
Lançamento Premium - Deságio 70%
Lançamento Premium Diesel
Lançamento Premium Diesel - Deságio 75%
Lançamento Premium Diesel - Deságio 70%
Lançamento Exclusive - Deságio 70%
Lançamento Exclusive - Deságio 75%
Lançamento Exclusive Diesel
Lançamento Exclusive Diesel - Deságio 75%
Lançamento Exclusive Diesel - Deságio 70%
```

### Para cada plano novo, serão inseridos:

1. **`planos`** — clone de todas as colunas do plano Select correspondente, com `nome`, `codigo`, `product_line_id` e `fipe_minima` ajustados
2. **`planos_coberturas`** — as 9 coberturas Lançamento (Roubo, Colisão, Furto, Incêndio, Perda Total, Alagamento, Chuva de Granizo, 100% FIPE Deságio, Taxa Administrativa)
3. **`planos_beneficios`** — mesmos benefícios do plano Select de referência (Rastreador, Assistência, Danos a Terceiros, etc. conforme o tier)
4. **`planos_regioes`** — mesmas regiões do plano Select de referência (quando aplicável)

### Atualização dos 3 planos existentes

Os 3 planos Lançamento existentes (Basic, Exclusive, Premium) já têm coberturas e benefícios corretos. Será verificado se `fipe_minima = 50000` (já está correto).

## Execução

Tudo via SQL (INSERT) usando o insert tool — operação puramente de dados, sem alteração de código.

