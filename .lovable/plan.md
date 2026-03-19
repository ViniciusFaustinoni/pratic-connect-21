

# Correção: Proposta de Filiação — Migração no PDF e Bloqueio de Pendente

## Resumo

Dois problemas: (1) a proposta de filiação (tanto o PDF do Cotador quanto o documento Autentique) não exibe dados de migração quando a entrada é direta (sem cotação); (2) não há bloqueio real que impeça gerar a proposta enquanto a migração está pendente de aprovação.

## Contexto técnico

- O **PDF do Cotador** (`useGerarProposta.ts`) já tem lógica para renderizar seção "MIGRAÇÃO" (linhas 324-341), mas o `dadosProposta` montado em `Cotador.tsx` nunca popula o campo `migracao`
- O **BotaoGerarProposta** já bloqueia quando `dados.migracao && !dados.migracao.aprovada`, mas isso depende de dados estáticos passados pelo pai — não consulta o banco
- O **Autentique** (`autentique-create/index.ts` linha 274) busca migração apenas por `cotacao_id`, ignorando migrações diretas
- O **Autentique by token** (`autentique-create-by-token/index.ts`) tem o mesmo padrão

## Alterações

### 1. `supabase/functions/autentique-create/index.ts` — Fallback por CPF

Na busca de migração (linhas 273-289), adicionar fallback: quando `tipo_entrada === 'migracao'` mas não há `cotacao_id` (migração direta), buscar em `solicitacoes_migracao` pelo CPF do associado vinculado ao contrato, com `status = 'aprovada'`.

### 2. `supabase/functions/autentique-create-by-token/index.ts` — Mesmo fallback

Aplicar a mesma lógica de fallback por CPF do associado.

### 3. `src/pages/vendas/Cotador.tsx` — Popular `migracao` no `dadosProposta`

No `useMemo` que monta `dadosProposta` (linhas 425-459), quando houver uma cotação salva com `tipo_entrada === 'migracao'`, buscar a solicitação de migração aprovada vinculada (por `cotacao_id`) e popular o campo `migracao` do `DadosProposta`. Isso requer uma query reativa (`useQuery`) que busca a solicitação quando a cotação tem tipo migração.

### 4. `src/components/vendas/BotaoGerarProposta.tsx` — Bloqueio dinâmico por consulta ao banco

Adicionar uma prop opcional `cotacaoId?: string`. Quando fornecida e o tipo de entrada for migração:
- Buscar em `solicitacoes_migracao` por `cotacao_id` com status diferente de `aprovada`
- Se encontrar pendente → bloquear botão com tooltip "Aguardando aprovação da migração"
- Se não encontrar ou status aprovada → liberar normalmente

Manter a lógica estática existente (`dados.migracao && !dados.migracao.aprovada`) como fallback.

### 5. `src/types/proposta.ts` — Ajustar tipo `migracao`

O tipo atual já tem `aprovada`, `associacaoOrigem`, `carenciaIsenta`, `dataAprovacao`. Verificar se está completo para os dados que o PDF precisa renderizar. Sem mudança se já estiver ok.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/autentique-create/index.ts` | Fallback busca migração por CPF do associado |
| `supabase/functions/autentique-create-by-token/index.ts` | Mesmo fallback |
| `src/pages/vendas/Cotador.tsx` | Popular campo `migracao` no `dadosProposta` |
| `src/components/vendas/BotaoGerarProposta.tsx` | Bloqueio dinâmico via query ao banco |

