
# Plano: Corrigir Erro PGRST201 - Ambiguidade de Relacionamento

## Problema Raiz

A migration que adicionou `pendencia_rastreador_servico_id UUID REFERENCES servicos(id)` na tabela `associados` criou um **segundo FK** entre `servicos` e `associados`. Agora existem dois caminhos:

1. `servicos.associado_id` -> `associados.id` (o original)
2. `associados.pendencia_rastreador_servico_id` -> `servicos.id` (o novo)

O PostgREST retorna erro **PGRST201** porque nao sabe qual relacionamento usar quando a query faz `associado:associados(...)`.

Isso afeta **TODAS** as queries que usam `useServicos` -- nao apenas a RetiradasPage.

## Solucao

Modificar **1 arquivo**: `src/hooks/useServicos.ts`

Na query principal do `useServicos()` (linha ~272), alterar o join de `associados` para especificar explicitamente o FK:

**De:**
```
associado:associados(id, nome, telefone, whatsapp, cpf, email)
```

**Para:**
```
associado:associados!servicos_associado_id_fkey(id, nome, telefone, whatsapp, cpf, email)
```

Tambem verificar e corrigir o mesmo problema em outras queries do mesmo arquivo que fazem join com `associados` (ex: `useServico`, `useTarefaDoDia`, etc.).

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useServicos.ts` | Adicionar `!servicos_associado_id_fkey` em todos os joins `associado:associados(...)` |
| `src/hooks/useRetiradaRastreador.ts` | Mesmo fix na query `useRetiradas` (linha ~293) |

## Impacto

- Corrige a RetiradasPage que mostra 0 resultados
- Corrige qualquer outra pagina que use `useServicos` e esteja silenciosamente falhando
- Nao requer migration SQL
- Nao requer mudancas de schema
