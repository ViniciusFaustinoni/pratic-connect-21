

# Causa Raiz: Atribuicao automatica quebrada por coluna inexistente

## Problema

A edge function `cron-atribuir-tarefas` falha em **todas as execucoes** com o erro:

```
column associados_1.telefone1 does not exist
```

A tabela `associados` tem a coluna `telefone` (e `whatsapp`), mas o codigo referencia `telefone1` em 7 pontos da funcao. Isso faz a query de busca de servicos retornar erro, e o `continue` no loop pula o profissional sem atribuir nada.

Os 5 profissionais online sao encontrados, mas nenhum servico e retornado porque a query quebra antes.

## Solucao

Alterar `supabase/functions/cron-atribuir-tarefas/index.ts`: substituir todas as ocorrencias de `telefone1` por `telefone`.

| Linha | De | Para |
|-------|----|------|
| 316 | `associado:associados!...fkey(nome, telefone1, whatsapp)` | `associado:associados!...fkey(nome, telefone, whatsapp)` |
| 353 | idem | idem |
| 561 | `assocEncaixe?.telefone1` | `assocEncaixe?.telefone` |
| 736 | `associados!...fkey(nome, telefone1, whatsapp)` | `associados!...fkey(nome, telefone, whatsapp)` |
| 792 | `assocData?.telefone1` | `assocData?.telefone` |
| 877 | `associados!...fkey(nome, telefone1, whatsapp)` | `associados!...fkey(nome, telefone, whatsapp)` |
| 891 | `assocVist?.telefone1` | `assocVist?.telefone` |

Sao 7 substituicoes no mesmo arquivo, seguida de redeploy da edge function.

