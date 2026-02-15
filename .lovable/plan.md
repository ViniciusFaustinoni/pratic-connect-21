
# Corrigir tela "Link Invalido" apos conclusao das 3 etapas

## Problema

Quando o associado completa a etapa 3, a edge function `salvar-etapa-evento` muda o status do link para `"completado"` (linha 132). Em seguida, o frontend chama `validar()` para atualizar os dados, mas a edge function `validar-link-evento` rejeita qualquer link com status diferente de `"ativo"` (linha 57), retornando `valid: false`. Isso faz o frontend exibir "Link Invalido" em vez da tela de sucesso.

## Solucao

### Arquivo: `supabase/functions/validar-link-evento/index.ts`

Alterar a verificacao de status (linha 57) para aceitar tambem o status `"completado"` como valido. Links completados devem retornar `valid: true` para que o frontend exiba a tela de sucesso/agendamento.

Logica atual:
```
if (link.status !== "ativo") {
  return { valid: false, reason: link.status }
}
```

Logica corrigida:
```
if (link.status !== "ativo" && link.status !== "completado") {
  return { valid: false, reason: link.status }
}
```

Isso permite que o frontend receba os dados do link completado e mostre corretamente a tela de sucesso (EventoSucesso) ou agendamento (EventoAgendamento), pois o componente EventoColisao ja verifica `etapaAtual >= 3` para decidir o que exibir.

## Detalhes tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/validar-link-evento/index.ts` | Linha 57: aceitar status "completado" como valido alem de "ativo" |

Apenas uma linha precisa ser alterada. Nenhuma mudanca no frontend e necessaria pois a logica de exibicao ja esta correta (verifica `etapaAtual >= 3` para mostrar sucesso).
