

# Renomear "Origem do Cadastro" para "Tipo de Entrada" e adicionar tipo Inclusão

## Resumo

Renomear a seção "Origem do Cadastro" para "Tipo de Entrada" em todo o sistema, adicionar o tipo "Inclusão de Veículo" ao card, e exibir o tipo de entrada de cada veículo na listagem do associado.

## Alterações

### 1. `src/components/associados/detalhe/OrigemCadastroCard.tsx`

- Renomear título de "Origem do Cadastro" para "Tipo de Entrada" (linha 492)
- Adicionar `'inclusao'` ao tipo `TipoEntradaKey`
- Adicionar label `'Inclusão de Veículo'` em `TIPO_ENTRADA_LABELS`
- Adicionar badge style e ícone (usar `Plus` ou `CarFront`) para inclusão em `BADGE_STYLES` e `ICONS`
- Adicionar campos na interface `OrigemData` para inclusão: `{ veiculoPrincipal: { placa, modelo, marca } | null, consultorNome, dataInclusao, carenciaInicio, carenciaFim }`
- Na query: quando `tipo_entrada === 'inclusao'`, buscar o veículo mais antigo do associado (veículo principal) e dados de carência do contrato
- Criar `RenderInclusao` que exibe:
  - Veículo principal (marca modelo — placa)
  - Consultor responsável
  - Data da inclusão
  - Carência do veículo incluído (início e fim, 120 dias)
- Adicionar case `'inclusao'` no switch de `renderContent()`
- Mostrar carência também para tipo `inclusao`

### 2. `src/components/associados/detalhe/AssociadoResumoTab.tsx`

- Alterar comentário de `{/* Origem do Cadastro */}` para `{/* Tipo de Entrada */}`

### 3. `src/hooks/useAssociados.ts` — `useVeiculosDoAssociado`

- Adicionar join com `contratos` para trazer `tipo_entrada` de cada veículo:
  ```
  contratos!contratos_veiculo_id_fkey(tipo_entrada)
  ```
- Expor `tipo_entrada` no objeto retornado de cada veículo

### 4. `src/pages/cadastro/AssociadoDetalhe.tsx` — Listagem de veículos

- Ao lado do badge de status de cada veículo, exibir um badge secundário com o tipo de entrada: "Nova Adesão", "Inclusão", "Substituição", etc., usando o `tipo_entrada` do contrato vinculado ao veículo
- Badge discreto (outline, text-xs) para não competir com o status

### 5. Constantes compartilhadas

- Criar um mapa `TIPO_ENTRADA_SHORT_LABELS` no `OrigemCadastroCard.tsx` (ou exportar de lá) para uso na listagem:
  - `adesao` → "Nova Adesão"
  - `inclusao` → "Inclusão"
  - `migracao` → "Migração"
  - `substituicao_placa` → "Substituição"
  - `troca_titularidade` → "Troca Titular"
  - `reativacao` → "Reativação"

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/associados/detalhe/OrigemCadastroCard.tsx` | Renomear título, adicionar tipo `inclusao` com dados e render |
| `src/components/associados/detalhe/AssociadoResumoTab.tsx` | Atualizar comentário |
| `src/hooks/useAssociados.ts` | Join com contratos para trazer `tipo_entrada` por veículo |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Badge de tipo de entrada em cada veículo na listagem |

Nenhuma alteração de schema necessária.

