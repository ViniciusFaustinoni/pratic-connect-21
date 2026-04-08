

# Plano: Adicionar regras de Marca/Modelo e Ano ao modal de Linha

## Problema

O modal "Editar Linha" (`LinhaFormModal`) ja possui os componentes `EligibilityRulesEditor` e `MarcaModeloExclusionEditor`, mas:

1. So aparecem ao **editar** (nao ao criar) -- condicional `isEditing && productLine`
2. O modal e `max-w-md` (estreito demais para os editores)
3. As secoes de regras nao tem toggles visuais claros -- o usuario quer switches que mostrem/ocultem os campos

O usuario quer uma UX com **toggles** para ativar/desativar cada tipo de regra, e ao ativar, os campos configuraveis aparecem inline.

## Alteracoes

### 1. `LinhaFormModal.tsx` -- Ampliar modal e reorganizar UX

- Mudar `max-w-md` para `max-w-2xl` para acomodar os editores
- Adicionar scroll (`max-h-[80vh] overflow-y-auto`) ao conteudo
- Mover os editores de regras para DENTRO do form com toggles visuais
- Remover a condicao `isEditing && productLine` para que aparecam tambem na criacao (desabilitados com mensagem "salve primeiro")

### 2. Adicionar secao "Regra de Ano" com toggle

Nova secao com Switch "Restringir por Ano de Fabricacao":
- Desativado: nenhuma restricao de ano (aceita todos)
- Ativado: exibe dois campos numericos lado a lado (Ano Minimo / Ano Maximo)
- Ao salvar, cria/atualiza uma regra `ano_range` no `entity_eligibility_rules` com `rule_mode: 'include'`
- Ao desativar, remove a regra `ano_range` existente

Essa secao usara diretamente os hooks `useRulesForEntity`, `useSaveRule`, `useDeleteRule` para ler/gravar a regra de ano da linha.

### 3. Adicionar secao "Regra de Marca/Modelo" com toggle

Nova secao com Switch "Restringir por Marca / Modelo":
- Desativado: aceita todas as marcas
- Ativado: exibe o `MarcaModeloExclusionEditor` existente (ja funcional)

Sera basicamente um wrapper com Switch que mostra/oculta o editor existente. O estado do toggle sera derivado de `exclusions.length > 0`.

### 4. Remover EligibilityRulesEditor generico do modal de Linha

O editor generico de regras (`EligibilityRulesEditor`) sera removido do modal de Linha. As regras de ano e marca/modelo terao seus proprios editores dedicados com toggles. Se no futuro outras regras forem necessarias na linha, podem ser adicionadas como secoes dedicadas.

## Layout final do modal

```text
┌─────────────────────────────────────────┐
│ Editar Linha de Produto                 │
├─────────────────────────────────────────┤
│ [Icone] [Nome *]                        │
│ [Slug]                                  │
│ [Tipo Veiculo]  [Cor]                   │
│ [Ordem]         [x] Ativo              │
│─────────────────────────────────────────│
│ Regras de Elegibilidade                 │
│                                         │
│ [toggle] Restringir por Ano             │
│   ┌─────────┐  ┌─────────┐             │
│   │ Ano Min  │  │ Ano Max │             │
│   └─────────┘  └─────────┘             │
│                                         │
│ [toggle] Restringir por Marca/Modelo    │
│   [SearchableSelect marca...]           │
│   [+ Adicionar]                         │
│   TOYOTA - Marca inteira excluida       │
│                                         │
│              [Cancelar] [Salvar]        │
└─────────────────────────────────────────┘
```

## Arquivos modificados

- `src/components/admin/planos/LinhaFormModal.tsx` -- Reorganizar layout, adicionar toggles de ano e marca/modelo, ampliar modal, remover EligibilityRulesEditor generico

Nenhum arquivo novo. Os hooks existentes (`useEntityEligibilityRules`, `useMarcasModelos`) ja suportam tudo necessario.

