# Detalhe da OS como Modal

## Objetivo

Eliminar a rota `/oficinas/ordens/:id` e exibir o detalhe da Ordem de Serviço dentro de um modal full-screen, mantendo todas as funcionalidades atuais.

## Funcionalidades preservadas

Tudo que existe hoje na página continua funcionando dentro do modal:

- Cabeçalho com número da OS, status colorido e data de criação
- Botões "Concluir OS / Gerenciar Conclusão" e "Atualizar Status"
- Cards informativos (Oficina, Associado, Veículo)
- Tabela de itens do orçamento com "Adicionar Item" e exclusão por linha
- Total do orçamento
- Card de Observações (quando houver)
- Histórico/Timeline lateral (`OSTimeline`)
- Submodais aninhados: `OSStatusDialog`, `OSItemFormDialog`, `OSConclusaoModal`

Observação: a descrição original menciona `HistoricoAlteracoes`, `AdicionarItemOSModal` e `SinistroCombobox`. Na implementação real esses elementos correspondem a `OSTimeline`, `OSItemFormDialog` e a vinculação a sinistro não existe nessa tela hoje — nada será inventado.

## Mudanças técnicas

### Novo componente

- `src/components/oficinas/OrdemServicoDetalheModal.tsx`
  - `Dialog` grande (`max-w-6xl`, altura controlada com scroll interno)
  - Recebe `osId` via prop e usa os mesmos hooks (`useOrdemServico`, `useOSItens`, `useOSHistorico`, `useDeleteOSItem`)
  - Conteúdo idêntico ao da página atual, sem o botão "Voltar" (substituído pelo X do dialog)

### Integração na lista

- `src/pages/oficinas/OrdensServico.tsx`
  - Estado local `osSelecionadaId: string | null`
  - Card da OS abre o modal em vez de `navigate(...)`
  - Renderiza `<OrdemServicoDetalheModal osId={osSelecionadaId} open={!!osSelecionadaId} onOpenChange={...} />`

### Outros consumidores

- `src/pages/regulador/ReguladorOficina.tsx` (linha 657): o botão que hoje navega para `/oficinas/ordens/:id` passa a abrir o mesmo modal localmente (estado próprio na página + `OrdemServicoDetalheModal`).

### Deep-link / compatibilidade

- `src/App.tsx`
  - Remover `lazy(() => import("./pages/oficinas/OrdemServicoDetalhe"))` e a `<Route path="/oficinas/ordens/:id" ... />`
  - Adicionar redirecionamento da rota antiga: `<Route path="/oficinas/ordens/:id" element={<Navigate to="/ordens-servico" replace />} />` (preserva links antigos)

### Limpeza

- Deletar `src/pages/oficinas/OrdemServicoDetalhe.tsx`
- `src/components/layout/GlobalBreadcrumb.tsx`: remover a entrada `'/oficinas/ordens/:id'` (não há mais rota com esse padrão)

## Resultado

- Clicar numa OS na lista abre o modal sobreposto, sem trocar de rota
- O regulador também vê o detalhe via modal
- Todos os submodais (status, item, conclusão) continuam empilhando normalmente
- Links antigos `/oficinas/ordens/:id` redirecionam para a lista (`/ordens-servico`)
