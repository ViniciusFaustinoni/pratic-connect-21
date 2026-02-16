

# Corrigir Persistencia de Valores de Pecas e Incluir no Custo Total

## Problemas Identificados

### 1. Valores de pecas nao persistem na interface
Ao salvar valores e fornecedores, o sistema atualiza o `dados_vistoria` no banco corretamente (o toast "Valores e fornecedores salvos!" aparece). Porem, apos o save, os estados locais `valoresPecas` e `fornecedoresPecas` sao limpos, e a query e invalidada para refetch. O problema e que o input de valor usa `valoresPecas[i] ?? item.valor_unitario ?? ''` -- se o refetch ainda nao completou quando o estado local e limpo, o campo mostra vazio momentaneamente. Alem disso, o campo do fornecedor usa `fornecedoresPecas[i]?.id || item.fornecedor_id || ''` e, se o `item.fornecedor_id` nao estiver no array original recarregado, ele volta a "Selecionar...".

**Causa raiz**: Ao salvar, os estados locais sao limpos (linhas 1171-1172) antes do refetch completar. O `queryClient.invalidateQueries` e assincrono - os dados novos ainda nao chegaram quando o estado local ja foi resetado.

**Correcao**: Aguardar o refetch completar antes de limpar os estados locais, usando `await queryClient.invalidateQueries(...)` em sequencia, e o React ira usar os dados atualizados do servidor.

### 2. Custo total nao inclui pecas
O calculo do total (linhas 1091-1104) soma apenas itens do tipo `mao_de_obra` e `servico`. Pecas sao completamente ignoradas no calculo. O label diz "Custo medio estimado (mao de obra + servicos)" sem mencionar pecas.

**Correcao**: Adicionar o calculo de pecas ao total, considerando tanto valores manuais (`valoresPecas`) quanto valores vindos de cotacao aprovada (IA), e atualizar o label.

## Alteracoes

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

#### A. Garantir persistencia apos salvar (linhas 1170-1174)

Trocar a sequencia de limpeza para aguardar o refetch:

```typescript
toast.success('Valores e fornecedores salvos!');
// Primeiro invalidar e esperar refetch, DEPOIS limpar estados locais
await queryClient.invalidateQueries({ queryKey: ['sinistro-analise', id] });
await queryClient.invalidateQueries({ queryKey: ['sinistro-analise-vistoria-evento', id] });
setValoresPecas({});
setFornecedoresPecas({});
```

#### B. Incluir pecas no custo total (linhas 1091-1107)

Adicionar calculo do total de pecas, usando a mesma logica de prioridade IA que ja existe na tabela:

```typescript
const totalPecas = itens
  .filter((it: any) => it.tipo === 'peca')
  .reduce((s: number, it: any, i: number) => {
    // Prioridade: cotacao aprovada > valor manual > valor salvo
    const iaItem = temCotacaoAprovada
      ? (cotacaoAprovada?.resposta as any)?.itens?.[i]
      : null;
    const valor = iaItem?.valor_unitario ?? valoresPecas[i] ?? it.valor_unitario;
    if (valor == null) return s;
    return s + valor * (it.quantidade || 1);
  }, 0);
const totalMaoObra = itens
  .filter((it: any) => it.tipo === 'mao_de_obra' && it.valor_unitario != null)
  .reduce((s: number, it: any) => s + (it.valor_unitario * (it.quantidade || 1)), 0);
const totalServicos = itens
  .filter((it: any) => it.tipo === 'servico' && it.valor_unitario != null)
  .reduce((s: number, it: any) => s + (it.valor_unitario * (it.quantidade || 1)), 0);
const totalGeral = totalPecas + totalMaoObra + totalServicos;
```

E atualizar a exibicao para mostrar as tres categorias:

```
Pecas: R$ X.XXX,XX
Mao de obra: R$ X.XXX,XX
Servicos: R$ X.XXX,XX
Custo total (pecas + mao de obra + servicos): R$ X.XXX,XX
```

## Resumo

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Aguardar refetch antes de limpar estados locais + incluir pecas no calculo e exibicao do custo total |

