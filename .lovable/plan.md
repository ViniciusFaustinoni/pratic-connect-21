

# Plano: FIPE Menor — Toggle de Ativação/Desativação pelo Diretor

## Resumo

Criar uma chave `fipe_menor_ativo` na tabela `configuracoes` e usá-la para controlar a visibilidade do bloco "Solicitar FIPE Menor" no formulário de cotação, o menu "Aprovações FIPE" no sidebar, e a rota da página de aprovações.

## Onde a regra FIPE Menor aparece hoje

1. **`CotacaoFormDialog.tsx`** — Bloco 3.7: seção "Solicitar FIPE Menor" com switch, elegibilidade e justificativa
2. **`AppSidebar.tsx`** — Menu item "Aprovações FIPE" em Vendas
3. **`AprovacoesFipeMenor.tsx`** — Página completa de aprovações
4. **`Configuracoes.tsx` (Diretoria)** — Onde o toggle será adicionado

## Implementação

### 1. Migration: inserir chave na tabela `configuracoes`

```sql
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('fipe_menor_ativo', 'true', 'booleano', 'operacional', 
        'Ativa ou desativa a regra de FIPE Menor 1% em todo o sistema', true);
```

Isso já aparecerá automaticamente na página de Configurações da Diretoria (aba Operacional) com o switch nativo do `renderInput`.

### 2. Destaque visual na página de Configurações

Na `Configuracoes.tsx`, adicionar um card destacado no topo (antes das tabs) especificamente para a chave `fipe_menor_ativo` — com ícone, descrição clara e switch grande. Isso atende o requisito de "campo destacado".

### 3. Hook `useFipeMenorAtivo()`

Criar um hook simples que consulta `configuracoes` pela chave `fipe_menor_ativo` e retorna `boolean`. Usar `staleTime` longo para evitar queries repetidas.

### 4. Ocultar no `CotacaoFormDialog.tsx`

Consumir `useFipeMenorAtivo()`. Se `false`, não renderizar o bloco 3.7 inteiro (linhas 1794-1880). Também resetar `solicitarFipeMenor` para `false` se a config estiver desativada.

### 5. Ocultar no `AppSidebar.tsx`

Consumir `useFipeMenorAtivo()`. Se `false`, filtrar o item "Aprovações FIPE" da lista de menu de Vendas.

### 6. Guardar na página `AprovacoesFipeMenor.tsx`

Se desativado, exibir um banner informando que a regra está desativada pelo Diretor, mantendo o histórico visível (aprovações passadas não devem sumir).

### Arquivos modificados

- `supabase/migrations/` — nova migration com INSERT
- `src/hooks/useFipeMenorAtivo.ts` — novo hook
- `src/pages/diretoria/Configuracoes.tsx` — card destacado no topo
- `src/components/cotacoes/CotacaoFormDialog.tsx` — condicional no bloco 3.7
- `src/components/layout/AppSidebar.tsx` — filtrar menu item
- `src/pages/vendas/AprovacoesFipeMenor.tsx` — banner de desativado

