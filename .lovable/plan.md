

# Corrigir erro "Sinistro nao encontrado" ao analisar sinistro

## Problema

A query do hook `useSinistroAnalise` solicita as colunas `tipo_veiculo` e `combustivel` da tabela `veiculos`, mas essas colunas nao existem no banco. Isso causa um erro 400 do Supabase, retornando `null` para o sinistro, e a tela exibe "Sinistro nao encontrado".

## Causa raiz

No arquivo `src/hooks/useSinistroAnalise.ts`, linha 49-50, o select inclui:
```
tipo_veiculo, combustivel
```

Essas colunas nao existem na tabela `veiculos`.

## Solucao

Remover `tipo_veiculo` e `combustivel` do select da query principal em `src/hooks/useSinistroAnalise.ts`.

## Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useSinistroAnalise.ts` | Remover `tipo_veiculo` e `combustivel` do select do veiculo (linhas 49-50) |

## Resultado esperado

A pagina de analise do sinistro carregara corretamente, exibindo todos os dados do sinistro, associado e veiculo.

