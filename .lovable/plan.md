

# Corrigir Geocodificacao dos Sinistros Existentes

## Situacao

Apenas **1 sinistro** precisa de correcao:

| Sinistro | Local | Associado Cidade/UF |
|---|---|---|
| `d710629f` | Rua Bacairis proximo ao numero 465 | RIO DE JANEIRO, RJ |

## Solucao

Criar uma edge function temporaria `fix-geocode-sinistros` que:

1. Busca todos os sinistros com `local_ocorrencia` preenchido mas `latitude_informada` nula
2. Para cada um, busca a cidade/UF do associado
3. Monta a query: `"Rua Bacairis proximo ao numero 465, RIO DE JANEIRO, RJ, Brasil"`
4. Chama o Nominatim para obter coordenadas
5. Atualiza `latitude_informada` e `longitude_informada` no sinistro

A function sera chamada uma unica vez via curl para corrigir os dados e pode ser removida depois.

## Detalhe Tecnico

**Arquivo:** `supabase/functions/fix-geocode-sinistros/index.ts`

```text
1. SELECT sinistros com local_ocorrencia NOT NULL e latitude_informada IS NULL
2. JOIN associados para obter cidade/uf
3. Para cada sinistro:
   - Montar query: local_ocorrencia + cidade + uf + Brasil
   - Chamar Nominatim
   - UPDATE sinistros SET latitude_informada, longitude_informada
4. Retornar resumo dos resultados
```

## Resumo

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/fix-geocode-sinistros/index.ts` | Nova edge function temporaria para corrigir coordenadas |

Apos execucao bem-sucedida, a function pode ser deletada.
