
# Corrigir propagacao de dados para Proposta de Filiacao

## Problema identificado

Ao criar o contrato no `ContratoWizard.tsx`, varios campos disponiveis na cotacao/lead **nao estao sendo propagados** para a tabela `contratos`. Isso causa campos vazios na Proposta de Filiacao.

### Campos faltantes na criacao do contrato

| Campo | Status | Motivo |
|---|---|---|
| Cambio | Backend infere, mas falha frequentemente | `inferirCambio()` so detecta se o nome do modelo contem "MANUAL", "CVT", "AT" etc. — modelos FIPE geralmente nao incluem isso |
| Portas | Backend infere como 4 (padrao) | `inferirPortas()` usa apenas a categoria para decidir 0 (moto) ou 4 |
| Cod. FIPE | **Nao propagado** | `ContratoWizard` nao envia `codigo_fipe` ao criar contrato, mesmo estando disponivel na cotacao |
| Valor FIPE | Propagado parcialmente | Enviado como `veiculo_valor_fipe`, mas pode vir nulo se cotacao nao tem esse dado |
| Leilao (SIM/NAO) | Backend infere da categoria | `ehLeilao()` funciona, mas `veiculo_categoria` nao e propagada ao contrato |
| Uso aplicativo (SIM/NAO) | **Nao propagado** | `uso_aplicativo` nao e enviado ao criar contrato |
| Nome do Consultor | **Nao propagado** | `vendedor_id` nao e enviado ao criar contrato no `ContratoWizard` |
| Combustivel | **Nao propagado** | `veiculo_combustivel` nao e enviado ao contrato |

## Solucao

### 1. Propagar campos faltantes no ContratoWizard.tsx

Adicionar os seguintes campos na chamada `createContrato.mutateAsync()`:

- `codigo_fipe` (da cotacao)
- `veiculo_combustivel` (da cotacao ou dados do formulario)
- `veiculo_categoria` (da cotacao)
- `uso_aplicativo` (da cotacao)
- `vendedor_id` (da cotacao ou usuario logado)
- `veiculo_procedencia` (da cotacao, se disponivel)

### 2. Propagar campos faltantes no ContratoFormDialog.tsx

Mesma logica: garantir que o formulario de criacao de contrato tambem envie esses campos.

### 3. Melhorar inferencia de Cambio no backend

A funcao `inferirCambio()` em `termo-afiliacao-utils.ts` e muito limitada. Melhorar adicionando mais padroes comuns de nomes FIPE (ex: "AUT", "MEC", "I-MOTION", "FLEX") e tambem tentar inferir a partir da tabela `veiculos` se existir o veiculo vinculado.

### 4. Propagar campos na cotacao publica (EtapaPagamentoCotacao.tsx)

Verificar se o fluxo de cotacao publica tambem propaga esses campos ao gerar o contrato.

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `src/components/contratos/ContratoWizard.tsx` | Adicionar `codigo_fipe`, `veiculo_combustivel`, `veiculo_categoria`, `uso_aplicativo`, `vendedor_id`, `veiculo_procedencia` na criacao do contrato |
| `src/components/contratos/ContratoFormDialog.tsx` | Adicionar campos faltantes na criacao do contrato |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Melhorar `inferirCambio()` com mais padroes de nomes FIPE |
| `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` | Verificar e corrigir propagacao de campos no fluxo publico |

## Resultado

Todos os campos da Proposta de Filiacao serao preenchidos automaticamente sem necessidade de conferencia manual:
- Cambio: inferido com mais precisao do nome do modelo
- Portas: inferido da categoria (0 para motos, 4 para carros, 2 para coupe/esportivos)
- Cod. FIPE e Valor FIPE: propagados da cotacao
- Leilao e Uso aplicativo: propagados da cotacao
- Nome do Consultor: resolvido via `vendedor_id` no contrato
