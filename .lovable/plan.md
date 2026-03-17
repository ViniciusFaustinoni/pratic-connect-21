

## Plano: Nova aba "Taxas e Adesão" em Regras de Venda

### Dados existentes no banco (tabela `configuracoes`)

Chaves já existentes que serão usadas:
| Campo UI | Chave no banco | Valor atual |
|---|---|---|
| Percentual FIPE | `taxa_fallback_carro` | `0.025` (2.5%) — **mas o sistema usa 1% hardcoded** |
| Mínimo volante | *não existe* | — |
| Mínimo base | *não existe* | — |
| Repasse volante | `taxa_repasse_volante` | `50` |
| Substituição placa | `taxa_substituicao_placa` | `50` |
| Troca titularidade | `taxa_troca_titularidade` | `50` |
| Revistoria | `taxa_revistoria` | `50` |
| Multa rastreador | `multa_rastreador` | `400` |

**Problemas encontrados**: O percentual de adesão (1%) e mínimo (R$100) estão hardcoded em 4 arquivos. Não há chave específica para "percentual adesão sobre FIPE" nem para "mínimo volante" vs "mínimo base".

### Alterações

#### 1. Inserir chaves faltantes na tabela `configuracoes`

```sql
INSERT INTO configuracoes (chave, valor, descricao):
- 'taxa_adesao_percentual_fipe' → '1' (1%)
- 'taxa_adesao_minimo_volante' → '100'
- 'taxa_adesao_minimo_base' → '100'
```

A chave `adesao_minima` (usada em `useCalcularCotacao`) passa a ser substituída por `taxa_adesao_minimo_base` (ou mantida como fallback).

#### 2. Novo hook `useTaxasAdesao` em `useConteudosSistema.ts`

Exporta hooks reutilizáveis:
```typescript
export function useTaxaAdesaoPercentual() {
  return useConfiguracaoNumero('taxa_adesao_percentual_fipe', 1);
}
export function useTaxaAdesaoMinimoVolante() {
  return useConfiguracaoNumero('taxa_adesao_minimo_volante', 100);
}
export function useTaxaAdesaoMinimoBase() {
  return useConfiguracaoNumero('taxa_adesao_minimo_base', 100);
}
export function useTaxaRepasseVolante() {
  return useConfiguracaoNumero('taxa_repasse_volante', 50);
}
export function useTaxaSubstituicaoPlaca() {
  return useConfiguracaoNumero('taxa_substituicao_placa', 50);
}
export function useTaxaTrocaTitularidade() {
  return useConfiguracaoNumero('taxa_troca_titularidade', 50);
}
export function useTaxaRevistoria() {
  return useConfiguracaoNumero('taxa_revistoria', 50);
}
```

#### 3. Nova aba "Taxas e Adesão" em `RegrasVenda.tsx`

- Adicionar 4ª tab com ícone `DollarSign`
- 4 Cards correspondendo aos 4 blocos solicitados
- Leitura via `useComissoesFaixas().parametros` (mesma fonte das outras abas — tabela `comissoes_parametros`)

**Nota**: As taxas estão na tabela `configuracoes`, não em `comissoes_parametros`. A aba usará `supabase.from('configuracoes')` diretamente, com um hook local que busca as 8 chaves de uma vez e salva com `upsert`.

- Bloco 4 inclui aviso não editável com `Alert` + `AlertTriangle`
- Botão "Salvar configurações" com estado de loading e toast de sucesso

#### 4. Remover hardcoded dos 4 arquivos de cotação

| Arquivo | Hardcoded atual | Correção |
|---|---|---|
| `src/hooks/useCalcularCotacao.ts` L90,190 | `minimoAdesao = configMap.adesao_minima \|\| 100` e `valor_fipe * 0.01` | Ler `taxa_adesao_percentual_fipe` e `taxa_adesao_minimo_base` das configs |
| `src/hooks/useCotacao.ts` L262 | `Math.max(100, valorFipe * 0.01)` | Ler percentual e mínimo das configs |
| `src/pages/vendas/Cotador.tsx` L391,657 | `Math.max(100, valorFipe * 0.01)` | Usar hook `useTaxaAdesaoPercentual()` e `useTaxaAdesaoMinimoBase()` |
| `src/components/cotacoes/CotacaoFormDialog.tsx` L289-291,1696 | `MINIMO_ADESAO = 100` e `valorFipe * 0.01` | Usar hooks dinâmicos |

Cada local passará a usar:
```typescript
const adesao = Math.max(valorFipe * (percentualFipe / 100), minimoAdesao);
```

#### 5. Resumo de arquivos

- **Inserção SQL**: 3 novas chaves em `configuracoes`
- **`src/hooks/useConteudosSistema.ts`**: +7 hooks de taxa
- **`src/pages/diretoria/RegrasVenda.tsx`**: +1 aba com 4 blocos
- **`src/hooks/useCalcularCotacao.ts`**: remover hardcoded 0.01 e 100
- **`src/hooks/useCotacao.ts`**: remover hardcoded
- **`src/pages/vendas/Cotador.tsx`**: remover hardcoded
- **`src/components/cotacoes/CotacaoFormDialog.tsx`**: remover hardcoded

