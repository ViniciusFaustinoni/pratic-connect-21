

# Base Antiga: Separar Associados e Veículos

## Resumo

Transformar a página "Base Antiga" em uma página com 2 abas: **Associados** (conteúdo atual) e **Veículos** (nova listagem de veículos vinculados a associados com `origem_cadastro = 'api_externa'`).

## Alterações

### 1. `src/hooks/useBaseAntiga.ts` — Novo hook `useBaseAntigaVeiculos`

- Query em `veiculos` com join `associado:associados!inner(id, nome, cpf, origem_cadastro)` filtrando `associados.origem_cadastro = 'api_externa'`
- Busca por placa, chassi, marca/modelo ou nome do associado
- Paginação idêntica ao hook de associados
- Join com rastreadores para mostrar status do rastreador

### 2. `src/pages/cadastro/BaseAntiga.tsx` — Adicionar abas

- Envolver conteúdo atual em `Tabs` com 2 abas: "Associados" e "Veículos"
- Aba **Associados**: conteúdo existente (sem mudanças)
- Aba **Veículos**: nova tabela com colunas: Placa, Marca/Modelo, Ano, Cor, Associado (nome), Status, Rastreador
- Busca e paginação independentes para cada aba
- Clicar num veículo abre o `VeiculoDetalhesModal` já existente
- Clicar no nome do associado abre o modal de detalhes do associado (já existente)

### 3. Sidebar — Atualizar label

- Renomear "Base Antiga" para "Base Antiga" (manter) mas atualizar a descrição na página para "Base Antiga — Associados e Veículos importados"

## Tabela de Veículos (Aba)

| Coluna | Fonte |
|--------|-------|
| Placa | `veiculos.placa` |
| Marca/Modelo | `veiculos.marca` + `veiculos.modelo` |
| Ano | `veiculos.ano_modelo` |
| Cor | `veiculos.cor` |
| Associado | join `associados.nome` |
| Status | `veiculos.status` |
| Rastreador | join `rastreadores` (ícone verde/cinza) |

## Impacto
- 1 hook novo (`useBaseAntigaVeiculos`) no arquivo existente
- 1 página modificada (`BaseAntiga.tsx`)
- Reutiliza `VeiculoDetalhesModal` existente

