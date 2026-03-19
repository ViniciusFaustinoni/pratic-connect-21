

# Diagnóstico: Link de Reagendamento Não Chega ao Associado

## Causa Raiz Identificada

O log da edge function `enviar-link-reagendamento` mostra:

```text
ERROR: Serviço não encontrado
```

A query falha na linha que busca o serviço por `id`. Isso acontece porque:

1. **A edge function pode estar desatualizada** — o código foi editado no repositório mas precisa ser **redeployado** no Supabase para as mudanças entrarem em vigor.
2. **O `servico_id` passado pode ter sido inválido** — se o status `imprevisto_pendente` não estava no enum quando o imprevisto foi registrado, o update falhava silenciosamente e o fluxo passava um ID de um serviço que não existia ou cujo estado era inconsistente.

A boa notícia: o enum `imprevisto_pendente` **já existe** no banco (confirmado). Mas as edge functions editadas (`enviar-link-reagendamento` e `cron-reagendamento-automatico`) precisam ser redeployadas.

## Plano de Correção

### 1. Redeployar edge functions atualizadas
Deployar `enviar-link-reagendamento` e `cron-reagendamento-automatico` com o código atualizado (guard de idempotência + recuperação de órfãos).

### 2. Adicionar logging detalhado na edge function
Melhorar o log de `enviar-link-reagendamento` para registrar o `servico_id` recebido e detalhes do erro da query, facilitando debug futuro.

### 3. Adicionar fallback com retry no `ImprevistoBotao`
Se a chamada ao `enviar-link-reagendamento` falhar no Ponto A, tentar novamente após 3 segundos. Se falhar de novo, o Ponto B (DuploCheck) e o Ponto C (CRON) servem como backup.

### 4. Testar a edge function após deploy
Invocar a função com um `servico_id` real para validar que o fluxo funciona ponta a ponta.

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/enviar-link-reagendamento/index.ts` | Logging detalhado do servico_id e erro |
| `src/components/vistoriador/ImprevistoBotao.tsx` | Retry com delay no Ponto A |
| Deploy | `enviar-link-reagendamento` + `cron-reagendamento-automatico` |

