# Causa raiz — "Erro ao aprovar instalação"

Investiguei a stack completa do botão **Aprovar** em Monitoramento → Aprovação de Associados:

1. UI chama `useAprovarInstalacaoMonitoramento` (`src/hooks/useAprovacaoMonitoramento.ts`).
2. Hook faz `UPDATE servicos SET status = 'aprovada' …`.
3. O trigger **`trg_bloquear_servico_se_terminal`** dispara e chama a função **`fn_associado_em_estado_terminal(associado_id)`**.
4. Essa função considera **`'suspenso'` como estado terminal** (junto com `cancelado`, `recusado`, etc.).
5. Como acabamos de implementar o fluxo de **suspensão automática 48h/72h por não-instalação**, vários associados que chegam ao monitoramento agora estão com `status = 'suspenso'`. O trigger lança a exceção:

   > `Não é possível concluir serviço: associado está em status "suspenso"`

6. O hook captura, mas o `onError` mostra apenas `"Erro ao aprovar instalação"` genérico — daí o toast vazio na sua tela.

## Por que `'suspenso'` não é terminal

Suspensão por não-instalação é, **por design**, **reversível pela própria aprovação da instalação** — quando o monitoramento aprova a instalação tardia, a cobertura tem que voltar. Misturar `suspenso` em `fn_associado_em_estado_terminal` quebra esse fluxo (e qualquer outro que precise concluir/aprovar serviços de associados temporariamente suspensos).

Estados verdadeiramente terminais permanecem: `cancelado`, `cancelamento_solicitado`, `recusado`, `inadimplente_terminal`.

## Correções

**1. Migração** — Atualizar `public.fn_associado_em_estado_terminal` removendo `'suspenso'` da lista. Isso desbloqueia o trigger `trg_bloquear_servico_se_terminal` para serviços de associados suspensos, permitindo que a aprovação prossiga e o trigger `fn_reativar_cobertura_pos_instalacao` reative a cobertura naturalmente.

```sql
CREATE OR REPLACE FUNCTION public.fn_associado_em_estado_terminal(_associado_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT status::text FROM public.associados
  WHERE id = _associado_id
    AND status::text IN ('cancelado','cancelamento_solicitado','recusado','inadimplente_terminal')
  LIMIT 1;
$$;
```

**2. Hook** — `src/hooks/useAprovacaoMonitoramento.ts`: trocar o `onError` para exibir `error.message` real em vez do toast genérico, evitando que erros futuros do trigger fiquem invisíveis.

## Não muda

- `ativar-associado` (edge function), pré-validações, lógica de UI, RLS — nada disso é tocado.
- `'suspenso'` continua sendo um status válido em `associados` e bloqueando os fluxos onde já bloqueia hoje (cobrança, sinistro, etc.).
