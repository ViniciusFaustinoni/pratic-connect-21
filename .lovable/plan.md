

# Correção: Preços incorretos no link público e no formulário de cotação

## Causa Raiz

Três problemas independentes estão causando preços errados:

### 1. CRÍTICO: Mapeamento de região desconectado (CotacaoFormDialog)

O formulário de cotação do vendedor (`CotacaoFormDialog.tsx`, linha 272) **ignora a região selecionada** e sempre passa `regiao: 'rj'` para o hook de precificação:

```typescript
// BUG: hardcoded
const { planos } = usePlanosCotacao({
  regiao: 'rj', // ← Deveria ser regiaoSelecionada
  ...
});
```

Além disso, os valores do seletor de região no formulário usam nomes completos (`rio_de_janeiro`, `regiao_lagos`, `sao_paulo`) que **não correspondem** aos slugs da tabela de preços (`rj`, `lagos`, `sp`). Mesmo corrigindo o hardcode, a consulta falharia sem um mapeamento.

### 2. Link público `/q/:token` usa cliente autenticado

O hook `useCalcularCotacao.ts` importa `supabase` (cliente autenticado) em vez de `publicSupabase`. A tabela `configuracoes` bloqueia leitura anon para chaves como `taxa_fallback_carro` e `adicional_app`. Isso pode causar falhas silenciosas no cálculo.

Adicionalmente, o `CotacaoPublicaCompleta` não passa `regiao` nem `combustivel` ao chamar `calcular()`.

### 3. Valores de região inconsistentes entre formulário e banco

```text
Formulário          →  Tabela de preços
─────────────────────────────────────────
rio_de_janeiro      →  rj
regiao_lagos        →  lagos
sao_paulo           →  sp
interior_rj         →  (sem preço separado)
interior_sp         →  (sem preço separado)
```

## Plano de Correção

### Fase 1: Criar mapeamento de região (formulário → pricing)

Adicionar uma função de mapeamento `mapearRegiaoParaPricing()` que converte os nomes do formulário nos slugs da tabela de preços:

```typescript
function mapearRegiaoParaPricing(regiao: string): string {
  const MAPA: Record<string, string> = {
    'rio_de_janeiro': 'rj',
    'regiao_lagos': 'lagos',
    'sao_paulo': 'sp',
    'interior_rj': 'rj',
    'interior_sp': 'sp',
  };
  return MAPA[regiao] || regiao;
}
```

### Fase 2: Corrigir CotacaoFormDialog (formulário do vendedor)

- Linha 272: substituir `regiao: 'rj'` por `regiao: mapearRegiaoParaPricing(regiaoSelecionada || 'rj')`
- Isso faz o formulário calcular preços com a região real selecionada pelo vendedor

### Fase 3: Corrigir useCalcularCotacao (link público `/q/:token`)

- Trocar `import { supabase }` por `import { publicSupabase }` para garantir que as queries funcionem sem sessão
- As tabelas `planos`, `plano_preco_map` e `tabelas_preco_mensalidade` já permitem leitura anon
- Adicionar leitura das chaves de config necessárias à policy pública de `configuracoes`

### Fase 4: Corrigir CotacaoPublicaCompleta

- Passar `regiao` e `combustivel` da cotação para `calcular()` (atualmente omitidos)
- Aplicar o mesmo mapeamento de região

### Fase 5: Migração RLS

- Adicionar `taxa_fallback_carro` e `adicional_app` à lista de chaves permitidas na policy `config_base_public_read` de `configuracoes`

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Usar `regiaoSelecionada` com mapeamento |
| `src/hooks/useCalcularCotacao.ts` | Trocar `supabase` por `publicSupabase` |
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Passar `regiao` e `combustivel` |
| `supabase/migrations/` | RLS: adicionar chaves à policy pública |

