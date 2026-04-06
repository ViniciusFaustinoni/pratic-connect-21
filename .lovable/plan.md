
# Plano: Corrigir erro "atribuido_em column not found" na atribuição manual

## Problema
O hook `useAtribuirServicoManual` (linha ~133 de `useAtribuicaoManual.ts`) tenta fazer `update({ atribuido_em: new Date().toISOString() })` na tabela `servicos`, mas essa coluna não existe, gerando 400.

## Solução

### 1. Remover `atribuido_em` do update em `useAtribuicaoManual.ts`
- Na mutation, remover o campo `atribuido_em` do objeto de update do serviço.
- Manter apenas `profissional_id` e `status: 'agendada'`.

### 2. (Opcional) Criar a coluna se desejado
- Alternativa: criar migration adicionando `atribuido_em TIMESTAMPTZ` à tabela `servicos`. Porém, como o log de atribuições já registra o timestamp em `servicos_atribuicoes_log`, a coluna é redundante.

**Abordagem recomendada**: remover do update (opção 1), pois o timestamp já fica registrado no log.

## Arquivo modificado
- `src/hooks/useAtribuicaoManual.ts` -- remover `atribuido_em` do update
