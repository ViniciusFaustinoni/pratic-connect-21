## Diagnóstico

Hoje, ao clicar em uma cotação, `Cotacoes.tsx` (linha 364) chama `navigate('/vendas/cotacoes/:id')`, abrindo a **página** `CotacaoDetalhe.tsx` (602 linhas, registrada em `App.tsx`). Outros pontos também navegam para essa página: `CotacaoCard.tsx`, `VendedorHistorico.tsx`, `TrocaTitularidadeDialog.tsx`. Não existe mais nenhum modal/drawer de detalhe — o estado `cotacaoSelecionada` em `Cotacoes.tsx` está declarado mas nunca usado.

Provavelmente em algum refactor anterior o drawer foi substituído pela página dedicada.

## Objetivo

Voltar ao padrão de **modal/drawer** para detalhes de cotação, eliminando navegação para página separada.

## Mudanças

1. **Criar `src/components/cotacoes/CotacaoDetalheDrawer.tsx`** (Sheet do shadcn, side="right", largura ampla `w-full sm:max-w-5xl`).
   - Recebe `{ cotacaoId, open, onOpenChange }`.
   - Reaproveita o conteúdo de `CotacaoDetalhe.tsx`: `CotacaoHeader`, card "Plano Selecionado / Comparação", painel de Ações (Baixar PDF, Enviar WhatsApp, Enviar Email, Duplicar, Editar, Acessar Link Público), `OutrosProcessosPanel`, etc.
   - Usa o mesmo `useCotacao(cotacaoId)` para carregar dados.
   - Mantém todas as ações já existentes (mesmas mutations/hooks) — só muda o invólucro de página → drawer.

2. **`src/pages/vendas/Cotacoes.tsx`**
   - Trocar `handleRowClick` para apenas `setCotacaoSelecionada(cotacao)` e abrir o drawer (sem `navigate`).
   - Renderizar `<CotacaoDetalheDrawer cotacaoId={cotacaoSelecionada?.id} open={!!cotacaoSelecionada} onOpenChange={…} />` no fim do JSX.

3. **`src/components/cotacoes/CotacaoCard.tsx`**
   - Substituir os dois `navigate('/vendas/cotacoes/:id')` (linhas 149 e 348) por um callback `onOpenDetalhe?(cotacao)` exposto via props, deixando a página pai (Cotacoes / VendedorHistorico) decidir abrir o drawer.

4. **`src/pages/vendas/VendedorHistorico.tsx`**
   - Mesma troca: usar drawer em vez de `navigate`.

5. **`src/components/associados/TrocaTitularidadeDialog.tsx`**
   - Após sucesso, em vez de navegar para `/vendas/cotacoes/:id`, redirecionar para a listagem com query `?abrir=:id` e fazer `Cotacoes.tsx` ler o param para abrir o drawer automaticamente. (Mantém UX equivalente sem página de detalhe.)

6. **Rota `/vendas/cotacoes/:id` em `App.tsx`**
   - Substituir por `<Navigate to="/vendas/cotacoes?abrir=:id" replace />` (preserva links antigos / breadcrumb / abas externas que já estejam circulando).
   - Remover/arquivar `src/pages/vendas/CotacaoDetalhe.tsx` após confirmar que todo o conteúdo foi migrado para o drawer.

7. **`src/components/layout/GlobalBreadcrumb.tsx`** (linha 186)
   - Remover entrada `/vendas/cotacoes/:id` (não há mais página).

## Validação

- Clicar em uma cotação na lista → drawer abre à direita com header, plano selecionado e ações.
- Fechar drawer → URL permanece em `/vendas/cotacoes` sem reload.
- Acessar `/vendas/cotacoes/<id>` direto → redireciona para a lista e abre o drawer pelo `?abrir=<id>`.
- Botões "Baixar PDF / WhatsApp / Email / Duplicar / Editar / Link Público" funcionam dentro do drawer.
- Troca de Titularidade ao concluir abre o drawer da cotação resultante.

## Fora de escopo

- Não mexer em layout/conteúdo do detalhe além do invólucro (drawer em vez de página).
- Não alterar estilos do header/cards (já estão como nas screenshots enviadas).
