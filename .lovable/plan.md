

## Plano: Permitir criar coberturas e beneficios durante a criacao do plano

### Problema
Ao criar um novo plano, a tela mostra "Salve o plano primeiro para adicionar coberturas e benefícios." O usuario so consegue adicionar coberturas/beneficios apos salvar o plano. O pedido e que seja possivel criar e vincular itens ja na criacao.

### Abordagem
Mudar o fluxo de criacao para um processo de dois passos automatico:
1. Ao clicar "Criar Plano", o plano e salvo imediatamente
2. O modal recarrega em modo edicao (com o `planId` recem-criado), exibindo as secoes de coberturas e beneficios
3. O usuario adiciona os itens desejados e fecha o modal quando terminar

Isso e mais simples e seguro do que tentar gerenciar itens em memoria antes do plano existir no banco (o que quebraria o `EligibilityRulesEditor` e os vinculos em `planos_coberturas`/`planos_beneficios`).

### Alteracao

**`src/components/admin/planos/PlanFormModal.tsx`**
- No `handleSubmit`, quando for criacao (`!isEditing`):
  - Apos `createPlan.mutateAsync`, capturar o `id` retornado
  - Em vez de fechar o modal (`onOpenChange(false)`), atualizar o estado interno para modo edicao com o novo `planId`
  - Exibir toast "Plano criado! Agora adicione coberturas e benefícios."
- Remover a mensagem "Salve o plano primeiro..." e substituir por um estado que mostra as secoes de coberturas/beneficios assim que o plano for salvo
- O botao muda de "Criar Plano" para "Salvar Plano" apos a criacao

### Resultado
- Fluxo continuo: usuario preenche dados do plano, clica "Criar", e imediatamente ve as secoes para adicionar coberturas e beneficios
- Sem necessidade de fechar e reabrir o modal
- Sem complexidade de gerenciar itens orfaos em memoria

### Arquivo
- `src/components/admin/planos/PlanFormModal.tsx`

