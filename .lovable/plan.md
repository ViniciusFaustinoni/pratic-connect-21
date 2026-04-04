

# Organizar Botões do Header do Modal sem Overflow

## Problema

Os botões de ação (Mapa, Substituir, Troca Titular, Suspender, Reativar, Sync, Menu) ficam todos em uma linha horizontal, causando overflow quando o modal não tem largura suficiente — especialmente com nomes longos de associados.

## Solução

Mover os botões **Substituir**, **Troca Titular**, **Suspender** e **Reativar** para dentro do `DropdownMenu` (menu "...") que já existe. Manter visíveis apenas **Mapa** e o **menu "..."** (e Sync se aplicável).

### `src/components/associados/detalhe/AssociadoHeroHeader.tsx`

**Botões visíveis (linha 187):** Manter apenas Mapa + Sync + DropdownMenu

**Dentro do DropdownMenu (linha 235):** Adicionar no topo:
- Substituir Placa (se ativo)
- Troca de Titularidade (se ativo e com permissão)
- Separator
- Suspender (se ativo)
- Reativar (se suspenso)
- Separator
- (itens existentes: Documentos, Financeiro, WhatsApp, Cancelar, etc.)

**Remover** os `<Button>` individuais de Substituir, Troca Titular, Suspender e Reativar do layout principal (linhas 192-212).

## Impacto
- 1 arquivo alterado
- Botões reorganizados, nenhuma funcionalidade removida
- Elimina overflow horizontal no header

