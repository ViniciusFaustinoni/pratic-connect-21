

# Bloquear FIPE Menor para veiculos com FIPE <= R$30.000

## Alteracao

No `useMemo` de `fipeMenorInfo` (linha 364 de `CotacaoFormDialog.tsx`), adicionar uma validacao no inicio: se `valorFipe <= 30000`, retornar `null` — o que oculta toda a secao "Solicitar FIPE Menor".

Opcionalmente, em vez de ocultar, podemos mostrar a secao desabilitada com uma mensagem explicativa ("Nao disponivel para veiculos com FIPE igual ou inferior a R$ 30.000,00"). A abordagem mais limpa e simplesmente nao renderizar o bloco, ja que o `null` ja faz isso automaticamente.

O valor limite (R$ 30.000) sera lido da tabela `configuracoes` para manter o padrao dinamico do projeto — chave `fipe_menor_limite_minimo`. Fallback para 30000 caso a config nao exista.

## Arquivos editados

| Arquivo | Alteracao |
|---|---|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | No `useMemo` de `fipeMenorInfo`, retornar `null` quando `valorFipe <= limiteMinimo`. Adicionar query para buscar o limite da tabela `configuracoes`. |

## Detalhe tecnico

```
// No useMemo fipeMenorInfo, logo apos o primeiro if:
if (valorFipe <= fipeMenorLimiteMinimo) return null;
```

A config sera buscada com um hook inline (useQuery) similar ao padrao `useValorPorCota`:
- Chave: `fipe_menor_limite_minimo`
- Fallback: `30000`

