
# Corrigir Valores Zerando Apos Salvar

## Causa Raiz

Mesmo com `await queryClient.invalidateQueries(...)`, o React ainda nao re-renderizou o componente com os dados atualizados do servidor quando `setValoresPecas({})` executa. Isso faz o input mostrar `undefined ?? item.valor_unitario` onde `item.valor_unitario` ainda e o valor antigo (pre-save) do render anterior, resultando em valor zero ou vazio.

## Solucao

Remover a limpeza dos estados locais `valoresPecas` e `fornecedoresPecas` apos salvar. Os valores no estado local ja correspondem exatamente ao que foi salvo no banco. Quando o usuario recarregar a pagina ou navegar de volta, o estado local comeca vazio e os valores do banco sao usados normalmente via `item.valor_unitario`.

## Alteracao

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

Remover as linhas 1184-1185:

```typescript
// REMOVER estas duas linhas:
setValoresPecas({});
setFornecedoresPecas({});
```

O bloco final do save ficara:

```typescript
toast.success('Valores e fornecedores salvos!');
await queryClient.invalidateQueries({ queryKey: ['sinistro-analise', id] });
await queryClient.invalidateQueries({ queryKey: ['sinistro-analise-vistoria-evento', id] });
// NÃO limpar estados locais - os valores já correspondem ao que foi salvo
```

Isso garante que:
1. Os valores permanecem visiveis na interface imediatamente apos salvar
2. Ao recarregar a pagina, os valores vem do banco de dados
3. O calculo do custo total continua correto (usa `valoresPecas[i] ?? item.valor_unitario`)

## Resumo

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Remover `setValoresPecas({})` e `setFornecedoresPecas({})` apos salvar |
