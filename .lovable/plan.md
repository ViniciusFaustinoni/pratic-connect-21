

## Plano: Ordenar coberturas e benefícios em ordem alfabética

### Alteração
Mudar a ordenação das queries de `display_order` para `nome`/`name` no arquivo `src/hooks/usePlans.ts`.

### Detalhes técnicos

**`src/hooks/usePlans.ts`**

1. **useCoberturas** (linha 442): Trocar `.order('display_order', ...)` por `.order('nome')` 
2. **useBenefits** (linha 382): Trocar `.order('display_order')` por `.order('name')`

### Resultado
- Todas as coberturas aparecem em ordem A-Z pelo campo `nome`
- Todos os benefícios aparecem em ordem A-Z pelo campo `name`
- Afeta tanto o catálogo global quanto qualquer tela que use esses hooks

