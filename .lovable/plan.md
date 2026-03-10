

# Plano: Paginação nas Faixas de Preço e Tabela de Preços

## Problema

Duas áreas limitam a visualização de dados:

1. **Tab "Produtos & Planos" → sub-tab "Faixas de Preço"**: Hardcoded `.slice(0, 30)` — mostra apenas 30 de 210+ faixas, sem paginação
2. **Tab "Tabela de Preços"**: Carrega tudo mas pode ficar lento com 1000+ registros — precisa de paginação também

## Solução

Adicionar paginação simples (anterior/próximo + indicador de página) em ambos os locais.

### 1. `ProdutosPlanos.tsx` — sub-tab Faixas de Preço (linha 244-279)

- Adicionar state `precosPage` (reset ao trocar de plano)
- Substituir `.slice(0, 30)` por `.slice(page * 30, (page + 1) * 30)`
- Adicionar filtros de região e tipo_uso dentro da sub-tab para reduzir volume
- Rodapé com: "Página 1 de 7 (210 faixas)" + botões Anterior/Próximo

### 2. `TabelaPrecosTab.tsx` — tabela principal

- Adicionar state `page` (reset ao trocar filtros)
- Paginar `itens` dentro de cada grupo de `linha_slug` (30 por página por grupo)
- Rodapé por grupo com navegação

### Componente reutilizável

Criar um componente `Pagination` simples:

```text
[← Anterior]  Página 2 de 7 · 210 faixas  [Próximo →]
```

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/gestao-comercial/ProdutosPlanos.tsx` | Paginação + filtros na sub-tab preços |
| `src/components/gestao-comercial/TabelaPrecosTab.tsx` | Paginação por grupo |

Nenhum arquivo novo necessário — componente de paginação inline.

