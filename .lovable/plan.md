
### Objetivo
Deixar apenas a área interna correta de cotação em `/vendas/cotacoes` e fazer esse fluxo respeitar exclusivamente a regra geral de filtros.

### O que o código mostra hoje
- Há múltiplas entradas internas de cotação em `src/App.tsx`:
  - `/vendas/cotacao` → `src/pages/vendas/Cotacao.tsx` (legado, página inteira)
  - `/vendas/cotacoes` → `src/pages/vendas/Cotacoes.tsx` (produção, lista + modal correto)
  - `/vendas/cotador` → `src/pages/vendas/Cotador.tsx` (terceiro fluxo paralelo)
- O modal correto de produção é `src/components/cotacoes/CotacaoFormDialog.tsx`, aberto dentro de `src/pages/vendas/Cotacoes.tsx`.
- `src/components/vendas/OutrasEntradasMenu.tsx` ainda manda substituição/inclusão para `/vendas/cotacao`, então o fluxo certo cai no fluxo errado.
- O modal correto já usa `usePlanosCotacao`, mas o hook ainda tem lógica extra que conflita com sua regra:
  - `src/hooks/usePlanosCotacao.ts` ainda considera regras em `entity_type='plano'`
  - `src/hooks/useEntityEligibilityRules.ts` libera `tipo_placa` de forma permissiva para veículo normal
  - `src/hooks/usePlanosCotacao.ts` mantém plano vivo mesmo se todas as coberturas forem removidas e sobrar só benefício residual

### Plano de implementação

1. **Consolidar as rotas internas**
   - Remover a rota funcional de `/vendas/cotacao`
   - Transformar `/vendas/cotacao` em redirecionamento para `/vendas/cotacoes`, preservando query params
   - Desativar também `/vendas/cotador` como área paralela, redirecionando para `/vendas/cotacoes`
   - Manter intactas as rotas públicas (`/cotacao/:token`, `/cotacao-visualizar/:token`, `/q/:token`)

2. **Fazer toda navegação interna cair em `/vendas/cotacoes`**
   - Ajustar `src/components/vendas/OutrasEntradasMenu.tsx` para nunca mais navegar para `/vendas/cotacao`
   - Passar a abrir o fluxo certo em `/vendas/cotacoes` usando query/state para:
     - nova cotação
     - substituição
     - inclusão
     - demais entradas que hoje desviam para o legado

3. **Expandir `/vendas/cotacoes` para absorver os contextos do legado**
   - Em `src/pages/vendas/Cotacoes.tsx`, além de `lead` e `novo=true`, ler:
     - `tipo_entrada`
     - `associado_id`
     - `veiculo_antigo_id`
     - `veiculo_antigo_placa`
     - `veiculo_antigo_modelo`
   - Abrir o modal correto com esse contexto já resolvido
   - Limpar a URL após abrir, como já é feito com `lead` e `novo=true`

4. **Adaptar o modal correto para inclusão/substituição**
   - Estender `src/components/cotacoes/CotacaoFormDialog.tsx` com um `entryContext`
   - Pré-carregar dados do associado quando houver `associado_id`
   - Mostrar banner/título correto para substituição e inclusão
   - Carregar dados do veículo antigo quando houver substituição
   - Assim, o usuário fica sempre em `/vendas/cotacoes`, mas com o comportamento que hoje só existe em `/vendas/cotacao`

5. **Fazer o motor respeitar sua regra geral**
   - Em `src/hooks/usePlanosCotacao.ts`:
     - Linha restringe por tipo de veículo, ano e marca/modelo
     - Plano não restringe nada
     - Coberturas/benefícios filtram individualmente
     - Se um plano perder todas as coberturas reais, ele não deve aparecer
   - Em `src/hooks/useEntityEligibilityRules.ts`:
     - corrigir a regra de `tipo_placa` para veículo normal não passar em regras `include` de placas/categorias especiais
   - Ignorar qualquer restrição extra no nível de plano, mesmo que exista em `entity_eligibility_rules`

6. **Preservar os fluxos posteriores sem depender da rota antiga**
   - Hoje o contrato ainda tenta ler `tipo_entrada`/`associado_id` como se estivessem na cotação
   - Como a tabela `cotacoes` não expõe isso de forma tipada, salvar esse contexto em `dados_extras`
   - Atualizar `ContratoWizard` para ler `dados_extras.contexto_entrada` em vez de depender do fluxo legado
   - Isso evita quebrar substituição/inclusão quando `/vendas/cotacao` deixar de existir

7. **Desligar o legado sem quebrar acesso antigo**
   - Primeiro redirecionar `/vendas/cotacao` e `/vendas/cotador`
   - Depois remover referências internas restantes
   - Por fim, os arquivos legados podem ser mantidos só como fallback temporário ou excluídos numa segunda etapa

### Resultado esperado
- Existe apenas uma área interna de cotação: `/vendas/cotacoes`
- O modal correto vira a única entrada real para cotação
- Substituição e inclusão também passam pelo fluxo de `/vendas/cotacoes`
- O motor de planos passa a seguir só esta hierarquia:
  - **Linha**: restringe
  - **Plano**: não restringe
  - **Coberturas/benefícios**: filtram item a item
- Planos errados, fantasmas, Diesel/Deságio indevidos e efeitos de regras extras deixam de aparecer nesse fluxo

### Arquivos principais
- `src/App.tsx`
- `src/pages/vendas/Cotacoes.tsx`
- `src/components/vendas/OutrasEntradasMenu.tsx`
- `src/components/cotacoes/CotacaoFormDialog.tsx`
- `src/hooks/usePlanosCotacao.ts`
- `src/hooks/useEntityEligibilityRules.ts`
- `src/components/contratos/ContratoWizard.tsx`

### Não alterar
- Rotas públicas de cotação por token
- A tela `/vendas/cotacoes` como ponto de entrada visual principal
- O uso do `CotacaoFormDialog` como modal oficial de produção
