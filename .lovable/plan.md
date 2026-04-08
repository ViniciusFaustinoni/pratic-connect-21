

# Plano: Adicionar seletor Blacklist/Whitelist ao editor de Marca/Modelo

## Contexto

O `MarcaModeloExclusionEditor` atualmente so suporta modo **exclusao** (blacklist). O motor de elegibilidade (`useEntityEligibilityRules`) ja suporta `rule_mode: 'include' | 'exclude'`, entao basta atualizar o componente de UI.

## Alteracoes

### 1. `MarcaModeloExclusionEditor.tsx` — Adicionar seletor de modo

- Adicionar um **toggle ou segmented control** no topo do editor com duas opcoes:
  - **Blacklist (Exclusiva)**: "Aceitar todos EXCETO as marcas/modelos listados"
  - **Whitelist (Inclusiva)**: "Aceitar APENAS as marcas/modelos listados"
- O estado do modo sera derivado das regras existentes: se existem regras `include`, modo = whitelist; se existem regras `exclude` ou nenhuma, modo = blacklist
- Ao trocar o modo, as regras existentes serao removidas (com confirmacao) e novas regras usarao o novo `rule_mode`
- Atualizar labels dinamicamente:
  - Blacklist: "Adicionar marca a exclusao", "Marca inteira excluida", "Nenhuma marca excluida"
  - Whitelist: "Adicionar marca permitida", "Marca inteira permitida", "Nenhuma marca configurada — todos bloqueados"
- Ajustar o filtro `useMemo` para ler regras com `rule_mode` igual ao modo ativo (nao mais hardcoded `'exclude'`)
- Ao salvar regras, usar o `rule_mode` selecionado

### 2. `LinhaFormModal.tsx` — Atualizar descricao do toggle

- Mudar o texto "Exclui marcas ou modelos especificos desta linha" para "Configura marcas e modelos aceitos ou bloqueados nesta linha"

### Arquivos modificados

- `src/components/admin/planos/MarcaModeloExclusionEditor.tsx`
- `src/components/admin/planos/LinhaFormModal.tsx`

