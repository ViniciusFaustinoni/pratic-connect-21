

# Plano: Melhorar Visualização de Benefícios Restritos na Tela de Cotação

## Resumo

Ao selecionar uma condição especial para o veículo (ex: "Veículo proveniente de leilão"), os benefícios que não estão disponíveis para essa condição devem aparecer com efeito visual de riscado (strikethrough) e X vermelho, reforçando visualmente quais coberturas o cliente não terá direito.

## Situação Atual

O sistema **já possui** a lógica de restrições implementada em alguns componentes:

| Componente | Status |
|------------|--------|
| `EscolhaPlano.tsx` | Mostra riscado |
| `CotacaoFormDialog.tsx` (linhas 1484-1530) | Mostra riscado |
| `PlanoCard.tsx` | Mostra riscado |
| `PlanoCardComparativo.tsx` | Mostra riscado |
| `PlanoDetalhesModal.tsx` | Mostra riscado |
| `PlanoCardSelecao.tsx` | Mostra riscado |

Porém, existem **dois locais** onde a verificação de restrições **não está sendo aplicada**:

1. **`src/pages/vendas/Cotador.tsx`** (linhas 1278-1283) - Detalhes do plano no resultado
2. **`src/components/cotacoes/CotacaoFormDialog.tsx`** (linhas 1675-1695) - Preview de planos na seção de comparação

## Alterações Necessárias

### 1. Arquivo: `src/pages/vendas/Cotador.tsx`

**Adicionar importação:**
```tsx
import { isCoberturaRemovida } from '@/data/restricoesCategorias';
```

**Modificar linhas 1278-1283:**

De:
```tsx
{planoAtual.coberturas.map((cobertura, i) => (
  <div key={i} className="flex items-center gap-2 text-sm">
    <Check className="h-4 w-4 text-green-500 shrink-0" />
    <span>{cobertura}</span>
  </div>
))}
```

Para:
```tsx
{planoAtual.coberturas.map((cobertura, i) => {
  const isRemovida = isCoberturaRemovida(cobertura, categoriaVeiculo);
  return (
    <div key={i} className="flex items-center gap-2 text-sm">
      {isRemovida ? (
        <>
          <X className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-muted-foreground line-through">{cobertura}</span>
          <span className="text-xs text-destructive">(não cobre)</span>
        </>
      ) : (
        <>
          <Check className="h-4 w-4 text-green-500 shrink-0" />
          <span>{cobertura}</span>
        </>
      )}
    </div>
  );
})}
```

### 2. Arquivo: `src/components/cotacoes/CotacaoFormDialog.tsx`

**Modificar linhas 1675-1695** (preview dos planos selecionados para comparação):

De:
```tsx
{plano.coberturas.slice(0, LIMIT).map((cobertura, i) => (
  <li key={i} className="flex items-start gap-2">
    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
    <span>{cobertura}</span>
  </li>
))}
```

Para:
```tsx
{plano.coberturas.slice(0, LIMIT).map((cobertura, i) => {
  const isRemovida = isCoberturaRemovida(cobertura, categoria);
  return (
    <li key={i} className="flex items-start gap-2">
      {isRemovida ? (
        <>
          <X className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <span className="line-through text-muted-foreground/60">{cobertura}</span>
        </>
      ) : (
        <>
          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{cobertura}</span>
        </>
      )}
    </li>
  );
})}
```

Aplicar a mesma lógica para as coberturas expandidas (linhas 1690-1695).

## Resultado Visual

Quando o vendedor selecionar "Veículo proveniente de leilão":

- "Roubo e Furto" - check verde normal
- "Colisão" - check verde normal  
- "Perda Total" - check verde normal
- ~~"Incêndio"~~ (não disponível) - X vermelho com texto riscado

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotador.tsx` | Importar `isCoberturaRemovida` e aplicar na listagem de coberturas |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Aplicar lógica de riscado na seção de preview dos planos |

