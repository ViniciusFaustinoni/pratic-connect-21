

# Remover seção de Prestadores do modal Atribuir Fornecedores

## Problema

O modal "Atribuir Fornecedores" exibe uma seção "Prestadores de Serviço (opcional)" que lista prestadores da tabela `prestadores_evento`. Esses prestadores pertencem ao fluxo de Assistencia 24h e nao devem aparecer neste modal de atribuicao de oficinas para sinistros/eventos.

## Solucao

Remover completamente a seção de Prestadores do modal, incluindo:

1. **Remover imports e hooks** nao mais necessarios:
   - `usePrestadoresEvento` (linha 4)
   - Estado `prestadoresSelecionados` e funcao `handleTogglePrestador`
   - Icone `Users` (se nao usado em outro lugar)

2. **Remover a seção visual** "Prestadores de Serviço (opcional)" (linhas 372-429) do JSX

3. **Remover referencia a prestadores na logica de submit** -- garantir que o `handleConfirmar` nao envie `prestadoresSelecionados` ao banco

## Arquivo alterado

- `src/components/sinistros/AtribuirFornecedoresDialog.tsx`

