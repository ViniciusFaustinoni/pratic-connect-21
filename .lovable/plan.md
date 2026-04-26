# Remover fluxo legado de Substituição de Veículo

## Por quê

Hoje convivem dois fluxos paralelos para substituir veículo de associado:

1. **Fluxo via cotação (oficial)** — Cotador padrão com `tipo_entrada='substituicao'`, acionado pelo `OutrasEntradasMenu` e validado pela memória `features/sales/vehicle-substitution-flow`.
2. **Fluxo legado (stepper de 8 passos)** — `/cadastro/associados/:id/substituicao`, `/vendas/substituicao/:id`, `/cadastro/substituicoes`, `/cadastro/substituicoes/:id` e `/substituicao/:token`, gravando em `substituicoes_veiculo`.

Manter os dois cria divergência de regras (carência, agendamento dois locais, dupla aprovação). A decisão é manter apenas o fluxo via cotação.

## Dados existentes

Consultei a tabela `substituicoes_veiculo`: **0 registros**. Não há nada para migrar — o passo de "migrar para cotacoes antes de apagar" se torna trivial (nenhum INSERT necessário). Vou apenas dropar a tabela e suas dependências.

## Arquivos / rotas a remover

### Páginas
- `src/pages/cadastro/SubstituicaoVeiculoPage.tsx` (stepper completo)
- `src/pages/cadastro/SubstituicoesPendentesPage.tsx` (lista pendentes)
- `src/pages/cadastro/SubstituicaoDetalhePage.tsx` (detalhe)
- `src/pages/public/SubstituicaoPublica.tsx` (jornada pública por token)

### Componentes do stepper (`src/components/substituicao/`)
- `SubstituicaoStepper.tsx`
- `StepElegibilidade.tsx`
- `StepEventoAtivo.tsx`
- `StepRastreador.tsx`
- `StepNovoVeiculo.tsx`
- `StepVistoria.tsx`
- `StepBeneficios.tsx`
- `StepFinanceiro.tsx`
- `StepConclusao.tsx`
- `SubstituicaoStatusCard.tsx` (usado em `AssociadoDetalhe`)
- Demais arquivos da pasta que só sirvam ao stepper (vou auditar diretório inteiro)

### Hooks / tipos / módulos
- `src/hooks/useSubstituicaoVeiculo.ts` (todos os hooks: `useSubstituicoes`, `useSubstituicao`, `useIniciarSubstituicao`, `useAprovarSubstituicao`, `useRejeitarSubstituicao` etc.)
- `src/types/substituicao.ts`
- Edge Functions / utilitários que existam apenas para `substituicoes_veiculo` (auditar `supabase/functions/`)

### Rotas (`src/App.tsx`)
- Remover `/substituicao/:token`, `/vendas/substituicao/:associadoId`, `/cadastro/associados/:associadoId/substituicao`, `/cadastro/substituicoes`, `/cadastro/substituicoes/:id`
- Adicionar redirects de compatibilidade que mandam para o cotador com `tipo_entrada=substituicao`:
  - `/vendas/substituicao/:associadoId` → `/vendas/cotacoes?associado_id=:id&tipo_entrada=substituicao`
  - `/cadastro/associados/:associadoId/substituicao` → idem
  - `/cadastro/substituicoes` e `/cadastro/substituicoes/:id` → `/cadastro/processos-operacionais` (aba relevante)
  - `/substituicao/:token` → página simples explicando que o link expirou

### Pontos de chamada a ajustar
- `src/components/associados/detalhe/AssociadoHeroHeader.tsx` (linha 217): trocar o `navigate(\`/cadastro/associados/${id}/substituicao\`)` por abertura do mesmo `OutrasEntradasMenu` (ou navigate direto para `/vendas/cotacoes?associado_id=${id}&tipo_entrada=substituicao`).
- `src/pages/vendas/Cotacao.tsx` (linha 393, callback `onSubstituicao`): remover o navigate para `/vendas/substituicao/:id`. O fluxo de substituição já é tratado pelo próprio Cotador via `tipo_entrada`, então a etapa que oferece "transformar em substituição" deve simplesmente seguir o fluxo unificado (vou confirmar o uso da função antes de remover).
- `src/pages/cadastro/AssociadoDetalhe.tsx` (linha 404): remover o `<SubstituicaoStatusCard />` (componente será deletado).
- `src/pages/cadastro/ProcessosOperacionais.tsx`: remover a aba "Substituições" inteira (`useSubstituicoes`, `STATUS_SUBSTITUICAO_LABELS`, contadores, conteúdo da TabsContent), reorganizando as TabsList restantes.
- `src/components/layout/GlobalBreadcrumb.tsx`: remover `'/cadastro/substituicoes'`.
- `src/hooks/useModuleItemVisibility.ts`: remover `'/cadastro/substituicoes': 'substituicoes'`.
- `src/hooks/useModuleVisibility.ts`: remover `'/vendas/substituicao'` da lista do módulo `vendas`.

### Banco de dados (migration)

```sql
-- Drop FKs/constraints e a tabela; está vazia (0 registros).
DROP TABLE IF EXISTS public.substituicoes_veiculo CASCADE;

-- Caso existam tipos/enums dedicados (status_substituicao etc.), DROP TYPE IF EXISTS ... CASCADE.
-- Vou auditar antes da migration final.
```

CASCADE garante que policies, triggers, índices e referências caiam junto. Antes de rodar vou listar dependências para o usuário aprovar.

## O que NÃO muda

- Cotador continua aceitando `tipo_entrada=substituicao` (feature `vehicle-substitution-flow` permanece válida).
- `OutrasEntradasMenu` permanece como porta de entrada.
- A memória `features/sales/vehicle-substitution-flow` permanece atual.

## Resultado

- Um único fluxo de substituição: Cotador.
- Aproximadamente 15+ arquivos deletados, 5 rotas removidas, 1 tabela dropada.
- Links antigos redirecionam para o novo fluxo (sem quebrar bookmarks).

## Etapas técnicas

1. Auditoria final do diretório `src/components/substituicao/` e `supabase/functions/` para listar tudo que será removido.
2. Rodar migration de DROP (com aprovação do usuário).
3. Apagar arquivos órfãos.
4. Atualizar consumidores (App.tsx, AssociadoHeroHeader, AssociadoDetalhe, ProcessosOperacionais, Cotacao.tsx, breadcrumbs, módulos).
5. Adicionar redirects.
6. Verificar build (`tsc`).
