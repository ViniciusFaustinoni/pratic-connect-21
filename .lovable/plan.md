
Diagnóstico

- O erro vem de um desencontro entre o mapa e a mutation de atribuição.
- `view_vistorias_mapa` hoje mistura 3 origens: `vistorias`, `instalacoes` e `servicos` (`supabase/migrations/20260409115536_9e44b776-7592-402e-a917-1f48f6cc183a.sql`).
- Em `src/components/mapa/MapaVistoriasContent.tsx`, o drag-and-drop e o botão “Atribuir” tratam qualquer item sem técnico como atribuível.
- Porém `src/hooks/useAtribuicaoManual.ts` atualiza apenas `public.servicos`.
- Resultado: ao soltar perto de um item que veio de `vistorias` ou `instalacoes`, o `UPDATE servicos` não encontra linha; depois o insert em `servicos_atribuicoes_log` tenta gravar um `servico_id` que não existe em `servicos`, gerando o `409`; em seguida o `.single()` em `servicos` retorna `406` porque não há linha para aquele id.
- Há um segundo problema no log: `atribuido_por` recebe `auth.users.id`, mas a FK aponta para `profiles.id`. Isso também pode gerar `409`.
- E mesmo quando a atribuição dá certo, a rota pode não aparecer na hora porque `useAtribuirServicoManual` não invalida `['vistorias-mapa']` nem `['vistoriadores-localizacao-realtime']`.

Plano de correção

1. Tornar a origem do marcador explícita
- Atualizar a view `view_vistorias_mapa` para incluir um campo claro, por exemplo `origem_registro`, com valores:
  - `vistorias`
  - `instalacoes`
  - `servicos`

2. Ajustar o tipo consumido no frontend
- Atualizar `src/hooks/useVistoriasMapa.ts` para expor `origem_registro` no tipo `VistoriaMapa`.

3. Restringir a atribuição manual do mapa ao que a mutation realmente suporta
- Em `src/components/mapa/MapaVistoriasContent.tsx`, permitir drag-and-drop/manual assign apenas para itens com `origem_registro === 'servicos'`.
- Aplicar essa regra em todos os pontos:
  - lista lateral (`canAssign`)
  - botão “Atribuir” no popup
  - busca do serviço mais próximo no `dragend`
- Se o técnico for solto perto de um item não atribuível por esse fluxo, mostrar mensagem clara em vez de deixar quebrar.

4. Corrigir o log da atribuição
- Em `src/hooks/useAtribuicaoManual.ts`, antes de inserir no log, buscar o `profiles.id` do usuário autenticado via `user_id`.
- Gravar esse `profiles.id` em `atribuido_por`.
- Passar a verificar explicitamente o erro do insert em `servicos_atribuicoes_log`.

5. Fazer a rota aparecer imediatamente após atribuir
- No `onSuccess` de `useAtribuirServicoManual`, invalidar também:
  - `['vistorias-mapa']`
  - `['vistoriadores-localizacao-realtime']`
- Isso força o mapa a recarregar o serviço já atribuído e recalcular `linhasDeRota`.

6. Endurecer as leituras auxiliares para não gerar 406 desnecessário
- Trocar os `.single()` usados só para montar payload de WhatsApp por `.maybeSingle()` em `useAtribuicaoManual.ts`.
- Se algum dado não existir, seguir com fallback amigável em vez de erro de rede visível.

7. Aplicar o mesmo conserto no cancelamento
- Em `src/hooks/useDesatribuirServico.ts`, corrigir `atribuido_por` para usar `profiles.id`, evitando o mesmo conflito no log de cancelamento.

Arquivos envolvidos

- `supabase/migrations/...view_vistorias_mapa...sql`
- `src/hooks/useVistoriasMapa.ts`
- `src/components/mapa/MapaVistoriasContent.tsx`
- `src/hooks/useAtribuicaoManual.ts`
- `src/hooks/useDesatribuirServico.ts`

Resultado esperado

- Drag-and-drop deixa de disparar `409/406`.
- Só serviços realmente compatíveis com a mutation entram no fluxo manual.
- A atribuição conclui sem erro.
- A rota do técnico para o serviço aparece logo após confirmar.
- O cancelamento também deixa de falhar silenciosamente no log.

Escopo que não muda agora

- Não vou mexer no motor automático.
- Não vou redesenhar a atribuição para suportar `vistorias` e `instalacoes` legadas no mesmo fluxo; isso exigiria uma mutation/log genéricos. Para corrigir o bug atual, o ajuste certo é alinhar o mapa manual ao modelo já existente em `servicos`.
