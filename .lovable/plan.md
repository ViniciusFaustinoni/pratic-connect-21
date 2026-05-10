## Problema

O webhook do Autentique já atualiza o banco corretamente (`status='aguardando_cadastro'` + `termo_cancelamento_assinado_em`). Mas o **modal de Detalhes da Troca** continua mostrando "Cotação em andamento" / "Aguardando assinatura" porque o hook `useSolicitacaoTroca` não escuta mudanças — fica preso no cache do React Query até o usuário fechar/reabrir.

## Mudança (sem polling)

### `src/hooks/useSolicitacoesTroca.ts` — `useSolicitacaoTroca`

Adicionar **subscrição Supabase Realtime** ao registro aberto (e remover qualquer polling):

1. Em um `useEffect` dentro do hook, quando `id` está definido, criar um channel:
   - `supabase.channel('troca-' + id)`
   - `.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitacoes_troca_titularidade', filter: 'id=eq.' + id }, () => qc.invalidateQueries({ queryKey: ['solicitacao-troca', id] }))`
   - `.subscribe()`
2. No cleanup, `supabase.removeChannel(channel)`.
3. Manter `refetchOnWindowFocus: true` apenas como fallback (não é polling) para o caso raro de o canal cair.
4. **Não** adicionar `refetchInterval`.

Resultado: o webhook Autentique → UPDATE no Postgres → Realtime emite o evento → React Query invalida → modal re-renderiza com "Termo assinado" e libera o botão Aprovar, sem polling.

### Verificação prévia (1 query, sem mudanças)

Confirmar que `solicitacoes_troca_titularidade` está na publicação `supabase_realtime`. Se não estiver, criar uma migration única para adicioná-la (`alter publication supabase_realtime add table public.solicitacoes_troca_titularidade;` + `alter table … replica identity full`). Sem esse passo, a subscription não recebe eventos.

## Não escopo

- Não alterar webhook Autentique nem regras de transição de status.
- Sem polling em nenhum hook desta feature.
