

# Plano: Atribuir rastreador a veículo manualmente (somente diretor)

## Resumo

No modal de detalhes de um rastreador com status diferente de "instalado" (estoque, manutenção, etc.), adicionar um botão "Vincular a Veículo" visível apenas para diretores. Ao clicar, abre um campo de busca por placa. Ao selecionar o veículo, o rastreador é vinculado (status → `instalado`, `veiculo_id` preenchido).

## Alterações

### 1. `RastreadorDetailDrawer.tsx` — Adicionar seção de vinculação manual

Na aba "info", quando `!isInstalled && !rastreador.veiculos && isDiretor`:
- Mostrar seção "Vincular a Veículo" com input de busca por placa
- Usar `Combobox`/input com debounce que busca veículos pela placa digitada
- Ao selecionar, chamar `useUpdateRastreadorStatus` com `{ id, status: 'instalado', veiculo_id }` (já suporta esse parâmetro)
- Mostrar confirmação antes de vincular

Componente interno (ou extraído): `VincularVeiculoSection`
- State: `buscaPlaca`, `veiculoSelecionado`, `confirmando`
- Query: busca veículos por placa com `ilike` (debounced 300ms)
- Resultado: lista de veículos (placa, marca, modelo, associado)
- Ação: botão "Vincular" → chama `updateStatus.mutateAsync({ id, status: 'instalado', veiculo_id })`

### 2. Nenhuma alteração no backend

O hook `useUpdateRastreadorStatus` já aceita `veiculo_id` e muda o status para `instalado` com vinculação. Não é necessário criar migration nem edge function.

## Arquivos alterados
- `src/components/rastreadores/RastreadorDetailDrawer.tsx` — adicionar seção de vinculação com busca por placa (protegida por `isDiretor`)

